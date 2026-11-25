import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppCard, Screen } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

export default function RewardsScreen() {
  return <Screen scroll style={styles.content}>
    <Text style={styles.eyebrow}>LAUPAY REWARDS</Text><Text style={styles.title}>Rewards</Text>
    <AppCard style={styles.card}><View style={styles.icon}><Ionicons name="sparkles-outline" size={28} color={colors.navy2} /></View><Text style={styles.cardTitle}>Rewards aren’t enabled yet</Text><Text style={styles.body}>LAUPAY’s current backend doesn’t provide a referral code, reward balance or promotions feed. We’ll show rewards here only when they’re backed by verified account data.</Text></AppCard>
  </Screen>;
}

const styles = StyleSheet.create({ content: { padding: spacing.xl, gap: spacing.lg }, eyebrow: { color: colors.navy2, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.midnight, fontSize: 26, fontWeight: '900' }, card: { gap: spacing.md, alignItems: 'flex-start', marginTop: spacing.lg }, icon: { backgroundColor: colors.softGold, padding: spacing.md, borderRadius: 15 }, cardTitle: { color: colors.midnight, fontSize: 18, fontWeight: '900' }, body: { color: colors.muted, fontSize: 14, lineHeight: 22 } });
