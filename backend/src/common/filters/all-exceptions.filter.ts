import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { InsufficientBalanceError, WalletNotActiveError, InvalidAmountError } from '../../modules/ledger/ledger.errors';

/**
 * Maps internal errors to safe, generic client-facing messages in
 * production. Full detail (stack trace, request context) is logged
 * server-side only — never returned in the API response when
 * NODE_ENV=production. See docs/security/security-model.md §7.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : (body as any).message ?? exception.message;
    } else if (exception instanceof InsufficientBalanceError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      message = 'Insufficient wallet balance';
    } else if (exception instanceof WalletNotActiveError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      message = 'Wallet is not active';
    } else if (exception instanceof InvalidAmountError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid amount';
    }

    this.logger.error(
      `${request.method} ${request.url} -> ${status}: ${
        exception instanceof Error ? exception.stack : String(exception)
      }`,
    );

    response.status(status).json({
      statusCode: status,
      message,
      // Full error detail only ever included outside production, and even
      // then only in the log above, not by default in the body.
      ...(this.config.isProduction ? {} : { debug: String(exception) }),
    });
  }
}
