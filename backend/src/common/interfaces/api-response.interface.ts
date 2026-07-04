export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  message: string;
  errorCode: string;
}

export interface PaginatedResult<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}
