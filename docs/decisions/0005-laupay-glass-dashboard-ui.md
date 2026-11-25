# Laupay Glass Dashboard UI

## Scope

Apply the Laupay Glass visual system to the authenticated customer and admin dashboards without changing business logic, routes, authentication, APIs, wallet operations, or admin permissions. The marketing site remains unchanged.

## Visual system

`web/src/index.css` defines the shared navy/glass tokens (`--glass-navy`, `--glass-surface`, `--glass-border`, `--glass-text`, `--glass-muted`, and `--glass-teal`) and applies them only inside `.customer-shell` and `.admin-shell`. Existing customer glass panels and admin cards are reused as shared surface primitives; existing status badges retain semantic status colours. On small screens blur is reduced to 10px. If `backdrop-filter` is unavailable, panels and headers use opaque navy fallbacks. Existing reduced-motion preferences disable card motion.

## Customer dashboard

The dashboard keeps its wallet balance and existing shortcuts and now surfaces the latest four real transactions via the existing `TransactionList` component, with a link to full transaction history. No mock metrics or invented transaction data are added. Existing receipt, dispute, wallet and purchase flows are reused unchanged.

## Admin dashboard

The existing admin shell, role-filtered navigation, live API-backed overview cards, provider health, attention items, service switches, audit data, users and transaction tables retain their current data and permission checks. Styling is changed through the scoped glass tokens and existing `admin-card` surface class; no charts or metrics are fabricated.

## Files changed

- `web/src/index.css` — scoped glass tokens, dark dashboard surfaces, contrast, responsive blur and browser fallbacks.
- `web/src/app/pages/customer/DashboardPage.tsx` — add a recent-activity section using existing transaction data.
- `docs/decisions/0005-laupay-glass-dashboard-ui.md` — design and implementation note.

## Verification

Run `npm run typecheck` and `npm run build` from `web/`. Review the customer dashboard at desktop and mobile widths; verify login, wallet, purchases, history, disputes and admin role-gated routes remain intact. Provider/API behavior is not changed by this UI work.
