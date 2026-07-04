import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

const SLOW_REQUEST_THRESHOLD_MS = 500;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] ?? randomUUID();
    request.requestId = requestId;

    const start = Date.now();
    const user: AuthenticatedUser | undefined = request.user;

    return next.handle().pipe(
      tap({
        next: () => this.log(request, requestId, user, start),
        error: () => this.log(request, requestId, user, start),
      }),
    );
  }

  private log(
    request: { method: string; url: string },
    requestId: string,
    user: AuthenticatedUser | undefined,
    start: number,
  ): void {
    const duration = Date.now() - start;
    const entry = {
      requestId,
      method: request.method,
      url: request.url,
      userId: user?.userId,
      pharmacyId: user?.pharmacyId,
      branchId: user?.branchId,
      durationMs: duration,
    };

    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      this.logger.warn(`SLOW_REQUEST ${JSON.stringify(entry)}`);
    } else {
      this.logger.log(JSON.stringify(entry));
    }
  }
}
