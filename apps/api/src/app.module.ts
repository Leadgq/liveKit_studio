import { Module } from '@nestjs/common'
import { FilesController } from './files.controller'
import { FilesService } from './files.service'
import { RoomsController } from './rooms.controller'
import { RoomsService } from './rooms.service'

@Module({
  controllers: [RoomsController, FilesController],
  providers: [RoomsService, FilesService],
})
export class AppModule {}
