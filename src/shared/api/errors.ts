/**
 * A problem returned by the API, shaped so the UI can decide what to render
 * without string-matching messages.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
    this.requestId = args.requestId;
  }

  get isUnauthenticated() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidation() {
    return this.status === 422;
  }

  /**
   * The columns the server named as clashing on a 409, so a form can put the
   * message on the input that caused it. Empty when the server did not say —
   * a conflict caught by an explicit check rather than a unique index.
   */
  get fields(): string[] {
    if (!this.details || typeof this.details !== 'object') return [];

    const { fields } = this.details as { fields?: unknown };
    return Array.isArray(fields) ? fields.filter((field) => typeof field === 'string') : [];
  }

  /** 5xx and network failures are worth retrying; 4xx are not. */
  get isRetryable() {
    return (
      this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500
    );
  }
}

export class NetworkError extends ApiError {
  constructor(cause?: unknown) {
    super({
      status: 0,
      code: 'network_error',
      message: 'Could not reach the server. Check your connection and try again.',
      details: cause,
    });
    this.name = 'NetworkError';
  }
}

export function toDisplayMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
