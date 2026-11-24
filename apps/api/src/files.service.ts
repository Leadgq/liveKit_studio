import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'

export const MAX_FILE_SIZE = 20 * 1024 * 1024

export interface UploadedFileData {
  originalname: string
  size: number
  buffer: Buffer
}

export interface FileInfo {
  id: string
  name: string
  size: number
  extension: string
}

@Injectable()
export class FilesService {
  private readonly directory = resolve(__dirname, '../.uploads')

  private normalizeName(original: string): string {
    let name = original
    if (Array.from(name).every(character => character.charCodeAt(0) <= 255)) {
      const decoded = Buffer.from(name, 'latin1').toString('utf8')
      if (!decoded.includes('\uFFFD')) {
        name = decoded
      }
    }
    return basename(name.replace(/\\/g, '/')).replace(/[\x00-\x1F\x7F]/g, '').slice(0, 255) || '未命名文件'
  }

  private validateId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new NotFoundException('文件不存在')
    }
  }

  async upload(file?: UploadedFileData): Promise<FileInfo> {
    if (!file) {
      throw new BadRequestException('请选择文件')
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('单个文件最多支持 20MB')
    }
    await mkdir(this.directory, { recursive: true })
    const id = randomUUID()
    const name = this.normalizeName(file.originalname)
    const info: FileInfo = { id, name, size: file.size, extension: extname(name).slice(1).toLowerCase() }
    const contentPath = resolve(this.directory, id + '.bin')
    await writeFile(contentPath, file.buffer, { flag: 'wx' })
    try {
      await writeFile(resolve(this.directory, id + '.json'), JSON.stringify(info), { flag: 'wx' })
    } catch (error) {
      await unlink(contentPath).catch(() => undefined)
      throw error
    }
    return info
  }

  async getInfo(id: string): Promise<FileInfo> {
    this.validateId(id)
    try {
      const json = await readFile(resolve(this.directory, id + '.json'), 'utf8')
      return JSON.parse(json) as FileInfo
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('文件不存在或已被删除')
      }
      throw error
    }
  }

  async getContent(id: string) {
    const info = await this.getInfo(id)
    try {
      const buffer = await readFile(resolve(this.directory, id + '.bin'))
      return { info, buffer }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('文件不存在或已被删除')
      }
      throw error
    }
  }
}
