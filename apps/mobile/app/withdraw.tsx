import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { AppButton, AppCard, FormField, InlineNotice, Screen, StatusBadge } from '../src/components/ui';
import { withdrawalsApi, Bank } from '../src/api/services';
import { colors } from '../src/theme';

export default function Withdraw() {
  const banks = useQuery({ queryKey: ['withdrawal-banks'], queryFn: withdrawalsApi.banks });
  const history = useQuery({ queryKey: ['withdrawals'], queryFn: withdrawalsApi.list });
  const [bank, setBank] = useState<Bank | null>(null);
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const idempotencyKey = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => {
      idempotencyKey.current ??= Crypto.randomUUID();
      return withdrawalsApi.create({ amount: Number(amount), bankName: bank!.name, bankCode: bank!.code, accountName: name.trim(), accountNumber: account, pin, idempotencyKey: idempotencyKey.current });
    },
    onSuccess: (result) => {
      idempotencyKey.current = null;
      setPin('');
      Alert.alert('Request submitted', `Status: ${result.status}. It is pending review; payout is not automatic.`);
      void history.refetch();
    },
    onError: (error) => Alert.alert('Withdrawal not confirmed', `${error instanceof Error ? error.message : 'Please check withdrawal history.'} Retrying uses the same request key.`),
  });
  return <Screen scroll>
    <Text style={s.title}>Withdraw</Text>
    <InlineNotice title="Eligibility and review" body="The backend may reject test-credit funds. In live fulfillment mode, new withdrawal requests are currently rejected until a verified payout provider is configured; a bank list does not guarantee availability. Otherwise requests are held for review and payout is not automatic. If the result is ambiguous, check withdrawal history before retrying." />
    <FormField label="Amount (₦100–₦500,000)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
    <Text style={s.label}>Choose a backend-provided bank</Text>
    {banks.isError ? <InlineNotice title="Bank list unavailable" body="No static bank directory is used." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void banks.refetch()} />} /> : null}
    <View style={s.list}>{(banks.data || []).map((item) => <AppButton key={item.code} title={item.name} variant={bank?.code === item.code ? 'primary' : 'secondary'} onPress={() => setBank(item)} />)}</View>
    {banks.data?.length === 0 && !banks.isPending ? <Text style={s.body}>No verified bank options are currently available.</Text> : null}
    <FormField label="Account name" value={name} onChangeText={setName} autoCapitalize="words" />
    <FormField label="10-digit account number" value={account} onChangeText={setAccount} keyboardType="number-pad" maxLength={10} />
    <FormField label="4-digit transaction PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))} secureTextEntry keyboardType="number-pad" maxLength={4} />
    <AppButton title="Submit withdrawal request" loading={mutation.isPending} disabled={!bank || Number(amount) < 100 || Number(amount) > 500000 || account.length !== 10 || name.trim().length < 2 || !/^\d{4}$/.test(pin)} onPress={() => Alert.alert('Confirm request', `Request ₦${amount} from LAUPAY for ${bank?.name} account ending ${account.slice(-4)}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => mutation.mutate() }])} />
    <Text style={s.label}>Recent withdrawal requests</Text>
    {history.isError ? <InlineNotice title="History unavailable" body="Could not load withdrawal requests." tone="error" action={<AppButton title="Retry" variant="secondary" onPress={() => void history.refetch()} />} /> : null}
    {(history.data || []).map((item) => <AppCard key={item.id}><Text style={s.body}>{item.reference} · ₦{Number(item.amount).toLocaleString('en-NG')}</Text><StatusBadge status={item.status} /></AppCard>)}
  </Screen>;
}
const s = StyleSheet.create({ title: { fontSize: 26, fontWeight: '900', color: colors.midnight }, body: { fontSize: 13, color: colors.muted, lineHeight: 20 }, label: { fontWeight: '900', color: colors.navy }, list: { gap: 7 } });
