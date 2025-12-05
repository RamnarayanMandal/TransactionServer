import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        next(error);
      }
    }
  };
};

export const schemas = {
  createAccount: z.object({
    user_id: z.string().min(1),
    currency: z.enum(['USD', 'INR']),
  }),

  recordTransaction: z.object({
    account_id: z.string().uuid(),
    type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
    amount: z.number().positive(),
    description: z.string().optional(),
  }),

  transfer: z.object({
    from_account_id: z.string().uuid(),
    to_account_id: z.string().uuid(),
    amount: z.number().positive(),
    description: z.string().optional(),
  }),
};

