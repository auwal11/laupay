import { Link, useLocation } from "react-router-dom";
import { AuthLayout } from "@/layouts/AuthLayout";

export function LegalPage() {
  const isPrivacy = useLocation().pathname === "/privacy";
  return <AuthLayout><h1 className="font-display text-lg font-semibold text-laupay-ink">{isPrivacy ? "Privacy Policy" : "Terms of Service"}</h1><p className="mt-3 text-sm leading-6 text-laupay-ink-muted">{isPrivacy ? "LAUPAY, a service of Ibrahim Lau Provision Shop, uses your account information to provide secure wallet and digital service transactions. We do not sell your personal information." : "By using LAUPAY, you agree to provide accurate account information, protect your credentials, and use the service lawfully. Wallet and transaction decisions are made by the LAUPAY backend."}</p><Link to="/register" className="mt-6 inline-block text-sm font-medium text-laupay-indigo hover:underline">Back to registration</Link></AuthLayout>;
}
