import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProcessDefinitionsModule } from './process-definitions/process-definitions.module';
import { NodeDefinitionsModule } from './node-definitions/node-definitions.module';
import { ProcessInstancesModule } from './process-instances/process-instances.module';
import { NodeInstancesModule } from './node-instances/node-instances.module';
import { TasksModule } from './tasks/tasks.module';
import { KnowledgeBasesModule } from './knowledge-bases/knowledge-bases.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TemplatesModule } from './templates/templates.module';
import { RolesModule } from './roles/roles.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AiReportsModule } from './ai-reports/ai-reports.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { QueueModule } from './queue/queue.module';
import { WsModule } from './ws/ws.module';

import { AiSettingsModule } from './ai-settings/ai-settings.module'
import { AiAssistantModule } from './ai-assistant/ai-assistant.module'
import { SkillChatModule } from './skill-chat/skill-chat.module'
import { OpenApiModule } from './open-api/open-api.module'
import { WikiModule } from './wiki/wiki.module'
import { SopGeneratorModule } from './sop-generator/sop-generator.module'
import { TaskDefinitionsModule } from './task-definitions/task-definitions.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    QueueModule,
    WsModule,
    AuthModule,
    UsersModule,
    HealthModule,
    ProcessDefinitionsModule,
    NodeDefinitionsModule,
    ProcessInstancesModule,
    NodeInstancesModule,
    TasksModule,
    KnowledgeBasesModule,
    NotificationsModule,
    TemplatesModule,
    RolesModule,
    AuditLogModule,
    AiReportsModule,
    SchedulerModule,
    AiSettingsModule,
    AiAssistantModule,
    SkillChatModule,
    OpenApiModule,
    WikiModule,
    SopGeneratorModule,
    TaskDefinitionsModule,
  ],
})
export class AppModule {}
