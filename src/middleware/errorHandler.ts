import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Handle known database errors
  if (err.message.includes('Concurrent modification')) {
    res.status(409).json({
      error: 'Concurrent modification detected. Please retry.',
    });
    return;
  }

  if (err.message.includes('Insufficient funds')) {
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  // Unknown errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
};

