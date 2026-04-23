import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configuredOrigins =
    process.env.FRONTEND_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  const allowedOrigins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : ['http://localhost:8081'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-webhook-secret'],
  });

  // Explicit CORS headers to guarantee browser preflight compatibility.
  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (
      typeof requestOrigin === 'string' &&
      allowedOrigins.includes(requestOrigin)
    ) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
    } else if (allowedOrigins.length > 0) {
      res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,x-api-key,x-webhook-secret');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });
  const port = Number(process.env.PORT ?? 5601);
  await app.listen(port);
}
bootstrap();
