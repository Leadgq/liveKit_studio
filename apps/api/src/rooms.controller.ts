import { Body, Controller, Get, Header, Post } from '@nestjs/common'
import { RoomsService } from './rooms.service'

@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get('health')
  health() {
    return { status: 'ok' }
  }

  @Post('rooms/token')
  @Header('Cache-Control', 'no-store')
  createToken(@Body() body: unknown) {
    return this.rooms.createToken(body)
  }
}
