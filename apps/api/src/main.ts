import 'reflect-metadata'
import { config } from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { resolve } from 'node:path'
import { AppModule } from './app.module'

async function bootstrap() {
  config({ path: resolve(__dirname, '../.env') })
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  await app.listen(Number(process.env.PORT || 3001), '127.0.0.1')
}
void bootstrap()
