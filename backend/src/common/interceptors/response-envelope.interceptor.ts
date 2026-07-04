import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../interfaces/api-response.interface';

/** Controllers return this shape to customize the envelope's message/meta. */
export interface ControllerResult<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

function isControllerResult(value: unknown): value is ControllerResult<unknown> {
  return typeof value === 'object' && value !== null && 'data' in value;
}

/**
 * Wraps every successful controller return value in the standard envelope
 * `{ success, data, message, meta }`. Controllers should return a
 * `ControllerResult<T>` (`{ data, message?, meta? }`) to customize the
 * message/meta, or just the raw payload otherwise.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(
      map((result) => {
        if (isControllerResult(result)) {
          return {
            success: true,
            data: result.data ?? null,
            message: result.message ?? 'Request successful',
            ...(result.meta ? { meta: result.meta } : {}),
          };
        }

        return {
          success: true,
          data: result ?? null,
          message: 'Request successful',
        };
      }),
    );
  }
}
