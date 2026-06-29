import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/controllers/store';
import {
  fetchEMoneyAccounts,
  fetchEMoneyTransactions,
  linkEMoneyAccount,
  cashIn,
  cashOut,
  setDefaultAccount,
  removeAccount,
  clearPaymentError,
  clearPaymentSuccess,
  EMoneyProvider,
  EMoneyAccount,
  EMoneyTransaction,
} from '@/controllers/slices/paymentSlice';
import { Button } from '@/views/components/common/Button';
import { colors, radius, shadows, spacing, typography, layout } from '@/views/styles/theme';
import { formatDate } from '@/utils/dateUtils';
import { confirm, notify } from '@/utils/confirm';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalType = 'link' | 'cashIn' | 'cashOut' | 'accounts' | null;

// ─── Main Component ───────────────────────────────────────────────────────────

export const EMoneyWalletScreen = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<AppDispatch>();

  const { user } = useSelector((state: RootState) => state.auth);
  const {
    accounts,
    transactions,
    defaultAccount,
    totalBalance,
    loading,
    transactionsLoading,
    error,
    successMessage,
  } = useSelector((state: RootState) => state.payment);

  const [refreshing, setRefreshing] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);

  // Link account form
  const [linkProvider, setLinkProvider] = useState<EMoneyProvider>('gcash');
  const [linkAccountNumber, setLinkAccountNumber] = useState('');
  const [linkAccountName, setLinkAccountName] = useState('');

  // Cash in/out form
  const [selectedAccount, setSelectedAccount] = useState<EMoneyAccount | null>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchEMoneyAccounts(user.id));
      dispatch(fetchEMoneyTransactions(user.id));
    }
  }, [user?.id, dispatch]);

  useEffect(() => {
    if (error) {
      void notify('Error', error);
      dispatch(clearPaymentError());
    }
  }, [error]);

  useEffect(() => {
    if (successMessage) {
      void notify('Success', successMessage);
      dispatch(clearPaymentSuccess());
      closeModal();
    }
  }, [successMessage]);

  const onRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchEMoneyAccounts(user.id)),
      dispatch(fetchEMoneyTransactions(user.id)),
    ]);
    setRefreshing(false);
  };

  const closeModal = () => {
    setModalType(null);
    setLinkProvider('gcash');
    setLinkAccountNumber('');
    setLinkAccountName('');
    setSelectedAccount(null);
    setAmount('');
  };

  const handleLinkAccount = () => {
    if (!user?.id) return;
    if (!linkAccountNumber || !linkAccountName) {
      void notify('Error', 'Please fill all fields');
      return;
    }
    dispatch(
      linkEMoneyAccount({
        userId: user.id,
        provider: linkProvider,
        accountNumber: linkAccountNumber,
        accountName: linkAccountName,
      })
    );
  };

  const handleCashIn = () => {
    if (!user?.id || !selectedAccount) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      void notify('Error', 'Please enter a valid amount');
      return;
    }
    dispatch(
      cashIn({
        userId: user.id,
        accountId: selectedAccount.id,
        amount: amountNum,
        provider: selectedAccount.provider,
      })
    );
  };

  const handleCashOut = () => {
    if (!user?.id || !selectedAccount) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      void notify('Error', 'Please enter a valid amount');
      return;
    }
    if (amountNum > selectedAccount.balance) {
      void notify('Error', 'Insufficient balance');
      return;
    }
    dispatch(
      cashOut({
        userId: user.id,
        accountId: selectedAccount.id,
        amount: amountNum,
        provider: selectedAccount.provider,
      })
    );
  };

  const handleSetDefault = (accountId: string) => {
    if (!user?.id) return;
    dispatch(setDefaultAccount({ userId: user.id, accountId }));
  };

  const handleRemoveAccount = async (accountId: string) => {
    const yes = await confirm('Remove Account', 'Are you sure you want to remove this account?', {
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (yes) dispatch(removeAccount(accountId));
  };

  const openCashInModal = (account: EMoneyAccount) => {
    setSelectedAccount(account);
    setModalType('cashIn');
  };

  const openCashOutModal = (account: EMoneyAccount) => {
    setSelectedAccount(account);
    setModalType('cashOut');
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <Surface style={styles.header} elevation={2}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-Money Wallet</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setModalType('accounts')}
          accessibilityLabel="Manage accounts"
        >
          <MaterialCommunityIcons name="cog-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </Surface>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <LinearGradient
          colors={['#2C5F2D', '#1E4620']}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>₱{totalBalance.toFixed(2)}</Text>
          {defaultAccount && (
            <View style={styles.defaultAccountChip}>
              <MaterialCommunityIcons
                name={defaultAccount.provider === 'gcash' ? 'wallet' : 'credit-card'}
                size={14}
                color="#fff"
              />
              <Text style={styles.defaultAccountText}>
                {defaultAccount.provider.toUpperCase()} • {defaultAccount.masked_number}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => defaultAccount ? openCashInModal(defaultAccount) : notify('Error', 'Please link an account first')}
            disabled={loading}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: colors.secondaryLight }]}>
              <MaterialCommunityIcons name="plus-circle" size={26} color={colors.secondary} />
            </View>
            <Text style={styles.actionLabel}>Cash In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => defaultAccount ? openCashOutModal(defaultAccount) : notify('Error', 'Please link an account first')}
            disabled={loading}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: colors.infoLight }]}>
              <MaterialCommunityIcons name="bank-transfer-out" size={26} color={colors.accent} />
            </View>
            <Text style={styles.actionLabel}>Cash Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setModalType('link')}
            disabled={loading}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: colors.primaryLight }]}>
              <MaterialCommunityIcons name="link-plus" size={26} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Link Account</Text>
          </TouchableOpacity>
        </View>

        {/* Linked Accounts */}
        {accounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Accounts</Text>
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onCashIn={() => openCashInModal(account)}
                onCashOut={() => openCashOutModal(account)}
              />
            ))}
          </View>
        )}

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactionsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : transactions.length === 0 ? (
            <Surface style={styles.emptyCard} elevation={0}>
              <MaterialCommunityIcons name="history" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </Surface>
          ) : (
            transactions.map((tx) => <TransactionCard key={tx.id} transaction={tx} />)
          )}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Modals */}
      <LinkAccountModal
        visible={modalType === 'link'}
        provider={linkProvider}
        accountNumber={linkAccountNumber}
        accountName={linkAccountName}
        loading={loading}
        onChangeProvider={setLinkProvider}
        onChangeAccountNumber={setLinkAccountNumber}
        onChangeAccountName={setLinkAccountName}
        onSubmit={handleLinkAccount}
        onClose={closeModal}
      />

      <CashInOutModal
        visible={modalType === 'cashIn'}
        type="cashIn"
        account={selectedAccount}
        amount={amount}
        loading={loading}
        onChangeAmount={setAmount}
        onSubmit={handleCashIn}
        onClose={closeModal}
      />

      <CashInOutModal
        visible={modalType === 'cashOut'}
        type="cashOut"
        account={selectedAccount}
        amount={amount}
        loading={loading}
        onChangeAmount={setAmount}
        onSubmit={handleCashOut}
        onClose={closeModal}
      />

      <ManageAccountsModal
        visible={modalType === 'accounts'}
        accounts={accounts}
        onSetDefault={handleSetDefault}
        onRemove={handleRemoveAccount}
        onClose={closeModal}
      />
    </View>
  );
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

