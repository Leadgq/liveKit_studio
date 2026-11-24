import { Controller, Get, Header, Param, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { FilesService, MAX_FILE_SIZE, type UploadedFileData } from './files.service'

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE, files: 1 } }))
  upload(@UploadedFile() file?: UploadedFileData) {
    return this.files.upload(file)
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  getInfo(@Param('id') id: string) {
    return this.files.getInfo(id)
  }

  @Get(':id/content')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async download(@Param('id') id: string) {
    const { info, buffer } = await this.files.getContent(id)
    const encodedName = encodeURIComponent(info.name).replace(/['()*]/g, character => {
      return '%' + character.charCodeAt(0).toString(16).toUpperCase()
    })
    return new StreamableFile(buffer, {
      type: 'application/octet-stream',
      disposition: "attachment; filename*=UTF-8''" + encodedName,
      length: buffer.length,
    })
  }
}
