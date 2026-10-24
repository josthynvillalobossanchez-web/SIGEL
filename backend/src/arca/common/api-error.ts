/** Error de negocio o de acceso con código estable para el frontend (se serializa como problem+json). */
export class ApiError extends Error {
  readonly extras: Record<string, unknown> = {};

  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
  ) {
    super(detail);
  }

  with(key: string, value: unknown): this {
    this.extras[key] = value;
    return this;
  }

  static badRequest(code: string, detail: string) {
    return new ApiError(400, code, detail);
  }
  static unauthorized(code: string, detail: string) {
    return new ApiError(401, code, detail);
  }
  static forbidden(code: string, detail: string) {
    return new ApiError(403, code, detail);
  }
  static notFound(detail: string) {
    return new ApiError(404, 'NOT_FOUND', detail);
  }
  static conflict(code: string, detail: string) {
    return new ApiError(409, code, detail);
  }
  static unprocessable(code: string, detail: string) {
    return new ApiError(422, code, detail);
  }
}