const AccountCard = ({
  account,
  onCashIn,
  onCashOut,
}: {
  account: EMoneyAccount;
  onCashIn: () => void;
  onCashOut: () => void;
}) => (
  <Surface style={styles.accountCard} elevation={1}>
    <View style={styles.accountHeader}>
      <View style={styles.accountIconWrap}>
        <MaterialCommunityIcons
          name={account.provider === 'gcash' ? 'wallet' : 'credit-card'}
          size={24}
          color={colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.accountProvider}>{account.provider.toUpperCase()}</Text>
        <Text style={styles.accountNumber}>{account.masked_number}</Text>
      </View>
      {account.is_default && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>Default</Text>
        </View>
      )}
    </View>
    <Text style={styles.accountBalance}>₱{account.balance.toFixed(2)}</Text>
    <View style={styles.accountActions}>
      <TouchableOpacity style={styles.smallActionBtn} onPress={onCashIn}>
        <MaterialCommunityIcons name="plus" size={16} color={colors.secondary} />
        <Text style={styles.smallActionText}>Cash In</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.smallActionBtn} onPress={onCashOut}>
        <MaterialCommunityIcons name="minus" size={16} color={colors.accent} />
        <Text style={styles.smallActionText}>Cash Out</Text>
      </TouchableOpacity>
    </View>
  </Surface>
);

