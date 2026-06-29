-- ═══════════════════════════════════════════════════════════════════════════
-- E-Money Integration Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── E-Money Accounts Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emoney_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('gcash', 'paymaya', 'maya')),
  masked_number VARCHAR(50) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  balance DECIMAL(10,2) DEFAULT 0.00 CHECK (balance >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_emoney_accounts_user_id ON emoney_accounts(user_id);
CREATE INDEX idx_emoney_accounts_provider ON emoney_accounts(provider);
CREATE INDEX idx_emoney_accounts_default ON emoney_accounts(user_id, is_default) WHERE is_default = TRUE;

-- Ensure only one default account per user
CREATE UNIQUE INDEX idx_emoney_accounts_user_default 
  ON emoney_accounts(user_id) 
  WHERE is_default = TRUE;

-- ─── E-Money Transactions Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emoney_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES emoney_accounts(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'trip_payment', 'driver_payout')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reference_id VARCHAR(100),
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('gcash', 'paymaya', 'maya')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL
);

-- Indexes for transaction queries
CREATE INDEX idx_emoney_transactions_user_id ON emoney_transactions(user_id);
CREATE INDEX idx_emoney_transactions_account_id ON emoney_transactions(account_id);
CREATE INDEX idx_emoney_transactions_created_at ON emoney_transactions(created_at DESC);
CREATE INDEX idx_emoney_transactions_status ON emoney_transactions(status);
CREATE INDEX idx_emoney_transactions_booking_id ON emoney_transactions(booking_id);
CREATE INDEX idx_emoney_transactions_type ON emoney_transactions(type);

-- ─── Update Trigger for emoney_accounts ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_emoney_accounts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_emoney_accounts_timestamp
  BEFORE UPDATE ON emoney_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_emoney_accounts_timestamp();

-- ─── Function to ensure single default account per user ───────────────────────
CREATE OR REPLACE FUNCTION ensure_single_default_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    -- Unset other default accounts for this user
    UPDATE emoney_accounts 
    SET is_default = FALSE 
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default
  AFTER INSERT OR UPDATE OF is_default ON emoney_accounts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_account();

-- ─── Row Level Security Policies ──────────────────────────────────────────────

-- Enable RLS
ALTER TABLE emoney_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emoney_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own accounts
CREATE POLICY "Users can view own emoney accounts"
  ON emoney_accounts FOR SELECT
  USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Users can insert their own accounts
CREATE POLICY "Users can insert own emoney accounts"
  ON emoney_accounts FOR INSERT
  WITH CHECK (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Users can update their own accounts
CREATE POLICY "Users can update own emoney accounts"
  ON emoney_accounts FOR UPDATE
  USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Users can delete their own accounts
CREATE POLICY "Users can delete own emoney accounts"
  ON emoney_accounts FOR DELETE
  USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON emoney_transactions FOR SELECT
  USING (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Users can insert their own transactions
CREATE POLICY "Users can insert own transactions"
  ON emoney_transactions FOR INSERT
  WITH CHECK (auth.uid() = (SELECT auth_id FROM users WHERE id = user_id));

-- Admins can view all accounts and transactions
CREATE POLICY "Admins can view all emoney accounts"
  ON emoney_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() 
      AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON emoney_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_id = auth.uid() 
      AND user_type = 'admin'
    )
  );

-- ─── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE emoney_accounts IS 'Stores linked GCash and PayMaya/Maya accounts for users';
COMMENT ON TABLE emoney_transactions IS 'Records all e-money transactions including cash in, cash out, and trip payments';
COMMENT ON COLUMN emoney_accounts.masked_number IS 'Masked account number for display (e.g., 09**-***-1234)';
COMMENT ON COLUMN emoney_accounts.account_number IS 'Full account number (stored securely)';
COMMENT ON COLUMN emoney_transactions.type IS 'Transaction type: cash_in, cash_out, trip_payment, or driver_payout';
COMMENT ON COLUMN emoney_transactions.reference_id IS 'External reference from payment provider';
