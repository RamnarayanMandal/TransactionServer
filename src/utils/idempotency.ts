import { createHash } from 'crypto';
import { query } from '../config/database';
import { PoolClient } from 'pg';

export const generateIdempotencyKeyHash = (
  method: string,
  path: string,
  key: string
): string => {
  const combined = `${method}:${path}:${key}`;
  return createHash('sha256').update(combined).digest('hex');
};

export interface IdempotencyRecord {
  response_status: number;
  response_body: unknown;
}

export const getIdempotencyRecord = async (
  keyHash: string
): Promise<IdempotencyRecord | null> => {
  const result = await query(
    `SELECT response_status, response_body 
     FROM idempotency_keys 
     WHERE key_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [keyHash]
  ) as { rows: IdempotencyRecord[] };

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

export const storeIdempotencyRecord = async (
  keyHash: string,
  method: string,
  path: string,
  status: number,
  body: unknown,
  client?: PoolClient
): Promise<void> => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

  const queryText = `
    INSERT INTO idempotency_keys (key_hash, request_method, request_path, response_status, response_body, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (key_hash) DO NOTHING
  `;

  if (client) {
    await client.query(queryText, [keyHash, method, path, status, JSON.stringify(body), expiresAt]);
  } else {
    await query(queryText, [keyHash, method, path, status, JSON.stringify(body), expiresAt]);
  }
};

