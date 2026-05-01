import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: '*', credentials: true },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WsGateway.name)
  private clientUserMap = new Map<string, Set<string>>()

  @WebSocketServer()
  server: Server

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token
      if (!token) {
        client.disconnect()
        return
      }
      const payload = this.jwtService.verify(token as string)
      const userId = payload.sub
      this.registerClient(userId, client.id)
      this.logger.log(`User ${userId} connected (socket: ${client.id})`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.clientUserMap.entries()) {
      sockets.delete(client.id)
      if (sockets.size === 0) {
        this.clientUserMap.delete(userId)
      }
    }
  }

  private registerClient(userId: string, socketId: string) {
    if (!this.clientUserMap.has(userId)) {
      this.clientUserMap.set(userId, new Set())
    }
    this.clientUserMap.get(userId)!.add(socketId)
  }

  notifyUser(userId: string, event: string, data: unknown) {
    const sockets = this.clientUserMap.get(userId)
    if (!sockets) return
    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, data)
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong', { timestamp: Date.now() })
  }
}
