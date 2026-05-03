import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, SearchDto } from './dto/knowledge-base.dto'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class KnowledgeBasesService {
  private aiServiceUrl: string

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:5000'
  }

  async findAll(query: { type?: string; page: number; pageSize: number }) {
    const { type, page, pageSize } = query
    const where: Record<string, unknown> = {}
    if (type) where.type = type

    const [list, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { documents: true } } },
      }),
      this.prisma.knowledgeBase.count({ where }),
    ])

    return {
      list: list.map((kb) => ({
        id: kb.id,
        name: kb.name,
        type: kb.type,
        description: kb.description,
        documentCount: kb._count.documents,
        createdAt: kb.createdAt,
        updatedAt: kb.updatedAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async findOne(id: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: { _count: { select: { documents: true } } },
    })
    if (!kb) throw new NotFoundException('知识库不存在')
    return {
      ...kb,
      documentCount: kb._count.documents,
    }
  }

  async create(dto: CreateKnowledgeBaseDto) {
    return this.prisma.knowledgeBase.create({ data: dto })
  }

  async update(id: string, dto: UpdateKnowledgeBaseDto) {
    await this.findOne(id)
    return this.prisma.knowledgeBase.update({ where: { id }, data: dto })
  }

  async remove(id: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: { documents: { select: { id: true, filePath: true } } },
    })
    if (!kb) throw new NotFoundException('知识库不存在')

    for (const doc of kb.documents) {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath)
      }
    }

    return this.prisma.knowledgeBase.delete({ where: { id } })
  }

  async getDocuments(kbId: string, query: { page: number; pageSize: number }) {
    await this.findOne(kbId)
    const { page, pageSize } = query

    const [list, total] = await Promise.all([
      this.prisma.knowledgeBaseDocument.findMany({
        where: { knowledgeBaseId: kbId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.knowledgeBaseDocument.count({ where: { knowledgeBaseId: kbId } }),
    ])

    return {
      list: list.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileSize: Number(d.fileSize),
        mimeType: d.mimeType,
        parseStatus: d.parseStatus,
        vectorizedStatus: d.vectorizedStatus,
        chunkCount: d.chunkCount,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  async uploadDocument(kbId: string, file: { originalname: string; buffer: Buffer; size: number; mimetype: string }) {
    await this.findOne(kbId)

    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      throw new Error('文件大小超过 50MB 限制')
    }

    const uploadDir = path.resolve('uploads', 'knowledge', kbId)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const filePath = path.join(uploadDir, `${Date.now()}_${file.originalname}`)
    fs.writeFileSync(filePath, file.buffer)

    const doc = await this.prisma.knowledgeBaseDocument.create({
      data: {
        knowledgeBaseId: kbId,
        fileName: file.originalname,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        parseStatus: 'pending',
        vectorizedStatus: 'pending',
      },
    })

    this.processDocument(doc.id, filePath, file.originalname).catch(() => {})

    return doc
  }

  async retryVectorize(kbId: string, docId: string) {
    const doc = await this.prisma.knowledgeBaseDocument.findFirst({
      where: { id: docId, knowledgeBaseId: kbId },
    })
    if (!doc) throw new NotFoundException('文档不存在')

    await this.prisma.knowledgeBaseDocument.update({
      where: { id: docId },
      data: { parseStatus: 'processing', vectorizedStatus: 'pending', errorMessage: null },
    })

    await this.prisma.documentChunk.deleteMany({ where: { documentId: docId } })

    this.processDocument(doc.id, doc.filePath, doc.fileName).catch(() => {})

    return { message: '已触发重新向量化' }
  }

  async search(dto: SearchDto) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`${this.aiServiceUrl}/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: dto.query,
          knowledgeBaseIds: dto.knowledgeBaseIds || [],
          topK: dto.topK || 5,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`)
      }

      const result = await response.json()
      return result
    } catch {
      return { chunks: [] }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async processDocument(docId: string, filePath: string, fileName: string) {
    try {
      await this.prisma.knowledgeBaseDocument.update({
        where: { id: docId },
        data: { parseStatus: 'processing' },
      })

      let content: string

      const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
      if (['pdf', 'docx', 'doc'].includes(ext)) {
        // Delegate parsing to AI service which handles binary formats
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        try {
          const parseResp = await fetch(`${this.aiServiceUrl}/ai/parse-path`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath, fileName }),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          if (!parseResp.ok) {
            const errBody = await parseResp.text()
            throw new Error(`AI parse service returned ${parseResp.status}: ${errBody}`)
          }
          const parsed = await parseResp.json() as { text: string }
          content = parsed.text
        } catch (e) {
          clearTimeout(timeoutId)
          throw e
        }
      } else {
        // TXT and unknown formats: read directly
        content = fs.readFileSync(filePath, { encoding: 'utf-8' })
      }

      await this.prisma.knowledgeBaseDocument.update({
        where: { id: docId },
        data: { parseStatus: 'completed' },
      })

      await this.vectorizeDocument(docId, content)
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      await this.prisma.knowledgeBaseDocument.update({
        where: { id: docId },
        data: { parseStatus: 'failed', errorMessage: errMsg },
      })
    }
  }

  private async vectorizeDocument(docId: string, content: string) {
    try {
      await this.prisma.knowledgeBaseDocument.update({
        where: { id: docId },
        data: { vectorizedStatus: 'processing' },
      })

      const chunks = this.chunkText(content)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const response = await fetch(`${this.aiServiceUrl}/ai/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: chunks }),
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('Embedding failed')

        const { embeddings } = await response.json() as { embeddings: number[][] }

        for (let i = 0; i < chunks.length; i++) {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO document_chunks (id, document_id, chunk_index, content, embedding, created_at) VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
            crypto.randomUUID(),
            docId,
            i,
            chunks[i],
            `[${embeddings[i].join(',')}]`,
          )
        }

        await this.prisma.knowledgeBaseDocument.update({
          where: { id: docId },
          data: { vectorizedStatus: 'completed', chunkCount: chunks.length },
        })
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      await this.prisma.knowledgeBaseDocument.update({
        where: { id: docId },
        data: { vectorizedStatus: 'failed', errorMessage: errMsg },
      })
    }
  }

  private chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const sentences = text.split(/(?<=[。！？.!?\n])/)
    const chunks: string[] = []
    let current = ''

    for (const sentence of sentences) {
      if (current.length + sentence.length > chunkSize && current) {
        chunks.push(current.trim())
        current = current.slice(-overlap)
      }
      current += sentence
    }

    if (current.trim()) {
      chunks.push(current.trim())
    }

    return chunks
  }
}