const TransactionCard = ({ transaction }: { transaction: EMoneyTransaction }) => {
  const isPositive = transaction.type === 'cash_in' || transaction.type === 'driver_payout';
  const icon = {
    cash_in: 'plus-circle',
    cash_out: 'minus-circle',
    trip_payment: 'car',
    driver_payout: 'cash',
  }[transaction.type];

  return (
    <Surface style={styles.transactionCard} elevation={0}>
      <View style={styles.transactionIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={24} color={isPositive ? colors.secondary : colors.error} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.transactionDesc}>{transaction.description}</Text>
        <Text style={styles.transactionDate}>{formatDate(transaction.created_at)}</Text>
      </View>
      <Text style={[styles.transactionAmount, { color: isPositive ? colors.secondary : colors.error }]}>
        {isPositive ? '+' : '-'}₱{transaction.amount.toFixed(2)}
      </Text>
    </Surface>
  );
};

// ─── Modals ───────────────────────────────────────────────────────────────────

const LinkAccountModal = ({
  visible,
  provider,
  accountNumber,
  accountName,
  loading,
  onChangeProvider,
  onChangeAccountNumber,
  onChangeAccountName,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  provider: EMoneyProvider;
  accountNumber: string;
  accountName: string;
  loading: boolean;
  onChangeProvider: (p: EMoneyProvider) => void;
  onChangeAccountNumber: (n: string) => void;
  onChangeAccountName: (n: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Surface style={styles.modalContent} elevation={5}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Link E-Money Account</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>Provider</Text>
        <View style={styles.providerRow}>
          {(['gcash', 'paymaya'] as EMoneyProvider[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.providerChip, provider === p && styles.providerChipActive]}
              onPress={() => onChangeProvider(p)}
            >
              <Text style={[styles.providerChipText, provider === p && styles.providerChipTextActive]}>
                {p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Account Number</Text>
        <TextInput
          style={styles.input}
          placeholder="09XX-XXX-XXXX"
          value={accountNumber}
          onChangeText={onChangeAccountNumber}
          keyboardType="phone-pad"
        />

        <Text style={styles.inputLabel}>Account Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Juan Dela Cruz"
          value={accountName}
          onChangeText={onChangeAccountName}
        />

        <Button
          onPress={onSubmit}
          disabled={loading}
          style={{ marginTop: spacing.lg }}
        >
          {loading ? 'Linking...' : 'Link Account'}
        </Button>
      </Surface>
    </View>
  </Modal>
);

const CashInOutModal = ({
  visible,
  type,
  account,
  amount,
  loading,
  onChangeAmount,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  type: 'cashIn' | 'cashOut';
  account: EMoneyAccount | null;
  amount: string;
  loading: boolean;
  onChangeAmount: (a: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Surface style={styles.modalContent} elevation={5}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{type === 'cashIn' ? 'Cash In' : 'Cash Out'}</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {account && (
          <>
            <View style={styles.modalAccountInfo}>
              <Text style={styles.modalAccountLabel}>{account.provider.toUpperCase()}</Text>
              <Text style={styles.modalAccountNumber}>{account.masked_number}</Text>
              <Text style={styles.modalAccountBalance}>Balance: ₱{account.balance.toFixed(2)}</Text>
            </View>

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="0.00"
              value={amount}
              onChangeText={onChangeAmount}
              keyboardType="decimal-pad"
            />

            <Button
              onPress={onSubmit}
              disabled={loading}
              style={{ marginTop: spacing.lg }}
            >
              {loading ? 'Processing...' : type === 'cashIn' ? 'Cash In' : 'Cash Out'}
            </Button>
          </>
        )}
      </Surface>
    </View>
  </Modal>
);

const ManageAccountsModal = ({
  visible,
  accounts,
  onSetDefault,
  onRemove,
  onClose,
}: {
  visible: boolean;
  accounts: EMoneyAccount[];
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Surface style={styles.modalContent} elevation={5}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Manage Accounts</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.accountsList}>
          {accounts.map((account) => (
            <View key={account.id} style={styles.manageAccountCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.manageAccountProvider}>{account.provider.toUpperCase()}</Text>
                <Text style={styles.manageAccountNumber}>{account.masked_number}</Text>
              </View>
              <View style={styles.manageAccountActions}>
                {!account.is_default && (
                  <TouchableOpacity onPress={() => onSetDefault(account.id)}>
                    <Text style={styles.manageActionText}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onRemove(account.id)}>
                  <MaterialCommunityIcons name="delete-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </Surface>
    </View>
  </Modal>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { ...typography.title, flex: 1, textAlign: 'center', marginRight: 40 },
  headerBtn: { padding: spacing.xs },

  // Scroll
  scrollContent: { paddingHorizontal: spacing.screen, paddingTop: spacing.lg },

  // Balance card
  balanceCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  balanceLabel: { ...typography.bodySmall, color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  balanceAmount: { ...typography.number, fontSize: 38, color: '#fff', marginVertical: spacing.xs },
  defaultAccountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  defaultAccountText: { ...typography.label, color: '#fff', fontSize: 12 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  actionBtn: { flex: 1, alignItems: 'center', gap: spacing.sm },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { ...typography.label, fontSize: 12, color: colors.text },

  // Section
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.subtitle, fontSize: 16, marginBottom: spacing.md },

  // Account card
  accountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  accountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountProvider: { ...typography.label, fontSize: 13, color: colors.text },
  accountNumber: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  accountBalance: { ...typography.number, fontSize: 24, color: colors.text, marginBottom: spacing.sm },
  accountActions: { flexDirection: 'row', gap: spacing.sm },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  smallActionText: { ...typography.label, fontSize: 12, color: colors.text },
  defaultBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  defaultBadgeText: { ...typography.label, fontSize: 10, color: colors.primary },

  // Transaction card
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  transactionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionDesc: { ...typography.subtitle, fontSize: 14, color: colors.text },
  transactionDate: { ...typography.bodySmall, fontSize: 11, color: colors.textSecondary },
  transactionAmount: { ...typography.number, fontSize: 16 },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.title, fontSize: 20 },
  inputLabel: { ...typography.label, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  amountInput: {
    fontSize: 24,
    fontFamily: 'Poppins-SemiBold',
  },
  providerRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  providerChip: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  providerChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  providerChipText: { ...typography.label, color: colors.textSecondary },
  providerChipTextActive: { color: colors.primary },
  modalAccountInfo: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  modalAccountLabel: { ...typography.label, fontSize: 12, color: colors.textSecondary },
  modalAccountNumber: { ...typography.subtitle, fontSize: 16, color: colors.text, marginTop: 2 },
  modalAccountBalance: { ...typography.body, fontSize: 14, color: colors.textMuted, marginTop: 4 },
  accountsList: { maxHeight: 400 },
  manageAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  manageAccountProvider: { ...typography.label, fontSize: 13, color: colors.text },
  manageAccountNumber: { ...typography.bodySmall, fontSize: 12, color: colors.textSecondary },
  manageAccountActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  manageActionText: { ...typography.label, fontSize: 12, color: colors.primary },
});