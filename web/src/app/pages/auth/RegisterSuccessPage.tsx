import { Link } from "react-router-dom";
import { AuthShell } from "@app/components/auth/AuthShell";
import { Button } from "@app/components/ui/Button";

export function RegisterSuccessPage() {
  return <AuthShell variant="centered" eyebrow="Step 5 of 5" header={<><h1 className="mt-4 font-display text-2xl font-extrabold leading-[1.08] tracking-[-.045em] text-white">You’re all set</h1><p className="mt-2 text-sm leading-6 text-white/65">Your LAUPAY account is ready.</p></>}><div className="flex flex-col items-center gap-5 py-8 text-center"><Progress /><div className="flex h-16 w-16 items-center justify-center rounded-full bg-laupay-amber text-3xl text-laupay-ink">✓</div><p className="text-sm text-laupay-ink-muted">Your email and transaction PIN are set up.</p><Link to="/app" className="w-full"><Button fullWidth>Go to dashboard</Button></Link></div></AuthShell>;
}

function Progress() {
  return <div className="mb-1 flex w-full gap-2" aria-label="Registration step 5 of 5">{[1, 2, 3, 4, 5].map((item) => <span key={item} className="h-1.5 flex-1 rounded-full bg-laupay-amber" />)}</div>;
}
