import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import * as fs from 'fs'
import * as path from 'path'

type MulterFile = { originalname: string; buffer: Buffer; size: number; mimetype: string }

async function postJson(url: string, body: unknown): Promise<unknown> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>
    throw new Error((err.detail as string) || `HTTP ${resp.status}`)
  }
  return resp.json()
}

@Injectable()
export class WikiService {
  private aiServiceUrl: string
  private uploadDir: string

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:5000'
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || '/uploads'
  }

  // -----------------------------------------------------------------------
  // Sources
  // -----------------------------------------------------------------------

  async getSources(kbId: string, opts: { page: number; pageSize: number }) {
    const skip = (opts.page - 1) * opts.pageSize
    const [list, total] = await Promise.all([
      this.prisma.wikiRawSource.findMany({
        where: { knowledgeBaseId: kbId },
        skip,
        take: opts.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.wikiRawSource.count({ where: { knowledgeBaseId: kbId } }),
    ])
    return { list, pagination: { page: opts.page, pageSize: opts.pageSize, total } }
  }

  async uploadSource(kbId: string, file: MulterFile) {
    if (!file) throw new BadRequestException('No file provided')
    await this._ensureKb(kbId)

    const destDir = path.join(this.uploadDir, 'wiki', kbId)
    fs.mkdirSync(destDir, { recursive: true })
    const destPath = path.join(destDir, `${Date.now()}_${file.originalname}`)
    fs.writeFileSync(destPath, file.buffer)

    const source = await this.prisma.wikiRawSource.create({
      data: {
        knowledgeBaseId: kbId,
        fileName: file.originalname,
        filePath: destPath,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
        conversionStatus: 'pending',
        ingestStatus: 'pending',
      },
    })
    return source
  }

  async deleteSource(kbId: string, sourceId: string) {
    const src = await this.prisma.wikiRawSource.findFirst({
      where: { id: sourceId, knowledgeBaseId: kbId },
    })
    if (!src) throw new NotFoundException('Source not found')
    if (src.filePath) {
      try { fs.unlinkSync(src.filePath) } catch { /* ignore */ }
    }
    await this.prisma.wikiRawSource.delete({ where: { id: sourceId } })
    return { success: true }
  }

  async convertSource(kbId: string, sourceId: string) {
    const src = await this._getSource(kbId, sourceId)
    if (!src.filePath) throw new BadRequestException('Source has no file path')

    await this.prisma.wikiRawSource.update({
      where: { id: sourceId },
      data: { conversionStatus: 'processing', errorMessage: null },
    })

    try {
      // Get MinerU API key from system config
      const mineruKey = await this._getMineruKey()

      const fileBytes = fs.readFileSync(src.filePath)
      const b64 = fileBytes.toString('base64')

      const respData = await postJson(`${this.aiServiceUrl}/wiki/convert`, {
        file_bytes_b64: b64,
        filename: src.fileName,
        mineru_api_key: mineruKey,
      }) as { markdown: string; converter_mode: string }

      const { markdown, converter_mode } = respData

      await this.prisma.wikiRawSource.update({
        where: { id: sourceId },
        data: {
          markdownContent: markdown,
          converterMode: converter_mode,
          conversionStatus: 'done',
        },
      })
      return { success: true, converter_mode, length: markdown.length }
    } catch (err) {
      const msg = (err as Error).message
      await this.prisma.wikiRawSource.update({
        where: { id: sourceId },
        data: { conversionStatus: 'failed', errorMessage: msg },
      })
      throw new BadRequestException(`Conversion failed: ${msg}`)
    }
  }

  async ingestSource(kbId: string, sourceId: string) {
    const src = await this._getSource(kbId, sourceId)
    if (src.conversionStatus !== 'done' || !src.markdownContent) {
      throw new BadRequestException('Source must be converted first')
    }

    await this.prisma.wikiRawSource.update({
      where: { id: sourceId },
      data: { ingestStatus: 'processing', errorMessage: null },
    })

    try {
      const respData = await postJson(`${this.aiServiceUrl}/wiki/ingest`, {
        kb_id: kbId,
        source_id: sourceId,
        markdown_content: src.markdownContent,
        filename: src.fileName,
      })

      await this.prisma.wikiRawSource.update({
        where: { id: sourceId },
        data: { ingestStatus: 'done' },
      })
      return respData
    } catch (err) {
      const msg = (err as Error).message
      await this.prisma.wikiRawSource.update({
        where: { id: sourceId },
        data: { ingestStatus: 'failed', errorMessage: msg },
      })
      throw new BadRequestException(`Ingest failed: ${msg}`)
    }
  }

  async processSource(kbId: string, sourceId: string) {
    await this.convertSource(kbId, sourceId)
    return this.ingestSource(kbId, sourceId)
  }

  // -----------------------------------------------------------------------
  // Pages
  // -----------------------------------------------------------------------

  async getPages(
    kbId: string,
    opts: { page: number; pageSize: number; pageType?: string },
  ) {
    const where: Record<string, unknown> = { knowledgeBaseId: kbId }
    if (opts.pageType) where.pageType = opts.pageType

    const skip = (opts.page - 1) * opts.pageSize
    const [list, total] = await Promise.all([
      this.prisma.wikiPage.findMany({
        where,
        skip,
        take: opts.pageSize,
        orderBy: [{ pageType: 'asc' }, { title: 'asc' }],
        select: {
          id: true, slug: true, title: true, pageType: true,
          tags: true, sourceFile: true, createdAt: true, updatedAt: true,
        },
      }),
      this.prisma.wikiPage.count({ where }),
    ])
    return { list, pagination: { page: opts.page, pageSize: opts.pageSize, total } }
  }

  async getPage(kbId: string, slug: string) {
    const page = await this.prisma.wikiPage.findUnique({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: kbId, slug } },
    })
    if (!page) throw new NotFoundException('Wiki page not found')
    return page
  }

  async updatePage(kbId: string, slug: string, data: { title?: string; content?: string; tags?: string[] }) {
    const page = await this.prisma.wikiPage.findUnique({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: kbId, slug } },
    })
    if (!page) throw new NotFoundException('Wiki page not found')
    return this.prisma.wikiPage.update({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: kbId, slug } },
      data,
    })
  }

  async deletePage(kbId: string, slug: string) {
    const page = await this.prisma.wikiPage.findUnique({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: kbId, slug } },
    })
    if (!page) throw new NotFoundException('Wiki page not found')
    await this.prisma.wikiPage.delete({
      where: { knowledgeBaseId_slug: { knowledgeBaseId: kbId, slug } },
    })
    return { success: true }
  }

  // -----------------------------------------------------------------------
  // Query / Lint
  // -----------------------------------------------------------------------

  async query(kbId: string, question: string, maxPages = 5) {
    return postJson(`${this.aiServiceUrl}/wiki/query`, {
      kb_id: kbId,
      question,
      max_pages: maxPages,
    })
  }

  async lint(kbId: string) {
    return postJson(`${this.aiServiceUrl}/wiki/lint`, { kb_id: kbId })
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async _ensureKb(kbId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } })
    if (!kb) throw new NotFoundException('Knowledge base not found')
    if (kb.type !== 'wiki') throw new BadRequestException('Knowledge base is not of type wiki')
    return kb
  }

  private async _getSource(kbId: string, sourceId: string) {
    const src = await this.prisma.wikiRawSource.findFirst({
      where: { id: sourceId, knowledgeBaseId: kbId },
    })
    if (!src) throw new NotFoundException('Source not found')
    return src
  }

  private async _getMineruKey(): Promise<string> {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'mineru_api_key' } })
    return cfg?.value || ''
  }
}
