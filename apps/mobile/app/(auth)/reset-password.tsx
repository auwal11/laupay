import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { AppButton, FormField, InlineNotice, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { ApiError } from '../../src/api/http';
import { colors, spacing } from '../../src/theme';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    if (!params.token) { setError('Open the password-reset link from your email to continue.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setLoading(true);
    try { await resetPassword(params.token, password); setDone(true); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'The password could not be reset.'); }
    finally { setLoading(false); }
  };
  return <Screen scroll style={styles.content}>
    <Link href="/(auth)/login"><Text style={styles.back}>‹  Back to sign in</Text></Link>
    <Text style={styles.title}>Choose a new password</Text><Text style={styles.body}>Use the secure reset link sent by LAUPAY. A reset token is never generated or stored by this screen.</Text>
    <FormField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    <FormField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
    {done ? <InlineNotice title="Password updated" body="Your password has been changed. Sign in with your new password." tone="success" /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <AppButton title={done ? 'Go to sign in' : 'Reset password'} loading={loading} onPress={() => done ? router.replace('/(auth)/login') : void submit()} />
  </Screen>;
}

const styles = StyleSheet.create({ content: { flex: 1, justifyContent: 'center', gap: spacing.lg }, back: { color: colors.navy2, fontWeight: '800' }, title: { color: colors.midnight, fontSize: 27, fontWeight: '900', marginTop: spacing.xxxl }, body: { color: colors.muted, lineHeight: 22, fontSize: 14 }, error: { color: colors.error, fontSize: 13 } });
