import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, AppMark, FormField, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { ApiError } from '../../src/api/http';
import { colors, spacing } from '../../src/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try { await login(email, password); router.replace('/'); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Sign-in could not be completed. Try again.'); }
    finally { setLoading(false); }
  };
  return <Screen scroll style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
    <View style={styles.brand}><AppMark size={58} /><Text style={styles.wordmark}>LAUPAY</Text><Text style={styles.tagline}>Your money. Your control.</Text></View>
    <View style={styles.heading}><Text style={styles.title}>Good to see you</Text><Text style={styles.subtitle}>Sign in to your LAUPAY account.</Text></View>
    <FormField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
    <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" onSubmitEditing={() => void submit()} />
    <View style={styles.forgotRow}><Link href="/(auth)/forgot-password" asChild><Pressable><Text style={styles.link}>Forgot password?</Text></Pressable></Link></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <AppButton title="Sign in securely" loading={loading} onPress={() => void submit()} />
    <View style={styles.footer}><Text style={styles.subtitle}>New to LAUPAY?</Text><Link href="/(auth)/register" asChild><Pressable><Text style={styles.link}>Create an account</Text></Pressable></Link></View>
  </KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ safe: { flexGrow: 1 }, content: { flex: 1, justifyContent: 'center', gap: spacing.lg }, brand: { alignItems: 'center', gap: 5, marginBottom: spacing.lg }, wordmark: { fontSize: 20, fontWeight: '900', letterSpacing: 2, color: colors.midnight }, tagline: { fontSize: 12, color: colors.muted }, heading: { gap: 5, marginBottom: spacing.sm }, title: { fontSize: 27, fontWeight: '900', color: colors.midnight }, subtitle: { fontSize: 14, color: colors.muted }, forgotRow: { alignItems: 'flex-end', marginTop: -spacing.sm }, link: { color: colors.navy2, fontWeight: '800', fontSize: 14 }, error: { color: colors.error, lineHeight: 20, fontSize: 13 }, footer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm } });
