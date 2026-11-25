# LAUPAY Android Mobile — Audit da Implementation Plan

**Matsayi:** Phase 1 audit an kammala; ana jiran amincewa da wannan plan kafin fara mobile implementation.
**Repository:** `auwal11/laupay`, local working copy a branch `main`, HEAD `6d5030e` (a farkon audit, working tree clean).
**Manufa:** Android-first native fintech client da zai yi amfani da NestJS API da data records da suke nan; ba sabon backend ko frontend mockup ba.

## 1. Takaitaccen technical assessment

Repository ɗin ba komai ba ne: customer/admin web apps da NestJS/Prisma/PostgreSQL backend suna nan. Babban backend ɗin ya ƙunshi authentication, wallet/ledger, catalog, airtime/data orders, hosted payment funding, virtual accounts, withdrawals, disputes/support, notifications, security PIN da reconciliation. `apps/mobile/` babu source code a yanzu. Saboda haka za a ƙara mobile client dabam ba tare da maye gurbin `backend/`, `web/`, `apps/customer-web/`, schema ko migrations ba.

Akwai rashin daidaito tsakanin `docs/decisions/00-project-status.md` da source na yanzu: status doc har yanzu yana cewa wasu fasaloli (kamar real provider adapters, withdrawals, notifications da PIN) ba su wanzu, alhali code ɗin yanzu yana da modules/implementations. A gefe guda, wasu endpoints suna da iyaka ko placeholder behavior. Za a dogara da source/API contracts da gwaje-gwajen da aka gudanar, kuma a sabunta docs ne idan implementation ya tabbatar da halin yanzu.

### Ayyukan da API ke bayarwa a source ɗin yanzu

| Fannin app | Akwai a backend | Abin da mobile zai yi |
|---|---|---|
| Auth | `POST /auth/register`, `verify-otp`, `resend-otp`, `login`, password reset/change, refresh/logout, `GET /auth/me`. Registration tana buƙatar email, password, cikakken suna, lambar Najeriya da amincewa da Terms; OTP mai lamba 6 ana aikawa ta email, ba SMS/phone ba. | Haɗa kai tsaye da contract ɗin nan; kada a nuna phone OTP ko auth mock. |
| Wallet | `GET /wallet`, `GET /wallet/transactions` da detail; wallet balance ana daidaita shi daga authoritative backend/ledger. | Nuna ainihin balance/status da transaction records kawai; kada a adana ko ƙirƙiri balance a client. |
| Funding | `POST /payments/initialize`; virtual account `GET/POST /payments/virtual-account`; Monnify/Paystack adapters da webhook settlement. | Buɗe hosted checkout ta URL daga API ko nuna bank account na user idan endpoint ɗin ya dawo da shi; pending har backend ya tabbatar. |
| Airtime/data | `GET /catalog/networks`, `GET /catalog/data-plans/:networkCode`; `POST /orders/airtime`, `/orders/data`; list/detail orders. PIN da idempotency key suna cikin payload. Data plan price ana ɗauka ne daga DB, ba daga client ba. | Katalogu, airtime/data order, PIN confirmation, order status/receipt; amount/reference/status server-authoritative. |
| Withdrawals | `/withdrawals`, `/withdrawals/banks`, user history/detail; request PIN, real-credit provenance, idempotency da admin review/ledger holds/refund flow. | Nuna banku/limit/balance da backend ya bayar; babu alƙawarin auto-payout; test-credit ba za a iya withdraw ba. |
| Support/disputes | Support tickets/replies/tracking; disputes da ProofTrail endpoints. | Haɗa support da dispute path bisa ga transaction IDs/permissions. |
| Notifications | `/notifications`, unread count, mark-read/read-all; records a backend. | In-app notifications daga API; push notifications ba za a ce suna aiki ba sai an haɗa device-token registration. |
| Security | PIN status/set/change/verify; `/security/devices`, revoke, security notifications. | PIN yana aiki; sessions/devices a nuna a matsayin backend session list, ba a kira su ainihin device fingerprint ba. |

