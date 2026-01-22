import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // <--- IMPORTANTE

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefixo global da API
  app.setGlobalPrefix('api');

  // Ativa validação global (Essencial para o DTO funcionar)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove campos que não estão no DTO
      forbidNonWhitelisted: false,
      transform: true, // Transforma os dados conforme o DTO (ex: @Type)
    }),
  );

  app.enableCors();
  await app.listen(3001);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
