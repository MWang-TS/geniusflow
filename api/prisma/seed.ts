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
    await prisma.userRole.upsert({
      where: {
        userId_roleId_scopeType_scopeId: {
          userId: admin.id,
          roleId: adminRole.id,
          scopeType: 'global',
          scopeId: null,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: adminRole.id,
        scopeType: 'global',
      },
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
