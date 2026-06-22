import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '@/config/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EMoneyProvider = 'gcash' | 'paymaya' | 'maya';

export interface EMoneyAccount {
  id: string;
  user_id: string;
  provider: EMoneyProvider;
  /** Masked account number shown in UI, e.g. "09**-***-1234" */
  masked_number: string;
  /** Full number stored only locally; never sent to UI logs */
  account_number: string;
  account_name: string;
  is_default: boolean;
  balance: number;
  created_at: string;
}

export interface EMoneyTransaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'cash_in' | 'cash_out' | 'trip_payment' | 'driver_payout';
  amount: number;
  reference_id: string | null;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  provider: EMoneyProvider;
}

export interface CashInPayload {
  userId: string;
  accountId: string;
  amount: number;
  provider: EMoneyProvider;
}

export interface CashOutPayload {
  userId: string;
  accountId: string;
  amount: number;
  provider: EMoneyProvider;
}

export interface LinkAccountPayload {
  userId: string;
  provider: EMoneyProvider;
  accountNumber: string;
  accountName: string;
}

interface PaymentState {
  accounts: EMoneyAccount[];
  transactions: EMoneyTransaction[];
  defaultAccount: EMoneyAccount | null;
  totalBalance: number;
  loading: boolean;
  transactionsLoading: boolean;
  error: string | null;
  successMessage: string | null;
}

