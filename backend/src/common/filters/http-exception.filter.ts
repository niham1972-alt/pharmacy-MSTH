import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';
    // Real detail for server-side logs only — never leaked to the client.
    let internalDetail = exception instanceof Error ? exception.message : String(exception);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        errorCode = (b.errorCode as string) ?? this.defaultErrorCode(status);
      }
      internalDetail = message;
    }
    // For anything that isn't a deliberate HttpException (raw Error, Prisma error,
    // etc.) we keep the generic "Internal server error" message client-side so
    // internal details (table/column names, stack info) never leak.

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status}: ${internalDetail}`, (exception as Error)?.stack);
    }

    const payload: ApiErrorResponse = {
      success: false,
      data: null,
      message,
      errorCode,
    };

    response.status(status).json(payload);
  }

  private defaultErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
