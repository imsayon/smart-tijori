import { NextResponse } from 'next/server';
import { OPERATOR_COOKIE_NAME, readOperatorToken } from '@server/http/auth/operator-guard';
import { handleServerError, HttpError } from '@server/http/errors/http-errors';
import { validateMutationOrigin } from '@server/http/security/csrf';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export async function POST(request: Request) {
  try {
    validateMutationOrigin(request);
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token || !readOperatorToken(token)) throw new HttpError('FORBIDDEN', 'Invalid operator credential.', 403);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(OPERATOR_COOKIE_NAME, token, { ...cookieOptions, maxAge: 8 * 60 * 60 });
    return response;
  } catch (error) {
    return handleServerError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    validateMutationOrigin(request);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(OPERATOR_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return handleServerError(error);
  }
}
