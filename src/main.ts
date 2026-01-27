import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // ATIVA A VALIDAÇÃO GLOBAL
  // Transform: true converte os tipos automaticamente
  // Whitelist: true remove campos perigosos que não estão no DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.enableCors();
  await app.listen(3001);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
