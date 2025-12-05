import { Router, Request, Response } from 'express';
import { TransactionService } from '../services/transactionService';
import { validateRequest, schemas } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const transactionService = new TransactionService();

router.post(
  '/',
  validateRequest(schemas.recordTransaction),
  async (req: Request, res: Response): Promise<void> => {
    const transaction = await transactionService.recordTransaction(req.body);
    res.status(201).json(transaction);
  }
);

router.post(
  '/transfer',
  validateRequest(schemas.transfer),
  async (req: Request, res: Response): Promise<void> => {
    const result = await transactionService.transfer(req.body);
    res.status(201).json(result);
  }
);

router.get('/:accountId/balance', async (req: Request, res: Response): Promise<void> => {
  try {
    const balance = await transactionService.getBalance(req.params.accountId);
    res.json({ account_id: req.params.accountId, balance });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new AppError(404, error.message);
    }
    throw error;
  }
});

router.get('/:accountId/history', async (req: Request, res: Response): Promise<void> => {
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  if (page < 1 || limit < 1) {
    throw new AppError(400, 'Page and limit must be positive integers');
  }

  const history = await transactionService.getTransactionHistory({
    account_id: req.params.accountId,
    page,
    limit,
  });

  res.json(history);
});

export default router;

