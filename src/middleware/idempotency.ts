import { Request, Response, NextFunction } from 'express';
import {
  generateIdempotencyKeyHash,
  getIdempotencyRecord,
  storeIdempotencyRecord,
} from '../utils/idempotency';
import { transaction } from '../config/database';

export interface IdempotentRequest extends Request {
  idempotencyKey?: string;
  idempotencyKeyHash?: string;
}

export const idempotencyMiddleware = async (
  req: IdempotentRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    // If no idempotency key, proceed normally
    return next();
  }

  const keyHash = generateIdempotencyKeyHash(
    req.method,
    req.path,
    idempotencyKey
  );

  req.idempotencyKey = idempotencyKey;
  req.idempotencyKeyHash = keyHash;

  // Check if we've seen this request before
  const existingRecord = await getIdempotencyRecord(keyHash);

  if (existingRecord) {
    // Return cached response
    res.status(existingRecord.response_status).json(existingRecord.response_body);
    return;
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json to capture response
  res.json = function (body: unknown) {
    // Store idempotency record asynchronously (don't block response)
    storeIdempotencyRecord(
      keyHash,
      req.method,
      req.path,
      res.statusCode,
      body
    ).catch((error) => {
      console.error('Failed to store idempotency record:', error);
    });

    return originalJson(body);
  };

  next();
};

