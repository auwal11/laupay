import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppButton, AppCard, InlineNotice, Screen, StatusBadge } from '../../src/components/ui';
import { walletApi, ordersApi, LedgerEntry, Order } from '../../src/api/services';
import { colors, spacing } from '../../src/theme';

const fmt = (v: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(v));

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const ledger = useQuery({ queryKey: ['ledger-detail', id], queryFn: () => walletApi.getTransaction(id), enabled: !!id });
  const order = useQuery({ queryKey: ['order-detail', id], queryFn: () => ordersApi.detail(id), enabled: !!id, retry: false });
  const record = (ledger.data || order.data) as LedgerEntry | Order | undefined;
  const isCredit = Boolean(ledger.data && ledger.data.direction.toLowerCase() === 'credit');
  const reference = ledger.data?.referenceId || record?.id || '';
  const share = () => { if (!record) return; const message = `LAUPAY receipt\nReference: ${reference}\nAmount: ${fmt(record.amount)}\nStatus: ${record.status}\nDate: ${new Date(record.createdAt).toLocaleString('en-NG')}`; void Share.share({ message }); };
  const copyReference = async () => { if (!reference) return; await Clipboard.setStringAsync(reference); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return <Screen scroll><Text style={s.eyebrow}>LAUPAY WALLET</Text><Text style={s.title}>Transaction details</Text><Text style={s.subtitle}>Review the full record returned for this transaction.</Text>
    {ledger.isError && order.isError ? <InlineNotice title="Details unavailable" body="The authenticated backend did not return a matching ledger entry or order. No record has been fabricated." tone="error" /> : null}
    {ledger.isPending && order.isPending ? <Text style={s.body}>Loading authorized record…</Text> : record ? <>
      <AppCard style={s.hero}><View style={s.heroTop}><Text style={s.receipt}>LAUPAY · RECEIPT</Text><StatusBadge status={record.status} /></View><Text style={s.amount}>{isCredit ? '+' : '−'}{fmt(record.amount)}</Text><Text style={s.description}>{ledger.data?.description || ('type' in record ? record.type : 'Transaction')}</Text><Text style={s.date}>{new Date(record.createdAt).toLocaleString('en-NG')}</Text></AppCard>
      {ledger.data ? <AppCard><Text style={s.section}>Balance summary</Text><View style={s.metrics}><Metric label="Balance before" value={ledger.data.balanceBefore ? fmt(ledger.data.balanceBefore) : 'Not available'} /><Metric label="Balance after" value={ledger.data.balanceAfter ? fmt(ledger.data.balanceAfter) : 'Not available'} /></View><Row label={isCredit ? 'Total credit' : 'Total debit'} value={fmt(record.amount)} strong /></AppCard> : null}
      <AppCard><Text style={s.section}>Other details</Text><Row label="Reference" value={reference} copy onCopy={() => void copyReference()} copied={copied} />{ledger.data?.reason ? <Row label="Transaction type" value={ledger.data.reason.replaceAll('_', ' ')} /> : null}{ledger.data?.counterparty ? <Row label="Beneficiary / phone" value={ledger.data.counterparty} /> : null}{ledger.data?.network ? <Row label="Network / provider" value={ledger.data.network} /> : null}<Row label="Transaction status" value={record.status} /><Text style={s.note}>Receipt status reflects the latest endpoint response. Pending or unknown is not successful.</Text></AppCard>
    </> : null}
    <AppButton title="Share receipt" variant="secondary" disabled={!record} onPress={share} />
    {ledger.data ? <AppButton title="Copy reference" variant="ghost" onPress={copyReference} /> : null}
    {ledger.data ? <AppButton title="Report a transaction issue" variant="ghost" onPress={() => router.push({ pathname: '/disputes', params: { transactionId: ledger.data!.id } })} /> : null}
  </Screen>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={s.metric}><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text></View>; }
function Row({ label, value, strong, copy, onCopy, copied }: { label: string; value: string; strong?: boolean; copy?: boolean; onCopy?: () => void; copied?: boolean }) { return <View style={s.row}><Text style={s.rowLabel}>{label}</Text><View style={s.rowRight}><Text style={[s.rowValue, strong && s.strong]}>{value}</Text>{copy ? <AppButton title={copied ? 'Copied' : 'Copy'} variant="ghost" onPress={onCopy} style={s.copyButton} /> : null}</View></View>; }
const s = StyleSheet.create({ eyebrow: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, title: { color: colors.midnight, fontSize: 27, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: -spacing.sm }, hero: { gap: spacing.sm }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, receipt: { color: colors.navy2, fontWeight: '900', letterSpacing: 1 }, amount: { color: colors.midnight, fontSize: 32, fontWeight: '900', marginTop: spacing.md }, description: { color: colors.navy, fontSize: 14, fontWeight: '800' }, date: { color: colors.muted, fontSize: 12 }, section: { color: colors.midnight, fontSize: 16, fontWeight: '900', marginBottom: spacing.sm }, metrics: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', marginBottom: spacing.sm }, metric: { flex: 1, padding: spacing.md }, metricLabel: { color: colors.muted, fontSize: 11 }, metricValue: { color: colors.navy, fontSize: 13, fontWeight: '800', marginTop: 4 }, row: { minHeight: 44, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, rowLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 }, rowRight: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, flexShrink: 1 }, rowValue: { color: colors.navy, fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 }, strong: { color: colors.midnight, fontWeight: '900' }, copyButton: { minHeight: 30, paddingHorizontal: spacing.sm }, body: { color: colors.navy, fontSize: 13, lineHeight: 20 }, note: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.md } });