### Ba a tabbatar yana aiki ko babu shi ba

- Babu customer endpoints/controllers na electricity ko cable-TV package, verification ko purchase. `OrderType.BILL` a schema kaɗai ba hujja ba ce cewa service ɗin ya shirya. Ba za a nuna su a matsayin enabled ba.
- Babu referral/rewards APIs ko reward ledger; rewards ba za a ƙirƙira su ba.
- Babu transfer feature; transfer CTA ba zai bayyana ba.
- Biometric login/PIN da notification preferences ba su da backend protocol. Za a iya tantance biometrics a native device nan gaba, amma ba za a yi amfani da shi wajen authorize money-moving request ba sai an tsara secure backend step-up.
- `/security/devices` yana lissafa refresh-token sessions da labels na ƙirƙira na “Current session/Signed-in session”; ba ya adana hardware/device metadata. `/security/notifications` yana samar da audit summaries masu `read: true`, ba cikakken risk alert stream ba. A app za a bambanta waɗannan daga real device management da notifications.
- `SecurityService.assessOrderRisk()` a source yana dawowa koyaushe `allow` kuma an rubuta shi a fili a matsayin placeholder; kada app ya nuna “risk checked/protected” bisa ga wannan.
- Provider integrations suna nan a matsayin adapters, amma sandbox report (`SANDBOX-TEST-REPORT.md`) ya rubuta Monnify initialize/checkout a matsayin aiki, Paystack an toshe shi daga merchant account channel, VTpass airtime/data sandbox ya dawo `FAILED` kuma balance endpoint ya dawo `401`. Wannan rahoto ba hujja ba ce cewa production settlement ko kowane provider yana aiki a yau; ba za a gwada da real money ko canza live provider settings ba.
- `00-project-status.md` da `docs/decisions/0004-customer-web-integration-audit.md` na iya zama tsofaffi; customer web yana da mock adapter a default. Mobile ba zai kwafi mocks ɗin customer web ba.

### Gwaje-gwaje/tsaro da ke akwai

`backend/test/` yana da e2e/security tests na auth, OTP, PIN, notifications, virtual accounts, withdrawals, webhook/payments, VTU reconciliation da ledger-related flows. `SANDBOX-TEST-REPORT.md` ya rubuta (a lokacin da aka gudanar da shi) unit 32, e2e 49, web typecheck/build da backend build sun wuce. Ba a sake gudanar da waɗannan gwaje-gwaje a wannan audit ɗin ba; ba za a kira su fresh result ba. Backend yana da global DTO validation, JWT/RBAC, rate limiting, PIN lockout, ledger idempotency/row-locking logic, provider webhooks da reconciliation service. Risk decision har yanzu placeholder ne; aikin audit/production certification ba a ɗauka an kammala ba.

## 2. Shawarar architecture

Za a ƙirƙiri **React Native + Expo + TypeScript** native app a `apps/mobile/`, tare da Expo Router. Za a ci gaba da amfani da monorepo Git na mai amfani da NestJS backend ɗinsa a can. Ba za a sake amfani da Vite DOM screens a matsayin native screens ba: React web components da browser APIs ba su dace da Android UI/security/lifecycle ba; za a iya amfani da su ne a matsayin behavior/API reference kawai.

Wannan ya fi Capacitor dacewa saboda manufa ita ce Android-first app mai native navigation, safe-area/keyboard handling, secure token storage, haptics da APK build. Expo yana ba da Android keɓaɓɓen shell da damar iOS nan gaba. Mobile zai yi magana da `https://laupay.onrender.com/api` ko `EXPO_PUBLIC_API_BASE_URL` da aka saita a build; babu secrets ko provider keys a cikin bundle. Ba za a buƙaci sabon API/DB schema domin core screens ɗin da ke akwai ba.

### Tsarin fayilolin da ake nufi

