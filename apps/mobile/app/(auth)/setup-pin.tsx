import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { AppButton, FormField, InlineNotice, Screen } from '../../src/components/ui';
import { securityApi } from '../../src/api/services';
import { ApiError } from '../../src/api/http';
import { colors, spacing } from '../../src/theme';

export default function SetupPinScreen() {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    if (!/^\d{4}$/.test(pin)) { setError('Choose a 4-digit transaction PIN.'); return; }
    if (pin !== confirm) { setError('The PINs do not match.'); return; }
    setLoading(true);
    try { await securityApi.setPin(pin); router.replace('/(tabs)'); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'The PIN could not be saved. Try again.'); }
    finally { setLoading(false); }
  };
  return <Screen scroll style={styles.content}>
    <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text><Text style={styles.title}>Set your transaction PIN</Text><Text style={styles.body}>Your PIN is checked by LAUPAY’s backend before supported purchases. Choose one you don’t use elsewhere.</Text>
    <FormField label="4-digit PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))} placeholder="••••" keyboardType="number-pad" secureTextEntry maxLength={4} />
    <FormField label="Confirm PIN" value={confirm} onChangeText={(v) => setConfirm(v.replace(/\D/g, '').slice(0, 4))} placeholder="••••" keyboardType="number-pad" secureTextEntry maxLength={4} />
    <InlineNotice title="Keep your PIN private" body="LAUPAY staff will never ask you to share your transaction PIN." />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <AppButton title="Save PIN securely" loading={loading} onPress={() => void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({ content: { flex: 1, justifyContent: 'center', gap: spacing.lg }, eyebrow: { color: colors.navy2, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }, title: { color: colors.midnight, fontSize: 27, lineHeight: 33, fontWeight: '900' }, body: { color: colors.muted, lineHeight: 22, fontSize: 14 }, error: { color: colors.error, fontSize: 13 } });
