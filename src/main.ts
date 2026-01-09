import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Habilita o CORS para que o Front-end consiga "falar" com este Back-end
  app.enableCors();

  // 2. Muda a porta para 3001 (para não bater na porta 3000 do Front-end)
  await app.listen(3001);

  console.log(`🚀 Back-end rodando em: http://localhost:3001`);
}
bootstrap();