```text
apps/mobile/
  app/                       # Expo Router routes: auth, onboarding, tabs, flows
  src/
    api/                     # typed HTTP client, auth refresh, endpoint adapters
    components/              # shared buttons, fields, cards, status, skeletons
    features/                # auth, wallet, funding, airtime, data, history, profile
    hooks/                   # query/lifecycle/network hooks
    lib/                     # theme, formatters, validation, idempotency
    types/                   # API response/payload types local to mobile
  assets/                    # LAUPAY icon/splash/brand resources
  app.config.ts              # app identity and Expo config
  .env.example               # public API base placeholder only
  package.json / lockfile
```

`backend/` ya ci gaba da mallakar business logic, pricing, auth, ledger, order state, provider calls, webhooks da financial reconciliation. `web/` da `apps/customer-web/` za su ci gaba da kasancewa kamar yadda suke. Shared TypeScript types za a ƙara ne kawai idan akwai contract ɗin da zai iya zama shared ba tare da sa frontend ya dogara da backend internals ba.

### Auth/session da integrity

- Access token ya kasance a memory kawai; refresh token a native Keychain/Android Keystore ta Expo SecureStore. Kada a yi AsyncStorage/localStorage don credentials. A farawa, a yi refresh da token rotation, sannan a nemi `/auth/me`; idan refresh ya gaza a share tokens kuma a nuna login.
- 401 handling ya yi single-flight refresh kuma ya sake gwada safe request sau ɗaya; idan session ta revoked/expired, share secure storage, ba tare da loop ba. Logout ya kira backend idan zai yiwu sannan ya share local tokens.
- Ka kiyaye API’s current email OTP contract; registration tana buƙatar phone amma verify code ɗin ana aika shi email. OTP, password, PIN da bearer tokens ba za su shiga logs ko analytics ba.
- Kowane purchase/funding/withdrawal request yana da unique idempotency key na request; a riƙe key ɗin iri ɗaya idan ana retry request ɗin nan, amma sabon intent ya sami sabon key. Kada a retry order mai ambiguous state ta ƙirƙirar order na biyu; a nemi server order status.
- Server ne ke ƙayyade balance, price, fees, eligibility da transaction state. UI loading/success ba ya zama shaida na settlement. Provider timeout yana zama pending/unknown har backend reconciliation ya warware.

## 3. Design system

A bi LAUPAY reference da aka bayar: premium Nigerian fintech, mai zaman kansa da OPay/PalmPay. Navy ne ke gina amana; amber/gold yana nuna babban action da hankali, ba duka allon ba. Palette: Midnight Navy `#071735`, Deep Navy `#101D40`, Secondary Navy `#1B2C57`, Amber `#FBBF24`, Soft White `#F8FAFC`, Light Background `#F1F5F9`, Success `#16A34A`, Error `#DC2626`, Neutral `#64748B`.

- **Core principles:** amana kafin ado; bayanan kuɗi masu gaskiya; taɓawa mai sauƙi da hannu ɗaya; fili mai isa da readable states.
- **Layout:** native portrait-first, header ɗaya mai sauƙi, wallet card a sama, quick services masu large tap target, activity list mai ƙasa; bottom navigation Home/History/Rewards/Profile inda Rewards ke bayyana matsayin “not enabled” har sai backend ya wanzu. Babu transfer tile ko bill-payment cards da ba a goyi bayansu ba.
- **Signature elements:** navy wallet panel mai amber edge/accent; status chips masu launi + rubutu (ba launi kaɗai ba); LAUPAY monogram/wordmark mai geometric “L”/flow motif, ba emoji ba.
- **Typography:** system sans (Android native/Roboto) don latency/readability; babban balance da amounts su samu hierarchy mai ƙarfi; Naira format `₦` da dates Nigerian locale. Kada a dogara da remote font don first paint.
- **Interactions:** press feedback/haptics inda ya dace; motion gajere (120–220ms) da reduce-motion support; confirmation kafin money-moving action; skeletons, retry/error/offline/empty states na gaske; kada a yi fake wait ko fake transaction.
- **Brand voice:** gajere, bayyananne, kwantar da hankali. Misali: “Balance ɗinka daga wallet ɗinka ne.” “Muna tabbatar da wannan ciniki; kada ka sake biya tukuna.”
- **Brand essence:** “Your money. Your control.” — amintacce, bayyananne, mai sauƙin amfani.

