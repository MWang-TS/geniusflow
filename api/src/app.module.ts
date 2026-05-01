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
import { QueueModule } from './queue/queue.module';
import { WsModule } from './ws/ws.module';

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
  ],
})
export class AppModule {}
