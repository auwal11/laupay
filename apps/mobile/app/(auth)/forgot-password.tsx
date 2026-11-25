import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, FormField, InlineNotice, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { ApiError } from '../../src/api/http';
import { colors, spacing } from '../../src/theme';

export default function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    try { await forgotPassword(email.trim().toLowerCase()); setSent(true); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'The request could not be completed. Try again.'); }
    finally { setLoading(false); }
  };
  return <Screen scroll style={styles.content}>
    <Link href="/(auth)/login"><Text style={styles.back}>‹  Back to sign in</Text></Link>
    <Text style={styles.title}>Reset your password</Text><Text style={styles.body}>Enter the email address on your account. If it can be used for a reset, LAUPAY will send instructions.</Text>
    <FormField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    {sent ? <InlineNotice title="Check your email" body="If an eligible account matches, password-reset instructions have been sent." tone="success" /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <AppButton title={sent ? 'Send again' : 'Send reset instructions'} loading={loading} onPress={() => void submit()} />
    <AppButton title="I have a reset link" variant="secondary" onPress={() => router.push('/(auth)/reset-password')} />
  </Screen>;
}

const styles = StyleSheet.create({ content: { flex: 1, justifyContent: 'center', gap: spacing.lg }, back: { color: colors.navy2, fontWeight: '800' }, title: { color: colors.midnight, fontSize: 27, fontWeight: '900', marginTop: spacing.xxxl }, body: { color: colors.muted, lineHeight: 22, fontSize: 14 }, error: { color: colors.error, fontSize: 13 } });
