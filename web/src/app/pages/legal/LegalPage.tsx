import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FlowMark } from "@/components/laupay/FlowMark";

const LAST_UPDATED = "19 October 2026";

type LegalSection = {
  title: string;
  children: ReactNode;
};

function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-laupay-surface-muted text-laupay-ink">
      <header className="border-b border-laupay-border bg-laupay-indigo-deep text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-laupay-amber" aria-label="LAUPAY home">
            <FlowMark inverse />
            <span className="font-display text-lg font-extrabold tracking-[-.06em]">LAUPAY</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-bold text-white/70 sm:gap-5" aria-label="Legal navigation">
            <Link to="/terms" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-amber">Terms</Link>
            <Link to="/privacy" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-laupay-amber">Privacy</Link>
            <Link to="/login" className="rounded bg-laupay-amber px-3 py-2 text-laupay-ink hover:bg-laupay-amber-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-amber">Log in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="mb-8 border-b border-laupay-border pb-8 sm:mb-10 sm:pb-10">
          <p className="eyebrow text-laupay-indigo">LAUPAY · Ibrahim Lau Provision Shop</p>
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-[-.055em] text-laupay-indigo sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-laupay-ink-muted">{intro}</p>
          <p className="mt-4 text-xs font-semibold text-laupay-ink-muted">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="rounded-2xl border border-laupay-border bg-white p-6 shadow-[0_20px_60px_-32px_rgba(23,26,74,.35)] sm:p-10">
          <div className="space-y-9 text-[15px] leading-7 text-laupay-ink-muted">{children}</div>
        </div>

        <footer className="mt-8 flex flex-col gap-3 border-t border-laupay-border pt-6 text-xs font-semibold text-laupay-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>LAUPAY · Ibrahim Lau Provision Shop</span>
          <span>Questions? Use the support channel in your LAUPAY account.</span>
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }: LegalSection) {
  return (
    <section>
      <h2 className="font-display text-xl font-extrabold tracking-[-.04em] text-laupay-indigo sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-2 pl-5">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" intro="These terms explain the rules for using LAUPAY's digital services platform, including airtime, data, wallet and payment features.">
      <Section title="1. About LAUPAY"><p>LAUPAY is a digital services platform operated by Ibrahim Lau Provision Shop. Through LAUPAY, eligible users may access services such as airtime, data, wallet services and payment-related features. The available services may change as the platform develops.</p></Section>
      <Section title="2. Eligibility"><p>You must be at least 18 years old and able to enter a legally binding agreement to create and use a LAUPAY account. If you use LAUPAY for a business or on behalf of another person, you confirm that you have authority to do so. We may decline or restrict access where the law requires it.</p></Section>
      <Section title="3. Registration and account security"><p>You must provide accurate, current information when registering. Your account becomes usable for protected services only after you complete the required email verification and create a transaction PIN.</p><p>You are responsible for keeping your password, transaction PIN, email account and devices secure. Do not share your PIN or approve a transaction you did not start. Tell us promptly through the support channel in your account if you believe your account or credentials have been accessed without permission.</p></Section>
      <Section title="4. Services"><p>LAUPAY may let you buy airtime or data, fund or use a wallet, and use payment features made available in the app. Future services, including bill-related services, may be added. A service may be unavailable in a particular location, for a particular network or at a particular time.</p></Section>
      <Section title="5. Your responsibilities"><Bullets items={["Use truthful account and recipient information and keep it up to date.", "Use LAUPAY only for lawful and authorised purposes.", "Check the recipient, network, amount and other details before confirming a transaction.", "Do not interfere with the platform, bypass security controls, or attempt to access another person's account.", "Keep receipts and references for transactions you may need to query."]} /></Section>
      <Section title="6. Transactions, fees and status"><p>A transaction is submitted using the details you confirm. The backend and relevant provider records determine the authoritative amount, fee and status. A transaction may be successful, pending, failed or otherwise unresolved while a provider response is being checked.</p><p>Fees, where applicable, are shown before confirmation or in the transaction details. A receipt or reference confirms the recorded transaction event; it does not change a pending or failed transaction into a successful one. We may investigate and correct duplicate, reversed or incorrectly processed transactions in line with the applicable records.</p></Section>
      <Section title="7. Wallet credits"><p>Wallet balance is based on LAUPAY's ledger and verified payment records. A wallet is not a bank deposit account, and a displayed balance is not an invitation to treat unverified or reversed funds as available.</p><p>Promotional or test credits, where clearly identified, may have separate conditions, expiry or usage restrictions and may not be withdrawable. We will not treat an unverified provider callback as proof that a wallet should be credited.</p></Section>
      <Section title="8. Prohibited use"><p>You must not use LAUPAY for fraud, money laundering, impersonation, unauthorised payments, harassment, abuse of providers, credential testing, malicious code, or any activity that violates Nigerian law or another person's rights. We may investigate suspicious activity and preserve relevant records where appropriate.</p></Section>
      <Section title="9. Availability"><p>We aim to keep LAUPAY useful and reliable, but we do not promise uninterrupted availability or a particular response time. Maintenance, network outages, provider failures, security events and circumstances outside our reasonable control may interrupt a service.</p></Section>
      <Section title="10. Liability"><p>To the extent permitted by Nigerian law, Ibrahim Lau Provision Shop is not responsible for indirect or consequential loss, loss caused by inaccurate details supplied by you, or interruption caused by a third-party network or provider. Nothing in these terms excludes liability that cannot lawfully be excluded, including liability for fraud or death or personal injury caused by negligence.</p><p>Where we are responsible for a confirmed error, our remedy may include correcting the transaction, reversing a verified debit or refunding an applicable amount, subject to the provider and ledger records.</p></Section>
      <Section title="11. Suspension and termination"><p>We may suspend or close an account where information is inaccurate, credentials are compromised, activity is prohibited, a provider or legal requirement requires action, or continued access creates a security or financial risk. We may also close a service with reasonable notice where practical. Pending legitimate transaction or refund enquiries will be handled using the available records.</p></Section>
      <Section title="12. Changes to these terms"><p>We may update these terms when the service, law or security requirements change. We will publish the updated version and change the date above. If a change materially affects your use of LAUPAY, we may ask you to accept the updated terms before continuing.</p></Section>
      <Section title="13. Governing law"><p>These terms are governed by the laws of the Federal Republic of Nigeria. Any dispute will be handled by a court or other process with appropriate jurisdiction in Nigeria, subject to any rights you have under applicable law.</p></Section>
      <Section title="14. Contact"><p>For support, legal notices or a transaction question, use the support channel available in your LAUPAY account or reply to the service email sent to your registered email address. Include your registered email, transaction reference where relevant, and a clear description of the issue. Do not send your password or transaction PIN.</p></Section>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" intro="This policy explains what information LAUPAY collects, why we use it, and the practical choices available to you.">
      <Section title="1. Who we are"><p>LAUPAY is operated by Ibrahim Lau Provision Shop. In this policy, “LAUPAY”, “we” and “us” refer to the platform and its operator.</p></Section>
      <Section title="2. Information we collect"><Bullets items={["Account information such as your full name, email address and phone number.", "Security information needed for authentication, including email verification records and protected password or transaction PIN data. Passwords and PINs are not stored as plain text.", "Transaction information such as service, network, destination, amount, status, reference and timestamps.", "Wallet and payment information needed to record funding, debits, credits, reversals and provider references. We do not ask you to send provider secret keys through the app.", "Technical information such as device, browser, IP address, session and security-event information when needed to protect the service."]} /></Section>
      <Section title="3. How we use information"><p>We use information to create and maintain your account, send OTP and account emails, authenticate you, process requested services, maintain the wallet ledger, provide receipts and support, detect abuse, investigate disputes, improve reliability, and meet legal or accounting obligations.</p></Section>
      <Section title="4. Purpose and lawful basis"><p>We process information because it is needed to provide the service you request, maintain account and platform security, communicate important service information, prevent fraud and abuse, and comply with applicable legal obligations. Where a separate consent is required, we will ask for it clearly.</p></Section>
      <Section title="5. When we share information"><p>We share only what is reasonably needed with service providers that help us operate LAUPAY. This can include payment processors for wallet funding, airtime/data or VTU providers for fulfilment, email providers for OTP and account messages, hosting/database/storage providers, and professional or legal advisers where necessary. Providers receive the information needed for their role and are expected to protect it.</p><p>We do not sell your personal information. We may disclose information if required by law, to protect users or the platform, or as part of a lawful business change.</p></Section>
      <Section title="6. OTP and email communications"><p>We use an email provider such as Brevo, configured by LAUPAY, to send verification codes, password-reset messages and important account communications. OTP codes are time-limited and intended for one use. Do not share a code with anyone, including someone claiming to be support.</p></Section>
      <Section title="7. Security"><p>We use security controls appropriate to the service, including server-side authorization, hashed passwords and transaction PINs, protected sessions, access controls, audit records and provider verification. No online service can guarantee absolute security, so please protect your email, password, PIN and devices and report suspected misuse promptly.</p></Section>
      <Section title="8. Retention"><p>We retain account, transaction, ledger, security and support records for as long as needed to provide the service, resolve disputes, prevent abuse, meet tax/accounting requirements, and comply with applicable law. When information is no longer needed, we delete it, anonymise it or securely restrict access where appropriate.</p></Section>
      <Section title="9. Your choices and rights"><p>Depending on applicable law, you may ask for access to, correction of or deletion of personal information, or ask us to explain how it is used. Some records may need to be retained for legal, security or financial-integrity reasons. To make a request, use the support channel in your LAUPAY account or reply to a service email from your registered address. We may need to verify your identity before acting.</p></Section>
      <Section title="10. Cookies and local storage"><p>LAUPAY may use browser storage, including session storage, to keep an authenticated session and remember limited preferences. These values help the app function; they are not the authoritative source of your wallet balance or transaction status. You can clear browser storage, but doing so may sign you out or reset preferences.</p></Section>
      <Section title="11. Children"><p>LAUPAY is not intended for children under 18. We do not knowingly create accounts for children. If you believe a child has provided personal information, contact us through the support channel so we can review and take appropriate action.</p></Section>
      <Section title="12. Changes to this policy"><p>We may update this policy when our services, providers, security practices or legal obligations change. The latest version and its “Last updated” date will be published on this page. Where required, we will provide additional notice or ask for consent.</p></Section>
      <Section title="13. Privacy contact"><p>For a privacy request or question, use the support channel available in your LAUPAY account or reply to the service email sent to your registered email address. Include enough detail for us to understand the request, but never include your password, transaction PIN or OTP.</p></Section>
    </LegalLayout>
  );
}
