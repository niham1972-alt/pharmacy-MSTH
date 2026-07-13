import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { resolve, join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { globalValidationPipe } from './common/pipes/validation-pipe.config';

/** Critical env vars — without these the app cannot function, so fail fast with
 * a clear message rather than starting up broken. Optional vars (Redis, tuning
 * knobs) are read with sane fallbacks at their point of use and never fail here. */
function assertCriticalEnv(logger: Logger): void {
  const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    logger.error(`Missing required environment variable(s): ${missing.join(', ')}. Set them (Railway → Variables) before starting.`);
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  assertCriticalEnv(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve VPS-stored uploads as static files (fallback; Nginx serves these in
  // production). Path + public prefix mirror StorageService.
  const uploadsRoot = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
  const uploadsPrefix = (process.env.PUBLIC_UPLOADS_BASE ?? '/uploads').replace(/\/$/, '');
  app.useStaticAssets(uploadsRoot, { prefix: uploadsPrefix });

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(globalValidationPipe);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseEnvelopeInterceptor());

  // Railway assigns PORT dynamically; bind 0.0.0.0 so the container is reachable.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend listening on 0.0.0.0:${port} (CORS: ${corsOrigins.join(', ')})`);
}

bootstrap();