const initialState: PaymentState = {
  accounts: [],
  transactions: [],
  defaultAccount: null,
  totalBalance: 0,
  loading: false,
  transactionsLoading: false,
  error: null,
  successMessage: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskNumber(num: string): string {
  if (num.length < 6) return '•'.repeat(num.length);
  return num.slice(0, 2) + '**-***-' + num.slice(-4);
}

/** Simulate a provider API call — in production wire this to GCash / Maya APIs */
async function mockProviderTransaction(
  provider: EMoneyProvider,
  type: 'cash_in' | 'cash_out',
  amount: number,
): Promise<{ success: boolean; reference: string }> {
  await new Promise((r) => setTimeout(r, 900));
  if (amount <= 0) return { success: false, reference: '' };
  const ref = `${provider.toUpperCase()}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  return { success: true, reference: ref };
}

// ─── Thunks ───────────────────────────────────────────────────────────────────

/** Fetch all linked e-money accounts for a user */
export const fetchEMoneyAccounts = createAsyncThunk(
  'payment/fetchAccounts',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('emoney_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EMoneyAccount[];
    } catch (err: any) {
      // Fallback: return empty array so the UI still renders
      return rejectWithValue(err?.message ?? 'Failed to fetch accounts');
    }
  },
);

/** Fetch e-money transaction history */
export const fetchEMoneyTransactions = createAsyncThunk(
  'payment/fetchTransactions',
  async (userId: string, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('emoney_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as EMoneyTransaction[];
    } catch (err: any) {
      return rejectWithValue(err?.message ?? 'Failed to fetch transactions');
    }
  },
);

/** Link a new GCash or Maya/PayMaya account */
export const linkEMoneyAccount = createAsyncThunk(
  'payment/linkAccount',
  async (payload: LinkAccountPayload, { rejectWithValue }) => {
    try {
      const masked = maskNumber(payload.accountNumber);

      // Check if first account (auto set as default)
      const { count } = await supabase
        .from('emoney_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', payload.userId);

      const isFirst = (count ?? 0) === 0;

      const { data, error } = await supabase
        .from('emoney_accounts')
        .insert({
          user_id: payload.userId,
          provider: payload.provider,
          masked_number: masked,
          account_number: payload.accountNumber,
          account_name: payload.accountName,
          is_default: isFirst,
          balance: 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as EMoneyAccount;
    } catch (err: any) {
      return rejectWithValue(err?.message ?? 'Failed to link account');
    }
  },
);

/** Cash in to an e-money account */
export const cashIn = createAsyncThunk(
  'payment/cashIn',
  async (payload: CashInPayload, { rejectWithValue }) => {
    try {
      const providerResult = await mockProviderTransaction(payload.provider, 'cash_in', payload.amount);
      if (!providerResult.success) throw new Error('Provider transaction failed');

      // Update balance
      const { data: account, error: accountError } = await supabase
        .from('emoney_accounts')
        .select('balance')
        .eq('id', payload.accountId)
        .single();
      if (accountError) throw accountError;

      const newBalance = (account?.balance ?? 0) + payload.amount;
      const { error: updateError } = await supabase
        .from('emoney_accounts')
        .update({ balance: newBalance })
        .eq('id', payload.accountId);
      if (updateError) throw updateError;

      // Record transaction
      const { data: tx, error: txError } = await supabase
        .from('emoney_transactions')
        .insert({
          user_id: payload.userId,
          account_id: payload.accountId,
          type: 'cash_in',
          amount: payload.amount,
          reference_id: providerResult.reference,
          description: `Cash in via ${payload.provider}`,
          status: 'completed',
          provider: payload.provider,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (txError) throw txError;

      return { accountId: payload.accountId, newBalance, transaction: tx as EMoneyTransaction };
    } catch (err: any) {
      return rejectWithValue(err?.message ?? 'Cash in failed');
    }
  },
);

/** Cash out from an e-money account */
export const cashOut = createAsyncThunk(
  'payment/cashOut',
  async (payload: CashOutPayload, { rejectWithValue }) => {
    try {
      // Validate balance first
      const { data: account, error: accountError } = await supabase
        .from('emoney_accounts')
        .select('balance')
        .eq('id', payload.accountId)
        .single();
      if (accountError) throw accountError;

      const currentBalance = account?.balance ?? 0;
      if (currentBalance < payload.amount) throw new Error('Insufficient balance');

      const providerResult = await mockProviderTransaction(payload.provider, 'cash_out', payload.amount);
      if (!providerResult.success) throw new Error('Provider transaction failed');

      const newBalance = currentBalance - payload.amount;
      const { error: updateError } = await supabase
        .from('emoney_accounts')
        .update({ balance: newBalance })
        .eq('id', payload.accountId);
      if (updateError) throw updateError;

      const { data: tx, error: txError } = await supabase
        .from('emoney_transactions')
        .insert({
          user_id: payload.userId,
          account_id: payload.accountId,
          type: 'cash_out',
          amount: payload.amount,
          reference_id: providerResult.reference,
          description: `Cash out via ${payload.provider}`,
          status: 'completed',
          provider: payload.provider,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (txError) throw txError;

      return { accountId: payload.accountId, newBalance, transaction: tx as EMoneyTransaction };
    } catch (err: any) {
      return rejectWithValue(err?.message ?? 'Cash out failed');
    }
  },
);

/** Set an account as the default payment method */
export const setDefaultAccount = createAsyncThunk(
  'payment/setDefault',
  async (payload: { userId: string; accountId: string }, { rejectWithValue }) => {
    try {
      // Clear existing defaults
      await supabase
        .from('emoney_accounts')
        .update({ is_default: false })
        .eq('user_id', payload.userId);

      // Set new default
      const { error } = await supabase
        .from('emoney_accounts')
        .update({ is_default: true })
        .eq('id', payload.accountId);
      if (error) throw error;

      return payload.accountId;
    } catch (err: any) {
      return rejectWithValue(err?.message ?? 'Failed to set default');
    }
  },
);

/** Remove a linked account */
export const removeAccount = createAsyncThunk(
  'payment/removeAccount',
  async (accountId: string, { rejectWithValue }) => {
    try {
      const { error } = await supabase
        .from('emoney_accounts')
        .delete()
        .eq('id', accountId);
      if (error) throw error;
      return accountId;
    } catch (err: any) {
      return rejectWithValue(err?.message ?? 'Failed to remove account');
    }
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {
    clearPaymentError: (state) => {
      state.error = null;
    },
    clearPaymentSuccess: (state) => {
      state.successMessage = null;
    },
    /** Optimistically update balance (e.g. after trip completion) */
    deductBalance: (state, action: PayloadAction<{ accountId: string; amount: number }>) => {
      const account = state.accounts.find((a) => a.id === action.payload.accountId);
      if (account) {
        account.balance = Math.max(0, account.balance - action.payload.amount);
        state.totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
        if (state.defaultAccount?.id === account.id) {
          state.defaultAccount.balance = account.balance;
        }
      }
    },
  },
  extraReducers: (builder) => {
    // ── fetchEMoneyAccounts ──────────────────────────────────────────────────
    builder
      .addCase(fetchEMoneyAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEMoneyAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;
        state.defaultAccount = action.payload.find((a) => a.is_default) ?? action.payload[0] ?? null;
        state.totalBalance = action.payload.reduce((s, a) => s + a.balance, 0);
      })
      .addCase(fetchEMoneyAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // ── fetchEMoneyTransactions ──────────────────────────────────────────────
    builder
      .addCase(fetchEMoneyTransactions.pending, (state) => {
        state.transactionsLoading = true;
      })
      .addCase(fetchEMoneyTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchEMoneyTransactions.rejected, (state) => {
        state.transactionsLoading = false;
      });

    // ── linkEMoneyAccount ────────────────────────────────────────────────────
    builder
      .addCase(linkEMoneyAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(linkEMoneyAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts.push(action.payload);
        if (action.payload.is_default || state.accounts.length === 1) {
          state.defaultAccount = action.payload;
        }
        state.totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
        state.successMessage = 'Account linked successfully';
      })
      .addCase(linkEMoneyAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // ── cashIn ───────────────────────────────────────────────────────────────
    builder
      .addCase(cashIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cashIn.fulfilled, (state, action) => {
        state.loading = false;
        const account = state.accounts.find((a) => a.id === action.payload.accountId);
        if (account) account.balance = action.payload.newBalance;
        if (state.defaultAccount?.id === action.payload.accountId) {
          state.defaultAccount.balance = action.payload.newBalance;
        }
        state.totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
        state.transactions.unshift(action.payload.transaction);
        state.successMessage = `Cash in of ₱${action.payload.transaction.amount.toFixed(2)} successful`;
      })
      .addCase(cashIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // ── cashOut ──────────────────────────────────────────────────────────────
    builder
      .addCase(cashOut.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cashOut.fulfilled, (state, action) => {
        state.loading = false;
        const account = state.accounts.find((a) => a.id === action.payload.accountId);
        if (account) account.balance = action.payload.newBalance;
        if (state.defaultAccount?.id === action.payload.accountId) {
          state.defaultAccount.balance = action.payload.newBalance;
        }
        state.totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
        state.transactions.unshift(action.payload.transaction);
        state.successMessage = `Cash out of ₱${action.payload.transaction.amount.toFixed(2)} successful`;
      })
      .addCase(cashOut.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // ── setDefaultAccount ────────────────────────────────────────────────────
    builder.addCase(setDefaultAccount.fulfilled, (state, action) => {
      state.accounts.forEach((a) => {
        a.is_default = a.id === action.payload;
      });
      state.defaultAccount = state.accounts.find((a) => a.is_default) ?? null;
    });

    // ── removeAccount ────────────────────────────────────────────────────────
    builder.addCase(removeAccount.fulfilled, (state, action) => {
      state.accounts = state.accounts.filter((a) => a.id !== action.payload);
      if (state.defaultAccount?.id === action.payload) {
        state.defaultAccount = state.accounts[0] ?? null;
      }
      state.totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
    });
  },
});

export const { clearPaymentError, clearPaymentSuccess, deductBalance } = paymentSlice.actions;
export default paymentSlice.reducer;
