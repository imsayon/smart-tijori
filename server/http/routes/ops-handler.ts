import { NextResponse } from 'next/server';
import { createCommerceFacts } from '../../commerce/facts';
import { createPipelineReader } from '../../events/diagnostics';
import type { Database } from '../../db/database';
import { getCommerceDatabase } from '../../db/runtime';
import type { OperatorActor } from '../auth/operator-guard';
import { requireMerchant } from '../auth/merchant';
import { handleServerError, HttpError } from '../errors/http-errors';

let opsDatabase: Database | undefined;

export function getOpsDatabase(): Database {
  if (opsDatabase) return opsDatabase;
  if (process.env.SMARTTIJORI_DEMO_MODE === 'true') {
    throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Live branch facts are unavailable in fixture mode.');
  }
  return getCommerceDatabase();
}

export function setOpsDatabase(db: Database | null): void {
  opsDatabase = db ?? undefined;
}

function resolveAuthorizedStoreId(request: Request, operator: OperatorActor): string {
  if (!operator.storeId) {
    throw new HttpError('FORBIDDEN', 'Operator session is not assigned to any store', 403);
  }

  const { searchParams } = new URL(request.url, 'http://localhost');
  const requestedStoreId = searchParams.get('storeId')?.trim();

  if (requestedStoreId && requestedStoreId !== operator.storeId) {
    throw new HttpError('FORBIDDEN', 'Operator is not authorized for this store', 403);
  }

  return requestedStoreId || operator.storeId;
}

export async function handleGetOpsInventory(request: Request): Promise<NextResponse> {
  try {
    const operator = await requireMerchant(request);
    const storeId = resolveAuthorizedStoreId(request, operator);

    const db = getOpsDatabase();
    const facts = await createCommerceFacts(db).readOpsFacts(storeId);

    return NextResponse.json(facts, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function handleGetOpsDiagnostics(request: Request): Promise<NextResponse> {
  try {
    const operator = await requireMerchant(request);
    const storeId = resolveAuthorizedStoreId(request, operator);

    const db = getOpsDatabase();
    const readPipeline = createPipelineReader(db);
    const facts = await readPipeline(storeId);

    return NextResponse.json(facts, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleServerError(error);
  }
}
