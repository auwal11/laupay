LAUPAY — REAL BACKEND INTEGRATION + PROFILE PHOTO + SIDEBAR + DASHBOARD POLISH

IMPORTANT:
This is an existing LAUPAY project.

DO NOT create a new backend.
DO NOT replace the existing NestJS/Prisma/Supabase architecture.
DO NOT create mock APIs.
DO NOT use demo users, fake balances, fake transactions, or fake authentication.

The existing backend is the source of truth.

==================================================
CURRENT REAL BACKEND STATUS
==================================================

Already verified server-side:

- Register → Email OTP → Login
- Registration does not issue tokens before OTP verification
- Login before OTP returns 401
- Correct OTP activates the account
- New users start with ₦0 balance
- Supabase PostgreSQL is connected
- Paystack TEST credentials configured server-side
- Monnify SANDBOX credentials configured server-side
- VTpass SANDBOX credentials configured server-side
- Brevo email provider implemented server-side
- Existing provider abstractions must be preserved

The public backend deployment is still being completed.

Therefore:

If the backend is unavailable, NEVER fall back to mock data.

Show proper loading/error states instead.

==================================================
READ THESE FILES FIRST
==================================================

1. docs/decisions/00-project-status.md
2. docs/decisions/0004-customer-web-integration-audit.md
3. docs/architecture/overview.md
4. docs/architecture/wallet-ledger-model.md
5. docs/security/security-model.md
6. backend/README.md

Inspect the actual backend routes and response shapes before writing frontend API calls.

Do not invent endpoint names or response structures.

==================================================
PART 1 — REMOVE ALL MOCK AUTH/DATA
==================================================

Remove all normal-runtime mock/demo behaviour.

Search the entire customer-web app for:

Amina
17450
password123
mock
demo
fake
sample
dummy
hardcoded balance
hardcoded transactions
demo login
fake session

Remove these from normal application execution.

Mocks may remain ONLY inside isolated automated tests.

NEVER:

- allow any password to log in
- create a fake session
- use a demo user
- show fake wallet balance
- show fake transactions
- show fake successful purchases
- fall back to mock data when backend fails

If backend is unavailable, show:

"LAUPAY is temporarily unable to reach the service. Please try again."

with a Retry action.

==================================================
PART 2 — REAL REGISTRATION
==================================================

Registration must use the real backend.

Flow:

Register
→ OTP screen
→ Email OTP
→ Verify OTP
→ Account ACTIVE
→ Login
→ Dashboard

Registration fields:

- Full name
- Email
- Phone number
- Account type: Customer / Agent
- Password
- Confirm password
- Profile picture

==================================================
PART 3 — PROFILE PICTURE DURING REGISTRATION
==================================================

Add an optional profile-picture upload to registration.

Design it professionally and consistently with LAUPAY.

Registration UI:

[ Profile picture ]
[ Camera / Upload icon ]

"Add profile photo"
"Optional"

Allow:

- Camera on supported mobile devices
- Gallery/file picker
- JPG/JPEG
- PNG
- WebP where supported
- reasonable file-size validation
- image preview before submission
- remove/change image

IMPORTANT:

Do not send the raw image directly to Brevo.

The image must be handled through the proper application/backend architecture.

FIRST inspect whether the existing backend already has profile/avatar support.

If avatar/profile-image support already exists:
use the existing endpoint/model.

If it does NOT exist:
implement the smallest secure backend-compatible solution needed.

Requirements:

- authenticated/user ownership
- secure upload handling
- file type validation
- file size validation
- no executable files
- no arbitrary HTML/SVG execution
- no trust of client MIME type alone
- safe storage URL/reference
- do not store large binary blobs unnecessarily in PostgreSQL if the existing architecture has a suitable object-storage approach

Do NOT introduce a random third-party image service without approval.

Do NOT expose private storage credentials to frontend.

==================================================
PART 4 — PROFILE PHOTO IN DASHBOARD
==================================================

After registration/login, the user's uploaded profile picture must appear throughout the authenticated application.

Use the REAL authenticated user's profile.

The dashboard header/sidebar should show:

[PROFILE PHOTO]
User Full Name
Customer / Agent

Example:

○ Auwal Bashar
  Customer

Do NOT use "Amina".

If the user has no profile picture:

show a clean initials/avatar fallback.

Example:

AB

The fallback must be generated from the user's real name.

==================================================
PART 5 — PROFILE PAGE
==================================================

Update /app/profile.

Show:

- Profile picture
- Full name
- Email
- Phone number
- Account type
- Account status

Allow the authenticated user to:

