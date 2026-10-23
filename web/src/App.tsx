import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Database,
  Globe2,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  Moon,
  MoveRight,
  Phone,
  Receipt,
  ScanLine,
  Send,
  ShieldCheck,
  Smartphone,
  Sun,
  UserRound,
  WalletCards,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { LookInsideShowcase } from './components/laupay/LookInsideShowcase';
import { AuthProvider } from '@app/context/AuthContext';
import { AdminAuthProvider } from '@app/admin/AdminAuthContext';
import { appRoutes } from './app/AppRoutes';
import NotFound from './pages/not-found';

type ThemeMode = 'light' | 'dark' | 'system';
type ServiceKey = 'airtime' | 'data' | 'payments' | 'wallet';

type Service = {
  key: ServiceKey;
  label: string;
  description: string;
  action: string;
  amount: string;
  meta: string;
  icon: LucideIcon;
  accent: string;
};

const services: Service[] = [
  {
    key: 'airtime',
    label: 'Airtime',
    description: 'Top up a line in a few clear steps.',
    action: 'Buy airtime',
    amount: '₦1,000',
    meta: 'MTN • 0803 XXX XXXX',
    icon: Smartphone,
    accent: '#F4B33F',
  },
  {
    key: 'data',
    label: 'Data',
    description: 'Pick a plan that fits today.',
    action: 'Buy data',
    amount: '₦3,500',
    meta: 'MTN • 10GB • 0803 XXX XXXX',
    icon: Wifi,
    accent: '#91B7FF',
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Pay bills without the back-and-forth.',
    action: 'Pay a bill',
    amount: '₦7,500',
    meta: 'Electricity / Ibadan Disco / Example account',
    icon: Receipt,
    accent: '#E58D79',
  },
  {
    key: 'wallet',
    label: 'Wallet',
    description: 'Keep your everyday balance close.',
    action: 'Open wallet',
    amount: '₦24,850',
    meta: 'Available balance / Example',
    icon: WalletCards,
    accent: '#A7C997',
  },
];

const faqs = [
  {
    question: 'What can I explore on LAUPAY?',
    answer:
      'Explore airtime, data, payments, and wallet services in one place.',
  },
  {
    question: 'What does “one simple flow” mean?',
    answer:
      'It is the clear path from choosing a service to confirming the next step.',
  },
  {
    question: 'Can agents use LAUPAY?',
    answer:
      'Yes. The agent journey connects customer requests, services, and confirmation in one place.',
  },
  {
    question: 'How do the previews work?',
    answer:
      'The page cycles through illustrative product states so you can feel the flow before using a live service.',
  },
];

type DemoStage = 'dashboard' | 'select' | 'process' | 'confirm';

const CUSTOMER_APP_ORIGIN = ''; // same origin — landing and customer app share laupay.vercel.app


function FlowMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="relative inline-flex h-8 w-8 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 32 32" className="h-8 w-8 overflow-visible">
        <path
          d="M8 7v14c0 4 2.5 6 6.5 6H21"
          fill="none"
          stroke={inverse ? '#FFFFFF' : '#171A4A'}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 7h8.5c4 0 5.5 2.5 5.5 6v8c0 4-2.5 6-6.5 6H15"
          fill="none"
          stroke={inverse ? '#F4B33F' : '#F4B33F'}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ThemeSwitcher({
  theme,
  onChange,
}: {
  theme: ThemeMode;
  onChange: (next: ThemeMode) => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-white/8 p-1"
      aria-label="Choose colour theme"
      role="group"
    >
      {[
        { value: 'light' as const, label: 'Light', icon: Sun },
        { value: 'dark' as const, label: 'Dark', icon: Moon },
        { value: 'system' as const, label: 'System', icon: Globe2 },
      ].map(({ value, label, icon: Icon }) => (
        <button
          type="button"
          key={value}
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          onClick={() => onChange(value)}
          className={`rounded-full p-2 transition-colors ${
            theme === value ? 'bg-[#F4B33F] text-[#171A4A]' : 'text-white/65 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Icon size={14} strokeWidth={2.2} />
        </button>
      ))}
    </div>
  );
}

const HERO_R = 138;
const HERO_CX = 240;
const HERO_CY = 280;

const heroNodes = [
  { label: 'AIRTIME', angle: 152 },
  { label: 'DATA', angle: 180 },
  { label: 'PAYMENTS', angle: 208 },
  { label: 'BILLS', angle: 332 },
  { label: 'WALLET', angle: 28 },
];

// rotation order follows the available digital services.
const heroOrder = [0, 1, 2, 4, 3];

function heroPos(angle: number, radius = HERO_R) {
  const rad = (angle * Math.PI) / 180;
  return { x: HERO_CX + radius * Math.cos(rad), y: HERO_CY - radius * Math.sin(rad) };
}

function BridgeArtwork({ compact = false, activeService }: { compact?: boolean; activeService?: ServiceKey }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (compact || paused || reducedMotion) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % heroOrder.length), 2200);
    return () => window.clearInterval(id);
  }, [compact, paused, reducedMotion]);

  useEffect(() => {
    if (!activeService) return;
    const index = heroNodes.findIndex((node) => node.label.toLowerCase() === activeService);
    if (index >= 0) setStep(heroOrder.indexOf(index));
  }, [activeService]);

  if (compact) {
    return (
      <div className="pointer-events-none relative h-28" aria-hidden="true">
        <div className="absolute inset-x-[8%] top-1/2 h-px bg-white/18" />
        <div className="absolute left-[8%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#F4B33F]" />
        <div className="absolute right-[8%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/70" />
        <svg viewBox="0 0 760 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d="M60 60 C 240 60, 240 22, 380 22 C 520 22, 520 60, 700 60" fill="none" stroke="rgba(244,179,63,.22)" strokeWidth="1.4" />
          <path d="M60 60 C 240 60, 240 98, 380 98 C 520 98, 520 60, 700 60" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1.4" />
        </svg>
      </div>
    );
  }

  const active = heroOrder[step];
  const activeNode = heroNodes[active];

  return (
    <div
      className="relative mx-auto aspect-[480/560] w-full max-w-[22rem] sm:max-w-[28rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <svg viewBox="0 0 480 560" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx={HERO_CX} cy={HERO_CY} r={HERO_R} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1" opacity="0.45" />

        <g fill="none" strokeLinecap="round">
          {heroNodes.map((node, i) => {
            const outer = heroPos(node.angle, HERO_R - 12);
            const inner = heroPos(node.angle, 46);
            const midR = (HERO_R + 46) / 2;
            const bend = heroPos(node.angle + (node.angle > 90 && node.angle < 270 ? 9 : -9), midR);
            const isActive = i === active;
            return (
              <path
                key={node.label}
                d={`M${outer.x} ${outer.y} Q ${bend.x} ${bend.y} ${inner.x} ${inner.y}`}
                stroke={isActive ? '#F4B33F' : 'rgba(255,255,255,.55)'}
                strokeWidth={isActive ? 1.4 : 1}
                opacity={isActive ? 0.6 : 0.22}
                style={{ transition: 'opacity 600ms ease, stroke 600ms ease' }}
              />
            );
          })}
        </g>

        <g fill="none" strokeLinecap="round">
          <path d={`M${HERO_CX} 62 C ${HERO_CX} 130, ${HERO_CX} 170, ${HERO_CX} ${HERO_CY - 46}`} stroke="rgba(255,255,255,.45)" strokeWidth="1.25" />
          <path d={`M${HERO_CX} ${HERO_CY + 46} C ${HERO_CX} 380, ${HERO_CX} 420, ${HERO_CX} 498`} stroke="rgba(255,255,255,.45)" strokeWidth="1.25" />
          <path d={`M${HERO_CX} 62 C ${HERO_CX} 130, ${HERO_CX} 170, ${HERO_CX} ${HERO_CY - 46}`} stroke="#F4B33F" strokeWidth="1.25" opacity="0.32" strokeDasharray="4 10">
            {!reducedMotion && <animate attributeName="stroke-dashoffset" from="28" to="0" dur="2.2s" repeatCount="indefinite" />}
          </path>
          <path d={`M${HERO_CX} ${HERO_CY + 46} C ${HERO_CX} 380, ${HERO_CX} 420, ${HERO_CX} 498`} stroke="#F4B33F" strokeWidth="1.25" opacity="0.32" strokeDasharray="4 10">
            {!reducedMotion && <animate attributeName="stroke-dashoffset" from="28" to="0" dur="2.2s" repeatCount="indefinite" />}
          </path>
        </g>

        <line x1={HERO_CX - 26} y1="62" x2={HERO_CX + 26} y2="62" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
        <line x1={HERO_CX - 26} y1="498" x2={HERO_CX + 26} y2="498" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
      </svg>

      <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[.22em] text-white/85" style={{ top: `${(34 / 560) * 100}%` }}>
        Customer
      </span>
      <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[.22em] text-white/85" style={{ top: `${(526 / 560) * 100}%` }}>
        Agent
      </span>

      <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: '50%', top: `${(HERO_CY / 560) * 100}%` }}>
        <span className="block text-[9px] font-bold uppercase tracking-[.28em] text-white/45">Service</span>
        <span
          key={activeNode.label}
          className="mt-1 block font-display text-xl font-extrabold tracking-[-.03em] text-[#F4B33F] sm:text-2xl"
          style={{ animation: 'laupay-fade 600ms ease' }}
        >
          {activeNode.label}
        </span>
      </div>

      {heroNodes.map((node, i) => {
        const p = heroPos(node.angle);
        const isActive = i === active;
        return (
          <button
            key={node.label}
            type="button"
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onClick={() => setStep(heroOrder.indexOf(i))}
            aria-pressed={isActive}
            className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.14em] transition-all duration-500 sm:text-[10px] ${
              isActive
                ? 'bg-[#F4B33F]/10 text-[#F4B33F] shadow-[inset_0_0_0_1px_rgba(244,179,63,.38)]'
                : 'text-white/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]'
            }`}
            style={{ left: `${(p.x / 480) * 100}%`, top: `${(p.y / 560) * 100}%` }}
          >
            {node.label}
          </button>
        );
      })}
    </div>
  );
}

