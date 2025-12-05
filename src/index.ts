import express, { Express } from 'express';
import dotenv from 'dotenv';
import accountsRouter from './routes/accounts';
import transactionsRouter from './routes/transactions';
import { idempotencyMiddleware } from './middleware/idempotency';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(idempotencyMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;

