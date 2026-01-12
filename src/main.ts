import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ATENÇÃO: Essa linha libera o front-end para acessar o back-end
  app.enableCors();

  await app.listen(3001);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