function Home() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeService, setActiveService] = useState<ServiceKey>('airtime');
  const [demoStage, setDemoStage] = useState<DemoStage>('dashboard');
  const [rotationPaused, setRotationPaused] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [story, setStory] = useState<'today' | 'tomorrow'>('today');
  const resumeTimer = useRef<number | null>(null);
  const active = services.find((item) => item.key === activeService) ?? services[0];

  useEffect(() => {
    document.title = 'LAUPAY — Everyday digital services. One simple flow.';
    const saved = window.localStorage.getItem('laupay-theme') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
    window.localStorage.setItem('laupay-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (rotationPaused) return;
    const durations: Record<DemoStage, number> = {
      dashboard: 4300,
      select: 3200,
      process: 1500,
      confirm: 2200,
    };
    const timer = window.setTimeout(() => {
      setDemoStage((current) => {
        if (current === 'dashboard') return 'select';
        if (current === 'select') return 'process';
        if (current === 'process') return 'confirm';
        const index = services.findIndex((item) => item.key === activeService);
        const next = services[(index + 1) % services.length].key;
        setActiveService(next);
        return next === 'airtime' ? 'dashboard' : 'select';
      });
    }, durations[demoStage]);
    return () => window.clearTimeout(timer);
  }, [activeService, demoStage, rotationPaused]);

  useEffect(() => () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  };


  const pauseForInteraction = () => {
    setRotationPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setRotationPaused(false), 7000);
  };

  const pauseOnHover = () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    setRotationPaused(true);
  };

  const resumeAfterHover = () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    setRotationPaused(false);
  };

  return (
    <div className="grain min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="section-shell flex h-[76px] items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 text-white" aria-label="LAUPAY home">
            <FlowMark inverse />
            <span className="font-display text-[18px] font-extrabold tracking-[-.06em]">LAUPAY</span>
          </a>
          <nav className="hidden items-center gap-8 text-[11px] font-bold text-white/65 lg:flex" aria-label="Main navigation">
            <a className="transition-colors hover:text-white" href="#services">Services</a>
            <a className="transition-colors hover:text-white" href="#flow">The flow</a>
            <a className="transition-colors hover:text-white" href="#security">Security</a>
            <a className="transition-colors hover:text-white" href="#future">Our horizon</a>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <ThemeSwitcher theme={theme} onChange={setTheme} />
            <a href={`${CUSTOMER_APP_ORIGIN}/login`} className="inline-flex min-h-[44px] items-center rounded-full border border-white/20 px-5 text-xs font-extrabold text-white transition-colors hover:bg-white/10">
              Login
            </a>
            <a href={`${CUSTOMER_APP_ORIGIN}/register`} className="inline-flex min-h-[44px] items-center rounded-full bg-[#F4B33F] px-5 text-xs font-extrabold text-[#171A4A] transition-transform hover:-translate-y-0.5">
              Get Started
            </a>
          </div>
          <button type="button" onClick={() => setMobileOpen((value) => !value)} className="rounded-full border border-white/20 p-2.5 text-white lg:hidden" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="section-shell rounded-2xl border border-white/15 bg-[#11142A] p-4 shadow-[0_20px_40px_rgba(0,0,0,.22)] lg:hidden">
            <nav className="grid gap-1 text-sm font-bold text-white/80" aria-label="Mobile navigation">
              {['services', 'flow', 'security', 'future'].map((item) => (
                <a key={item} href={`#${item}`} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 capitalize hover:bg-white/10 hover:text-white">{item === 'flow' ? 'The flow' : item === 'future' ? 'Our horizon' : item}</a>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <ThemeSwitcher theme={theme} onChange={setTheme} />
              <div className="flex gap-2">
                <a href={`${CUSTOMER_APP_ORIGIN}/login`} className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-bold text-white">Login</a>
                <a href={`${CUSTOMER_APP_ORIGIN}/register`} className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-[#F4B33F] px-5 text-sm font-bold text-[#171A4A]">Get Started</a>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative overflow-hidden bg-[#171A4A] pb-24 pt-36 text-white sm:pb-36 sm:pt-48 lg:pb-40 lg:pt-48">
          {/* Decorative rings are hidden below `sm` — at 520px wide they extended well
          past a 360px viewport and were a common source of sideways scroll. */}
          <div className="absolute -right-40 top-0 hidden h-[520px] w-[520px] rounded-full border border-white/[.05] sm:block" />
          <div className="absolute -right-24 top-24 hidden h-[340px] w-[340px] rounded-full border border-[#F4B33F]/[.10] sm:block" />
          <div className="section-shell relative">
            <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
              <div className="max-w-[640px]">
                <div className="reveal inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F4B33F]" /> Digital services, connected
                </div>
                {/* Lowered the clamp minimum: 7.5vw lands near 27px on a 360px
                    Android, so the old 2.8rem floor forced ~45px type and
                    overflowed small screens. Now fluid with a sane floor. */}
                <h1 className="reveal reveal-delay-1 mt-8 max-w-[720px] font-display text-[clamp(2.65rem,10vw,7rem)] font-extrabold leading-[1.1] tracking-[-.05em] text-balance sm:mt-9 sm:leading-[1.08] sm:tracking-[-.055em] lg:text-[clamp(5.1rem,8.2vw,7rem)] lg:leading-[1.08]">
                  Everyday digital services.<br /><span className="flow-word-shift">One simple flow.</span>
                </h1>
                <p className="reveal reveal-delay-2 mt-9 max-w-[42ch] text-[19px] leading-[1.7] text-white/75 sm:mt-10 sm:text-[20px] lg:mt-9">
                  Airtime, data, payments, wallet services, and more — brought together so your next transaction feels clear from the start.
                </p>
                <div className="reveal reveal-delay-3 mt-11 flex flex-wrap items-center gap-3 sm:mt-13 sm:gap-4 lg:mt-11">
                  <a href={`${CUSTOMER_APP_ORIGIN}/register`} className="group inline-flex min-h-[58px] flex-[1.35] items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#F4B33F] px-5 text-[15px] sm:gap-3 sm:px-8 font-extrabold text-[#171A4A] transition-transform hover:-translate-y-1 sm:flex-none">
                    Get Started <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                  </a>
                  <a href={`${CUSTOMER_APP_ORIGIN}/login`} className="inline-flex min-h-[58px] flex-1 items-center justify-center gap-3 whitespace-nowrap rounded-full border border-white/25 px-5 text-[15px] sm:px-8 font-extrabold text-white transition-colors hover:bg-white/10 sm:flex-none">
                    Login
                  </a>
                </div>
              </div>
              <div className="reveal reveal-delay-2 lg:pl-8">
                {/* Real LAUPAY photo. Keep the complete subject visible in the frame. */}
                <div className="relative mx-auto aspect-[848/749] w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/10 bg-[#11142A] shadow-[0_30px_80px_rgba(0,0,0,.35)]">
                  <img
                    src="/images/landing/features-ibrahim.png"
                    alt="LAUPAY user viewing wallet dashboard on phone"
                    width={1671}
                    height={941}
                    fetchPriority="high"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover object-[75%_center]"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-[#F4B33F]/15" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="flow" className="bg-background py-32 sm:py-40 lg:py-48">
          <div className="section-shell">
            <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end lg:gap-16">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">Everyday value</p>
                <h2 className="mt-7 max-w-[560px] font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em] lg:text-[4rem]">
                  More value in every <span className="flow-word-shift">flow.</span>
                </h2>
              </div>
              <p className="max-w-[530px] text-[17px] leading-8 text-muted-foreground sm:text-lg">
                Quality services, clear purchasing, and a platform that works for customers and agents every day.
              </p>
            </div>
            <div className="mt-16 grid gap-4 sm:mt-20 lg:grid-cols-[1fr_1fr_.8fr]">
              <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-8">
                <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-[#F4B33F]/25" />
                <div className="relative flex items-center justify-between">
                  <span className="rounded-full border border-border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em]">For customers</span>
                  <Smartphone size={20} className="text-[#B17819] dark:text-[#F4B33F]" />
                </div>
                <h3 className="relative mt-8 font-display text-xl sm:mt-12 sm:text-2xl font-extrabold tracking-[-.05em]">Quality digital services.</h3>
                <ul className="relative mt-5 grid gap-3 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#B17819] dark:text-[#F4B33F]" /> Competitive pricing</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#B17819] dark:text-[#F4B33F]" /> Simple purchasing</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#B17819] dark:text-[#F4B33F]" /> Clear transaction flow</li>
                </ul>
              </article>
              <article className="relative overflow-hidden rounded-2xl bg-[#171A4A] p-7 text-white sm:p-8">
                <div className="absolute -bottom-14 -right-12 h-40 w-40 rounded-full border border-white/10" />
                <div className="relative flex items-center justify-between">
                  <span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em] text-white/70">For agents</span>
                  <ScanLine size={20} className="text-[#F4B33F]" />
                </div>
                <h3 className="relative mt-8 font-display text-xl sm:mt-12 sm:text-2xl font-extrabold tracking-[-.05em]">Better business value.</h3>
                <ul className="relative mt-5 grid gap-3 text-sm text-white/65">
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#F4B33F]" /> Agent-friendly pricing</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#F4B33F]" /> Fast service access</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#F4B33F]" /> Built for daily transactions</li>
                </ul>
              </article>
              <div className="surface-dotted rounded-2xl border border-border bg-card p-7 sm:p-8">
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">One platform</p>
                <h3 className="mt-5 font-display text-2xl font-extrabold leading-[1.05] tracking-[-.05em]">Simple for customers. Powerful for agents.</h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">Different needs, one clear flow.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="bg-[#171A4A] text-white">
          <div className="section-shell py-24 sm:py-32 lg:py-40">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0F1236]">
              <img
                  src="/images/landing/hero-ibrahim.png"
                  alt="LAUPAY customer holding a phone with the LAUPAY dashboard, balance and recent activity"
                  width={1672}
                  height={941}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-[4/3] w-full object-cover object-[72%_50%] sm:aspect-[16/9] lg:aspect-[1672/941]"
                />
              <div className="relative p-7 sm:p-10 lg:grid lg:grid-cols-[1.1fr_.9fr] lg:items-end lg:gap-x-16 lg:p-14">
                <div>
                <p className="eyebrow text-[#F4B33F]">Your LAUPAY dashboard</p>
                <h2 className="mt-7 max-w-[460px] font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em]">
                  Your dashboard, in your <span className="text-[#F4B33F]">hand.</span>
                </h2>
                <p className="mt-6 max-w-[420px] text-[17px] leading-8 text-white/70">
                  Check your wallet, buy airtime and data, and follow every payment from one calm screen.
                </p>
                </div>
                <div>
                <ul className="mt-6 grid gap-3 text-base text-white/75 lg:mt-0">
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#F4B33F]" /> Wallet balance at a glance</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#F4B33F]" /> Airtime and data in a few taps</li>
                  <li className="flex items-center gap-2"><Check size={15} className="text-[#F4B33F]" /> Clear status for every transaction</li>
                </ul>
                <div className="mt-8">
                  <a href={`${CUSTOMER_APP_ORIGIN}/register`} className="group inline-flex items-center gap-3 rounded-full bg-[#F4B33F] min-h-[58px] px-7 py-4 text-sm font-extrabold text-[#171A4A] transition-transform hover:-translate-y-1">
                    Get Started <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className="bg-[#F0F1F7] py-32 dark:bg-[#0D0F21] sm:py-40 lg:py-48">
          <div className="section-shell">
            <div className="mb-14 flex flex-col justify-between gap-6 sm:mb-20 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">A look inside</p>
                <h2 className="mt-7 max-w-[560px] font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em] lg:text-[4rem]">Open LAUPAY. See what’s next.</h2>
              </div>
              <p className="max-w-[360px] text-[17px] leading-8 text-muted-foreground">Start at your dashboard, then choose a service.</p>
            </div>
            <div className="grid items-center gap-14 lg:grid-cols-[1fr_.75fr] lg:gap-20">
              <div className="order-2 lg:order-1">
                <div
                  className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                  onMouseEnter={pauseOnHover}
                  onMouseLeave={resumeAfterHover}
                  onFocusCapture={pauseOnHover}
                  onBlurCapture={resumeAfterHover}
                  aria-label={`Choose a service${rotationPaused ? ' — automatic rotation paused' : ''}`}
                >
                  {services.map((item) => {
                    const Icon = item.icon;
                    const selected = item.key === activeService;
                    return (
                      <button
                        type="button"
                        key={item.key}
onClick={() => { pauseForInteraction(); setActiveService(item.key); setDemoStage('select'); }}
                        aria-pressed={selected}
                        className={`group flex min-h-[92px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-all duration-500 hover:-translate-y-1 ${selected ? 'border-[#F4B33F] bg-[#171A4A] text-white shadow-[0_12px_24px_rgba(23,26,74,.16)] dark:bg-[#F4B33F] dark:text-[#171A4A]' : 'border-border bg-card text-foreground opacity-65 hover:opacity-100'}`}
                      >
                        <Icon size={18} className={selected ? 'text-[#F4B33F] dark:text-[#171A4A]' : 'text-muted-foreground'} strokeWidth={1.8} />
                        <span className="text-[11px] font-extrabold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground">Flow preview</p>
                      <h3 className="mt-3 font-display text-2xl font-extrabold tracking-[-.05em] transition-colors duration-500" style={{ color: demoStage === 'dashboard' ? '#171A4A' : active.accent }}>{demoStage === 'dashboard' ? 'LAUPAY Dashboard' : active.label}</h3>
                      <p className="mt-2 max-w-[360px] text-sm leading-6 text-muted-foreground">{demoStage === 'dashboard' ? 'Balance, quick actions, and recent activity in one place.' : active.description}</p>
                    </div>
                    <div className="rounded-xl p-3 transition-colors duration-500" style={{ backgroundColor: `${demoStage === 'dashboard' ? '#F4B33F' : active.accent}40` }}>
                      {demoStage === 'dashboard' ? <WalletCards size={20} className="text-[#171A4A]" /> : <active.icon size={20} className="text-[#171A4A]" />}
                    </div>
                  </div>
                  <div className="mt-8 grid gap-3 text-xs sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <div className="rounded-xl bg-secondary p-3 font-bold"><span className="block text-[10px] font-semibold text-muted-foreground">{demoStage === 'dashboard' ? 'Balance' : 'Select'}</span><span className="mt-1 block">{demoStage === 'dashboard' ? '₦125,450.00' : `Choose ${active.label}`}</span></div>
                    <MoveRight className="hidden text-[#B17819] sm:block dark:text-[#F4B33F]" size={18} />
                    <div className="rounded-xl bg-secondary p-3 font-bold"><span className="block text-[10px] font-semibold text-muted-foreground">{demoStage === 'confirm' ? 'Confirm' : demoStage === 'process' ? 'Process' : 'Next'}</span><span className="mt-1 block">{demoStage === 'confirm' ? 'Service ready' : demoStage === 'process' ? 'Processing...' : active.action}</span></div>
                  </div>
                  <button type="button" onClick={() => scrollTo('journeys')} className="mt-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#8D6116] hover:text-[#171A4A] dark:text-[#F4B33F] dark:hover:text-white">
                    See how people use it <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <LookInsideShowcase active={active} stage={demoStage} />
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="bg-background py-32 sm:py-40 lg:py-48">
          <div className="section-shell">
            <div className="grid gap-14 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">One place, useful things</p>
                <h2 className="mt-7 font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em] lg:text-[4rem]">The everyday, joined up.</h2>
                <p className="mt-6 max-w-[400px] text-[17px] leading-8 text-muted-foreground">A service should feel close at hand, whether it is in your pocket or across the counter.</p>
                <button type="button" onClick={() => scrollTo('demo')} className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#171A4A] min-h-[58px] px-7 py-4 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5 dark:bg-[#F4B33F] dark:text-[#171A4A]">Explore the preview <ArrowRight size={14} /></button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button type="button" key={item.key} onClick={() => { pauseForInteraction(); setActiveService(item.key); setDemoStage('select'); scrollTo('demo'); }} className={`group flex items-start gap-4 border-t border-border py-5 text-left transition-colors hover:border-[#B17819] dark:hover:border-[#F4B33F] ${index === services.length - 1 ? 'sm:col-span-2' : ''}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.accent}36` }}><Icon size={19} className="text-[#171A4A]" strokeWidth={1.8} /></span>
                      <span className="flex-1"><span className="flex items-center justify-between font-display text-base font-extrabold tracking-[-.03em]">{item.label}<ArrowUpRightIcon /></span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="journeys" className="bg-[#171A4A] py-32 text-white sm:py-40 lg:py-48">
          <div className="section-shell">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end sm:gap-10">
              <div>
                <p className="eyebrow text-[#F4B33F]">Different days, same clarity</p>
                <h2 className="mt-7 max-w-[620px] font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em] lg:text-[4rem]">Built around real moments.</h2>
              </div>
              <p className="max-w-[380px] text-[17px] leading-8 text-white/65">The bridge works from both sides: for the person making a request and the person helping it happen.</p>
            </div>
            <div className="mt-16 grid gap-4 sm:mt-20 lg:grid-cols-2">
              <article className="relative overflow-hidden rounded-2xl bg-[#F4B33F] p-7 text-[#171A4A] sm:p-9">
                <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-[#171A4A]/10" />
                <div className="relative flex items-center justify-between"><span className="rounded-full border border-[#171A4A]/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em]">Customer journey</span><UserRound size={21} /></div>
                <h3 className="relative mt-16 max-w-[390px] font-display text-3xl font-extrabold leading-[1.05] tracking-[-.06em]">“I need data before my next call.”</h3>
                <div className="relative mt-10 grid gap-2 text-xs font-bold">
                  <span className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171A4A] text-[10px] text-[#F4B33F]">1</span> Open LAUPAY</span>
                  <span className="ml-3 h-4 w-px bg-[#171A4A]/20" />
                  <span className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171A4A] text-[10px] text-[#F4B33F]">2</span> Choose Data</span>
                  <span className="ml-3 h-4 w-px bg-[#171A4A]/20" />
                  <span className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171A4A] text-[10px] text-[#F4B33F]">3</span> See the next step</span>
                </div>
              </article>
              <article className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#11142A] p-7 sm:p-9">
                <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full border border-white/[.07]" />
                <div className="relative flex items-center justify-between"><span className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em] text-white/65">Agent journey</span><ScanLine size={21} className="text-[#F4B33F]" /></div>
                <h3 className="relative mt-16 max-w-[390px] font-display text-3xl font-extrabold leading-[1.05] tracking-[-.06em]">“I want every customer to leave certain.”</h3>
                <div className="relative mt-10 grid gap-2 text-xs font-bold text-white/70">
                  <span className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F4B33F] text-[10px] text-[#171A4A]">1</span> Find the right service</span>
                  <span className="ml-3 h-4 w-px bg-white/15" />
                  <span className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F4B33F] text-[10px] text-[#171A4A]">2</span> Guide a clear request</span>
                  <span className="ml-3 h-4 w-px bg-white/15" />
                  <span className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F4B33F] text-[10px] text-[#171A4A]">3</span> Close the loop</span>
                </div>
              </article>
            </div>
            <div className="mt-20">
              <BridgeArtwork compact />
            </div>
          </div>
        </section>

        <section id="security" className="bg-[#F0F1F7] py-32 dark:bg-[#0D0F21] sm:py-40 lg:py-48">
          <div className="section-shell">
            <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-16">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">Built with care</p>
                <h2 className="mt-7 max-w-[540px] font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em] lg:text-[4rem]">Built with security at every step.</h2>
                <p className="mt-6 max-w-[420px] text-[17px] leading-8 text-muted-foreground">Clear choices, clear confirmations, and useful status updates keep you in control.</p>
              </div>
              <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                {[
                  { icon: LockKeyhole, title: 'Secure account access', body: 'Clear account controls help you know what is happening at every step.' },
                  { icon: ShieldCheck, title: 'Protected transaction flows', body: 'Important actions move through deliberate confirmation steps.' },
                  { icon: Zap, title: 'Clear transaction history', body: 'Useful status updates make it easier to follow what happened next.' },
                  { icon: CircleUserRound, title: 'Human support', body: 'People remain part of the flow when you need a hand.' },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="border-t border-border pt-5">
                    <Icon size={21} className="text-[#B17819] dark:text-[#F4B33F]" strokeWidth={1.8} />
                    <h3 className="mt-5 font-display text-base font-extrabold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="future" className="bg-background py-32 sm:py-40 lg:py-48">
          <div className="section-shell">
            <div className="grid gap-14 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">The direction</p>
                <h2 className="mt-7 max-w-[540px] font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em] lg:text-[4rem]">Today, then tomorrow.</h2>
                 <p className="mt-6 max-w-[420px] text-[17px] leading-8 text-muted-foreground">Useful services first, with more connected possibilities ahead.</p>
                <div className="mt-8 inline-flex rounded-full border border-border bg-card p-1">
                  {(['today', 'tomorrow'] as const).map((item) => <button type="button" key={item} onClick={() => setStory(item)} className={`rounded-full px-4 py-2 text-xs font-extrabold capitalize ${story === item ? 'bg-[#171A4A] text-white dark:bg-[#F4B33F] dark:text-[#171A4A]' : 'text-muted-foreground'}`}>{item}</button>)}
                </div>
              </div>
              <div className="relative min-h-[370px] overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-10">
                <div className="absolute inset-x-10 top-1/2 h-px bg-border" />
                <div className="absolute left-10 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#F4B33F] ring-8 ring-[#F4B33F]/15" />
                <div className="absolute right-10 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#171A4A] ring-8 ring-[#171A4A]/10 dark:bg-white" />
                <div className="absolute left-7 top-7 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground sm:left-10 sm:top-10">Now</div>
                <div className="absolute right-7 top-7 text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground sm:right-10 sm:top-10">Next horizon</div>
                <div className="relative mt-20 grid grid-cols-2 gap-5 sm:mt-28 sm:gap-10">
                  <div><span className="font-mono text-3xl font-bold text-[#B17819] dark:text-[#F4B33F]">01</span><h3 className="mt-4 font-display text-xl font-extrabold tracking-[-.04em]">Useful today</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Airtime, data, payments, and wallets — a clear starting point for everyday needs.</p></div>
                  <div><span className="font-mono text-3xl font-bold text-[#171A4A] dark:text-white">02</span><h3 className="mt-4 font-display text-xl font-extrabold tracking-[-.04em]">Ready for more</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">A connected foundation for future digital services, without losing the simple flow.</p></div>
                </div>
                <div className="absolute bottom-7 left-7 right-7 rounded-xl bg-secondary px-4 py-3 text-xs font-bold sm:bottom-10 sm:left-10 sm:right-10"><span className="text-[#B17819] dark:text-[#F4B33F]">{story === 'today' ? 'TODAY' : 'TOMORROW'}</span><span className="ml-2 text-muted-foreground">{story === 'today' ? 'Start with the essentials.' : 'Keep the connection moving.'}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F0F1F7] py-32 dark:bg-[#0D0F21] sm:py-40 lg:py-48">
          <div className="section-shell">
            <div className="mx-auto max-w-[650px] text-center">
                 <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">Good to know</p>
                 <h2 className="mt-7 font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-[-.04em] text-balance sm:text-[3.65rem] sm:leading-[1.08] sm:tracking-[-.05em] lg:text-[4rem]">A few useful answers.</h2>
            </div>
            <div className="mx-auto mt-14 max-w-[760px] border-t border-border sm:mt-16">
              {faqs.map((item, index) => (
                <div key={item.question} className="border-b border-border">
                  <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="flex min-h-[64px] w-full items-center justify-between gap-5 py-6 text-left font-display text-base font-extrabold sm:text-lg" aria-expanded={openFaq === index}>
                    {item.question}<ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${openFaq === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><p className="overflow-hidden pr-10 text-[15px] leading-7 text-muted-foreground sm:text-base">{item.answer}</p></div>
                  {openFaq === index && <div className="h-5" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#171A4A] py-32 text-white sm:py-40 lg:py-48">
          <div className="section-shell relative overflow-hidden rounded-3xl border border-white/10 bg-[#11142A] px-6 py-20 text-center sm:px-12 sm:py-24 lg:py-28">
            <div className="absolute -left-16 -top-28 h-64 w-64 rounded-full border border-[#F4B33F]/15" />
            <div className="absolute -bottom-32 -right-20 h-72 w-72 rounded-full border border-white/10" />
            <div className="relative mx-auto max-w-[680px]">
              <FlowMark inverse />
              <h2 className="mt-8 font-display text-[2.4rem] font-extrabold leading-[1.08] tracking-[-.05em] text-balance sm:text-6xl sm:leading-[1.05] lg:text-[4.25rem]">Make everyday services simpler.</h2>
              <p className="mx-auto mt-6 max-w-[480px] text-[17px] leading-8 text-white/65">Choose a service and follow the flow from start to finish.</p>
              <button type="button" onClick={() => scrollTo('demo')} className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#F4B33F] min-h-[58px] px-7 py-4 text-sm font-extrabold text-[#171A4A] transition-transform hover:-translate-y-1">See the flow <ArrowRight size={15} /></button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#11142A] py-10 text-white">
        <div className="section-shell grid gap-9 md:grid-cols-[1.1fr_.9fr_.9fr] md:gap-12">
          <div>
            <div className="flex items-center gap-2.5"><FlowMark inverse /><span className="font-display text-[17px] font-extrabold tracking-[-.06em]">LAUPAY</span></div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">Simple digital services for everyday life, operated by Ibrahim Lau Provision Shop.</p>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#F4B33F]">Explore</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-bold text-white/45"><a className="hover:text-white" href="#services">Services</a><a className="hover:text-white" href="#security">Security</a><a className="hover:text-white" href="#future">Our horizon</a><a href={`${CUSTOMER_APP_ORIGIN}/login`} className="hover:text-white">Login</a></div>
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#F4B33F]">Contact us</p>
            <div className="mt-4 flex flex-col gap-3 text-sm text-white/65">
              <a href="mailto:support.laupay@gmail.com" className="flex items-start gap-2.5 transition-colors hover:text-white"><Mail size={16} className="mt-0.5 shrink-0 text-[#F4B33F]" aria-hidden="true" /><span>support.laupay@gmail.com</span></a>
              <a href="tel:+2347045648248" className="flex items-start gap-2.5 transition-colors hover:text-white"><Phone size={16} className="mt-0.5 shrink-0 text-[#F4B33F]" aria-hidden="true" /><span>0704 564 8248</span></a>
              <div className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-[#F4B33F]" aria-hidden="true" /><span>33 Palace Way, Jalingo</span></div>
            </div>
          </div>
          <p className="text-[10px] font-semibold text-white/30 md:col-span-3">
            © 2026 LAUPAY — a service of Ibrahim Lau Provision Shop
          </p>
        </div>

        {/* Developer credit — deliberately subtle: low-contrast, small, and
            readable in both light and dark. Opens in a new tab and is safe
            to follow (noopener/noreferrer). */}
        <div className="border-t border-white/[.08]">
          <div className="section-shell flex items-center justify-center py-4 text-[10px] font-semibold text-white/35">
            <a
              href="https://auwalbussines.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded transition-colors duration-150 hover:text-laupay-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-amber"
            >
              Developed by Auwalbussines
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}

function ArrowUpRightIcon() {
  return <ArrowDownRight size={17} className="-rotate-90 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />;
}

function LaupayApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminAuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            {appRoutes}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export { Home };
export default LaupayApp;
