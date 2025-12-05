import { v4 as uuidv4 } from 'uuid';
import { query, transaction, getClient } from '../config/database';
import {
  Account,
  Transaction,
  RecordTransactionRequest,
  TransferRequest,
  TransactionHistoryQuery,
  PaginatedResponse,
} from '../types';
import { AccountService } from './accountService';
import { PoolClient } from 'pg';

export class TransactionService {
  private accountService: AccountService;

  constructor() {
    this.accountService = new AccountService();
  }

  async recordTransaction(
    request: RecordTransactionRequest
  ): Promise<Transaction> {
    return await transaction(async (client) => {
      // Lock the account for update
      const account = await this.accountService.getAccountWithLock(
        request.account_id,
        client
      );

      if (!account) {
        throw new Error('Account not found');
      }

      let newBalance: number;

      if (request.type === 'DEPOSIT') {
        newBalance = account.balance + request.amount;
      } else {
        // WITHDRAWAL
        newBalance = account.balance - request.amount;
        if (newBalance < 0) {
          throw new Error('Insufficient funds. Account cannot go negative.');
        }
      }

      // Update account balance with optimistic concurrency control
      await this.accountService.updateAccountBalance(
        account.id,
        newBalance,
        account.version,
        client
      );

      // Record transaction
      const transactionId = uuidv4();
      const result = await client.query(
        `INSERT INTO transactions (id, account_id, type, amount, balance_after, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, account_id, type, amount, balance_after, related_transaction_id, description, created_at`,
        [
          transactionId,
          account.id,
          request.type,
          request.amount,
          newBalance,
          request.description || null,
        ]
      );

      return this.mapTransaction(result.rows[0]);
    });
  }

  async transfer(request: TransferRequest): Promise<{
    debit_transaction: Transaction;
    credit_transaction: Transaction;
  }> {
    if (request.from_account_id === request.to_account_id) {
      throw new Error('Cannot transfer to the same account');
    }

    return await transaction(async (client) => {
      // Lock both accounts in a consistent order to prevent deadlocks
      const accountIds = [request.from_account_id, request.to_account_id].sort();
      
      const fromAccount = await client.query(
        `SELECT id, user_id, currency, balance, created_at, updated_at, version
         FROM accounts
         WHERE id = $1
         FOR UPDATE`,
        [request.from_account_id]
      );

      const toAccount = await client.query(
        `SELECT id, user_id, currency, balance, created_at, updated_at, version
         FROM accounts
         WHERE id = $1
         FOR UPDATE`,
        [request.to_account_id]
      );

      if (fromAccount.rows.length === 0) {
        throw new Error('From account not found');
      }

      if (toAccount.rows.length === 0) {
        throw new Error('To account not found');
      }

      const from = this.mapAccount(fromAccount.rows[0]);
      const to = this.mapAccount(toAccount.rows[0]);

      // Check currency match
      if (from.currency !== to.currency) {
        throw new Error('Cannot transfer between different currencies');
      }

      // Check sufficient balance
      const newFromBalance = from.balance - request.amount;
      if (newFromBalance < 0) {
        throw new Error('Insufficient funds. Account cannot go negative.');
      }

      const newToBalance = to.balance + request.amount;

      // Update both accounts atomically
      await this.accountService.updateAccountBalance(
        from.id,
        newFromBalance,
        from.version,
        client
      );

      await this.accountService.updateAccountBalance(
        to.id,
        newToBalance,
        to.version,
        client
      );

      // Create linked transactions (double-entry bookkeeping)
      const debitId = uuidv4();
      const creditId = uuidv4();

      // Debit transaction
      await client.query(
        `INSERT INTO transactions (id, account_id, type, amount, balance_after, related_transaction_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          debitId,
          from.id,
          'TRANSFER_DEBIT',
          request.amount,
          newFromBalance,
          creditId,
          request.description || `Transfer to ${to.user_id}`,
        ]
      );

      // Credit transaction
      await client.query(
        `INSERT INTO transactions (id, account_id, type, amount, balance_after, related_transaction_id, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          creditId,
          to.id,
          'TRANSFER_CREDIT',
          request.amount,
          newToBalance,
          debitId,
          request.description || `Transfer from ${from.user_id}`,
        ]
      );

      // Fetch the created transactions
      const debitResult = await client.query(
        `SELECT id, account_id, type, amount, balance_after, related_transaction_id, description, created_at
         FROM transactions
         WHERE id = $1`,
        [debitId]
      );

      const creditResult = await client.query(
        `SELECT id, account_id, type, amount, balance_after, related_transaction_id, description, created_at
         FROM transactions
         WHERE id = $1`,
        [creditId]
      );

      return {
        debit_transaction: this.mapTransaction(debitResult.rows[0]),
        credit_transaction: this.mapTransaction(creditResult.rows[0]),
      };
    });
  }

  async getBalance(accountId: string): Promise<number> {
    const account = await this.accountService.getAccountById(accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    return account.balance;
  }

  async getTransactionHistory(
    queryParams: TransactionHistoryQuery
  ): Promise<PaginatedResponse<Transaction>> {
    const page = queryParams.page || 1;
    const limit = Math.min(queryParams.limit || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM transactions
       WHERE account_id = $1`,
      [queryParams.account_id]
    ) as { rows: [{ total: string }] };

    const total = parseInt(countResult.rows[0].total, 10);

    // Get transactions
    const result = await query(
      `SELECT id, account_id, type, amount, balance_after, related_transaction_id, description, created_at
       FROM transactions
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [queryParams.account_id, limit, offset]
    ) as { rows: Transaction[] };

    return {
      data: result.rows.map((row) => this.mapTransaction(row)),
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  private mapTransaction(row: Transaction): Transaction {
    return {
      id: row.id,
      account_id: row.account_id,
      type: row.type,
      amount: parseFloat(row.amount.toString()),
      balance_after: parseFloat(row.balance_after.toString()),
      related_transaction_id: row.related_transaction_id,
      description: row.description,
      created_at: row.created_at,
    };
  }

  private mapAccount(row: Account): Account {
    return {
      id: row.id,
      user_id: row.user_id,
      currency: row.currency,
      balance: parseFloat(row.balance.toString()),
      created_at: row.created_at,
      updated_at: row.updated_at,
      version: row.version,
    };
  }
}

