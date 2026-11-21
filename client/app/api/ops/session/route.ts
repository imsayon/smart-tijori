import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Sign in with your SmartTijori account.' } }, { status: 403 });
}
