import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(AppConfigService);

  // Paystack signs the exact bytes received over HTTP. Capture them before
  // JSON parsing; re-serialising req.body can change whitespace/key order.
  app.use(bodyParser.json({
    verify: (req, _res, buffer) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));

  app.use(helmet());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  app.enableCors({ origin: config.adminWebOrigin, credentials: true });

  // Strips/rejects any field not explicitly declared on a DTO — this is
  // what prevents a client from smuggling in fields like `balance` or
  // `status` on a request body. See docs/security/security-model.md §3.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Lightweight health endpoint for Railway's health check. Registered as
  // Express middleware before the Nest router so it answers on the root path
  // (which the /api global prefix would otherwise 404) as well as /health and
  // /api/health. Without a 200 here, Railway's health check fails, it restarts
  // the container, and clients see a 502.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' || req.path === '/health' || req.path === '/api/health') {
      res.status(200).json({ status: 'ok' });
      return;
    }
    next();
  });

  await app.listen(config.port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`LAUPAY backend listening on http://0.0.0.0:${config.port} (${config.nodeEnv})`);
}

bootstrap();
