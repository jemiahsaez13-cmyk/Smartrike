# E-Money Integration Guide

## Overview

The Smart Trike TODA booking system now supports e-money wallets (GCash and PayMaya/Maya) for seamless digital payments. This integration allows both passengers and drivers to manage their e-money accounts, perform transactions, and view transaction history.

## Features

### For Drivers
- **Wallet Management**: Link multiple GCash and PayMaya/Maya accounts
- **Balance Tracking**: View real-time balance across all linked accounts
- **Cash In**: Add funds to e-money accounts
- **Cash Out**: Withdraw earnings to linked accounts
- **Transaction History**: Complete audit trail of all transactions
- **Driver Payouts**: Automatic earnings deposits after completed trips
- **Default Account**: Set preferred payment method

### For Passengers
- **Payment Options**: Pay for trips using e-money wallets
- **Quick Top-Up**: Cash in directly from the app
- **Transaction Tracking**: View all payment history
- **Multiple Accounts**: Link and manage multiple e-money accounts
- **Secure Payments**: All transactions are encrypted and secure

## Database Schema

### Tables Created (Migration 008)

#### `emoney_accounts`
Stores linked e-money accounts for users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to users table |
| provider | VARCHAR(20) | 'gcash', 'paymaya', or 'maya' |
| masked_number | VARCHAR(50) | Masked account number (e.g., 09**-***-1234) |
| account_number | VARCHAR(50) | Full account number (encrypted) |
| account_name | VARCHAR(100) | Account holder name |
| is_default | BOOLEAN | Whether this is the default account |
| balance | DECIMAL(10,2) | Current balance |
| created_at | TIMESTAMPTZ | Account creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Constraints:**
- Only one default account per user
- Balance must be >= 0
- Provider must be one of: 'gcash', 'paymaya', 'maya'

#### `emoney_transactions`
Records all e-money transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to users table |
| account_id | UUID | Reference to emoney_accounts |
| type | VARCHAR(20) | Transaction type |
| amount | DECIMAL(10,2) | Transaction amount |
| reference_id | VARCHAR(100) | External reference from provider |
| description | TEXT | Transaction description |
| status | VARCHAR(20) | 'pending', 'completed', or 'failed' |
| provider | VARCHAR(20) | Payment provider |
| booking_id | UUID | Reference to booking (if applicable) |
| created_at | TIMESTAMPTZ | Transaction timestamp |

**Transaction Types:**
- `cash_in`: Adding funds to account
- `cash_out`: Withdrawing funds
- `trip_payment`: Passenger paying for trip
- `driver_payout`: Driver receiving earnings

## Redux Store Integration

### Payment Slice (`paymentSlice.ts`)

#### State Structure
```typescript
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
```

#### Actions

**Async Thunks:**
- `fetchEMoneyAccounts(userId)` - Load user's linked accounts
- `fetchEMoneyTransactions(userId)` - Load transaction history
- `linkEMoneyAccount(payload)` - Link new account
- `cashIn(payload)` - Add funds to account
- `cashOut(payload)` - Withdraw funds
- `setDefaultAccount(payload)` - Set default payment method
- `removeAccount(accountId)` - Unlink an account

**Sync Actions:**
- `clearPaymentError()` - Clear error messages
- `clearPaymentSuccess()` - Clear success messages
- `deductBalance(payload)` - Optimistically update balance

## Screen Components

### EMoneyWalletScreen

**Location:** `src/views/screens/driver/EMoneyWalletScreen.tsx`

**Features:**
- Balance overview card with gradient design
- Quick action buttons (Cash In, Cash Out, Link Account)
- Linked accounts list with individual balances
- Recent transactions with filtering
- Pull-to-refresh functionality
- Modal-based forms for all actions

**Navigation:**
```typescript
// Driver
navigation.navigate('EMoneyWallet');

// Passenger
navigation.navigate('EMoneyWallet');
```

### DriverProfileScreen (Enhanced)

**Location:** `src/views/screens/passenger/DriverProfileScreen.tsx`

**Features:**
- Driver ratings and reviews display
- Star rating breakdown with bar charts
- Vehicle information
- TODA membership verification
- Safety badges
- Review comments from passengers
- Animated parallax header

**Navigation:**
```typescript
navigation.navigate('DriverProfile', {
  driverId: 'driver-uuid',
  driverSnapshot?: driverData // optional pre-fetched data
});
```

## Security Features

### Row Level Security (RLS)

All e-money tables have RLS policies enabled:

1. **User Access**
   - Users can only view/modify their own accounts and transactions
   - Based on auth.uid() matching user's auth_id

2. **Admin Access**
   - Admins can view all accounts and transactions
   - For auditing and support purposes

### Data Protection

- Account numbers are masked in UI (09**-***-1234)
- Full account numbers stored with encryption in database
- All transactions require authentication
- Balance validation prevents negative balances

## Integration with Payment Providers

### Mock Implementation

Current implementation includes mock provider transactions for development:

