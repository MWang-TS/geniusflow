import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 创建默认角色
  const roles = [
    { name: 'designer', description: '流程设计者', permissions: ['process:create', 'process:edit', 'process:publish', 'template:use'] },
    { name: 'employee', description: '执行员工', permissions: ['task:execute', 'task:submit', 'instance:view:self'] },
    { name: 'manager', description: '管理者', permissions: ['task:approve', 'instance:view:all', 'report:view', 'dashboard:view'] },
    { name: 'admin', description: '系统管理员', permissions: ['*'] },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // 创建默认管理员
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@geniusflow.com' },
    update: {},
    create: {
      name: '系统管理员',
      email: 'admin@geniusflow.com',
      passwordHash: adminPassword,
    },
  });

  // 分配管理员角色
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  if (adminRole) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: admin.id, roleId: adminRole.id, scopeType: 'global', scopeId: null },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: admin.id, roleId: adminRole.id, scopeType: 'global' },
      });
    }
  }

  console.log('Seed completed')

  // 创建预设模板
  const templateData = [
    {
      name: '咨询项目标准流程',
      description: '适用于IT咨询项目的标准交付流程，包含需求调研、方案设计、交付验收三个阶段',
      category: '咨询',
      nodes: [
        { id: 'tpl-start', type: 'start', nodeName: '开始', sortOrder: 0, position: { x: 250, y: 50 }, data: { label: '开始' } },
        { id: 'tpl-1', type: 'task', nodeName: '需求调研', sortOrder: 1, position: { x: 250, y: 170 }, data: { label: '需求调研' } },
        { id: 'tpl-2', type: 'task', nodeName: '方案设计', sortOrder: 2, position: { x: 250, y: 290 }, data: { label: '方案设计' } },
        { id: 'tpl-3', type: 'task', nodeName: '交付验收', sortOrder: 3, position: { x: 250, y: 410 }, data: { label: '交付验收' } },
        { id: 'tpl-end', type: 'end', nodeName: '结束', sortOrder: 4, position: { x: 250, y: 530 }, data: { label: '结束' } },
      ],
      edges: [
        { id: 'tpl-e1', source: 'tpl-start', target: 'tpl-1' },
        { id: 'tpl-e2', source: 'tpl-1', target: 'tpl-2' },
        { id: 'tpl-e3', source: 'tpl-2', target: 'tpl-3' },
        { id: 'tpl-e4', source: 'tpl-3', target: 'tpl-end' },
      ],
    },
    {
      name: '软件开发流程',
      description: '标准软件开发流程，涵盖需求分析、开发、测试、上线各环节',
      category: '研发',
      nodes: [
        { id: 'tpl2-start', type: 'start', nodeName: '开始', sortOrder: 0, position: { x: 250, y: 50 }, data: { label: '开始' } },
        { id: 'tpl2-1', type: 'task', nodeName: '需求分析', sortOrder: 1, position: { x: 250, y: 170 }, data: { label: '需求分析' } },
        { id: 'tpl2-2', type: 'task', nodeName: '技术设计', sortOrder: 2, position: { x: 250, y: 290 }, data: { label: '技术设计' } },
        { id: 'tpl2-3', type: 'task', nodeName: '编码开发', sortOrder: 3, position: { x: 250, y: 410 }, data: { label: '编码开发' } },
        { id: 'tpl2-4', type: 'task', nodeName: '测试验证', sortOrder: 4, position: { x: 250, y: 530 }, data: { label: '测试验证' } },
        { id: 'tpl2-5', type: 'task', nodeName: '上线部署', sortOrder: 5, position: { x: 250, y: 650 }, data: { label: '上线部署' } },
        { id: 'tpl2-end', type: 'end', nodeName: '结束', sortOrder: 6, position: { x: 250, y: 770 }, data: { label: '结束' } },
      ],
      edges: [
        { id: 'tpl2-e1', source: 'tpl2-start', target: 'tpl2-1' },
        { id: 'tpl2-e2', source: 'tpl2-1', target: 'tpl2-2' },
        { id: 'tpl2-e3', source: 'tpl2-2', target: 'tpl2-3' },
        { id: 'tpl2-e4', source: 'tpl2-3', target: 'tpl2-4' },
        { id: 'tpl2-e5', source: 'tpl2-4', target: 'tpl2-5' },
        { id: 'tpl2-e6', source: 'tpl2-5', target: 'tpl2-end' },
      ],
    },
    {
      name: '合同审批流程',
      description: '企业合同审批流程，包含起草、法务审核、财务审核、最终签批',
      category: '行政',
      nodes: [
        { id: 'tpl3-start', type: 'start', nodeName: '开始', sortOrder: 0, position: { x: 250, y: 50 }, data: { label: '开始' } },
        { id: 'tpl3-1', type: 'task', nodeName: '合同起草', sortOrder: 1, position: { x: 250, y: 170 }, data: { label: '合同起草' } },
        { id: 'tpl3-2', type: 'task', nodeName: '法务审核', sortOrder: 2, position: { x: 250, y: 290 }, data: { label: '法务审核' } },
        { id: 'tpl3-3', type: 'task', nodeName: '财务审核', sortOrder: 3, position: { x: 250, y: 410 }, data: { label: '财务审核' } },
        { id: 'tpl3-4', type: 'task', nodeName: '领导签批', sortOrder: 4, position: { x: 250, y: 530 }, data: { label: '领导签批' } },
        { id: 'tpl3-end', type: 'end', nodeName: '结束', sortOrder: 5, position: { x: 250, y: 650 }, data: { label: '结束' } },
      ],
      edges: [
        { id: 'tpl3-e1', source: 'tpl3-start', target: 'tpl3-1' },
        { id: 'tpl3-e2', source: 'tpl3-1', target: 'tpl3-2' },
        { id: 'tpl3-e3', source: 'tpl3-2', target: 'tpl3-3' },
        { id: 'tpl3-e4', source: 'tpl3-3', target: 'tpl3-4' },
        { id: 'tpl3-e5', source: 'tpl3-4', target: 'tpl3-end' },
      ],
    },
  ]

  const defaultInputSpec = { dataSchema: [], acceptanceCriteria: '', source: 'manual', timeConstraint: { daysFromStart: 1 } }
  const defaultActionSpec = { instructions: '请填写', requirements: '', aiAssistance: [], timeConstraint: { estimatedDays: 1 } }
  const defaultOutputSpec = { deliverables: [], qualityStandard: '', acceptanceCondition: '', timeConstraint: { daysFromStart: 2 } }
  const defaultAiConfig = { inspector: { enabled: false, mode: 'normal', promptTemplate: '' }, assistant: { enabled: false, promptTemplate: '' } }
  const defaultProgressConfig = { plannedDuration: 2, isMilestone: false, needApproval: true, requireAiReportBeforeApproval: false }

  for (const tpl of templateData) {
    const existing = await prisma.processDefinition.findFirst({
      where: { name: tpl.name, isTemplate: true },
    })
    if (existing) continue

    const def = await prisma.processDefinition.create({
      data: {
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        isTemplate: true,
        isPreset: true,
        status: 'published',
        version: 1,
        graphJson: { nodes: tpl.nodes, edges: tpl.edges },
      },
    })

    for (const node of tpl.nodes) {
      const isStartOrEnd = node.type === 'start' || node.type === 'end'
      await prisma.nodeDefinition.create({
        data: {
          id: node.id,
          processId: def.id,
          nodeName: node.nodeName,
          nodeType: node.type,
          sortOrder: node.sortOrder,
          inputSpec: isStartOrEnd ? {} : defaultInputSpec,
          actionSpec: isStartOrEnd ? {} : defaultActionSpec,
          outputSpec: isStartOrEnd ? {} : defaultOutputSpec,
          aiConfig: isStartOrEnd ? { inspector: { enabled: false }, assistant: { enabled: false } } : defaultAiConfig,
          progressConfig: isStartOrEnd ? { plannedDuration: 0, isMilestone: false, needApproval: false, requireAiReportBeforeApproval: false } : defaultProgressConfig,
        },
      })
    }
  }

  console.log('Seed templates completed')
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
