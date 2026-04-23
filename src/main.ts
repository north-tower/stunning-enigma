import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigin = 'http://localhost:8081';
  app.enableCors({
    origin: allowedOrigin,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-webhook-secret'],
  });

  // Explicit CORS headers to guarantee browser preflight compatibility.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
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