- change profile picture
- remove profile picture
- update allowed profile fields

Do not allow users to change security-sensitive fields without the appropriate backend flow.

If profile update APIs do not exist, inspect backend first and implement only what is necessary.

Never store profile state only in localStorage.

After update, refresh the real user profile.

==================================================
PART 6 — SIDEBAR REDESIGN / FIX
==================================================

Fix the authenticated dashboard sidebar to match the approved LAUPAY design.

Desktop behaviour:

COLLAPSED:
- narrow icon rail
- logo/icon at top
- icons only
- tooltips on hover
- active route indicator

EXPANDED:
- logo + LAUPAY
- icon + route label
- smooth width animation
- active route indicator
- premium clean surface

The sidebar must NOT permanently occupy too much screen width.

Use a professional compact layout similar to modern SaaS products.

Navigation:

Home
Airtime
Data
Wallet
Transactions
Security
Profile

Log out at the bottom.

User profile area should appear naturally in the sidebar/header using the REAL uploaded profile image.

Desktop:
- collapse/expand control
- remember preference locally if appropriate
- keyboard accessible

Mobile:
- sidebar becomes a slide-in drawer
- hamburger/menu button opens it
- backdrop closes it
- selecting a route closes the drawer
- no horizontal overflow
- no sidebar permanently consuming mobile screen width

IMPORTANT:
Remove any visible developer/debug comment such as:

"// Mobile: slide-in drawer..."

from rendered UI.

Comments may remain in source code if useful, but NEVER render them to users.

==================================================
PART 7 — REAL DASHBOARD
==================================================

Dashboard must load real authenticated data.

Remove:

- Amina
- ₦17,450
- ₦18,450 total
- ₦1,000 pending
- fake activity
- fake transactions
- fake wallet numbers

Use real backend APIs.

Expected data sources where available:

/me
/wallet
/wallet/transactions
/orders
existing transaction/order APIs

Inspect actual backend implementation before connecting.

Dashboard should show:

- real user's name
- real profile photo
- real account type
- real wallet balance
- real transaction/activity data
- real status information

Freshly registered user should show:

₦0.00

until a legitimate backend ledger credit occurs.

==================================================
PART 8 — DASHBOARD MOBILE POLISH
==================================================

Based on the independent browser review, fix these dashboard issues:

1. Mobile layout must not have excessive empty space.
2. Cards should use available viewport efficiently.
3. Recent activity should not feel detached from the balance section.
4. Quick actions should remain easy to tap.
5. Sidebar drawer must not cover content incorrectly.
6. No horizontal scrolling.
7. Profile image must remain properly cropped as a circle.
8. Text must not overflow.
9. Loading states should preserve layout instead of causing large jumps.

Keep the existing premium LAUPAY visual identity.

Do NOT redesign the entire dashboard.

==================================================
PART 9 — LOGIN
==================================================

Login must use real backend authentication.

Requirements:

- Email
- Password
- Loading state
- Invalid credentials error
- Unverified account handling
- Backend unavailable handling
- Forgot password
- Create account

Wrong password must NOT authenticate.

No demo login.

No automatic login.

==================================================
PART 10 — OTP SCREEN
==================================================

Create a polished /verify-otp page.

Requirements:

- 6 digit OTP
- auto focus
- paste support
- resend OTP
- countdown/cooldown
- loading state
- invalid OTP state
- expired OTP state
- success state
- mobile friendly

After successful verification:

→ redirect to Login

Do not automatically invent a session unless the backend explicitly supports that flow.

==================================================
PART 11 — REAL WALLET
==================================================

Wallet page must use real backend data.

Show:

- Available balance
- Transaction history
- Pending/confirmed information where supported
- Loading state
- Empty state
- Error state

Frontend must NEVER mutate wallet balance.

Backend LedgerService is the source of truth.

==================================================
PART 12 — REAL TRANSACTIONS
==================================================

Remove static transaction arrays.

Load real transactions from backend.

Display:

- Reference
- Type
- Amount
- Status
- Date/time
- Service/network where available

Support:

SUCCESS
PENDING
FAILED
UNKNOWN

Never convert UNKNOWN into FAILED.

==================================================
PART 13 — REAL AIRTIME
==================================================

Connect Airtime UI to the real backend.

Flow:

Select network
→ phone number
→ amount
→ review
→ confirm
→ processing
→ result

Supported networks:

MTN
Airtel
Glo
9mobile

Frontend sends user input only.

Backend determines authoritative:

- price
- wallet debit
- provider request
- transaction state

Never call VTpass directly from browser.

==================================================
PART 14 — REAL DATA
==================================================

