import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { AppButton, FormField, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { ApiError } from '../../src/api/http';
import { colors, spacing } from '../../src/theme';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = String(params.email ?? '');
  const { verifyEmail, resendEmailCode } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code sent to your email.'); return; }
    setLoading(true);
    try { await verifyEmail(email, code); router.replace('/'); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Verification could not be completed. Try again.'); }
    finally { setLoading(false); }
  };
  const resend = async () => {
    setError(null); setMessage(null);
    try { const result = await resendEmailCode(email); setMessage(result.message || 'If that account is awaiting verification, a code has been sent.'); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'The code could not be resent right now.'); }
  };
  return <Screen scroll><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
    <Link href="/(auth)/login" asChild><Pressable><Text style={styles.back}>‹  Back to sign in</Text></Pressable></Link>
    <Text style={styles.eyebrow}>EMAIL VERIFICATION</Text><Text style={styles.title}>Check your inbox</Text><Text style={styles.body}>Enter the 6-digit code sent to {email || 'your email address'}. The code is verified by LAUPAY’s server.</Text>
    <FormField label="Verification code" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
    {message ? <Text style={styles.success}>{message}</Text> : null}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <AppButton title="Verify email" loading={loading} onPress={() => void submit()} />
    <Pressable onPress={() => void resend()}><Text style={styles.link}>Resend code</Text></Pressable>
  </KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ content: { flex: 1, justifyContent: 'center', gap: spacing.lg }, back: { color: colors.navy2, fontWeight: '800' }, eyebrow: { color: colors.navy2, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: spacing.xxxl }, title: { color: colors.midnight, fontSize: 27, fontWeight: '900' }, body: { color: colors.muted, lineHeight: 22, fontSize: 14 }, success: { color: colors.success, fontSize: 13 }, error: { color: colors.error, fontSize: 13 }, link: { color: colors.navy2, fontWeight: '800', textAlign: 'center', padding: spacing.md } });
