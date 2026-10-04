# Handoff — next agent (2026-10-04)

## Done & live
- laupay.vercel.app serves the unified web/ app (landing + /login + /register + /app), Vercel rootDirectory = web.
- fix-vtu-async-reversal merged (VtuTransaction.orderId @unique, PIN, agent pricing migration). Unit 6/6, e2e 42/42.
- Animated FlowMark loading on buttons; BalanceCard indigo fix.

## Credentials
Stored in the Lovable project secret store (never commit): DATABASE_URL (Supabase), VTPASS_API_KEY,
PAYSTACK_TEST_PUBLIC_KEY, STRIPE_TEST_API_KEY (= Paystack test secret), MONNIFY_API_KEY, MONNIFY_SECRET_KEY,
MONNIFY_BASE_URL, BREVO_API_KEY. Must also be set as backend host env vars (not frontend).

## Next tasks (not started — earlier draft code was lost)
1. Backend providers behind existing interfaces: PaystackPaymentProvider, MonnifyPaymentProvider (PaymentProvider),
   VtpassVtuProvider (VTUProvider); select via PAYMENT_PROVIDER / VTU_PROVIDER env. Real webhook verifiers.
2. Brevo email OTP: register -> OTP -> login (no tokens before verify).
3. Admin TEST FUND via LedgerService only.
4. Deploy backend publicly; wire web/src/app to real API; remove all mock auth/data (see next-agent-brief.md).
5. Sidebar (reference: collapsible floating sidebar, icon-only mini mode, MENU/GENERAL groups, profile photo at top)
   in LAUPAY indigo/amber — not red.
6. Profile photo upload + dashboard polish per brief.
