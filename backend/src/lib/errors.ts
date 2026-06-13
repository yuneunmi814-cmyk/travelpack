export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export const Errors = {
  unauthorized: (msg = '인증이 필요합니다') => new ApiError(401, 'AUTH_REQUIRED', msg),
  invalidCredentials: () => new ApiError(401, 'AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다'),
  sessionRevoked: () => new ApiError(401, 'AUTH_SESSION_REVOKED', '세션이 만료되었습니다. 다시 로그인해 주세요'),
  badRequest: (code: string, msg: string, details?: unknown) => new ApiError(400, code, msg, details),
  forbidden: (msg = '권한이 없습니다') => new ApiError(403, 'FORBIDDEN', msg),
  notFound: (what = '리소스') => new ApiError(404, 'NOT_FOUND', `${what}를 찾을 수 없습니다`),
  conflict: (code: string, msg: string, details?: unknown) => new ApiError(409, code, msg, details),
  validation: (msg: string, details?: unknown) => new ApiError(422, 'VALIDATION_ERROR', msg, details),
  rateLimited: () => new ApiError(429, 'RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요'),
  notConfigured: (what: string) => new ApiError(503, 'NOT_CONFIGURED', `${what}이(가) 설정되지 않았습니다`),
}
