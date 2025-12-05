import { Router, Request, Response } from 'express';
import { AccountService } from '../services/accountService';
import { validateRequest, schemas } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const accountService = new AccountService();

router.post(
  '/',
  validateRequest(schemas.createAccount),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const account = await accountService.createAccount(req.body);
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw new AppError(409, 'Account already exists for this user and currency');
      }
      throw error;
    }
  }
);

router.get('/:accountId', async (req: Request, res: Response): Promise<void> => {
  const account = await accountService.getAccountById(req.params.accountId);
  if (!account) {
    throw new AppError(404, 'Account not found');
  }
  res.json(account);
});

export default router;