## 4. Aiwatarwa bisa phases

1. **Phase 1 — Audit:** an kammala karatun repository, API/data models, deployment, security/testing artifacts; bambancin source da stale docs an rubuta a sama.
2. **Phase 2 — Architecture/design:** wannan takarda ta zaɓi Expo Router/native TypeScript da design system. Bayan amincewa, a ƙirƙiri mobile workspace, base theme/components da ADR da ke bayyana dalilin kada a taɓa backend schema.
3. **Phase 3 — Auth/core navigation:** onboarding, login/register, email OTP, resend, forgot/reset password, PIN setup, session refresh/logout, deep links da guarded tab navigation.
4. **Phase 4 — Dashboard/wallet:** `/auth/me`, wallet balance/status, hide/show, notifications count da recent ledger activity; loading/empty/error/offline states da pull-to-refresh.
5. **Phase 5 — Financial services:** hosted funding checkout da virtual-account display; airtime/data provider catalog/purchase/PIN; withdrawals inda APIs/bank list ke enabled. Electricity/TV/transfer su kasance a ɓoye ko a bayyane “ba a kunna ba” har sai backend/provider API ya wanzu.
6. **Phase 6 — History/receipts:** server-backed ledger/order/payment/withdrawal detail, status mapping da receipt/share; pending/unknown ba za a kira success ba. Idan list ɗin backend bai haɗa records da yawa ba, amfani da endpoints ɗin da ke nan ko rubuta backend gap daban ba tare da ƙirƙirar synthetic history ba.
7. **Phase 7 — Security:** PIN change/lockout, session list/revoke (da bayanin iyakokinsa), audit/security data daga APIs ɗin da ke nan; biometrics a nuna ne kawai idan device capability an gano kuma ba a yi amfani da su a matsayin backend PIN replacement ba. Kada a ɗauki `assessOrderRisk()` placeholder a matsayin fraud protection.
8. **Phase 8 — Profile/notifications/support/rewards:** profile edit, password change, in-app notifications, support/dispute flow. Rewards/referrals da push preferences su jira authoritative API/contract; babu fake points, history ko preferences.
9. **Phase 9 — Verification/security review:** mobile tests da backend tests masu dacewa, typecheck/lint/build, auth/storage/idempotency/ownership/error-state checks, da review mai zaman kansa; gwaji a sandbox/mock test environment kawai, ba production data ko real-money.
10. **Phase 10 — Android build:** app name/icon/splash/package ID da release config; a fara da development APK sannan signed release APK idan signing credential ya samu. A tabbatar da build artifact, package metadata da installability kafin a bayar da hanyar fayil.
11. **Phase 11 — Documentation/handoff:** install/run/environment/API mapping, migration status, test evidence, limitations, external provider/Expo account needs da APK path idan an samar da shi a zahiri.

## 5. Build/deployment constraints

A halin audit, Java yana nan; Flutter, Dart, `adb`, `sdkmanager`, Gradle, Expo CLI da EAS CLI ba su cikin `PATH`, kuma babu `apps/mobile`. Wannan ba ya hana rubuta/irin Expo source code, amma yana nufin ba a tabbatar Android native build zai iya gudana a Sandbox ba. Ba za a ce APK ya wanzu har sai an sami sakamakon build da artifact. Android SDK/global toolchain installation ba za a yi shiru ko da izinin mai amfani ba; za a bi supported build route ko a nemi izinin installation/login idan hakan ya zama dole.

Ba za a tura code zuwa `main`, a deploy backend/web, ko a canza provider/production settings a matsayin ɓangare na wannan audit ba. Babu production migration da ake bukata don screens ɗin da API ya riga ya goyi baya. Idan Phase na gaba ya nuna backend gap da ke buƙatar schema/API change, sai a gabatar da ƙaramar backward-compatible migration/API da dalilinta; kada a goge ko sake rubuta existing data/history.