Connect Data UI to backend.

Load real plans where implemented.

Show:

- Network
- Data plan
- Customer price
- Phone
- Review
- Confirm
- Processing
- Result

Do NOT expose provider cost to customers.

Do NOT hardcode production pricing.

==================================================
PART 15 — REAL PAYMENT FUNDING
==================================================

Connect wallet funding to the existing backend payment flow.

Use backend payment initialization.

Do NOT expose:

- Paystack secret key
- Monnify secret key
- Brevo API key
- VTpass credentials
- DATABASE_URL
- JWT secret

Frontend must never directly perform secret provider operations.

Wallet credit occurs only after backend verification/webhook.

If public backend/webhook is not ready:

show a clear staging-unavailable state.

NEVER fake a successful funding transaction.

==================================================
PART 16 — FORGOT PASSWORD
==================================================

Keep /forgot-password.

Improve UX:

After submission show a neutral message such as:

"If an account exists for this email, we've sent password reset instructions."

Do not reveal whether an email exists.

Add:

- loading state
- success state
- error state
- resend/retry where appropriate

==================================================
PART 17 — REGISTER VALIDATION
==================================================

Add:

- Confirm password
- Password strength hint
- Password mismatch validation
- Email validation
- Phone validation
- Required-field validation
- Profile image validation

Keep validation friendly and clear.

Do not expose unnecessary backend details.

==================================================
PART 18 — THEME / DESIGN
==================================================

Preserve approved LAUPAY identity:

Deep Navy
Amber
White/light surfaces
Existing LAUPAY logo
Existing typography
Existing landing-page visual language

Support:

Light
Dark
System

Do not introduce random colors.

Do not turn the app into a generic banking dashboard.

Do not add fake statistics, testimonials, logos, or unsupported claims.

==================================================
PART 19 — ACCESSIBILITY
==================================================

Ensure:

- proper form labels
- keyboard navigation
- focus states
- accessible buttons
- accessible sidebar controls
- avatar upload accessible
- image alt text
- sufficient contrast
- reduced-motion support

==================================================
PART 20 — SAME DOMAIN
==================================================

Keep all customer experience on:

https://laupay.vercel.app

Routes:

/
 /login
 /register
 /verify-otp
 /forgot-password
 /app
 /app/airtime
 /app/data
 /app/wallet
 /app/transactions
 /app/security
 /app/profile

Do NOT redirect to a separate landing-page domain.

==================================================
PART 21 — SECURITY
==================================================

Never:

- expose provider secrets
- trust frontend wallet amounts
- trust frontend prices
- trust frontend transaction status
- bypass backend authorization
- store wallet balance in frontend as authoritative state
- upload arbitrary files
- allow cross-user profile access
- allow one user to update another user's profile/photo

Preserve backend:

- JWT authentication
- authorization
- LedgerService
- idempotency
- row-level locking
- provider abstractions
- UNKNOWN state
- reversal logic

==================================================
PART 22 — MOCK AUDIT
==================================================

Search the complete customer-web application and remove normal-runtime references to:

Amina
17450
18450
1000 pending
password123
mock user
mock balance
mock transaction
demo login
demo success
fake wallet
sample transaction

After the audit, a fresh user must NEVER see demo data.

==================================================
PART 23 — TESTING
==================================================

Run frontend build.

Run backend tests where applicable.

Then manually test:

1. Open /register
2. Register fresh user
3. Upload profile picture
4. Preview picture
5. Complete registration
6. Receive OTP
7. Verify OTP
8. Login
9. Dashboard loads
10. Correct real name appears
11. Uploaded profile photo appears
12. Fresh wallet = ₦0
13. No Amina
14. No fake transactions
15. Sidebar works
16. Desktop collapse/expand works
17. Mobile drawer works
18. Profile page shows same real photo
19. Logout
20. Wrong password rejected
21. Correct password accepted
22. Wallet loads real backend data
23. Transactions load real backend data
24. Airtime calls backend
25. Data calls backend
26. Backend failure shows proper error
27. No mock fallback

==================================================
FINAL RULE
==================================================

DO NOT claim "end-to-end complete" unless the real public backend is reachable and the complete real flow has actually been tested.

If the backend deployment is still pending, report exactly:

"Frontend integration is complete, but public backend deployment is still required for full end-to-end verification."

Do not hide missing backend functionality with mock data.

At the end, provide a concise implementation report:

1. Files changed
2. Backend APIs used
3. Profile-photo implementation
4. Sidebar changes
5. Mock data removed
6. Tests/build result
7. Any remaining blocker

Do not make unrelated changes.