import { PropsWithChildren, ReactNode, useState } from 'react';
import { ActivityIndicator, Image, ImageSourcePropType, Pressable, PressableProps, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '../theme';

export function Screen({ children, scroll = false, style }: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const insets = useSafeAreaInsets();
  if (scroll) {
    return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxxl + insets.bottom }, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>;
  }
  return <SafeAreaView style={[styles.safe, style]} edges={['top', 'bottom']}>{children}</SafeAreaView>;
}

export function AppMark({ size = 54 }: { size?: number }) {
  return <Image source={require('../../assets/images/laupay-mark.png') as ImageSourcePropType} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="LAUPAY mark" />;
}

export function ProfileAvatar({ uri, initials, size = 40 }: { uri?: string | null; initials: string; size?: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = Boolean(uri && failedUri === uri);
  const fallback = initials.trim().slice(0, 2).toUpperCase() || 'L';
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    {uri && !failed ? <Image source={{ uri }} onError={() => setFailedUri(uri)} style={{ width: size, height: size }} accessibilityLabel="Profile photo" /> : <Text style={[styles.avatarText, { fontSize: Math.max(11, size * 0.3) }]}>{fallback}</Text>}
  </View>;
}

export function BrandLockup({ dark = false, subtitle }: { dark?: boolean; subtitle?: string }) {
  return <View style={styles.brandRow}><AppMark size={44} /><View><Text style={[styles.brand, dark && styles.brandLight]}>LAUPAY</Text>{subtitle ? <Text style={[styles.brandSub, dark && styles.brandSubLight]}>{subtitle}</Text> : null}</View></View>;
}

export function AppButton({ title, onPress, variant = 'primary', loading = false, disabled = false, icon, style, ...props }: Omit<PressableProps, 'style'> & { title: string; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; icon?: ReactNode; style?: ViewStyle }) {
  const muted = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: muted, busy: loading }} onPress={onPress} disabled={muted} style={({ pressed }) => [styles.button, styles[`button_${variant}`], muted && styles.buttonDisabled, pressed && !muted && styles.buttonPressed, style]} {...props}>
    {loading ? <ActivityIndicator color={variant === 'primary' ? colors.midnight : colors.navy} /> : <>{icon}{<Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>}</>}
  </Pressable>;
}

export function AppCard({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, shadow.card, style]}>{children}</View>;
}

export function GlassCard({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

export function FormField({ label, error, dark = false, style, ...props }: TextInputProps & { label: string; error?: string; dark?: boolean }) {
  return <View style={[styles.fieldWrap, style]}><Text style={[styles.label, dark && styles.labelDark]}>{label}</Text><TextInput placeholderTextColor={dark ? colors.glassMuted : '#94A3B8'} style={[styles.input, dark && styles.inputDark, error && styles.inputError]} autoCorrect={false} {...props} />{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>;
}

export function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{title}</Text>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.link}>{action}</Text></Pressable> : null}</View>;
}

export function StatusBadge({ status }: { status: string }) {
  const value = status.toLowerCase();
  const tone = value.includes('success') || value === 'fulfilled' ? [colors.softGreen, colors.success] : value.includes('fail') || value === 'cancelled' ? [colors.softRed, colors.error] : value.includes('unknown') ? [colors.softGold, '#92400E'] : [colors.softBlue, colors.navy2];
  return <View style={[styles.badge, { backgroundColor: tone[0] }]}><Text style={[styles.badgeText, { color: tone[1] }]}>{status.replaceAll('_', ' ').toLowerCase()}</Text></View>;
}

export function InlineNotice({ title, body, tone = 'info', action }: { title: string; body: string; tone?: 'info' | 'error' | 'success'; action?: ReactNode }) {
  const bg = tone === 'error' ? colors.softRed : tone === 'success' ? colors.softGreen : colors.softBlue;
  const fg = tone === 'error' ? colors.error : tone === 'success' ? colors.success : colors.navy2;
  return <View style={[styles.notice, { backgroundColor: bg }]}><Text style={[styles.noticeTitle, { color: fg }]}>{title}</Text><Text style={styles.noticeBody}>{body}</Text>{action}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { color: colors.midnight, fontSize: 18, fontWeight: '900', letterSpacing: 1.4 },
  brandLight: { color: colors.white },
  brandSub: { color: colors.subtext, fontSize: 11, marginTop: 2 },
  brandSubLight: { color: '#CBD5E1' },
  button: { minHeight: 54, borderRadius: radius.md, paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  button_primary: { backgroundColor: colors.gold },
  button_secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  button_ghost: { backgroundColor: 'transparent' },
  button_danger: { backgroundColor: colors.error },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  buttonText: { fontSize: 15, fontWeight: '800' },
  buttonText_primary: { color: colors.midnight },
  buttonText_secondary: { color: colors.navy },
  buttonText_ghost: { color: colors.navy },
  buttonText_danger: { color: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#E8EDF3' },
  glassCard: { backgroundColor: colors.glassSurface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.glassBorder },
  avatar: { backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder },
  avatarText: { color: colors.white, fontWeight: '900' },
  fieldWrap: { gap: spacing.xs },
  label: { fontSize: 13, fontWeight: '700', color: colors.navy },
  labelDark: { color: colors.glassMuted },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: spacing.lg, color: colors.text, fontSize: 16 },
  inputDark: { borderColor: colors.glassBorder, backgroundColor: colors.glassSurface, color: colors.glassText },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  sectionTitle: { color: colors.midnight, fontSize: 18, fontWeight: '800' },
  link: { color: colors.navy2, fontWeight: '800', fontSize: 13 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  notice: { borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  noticeTitle: { fontSize: 14, fontWeight: '800' },
  noticeBody: { color: colors.subtext, fontSize: 13, lineHeight: 19 },
});
