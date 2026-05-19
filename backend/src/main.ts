import 'reflect-metadata';
import {
  BadRequestException,
  Logger,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowedOrigins =
    configuredOrigins && configuredOrigins.length > 0
      ? configuredOrigins
      : ['http://localhost:3001', 'http://127.0.0.1:3001'];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const flattened = errors.map((error) => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
          children: error.children?.map((child) => ({
            property: child.property,
            value: child.value,
            constraints: child.constraints,
          })),
        }));

        logger.error(
          `[ValidationPipe] Request validation failed: ${JSON.stringify(flattened)}`,
        );

        return new BadRequestException({
          message: 'Validation failed',
          details: flattened,
        });
      },
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
