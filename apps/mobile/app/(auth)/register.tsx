import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { AppButton, AppMark, FormField, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/features/auth/AuthProvider';
import { ApiError } from '../../src/api/http';
import { colors, radius, spacing } from '../../src/theme';

const TERMS_VERSION = '2026-10-19';

type Step = 1 | 2;

export default function RegisterScreen() {
  const { register } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const continueDetails = () => {
    setError(null);
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (fullName.trim().length < 2) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!/^(?:\+234|0)[789]\d{9}$/.test(normalizedPhone)) return setError('Enter a valid Nigerian phone number.');
    setStep(2);
  };

  const createAccount = async () => {
    setError(null);
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return setError('Use at least 8 characters with upper-case, lower-case and a number.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (!accepted) return setError('Please agree to the Terms of Service and Privacy Policy to continue.');
    setLoading(true);
    try {
      await register({ email: email.trim().toLowerCase(), password, fullName: fullName.trim(), phone: phone.replace(/[\s()-]/g, ''), termsAccepted: true, termsVersion: TERMS_VERSION });
      router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim().toLowerCase() } });
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Account creation could not be completed. Try again.'); }
    finally { setLoading(false); }
  };

  return <Screen scroll><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
    <View style={styles.brand}><AppMark size={45} /><Text style={styles.wordmark}>LAUPAY</Text></View>
    <Text style={styles.stepLabel}>STEP {step} OF 5</Text>
    <View style={styles.progress} accessibilityLabel={`Registration step ${step} of 5`}>{[1, 2, 3, 4, 5].map((item) => <View key={item} style={[styles.progressBar, item <= step && styles.progressActive]} />)}</View>
    <View style={styles.heading}><Text style={styles.title}>Create your LAUPAY account</Text><Text style={styles.subtitle}>A few steps to get you set up securely.</Text></View>

    {step === 1 ? <View style={styles.form}>
      <FormField label="Full name" value={fullName} onChangeText={setFullName} placeholder="As it appears on your account" autoComplete="name" textContentType="name" autoFocus />
      <FormField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <FormField label="Phone number" value={phone} onChangeText={setPhone} placeholder="0801 234 5678" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <AppButton title="Continue" onPress={continueDetails} />
    </View> : <View style={styles.form}>
      <FormField label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
      <Text style={styles.hint}>At least 8 characters, with upper-case, lower-case and a number.</Text>
      <FormField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter password again" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={styles.consent}><View style={[styles.check, accepted && styles.checked]}><Text style={styles.checkText}>{accepted ? '✓' : ''}</Text></View><Text style={styles.consentText}>I agree to the Terms of Service and Privacy Policy.</Text></Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.buttonRow}><AppButton title="Back" variant="secondary" onPress={() => { setError(null); setStep(1); }} disabled={loading} style={styles.backButton} /><AppButton title={loading ? 'Creating account…' : 'Continue'} loading={loading} onPress={() => void createAccount()} style={styles.continueButton} /></View>
    </View>}
    <Text style={styles.footer}>Already have an account? <Link href="/(auth)/login" asChild><Pressable><Text style={styles.link}>Log in</Text></Pressable></Link></Text>
  </KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.sm }, brand: { alignItems: 'center', gap: 4, marginBottom: spacing.sm }, wordmark: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5, color: colors.midnight }, stepLabel: { color: colors.midnight, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 }, progress: { flexDirection: 'row', gap: spacing.sm }, progressBar: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.border }, progressActive: { backgroundColor: colors.gold }, heading: { gap: 5 }, title: { fontSize: 26, fontWeight: '900', lineHeight: 31, color: colors.midnight }, subtitle: { fontSize: 14, lineHeight: 20, color: colors.muted }, form: { gap: spacing.lg }, hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -spacing.sm }, consent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.navy2, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: colors.navy2 }, checkText: { color: colors.white, fontWeight: '900' }, consentText: { color: colors.navy, fontSize: 13, flex: 1, lineHeight: 18 }, error: { color: colors.error, fontSize: 13, lineHeight: 19 }, buttonRow: { flexDirection: 'row', gap: spacing.sm }, backButton: { flex: 0.8 }, continueButton: { flex: 1.5 }, footer: { color: colors.muted, fontSize: 14, textAlign: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }, link: { color: colors.navy2, fontWeight: '800' },
});
