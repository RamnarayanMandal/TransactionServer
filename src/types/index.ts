export type Currency = 'USD' | 'INR';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_DEBIT' | 'TRANSFER_CREDIT';

export interface Account {
  id: string;
  user_id: string;
  currency: Currency;
  balance: number;
  created_at: Date;
  updated_at: Date;
  version: number;
}

export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  related_transaction_id: string | null;
  description: string | null;
  created_at: Date;
}

export interface CreateAccountRequest {
  user_id: string;
  currency: Currency;
}

export interface RecordTransactionRequest {
  account_id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  description?: string;
}

export interface TransferRequest {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description?: string;
}

export interface TransactionHistoryQuery {
  account_id: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

