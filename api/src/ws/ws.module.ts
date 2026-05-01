import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { WsGateway } from './ws.gateway'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'geniusflow-jwt-secret',
    }),
  ],
  providers: [WsGateway],
  exports: [WsGateway],
})
export class WsModule {}
