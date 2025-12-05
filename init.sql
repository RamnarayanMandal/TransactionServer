-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'INR')),
    balance DECIMAL(20, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 0, -- For optimistic concurrency control
    UNIQUE(user_id, currency)
);

-- Create transactions table (Double-entry bookkeeping approach)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_DEBIT', 'TRANSFER_CREDIT')),
    amount DECIMAL(20, 2) NOT NULL CHECK (amount > 0),
    balance_after DECIMAL(20, 2) NOT NULL CHECK (balance_after >= 0),
    related_transaction_id UUID REFERENCES transactions(id), -- Links debit/credit pairs for transfers
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create idempotency table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    request_path TEXT NOT NULL,
    response_status INTEGER NOT NULL,
    response_body JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_currency ON accounts(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_related ON transactions(related_transaction_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_key_hash ON idempotency_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for accounts updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