```typescript
async function mockProviderTransaction(
  provider: EMoneyProvider,
  type: 'cash_in' | 'cash_out',
  amount: number,
): Promise<{ success: boolean; reference: string }>
```

### Production Integration

For production, replace mock functions with actual API integrations:

#### GCash Integration
- Use GCash API for real transactions
- Implement OAuth flow for account linking
- Handle webhooks for transaction status updates

#### PayMaya/Maya Integration
- Use Maya API for real transactions
- Implement secure token-based authentication
- Handle payment confirmations

**Required Environment Variables:**
```env
GCASH_API_KEY=your_gcash_api_key
GCASH_API_SECRET=your_gcash_secret
MAYA_PUBLIC_KEY=your_maya_public_key
MAYA_SECRET_KEY=your_maya_secret_key
```

## Usage Examples

### For Drivers

#### 1. Link an E-Money Account
```typescript
dispatch(linkEMoneyAccount({
  userId: user.id,
  provider: 'gcash',
  accountNumber: '09171234567',
  accountName: 'Juan Dela Cruz'
}));
```

#### 2. Cash Out Earnings
```typescript
dispatch(cashOut({
  userId: user.id,
  accountId: account.id,
  amount: 500.00,
  provider: 'gcash'
}));
```

#### 3. View Transaction History
```typescript
useEffect(() => {
  dispatch(fetchEMoneyTransactions(user.id));
}, [user.id]);
```

### For Passengers

#### 1. Pay for Trip
```typescript
// During booking confirmation
const defaultAccount = useSelector(state => state.payment.defaultAccount);
if (defaultAccount && defaultAccount.balance >= totalFare) {
  // Proceed with e-money payment
  dispatch(deductBalance({
    accountId: defaultAccount.id,
    amount: totalFare
  }));
}
```

#### 2. Top Up Account
```typescript
dispatch(cashIn({
  userId: user.id,
  accountId: selectedAccount.id,
  amount: 1000.00,
  provider: selectedAccount.provider
}));
```

## Testing

### Manual Testing Checklist

#### Account Management
- [ ] Link GCash account
- [ ] Link PayMaya account
- [ ] Set default account
- [ ] Remove account
- [ ] Try linking duplicate account

#### Transactions
- [ ] Cash in with valid amount
- [ ] Cash in with invalid amount (negative, zero)
- [ ] Cash out with sufficient balance
- [ ] Cash out with insufficient balance
- [ ] View transaction history

#### UI/UX
- [ ] Pull to refresh works
- [ ] Loading states display correctly
- [ ] Error messages display properly
- [ ] Success messages show and auto-clear
- [ ] Modals open and close smoothly

### Unit Test Examples

```typescript
// Test balance update after cash in
it('should update balance after successful cash in', async () => {
  const result = await dispatch(cashIn({
    userId: 'user-123',
    accountId: 'account-456',
    amount: 500,
    provider: 'gcash'
  }));
  
  expect(result.payload.newBalance).toBe(1500);
});

// Test insufficient balance validation
it('should fail cash out with insufficient balance', async () => {
  const result = await dispatch(cashOut({
    userId: 'user-123',
    accountId: 'account-456',
    amount: 2000,
    provider: 'gcash'
  }));
  
  expect(result.type).toContain('rejected');
});
```

## Troubleshooting

### Common Issues

#### 1. "Failed to fetch accounts"
- Check if user is authenticated
- Verify RLS policies are enabled
- Check network connection

#### 2. "Provider transaction failed"
- Verify provider API credentials
- Check if provider service is available
- Review transaction amount limits

#### 3. "Insufficient balance"
- Confirm account has sufficient funds
- Check for pending transactions
- Verify balance sync with provider

#### 4. Balance not updating
- Try pull-to-refresh
- Check if transaction completed successfully
- Verify Redux state is updating

### Debug Mode

Enable detailed logging:
```typescript
// In paymentSlice.ts
const DEBUG = true;

if (DEBUG) {
  console.log('Transaction payload:', payload);
  console.log('Current state:', state);
}
```

## Future Enhancements

### Planned Features
1. **QR Code Payments**: Scan QR codes for direct payments
2. **Bill Splitting**: Share trip costs with multiple passengers
3. **Promo Codes**: Apply discounts and promotions
4. **Loyalty Program**: Earn points on e-money transactions
5. **Budget Tracking**: Set spending limits and alerts
6. **Export Statements**: Download transaction reports
7. **Multi-Currency**: Support for multiple currencies
8. **Recurring Payments**: Set up auto top-ups

### API Improvements
- Implement real-time balance updates via WebSocket
- Add transaction status webhooks
- Implement retry logic for failed transactions
- Add transaction receipts via email/SMS

## Support

For issues or questions:
- Email: support@smarttrike.ph
- Documentation: [docs.smarttrike.ph](https://docs.smarttrike.ph)
- Issue Tracker: GitHub Issues

## License

Copyright © 2024 Smart Trike TODA System. All rights reserved.
