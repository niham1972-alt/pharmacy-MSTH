import { BadRequestException, ValidationPipe, ValidationError } from '@nestjs/common';

function flattenErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => {
      const constraints = e.constraints ? Object.values(e.constraints).join(', ') : '';
      const nested = e.children?.length ? flattenErrors(e.children) : '';
      return [constraints, nested].filter(Boolean).join(', ');
    })
    .filter(Boolean)
    .join('; ');
}

export const globalValidationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors: ValidationError[]) =>
    new BadRequestException({
      errorCode: 'VALIDATION_FAILED',
      message: flattenErrors(errors) || 'Validation failed',
    }),
});
