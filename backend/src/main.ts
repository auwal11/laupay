import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.use(helmet());
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

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`LAUPAY backend listening on port ${config.port} (${config.nodeEnv})`);
}

bootstrap();
