import request from 'supertest';
import app from '../../index';
import { AccountService } from '../../services/accountService';
import { TransactionService } from '../../services/transactionService';
import { query } from '../../config/database';

describe('Race Condition Tests', () => {
  let accountId: string;
  const accountService = new AccountService();
  const transactionService = new TransactionService();

  beforeAll(async () => {
    // Clean up test data
    await query('DELETE FROM transactions');
    await query('DELETE FROM accounts');
  });

  beforeEach(async () => {
    // Create a test account with initial balance
    const account = await accountService.createAccount({
      user_id: 'test_user_race',
      currency: 'USD',
    });
    accountId = account.id;

    // Add initial deposit
    await transactionService.recordTransaction({
      account_id: accountId,
      type: 'DEPOSIT',
      amount: 1000,
      description: 'Initial deposit',
    });
  });

  afterEach(async () => {
    // Clean up
    await query('DELETE FROM transactions WHERE account_id = $1', [accountId]);
    await query('DELETE FROM accounts WHERE id = $1', [accountId]);
  });

  test('should handle concurrent withdrawals correctly', async () => {
    const withdrawalAmount = 100;
    const concurrentRequests = 10;

    // Make 10 concurrent withdrawal requests
    const promises = Array.from({ length: concurrentRequests }, () =>
      request(app)
        .post('/api/transactions')
        .send({
          account_id: accountId,
          type: 'WITHDRAWAL',
          amount: withdrawalAmount,
        })
    );

    const responses = await Promise.allSettled(promises);

    // Count successful withdrawals
    const successful = responses.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 201
    ).length;

    // Count failed withdrawals (should be some due to insufficient funds)
    const failed = responses.filter(
      (r) =>
        r.status === 'fulfilled' &&
        (r.value.status === 400 || r.value.status === 409)
    ).length;

    // Verify final balance
    const finalBalance = await transactionService.getBalance(accountId);

    // With initial 1000, we can only withdraw 10 times (10 * 100 = 1000)
    // So successful should be <= 10, and final balance should be >= 0
    expect(finalBalance).toBeGreaterThanOrEqual(0);
    expect(successful + failed).toBe(concurrentRequests);
    expect(finalBalance).toBe(1000 - successful * withdrawalAmount);
  });

  test('should handle concurrent transfers correctly', async () => {
    // Create second account
    const account2 = await accountService.createAccount({
      user_id: 'test_user_race_2',
      currency: 'USD',
    });

    const transferAmount = 50;
    const concurrentRequests = 20;

    // Make 20 concurrent transfer requests
    const promises = Array.from({ length: concurrentRequests }, () =>
      request(app)
        .post('/api/transactions/transfer')
        .send({
          from_account_id: accountId,
          to_account_id: account2.id,
          amount: transferAmount,
        })
    );

    const responses = await Promise.allSettled(promises);

    // Verify balances
    const finalBalance1 = await transactionService.getBalance(accountId);
    const finalBalance2 = await transactionService.getBalance(account2.id);

    // Account 1 should not go negative
    expect(finalBalance1).toBeGreaterThanOrEqual(0);

    // Total money should be conserved (1000 initial)
    expect(finalBalance1 + finalBalance2).toBe(1000);

    // Clean up
    await query('DELETE FROM transactions WHERE account_id = $1 OR account_id = $2', [
      accountId,
      account2.id,
    ]);
    await query('DELETE FROM accounts WHERE id = $1 OR id = $2', [accountId, account2.id]);
  });

  test('should prevent double-spending with same idempotency key', async () => {
    const idempotencyKey = 'test-key-123';
    const withdrawalAmount = 200;

    // First request
    const response1 = await request(app)
      .post('/api/transactions')
      .set('idempotency-key', idempotencyKey)
      .send({
        account_id: accountId,
        type: 'WITHDRAWAL',
        amount: withdrawalAmount,
      });

    expect(response1.status).toBe(201);
    const transactionId1 = response1.body.id;

    // Duplicate request with same idempotency key
    const response2 = await request(app)
      .post('/api/transactions')
      .set('idempotency-key', idempotencyKey)
      .send({
        account_id: accountId,
        type: 'WITHDRAWAL',
        amount: withdrawalAmount,
      });

    // Should return same response
    expect(response2.status).toBe(201);
    expect(response2.body.id).toBe(transactionId1);

    // Balance should only be deducted once
    const finalBalance = await transactionService.getBalance(accountId);
    expect(finalBalance).toBe(1000 - withdrawalAmount);
  });
});

