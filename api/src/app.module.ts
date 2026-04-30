import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProcessDefinitionsModule } from './process-definitions/process-definitions.module';
import { NodeDefinitionsModule } from './node-definitions/node-definitions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    ProcessDefinitionsModule,
    NodeDefinitionsModule,
  ],
})
export class AppModule {}
