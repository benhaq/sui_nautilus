import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Medical Vault API')
    .setDescription(
      'API for medical records management using Sui blockchain, Walrus storage, and Seal encryption',
    )
    .setVersion('1.0')
    .addTag('folders', 'Folder management endpoints')
    .addTag('records', 'Medical record endpoints')
    .addTag('members', 'Member management endpoints')
    .addTag('export', 'Data export endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Medical Vault Backend running on: http://localhost:${port}`);
}

bootstrap();
