import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateNodeDefinitionDto } from './dto/update-node-definition.dto'

@Injectable()
export class NodeDefinitionsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const node = await this.prisma.nodeDefinition.findUnique({
      where: { id },
      include: { process: true },
    })
    if (!node) {
      throw new NotFoundException('节点定义不存在')
    }
    return node
  }

  async update(id: string, dto: UpdateNodeDefinitionDto) {
    const node = await this.findOne(id)

    if (node.process.status !== 'draft') {
      throw new ConflictException('只有草稿状态的流程节点可以编辑')
    }

    if ((dto as any).nodeType && (dto as any).nodeType !== node.nodeType) {
      throw new ConflictException('节点类型不可修改')
    }

    if (node.nodeType === 'start' || node.nodeType === 'end') {
      const { nodeName, progressConfig } = dto
      return this.prisma.nodeDefinition.update({
        where: { id },
        data: {
          ...(nodeName !== undefined ? { nodeName } : {}),
          ...(progressConfig !== undefined ? { progressConfig } : {}),
        },
      })
    }

    return this.prisma.nodeDefinition.update({
      where: { id },
      data: {
        ...(dto.nodeName !== undefined ? { nodeName: dto.nodeName } : {}),
        ...(dto.inputSpec !== undefined ? { inputSpec: dto.inputSpec as any } : {}),
        ...(dto.actionSpec !== undefined ? { actionSpec: dto.actionSpec as any } : {}),
        ...(dto.outputSpec !== undefined ? { outputSpec: dto.outputSpec as any } : {}),
        ...(dto.aiConfig !== undefined ? { aiConfig: dto.aiConfig as any } : {}),
        ...(dto.progressConfig !== undefined ? { progressConfig: dto.progressConfig as any } : {}),
      },
    })
  }
}
