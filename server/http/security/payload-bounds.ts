import { HttpError } from '../errors/http-errors';

export const DEFAULT_MAX_BODY_BYTES = 64 * 1024; // 64 KB

/**
 * Reads and bounds request body size to guard against Denial of Service / JSON bombs.
 */
export async function parseBoundedJson<T = unknown>(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): Promise<T> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new HttpError(
      'VALIDATION_ERROR',
      `Request body exceeds maximum allowed size of ${maxBytes} bytes`,
      400
    );
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new HttpError('VALIDATION_ERROR', 'Failed to read request body', 400);
  }

  if (!text || text.trim() === '') {
    return {} as T;
  }

  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new HttpError(
      'VALIDATION_ERROR',
      `Request body exceeds maximum allowed size of ${maxBytes} bytes`,
      400
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError('VALIDATION_ERROR', 'Malformed JSON in request body', 400);
  }
}
