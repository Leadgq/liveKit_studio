import { BadRequestException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { AccessToken } from 'livekit-server-sdk'

@Injectable()
export class RoomsService {
  private readonly serverUrl: string
  private readonly apiKey: string
  private readonly apiSecret: string

  constructor() {
    this.serverUrl = this.readEnvironment('LIVEKIT_URL')
    this.apiKey = this.readEnvironment('LIVEKIT_API_KEY')
    this.apiSecret = this.readEnvironment('LIVEKIT_API_SECRET')
  }

  private readEnvironment(name: string): string {
    const value = process.env[name]?.trim()
    if (!value) {
      throw new Error('缺少环境变量 ' + name)
    }
    return value
  }

  private readText(value: unknown, label: string, limit: number): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) {
      throw new BadRequestException(label + '必填，最多 ' + limit + ' 个字符')
    }
    return value.trim()
  }

  async createToken(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('请求内容格式错误')
    }
    const input = body as Record<string, unknown>
    const roomName = this.readText(input.roomName, '房间名称', 64)
    const displayName = this.readText(input.displayName, '显示名称', 32)
    if (!/^[a-zA-Z0-9_-]+$/.test(roomName)) {
      throw new BadRequestException('房间名称仅支持英文、数字、下划线和短横线')
    }

    // 学习版允许访客加入任意房间，正式业务在这里校验登录和房间权限。
    const identity = randomUUID()
    const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name: displayName,
      ttl: '1h',
    })
    accessToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    const token = await accessToken.toJwt()
    return { token, serverUrl: this.serverUrl, roomName, identity }
  }
}
