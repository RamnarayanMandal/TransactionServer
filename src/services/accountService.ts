import { query, transaction, getClient } from '../config/database';
import { Account, CreateAccountRequest, Currency } from '../types';
import { PoolClient } from 'pg';

export class AccountService {
  async createAccount(request: CreateAccountRequest): Promise<Account> {
    const result = await query(
      `INSERT INTO accounts (user_id, currency, balance, version)
       VALUES ($1, $2, 0.00, 0)
       RETURNING id, user_id, currency, balance, created_at, updated_at, version`,
      [request.user_id, request.currency]
    ) as { rows: Account[] };

    if (result.rows.length === 0) {
      throw new Error('Failed to create account');
    }

    return this.mapAccount(result.rows[0]);
  }

  async getAccountById(accountId: string): Promise<Account | null> {
    const result = await query(
      `SELECT id, user_id, currency, balance, created_at, updated_at, version
       FROM accounts
       WHERE id = $1`,
      [accountId]
    ) as { rows: Account[] };

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapAccount(result.rows[0]);
  }

  async getAccountByUserIdAndCurrency(
    userId: string,
    currency: Currency
  ): Promise<Account | null> {
    const result = await query(
      `SELECT id, user_id, currency, balance, created_at, updated_at, version
       FROM accounts
       WHERE user_id = $1 AND currency = $2`,
      [userId, currency]
    ) as { rows: Account[] };

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapAccount(result.rows[0]);
  }

  async getAccountWithLock(
    accountId: string,
    client: PoolClient
  ): Promise<Account | null> {
    const result = await client.query(
      `SELECT id, user_id, currency, balance, created_at, updated_at, version
       FROM accounts
       WHERE id = $1
       FOR UPDATE`,
      [accountId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapAccount(result.rows[0]);
  }

  async updateAccountBalance(
    accountId: string,
    newBalance: number,
    version: number,
    client: PoolClient
  ): Promise<void> {
    const result = await client.query(
      `UPDATE accounts
       SET balance = $1, version = version + 1
       WHERE id = $2 AND version = $3
       RETURNING id`,
      [newBalance, accountId, version]
    );

    if (result.rows.length === 0) {
      throw new Error('Concurrent modification detected. Please retry.');
    }
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

