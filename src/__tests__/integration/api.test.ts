import request from 'supertest';
import app from '../../index';
import { AccountService } from '../../services/accountService';
import { TransactionService } from '../../services/transactionService';
import { query } from '../../config/database';

describe('API Integration Tests', () => {
  const accountService = new AccountService();
  const transactionService = new TransactionService();

  beforeAll(async () => {
    // Clean up test data
    await query('DELETE FROM transactions');
    await query('DELETE FROM accounts');
  });

  afterAll(async () => {
    // Clean up
    await query('DELETE FROM transactions');
    await query('DELETE FROM accounts');
  });

  describe('Account Management', () => {
    test('POST /api/accounts - should create an account', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .send({
          user_id: 'user1',
          currency: 'USD',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.user_id).toBe('user1');
      expect(response.body.currency).toBe('USD');
      expect(response.body.balance).toBe(0);
    });

    test('GET /api/accounts/:accountId - should get account details', async () => {
      const account = await accountService.createAccount({
        user_id: 'user2',
        currency: 'USD',
      });

      const response = await request(app).get(`/api/accounts/${account.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(account.id);
      expect(response.body.user_id).toBe('user2');
    });
  });

  describe('Transactions', () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await accountService.createAccount({
        user_id: 'user3',
        currency: 'USD',
      });
      accountId = account.id;
    });

    test('POST /api/transactions - should record a deposit', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          account_id: accountId,
          type: 'DEPOSIT',
          amount: 500,
          description: 'Test deposit',
        });

      expect(response.status).toBe(201);
      expect(response.body.type).toBe('DEPOSIT');
      expect(response.body.amount).toBe(500);
      expect(response.body.balance_after).toBe(500);
    });

    test('POST /api/transactions - should record a withdrawal', async () => {
      // First deposit
      await transactionService.recordTransaction({
        account_id: accountId,
        type: 'DEPOSIT',
        amount: 500,
      });

      const response = await request(app)
        .post('/api/transactions')
        .send({
          account_id: accountId,
          type: 'WITHDRAWAL',
          amount: 200,
        });

      expect(response.status).toBe(201);
      expect(response.body.type).toBe('WITHDRAWAL');
      expect(response.body.balance_after).toBe(300);
    });

    test('POST /api/transactions - should reject withdrawal that would cause negative balance', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          account_id: accountId,
          type: 'WITHDRAWAL',
          amount: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient funds');
    });

    test('GET /api/transactions/:accountId/balance - should get account balance', async () => {
      await transactionService.recordTransaction({
        account_id: accountId,
        type: 'DEPOSIT',
        amount: 750,
      });

      const response = await request(app).get(
        `/api/transactions/${accountId}/balance`
      );

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe(750);
    });

    test('GET /api/transactions/:accountId/history - should get transaction history', async () => {
      // Create multiple transactions
      await transactionService.recordTransaction({
        account_id: accountId,
        type: 'DEPOSIT',
        amount: 100,
      });
      await transactionService.recordTransaction({
        account_id: accountId,
        type: 'DEPOSIT',
        amount: 200,
      });

      const response = await request(app).get(
        `/api/transactions/${accountId}/history?page=1&limit=10`
      );

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
    });
  });

  describe('Transfers', () => {
    let account1Id: string;
    let account2Id: string;

    beforeEach(async () => {
      const account1 = await accountService.createAccount({
        user_id: 'user4',
        currency: 'USD',
      });
      const account2 = await accountService.createAccount({
        user_id: 'user5',
        currency: 'USD',
      });
      account1Id = account1.id;
      account2Id = account2.id;

      // Fund account1
      await transactionService.recordTransaction({
        account_id: account1Id,
        type: 'DEPOSIT',
        amount: 1000,
      });
    });

    test('POST /api/transactions/transfer - should transfer funds between accounts', async () => {
      const response = await request(app)
        .post('/api/transactions/transfer')
        .send({
          from_account_id: account1Id,
          to_account_id: account2Id,
          amount: 300,
          description: 'Test transfer',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('debit_transaction');
      expect(response.body).toHaveProperty('credit_transaction');
      expect(response.body.debit_transaction.type).toBe('TRANSFER_DEBIT');
      expect(response.body.credit_transaction.type).toBe('TRANSFER_CREDIT');

      // Verify balances
      const balance1 = await transactionService.getBalance(account1Id);
      const balance2 = await transactionService.getBalance(account2Id);

      expect(balance1).toBe(700);
      expect(balance2).toBe(300);
    });

    test('POST /api/transactions/transfer - should reject transfer that would cause negative balance', async () => {
      const response = await request(app)
        .post('/api/transactions/transfer')
        .send({
          from_account_id: account1Id,
          to_account_id: account2Id,
          amount: 1500,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient funds');
    });

    test('POST /api/transactions/transfer - should reject transfer between different currencies', async () => {
      const inrAccount = await accountService.createAccount({
        user_id: 'user6',
        currency: 'INR',
      });

      const response = await request(app)
        .post('/api/transactions/transfer')
        .send({
          from_account_id: account1Id,
          to_account_id: inrAccount.id,
          amount: 100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('different currencies');
    });
  });
});

