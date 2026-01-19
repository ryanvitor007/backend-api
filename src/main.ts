import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- CORREÇÃO: Adicionar prefixo global /api ---
  app.setGlobalPrefix('api');

  app.enableCors(); // Permite requisições do Frontend
  await app.listen(3001);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
