import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, FormField, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { ApiError } from '../../src/api/http';
import { colors, spacing } from '../../src/theme';

const TERMS_VERSION = '2026-10-15';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (fullName.trim().length < 2) { setError('Enter your full name.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (!/^(?:\+234|0)[789]\d{9}$/.test(normalizedPhone)) { setError('Enter a valid Nigerian phone number.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    if (!accepted) { setError('Please confirm that you accept the Terms and Privacy Policy.'); return; }
    setLoading(true);
    try {
      await register({ email: email.trim().toLowerCase(), password, fullName: fullName.trim(), phone: normalizedPhone, termsAccepted: true, termsVersion: TERMS_VERSION });
      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase() } });
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Account creation could not be completed. Try again.'); }
    finally { setLoading(false); }
  };

  return <Screen scroll><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
    <Link href="/(auth)/login" asChild><Pressable><Text style={styles.back}>‹  Back to sign in</Text></Pressable></Link>
    <View style={styles.heading}><Text style={styles.title}>Create your account</Text><Text style={styles.subtitle}>A few details to get your wallet ready.</Text></View>
    <FormField label="Full name" value={fullName} onChangeText={setFullName} placeholder="As it appears on your account" autoComplete="name" textContentType="name" />
    <FormField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
    <FormField label="Nigerian phone number" value={phone} onChangeText={setPhone} placeholder="080… or +234…" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
    <FormField label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
    <FormField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter password again" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={styles.consent}><View style={[styles.check, accepted && styles.checked]}><Text style={styles.checkText}>{accepted ? '✓' : ''}</Text></View><Text style={styles.consentText}>I accept LAUPAY’s Terms and Privacy Policy.</Text></Pressable>
    <Text style={styles.note}>We’ll send a 6-digit verification code to your email address.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <AppButton title="Create account" loading={loading} onPress={() => void submit()} />
  </KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.lg, paddingTop: spacing.sm }, back: { color: colors.navy2, fontWeight: '800' }, heading: { gap: 5, marginBottom: spacing.sm }, title: { fontSize: 26, fontWeight: '900', color: colors.midnight }, subtitle: { fontSize: 14, color: colors.muted }, consent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.navy2, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.navy2 }, checkText: { color: colors.white, fontWeight: '900' }, consentText: { color: colors.navy, fontSize: 13, flex: 1 }, note: { color: colors.muted, fontSize: 12 }, error: { color: colors.error, fontSize: 13 } });
