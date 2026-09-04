import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownRight,
  ArrowRight,
  BatteryMedium,
  Check,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Database,
  Ellipsis,
  Globe2,
  LockKeyhole,
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

type ThemeMode = 'light' | 'dark' | 'system';
type ServiceKey = 'airtime' | 'data' | 'payments' | 'wallet' | 'pos';

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
  {
    key: 'pos',
    label: 'POS',
    description: 'Give customers a dependable local touchpoint.',
    action: 'Explore POS',
    amount: 'Ready to serve',
    meta: 'Agent tools / Example settlement view',
    icon: ScanLine,
    accent: '#D8A2D0',
  },
];

const faqs = [
  {
    question: 'What can I explore on LAUPAY?',
    answer:
      'Explore airtime, data, payments, wallet services, and POS journeys in one place.',
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
type Audience = 'customer' | 'agent';

const heroServiceNames = ['Airtime', 'Data', 'Payments', 'Wallet', 'POS', 'Bills'];

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

function BridgeArtwork({ compact = false, activeService }: { compact?: boolean; activeService?: ServiceKey }) {
  const featuredService = services.find((item) => item.key === activeService) ?? services[0];
  const FeaturedIcon = featuredService.icon;
  return (
    <div className={`pointer-events-none relative ${compact ? 'h-28' : 'h-[300px] sm:h-[390px]'}`} aria-hidden="true">
      <div className="absolute inset-x-[8%] top-[54%] h-px bg-white/20" />
      <div className="absolute left-[8%] top-[54%] h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#F4B33F] shadow-[0_0_0_7px_rgba(244,179,63,.12)]" />
      <div className="absolute right-[8%] top-[54%] h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_7px_rgba(255,255,255,.11)]" />
      <svg viewBox="0 0 760 360" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M60 194H244C290 194 287 94 334 94H426C473 94 470 194 516 194H700" fill="none" stroke="rgba(244,179,63,.25)" strokeWidth="1.5" />
        <path d="M60 194H210C264 194 257 286 314 286H446C503 286 496 194 550 194H700" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1.5" />
        <path d="M60 194H700" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" strokeDasharray="3 8" />
        <path d="M380 112V194" fill="none" stroke="rgba(244,179,63,.42)" strokeWidth="1.5" />
        <circle cx="380" cy="94" r="4" fill="#F4B33F" className="bridge-pulse" />
        <circle cx="380" cy="286" r="4" fill="#FFFFFF" opacity=".7" className="bridge-pulse" />
      </svg>
      {!compact && (
        <div className="absolute left-1/2 top-[11%] z-10 w-[min(54%,220px)] -translate-x-1/2 rounded-[1.35rem] border border-white/15 bg-[#F7F8FC] p-2 text-[#171A4A] shadow-[0_22px_48px_rgba(8,10,24,.32)] transition-all duration-700">
          <div className="rounded-[.95rem] bg-white p-3">
            <div className="flex items-center justify-between text-[7px] font-extrabold uppercase tracking-[.14em] text-[#85899A]">
              <span>LAUPAY</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${featuredService.accent}50` }}>
                <FeaturedIcon size={13} />
              </span>
              <div>
                <p className="text-[7px] font-semibold text-[#85899A]">Next service</p>
                <p className="mt-0.5 text-[10px] font-extrabold">{featuredService.label}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="h-1.5 flex-1 rounded-full bg-[#F4B33F]" />
              <span className="h-1.5 flex-1 rounded-full bg-[#D9DCE7]" />
              <span className="h-1.5 flex-1 rounded-full bg-[#D9DCE7]" />
            </div>
            <p className="mt-2 text-[7px] font-semibold text-[#85899A]">Choose · connect · confirm</p>
          </div>
        </div>
      )}
      {!compact && (
        <>
          <span className="absolute left-[3%] top-[48%] text-[10px] font-bold uppercase tracking-[.15em] text-white/55">Customer</span>
          <span className="absolute right-[1%] top-[48%] text-[10px] font-bold uppercase tracking-[.15em] text-white/55">Service</span>
          <span className="absolute left-[33%] top-[78%] text-[10px] font-bold uppercase tracking-[.15em] text-white/35">Agent</span>
          <div className="absolute bottom-0 left-1/2 flex w-[min(100%,450px)] -translate-x-1/2 flex-wrap justify-center gap-2">
            {heroServiceNames.map((name) => {
              const key = name.toLowerCase() as ServiceKey;
              const selected = key === activeService;
              return (
                <span key={name} className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.12em] transition-all duration-700 ${selected ? 'scale-105 border-[#F4B33F]/70 bg-[#F4B33F]/15 text-[#F4B33F]' : 'border-white/10 bg-white/[.03] text-white/35'}`}>
                  {name}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AudienceToggle({ audience, onChange }: { audience: Audience; onChange: (next: Audience) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-[#EDEEF4] p-0.5" aria-label="Choose pricing view">
      {(['customer', 'agent'] as const).map((item) => (
        <button
          type="button"
          key={item}
          onClick={() => onChange(item)}
          aria-pressed={audience === item}
          className={`rounded-md px-2 py-1 text-[8px] font-extrabold capitalize transition-colors ${audience === item ? 'bg-[#171A4A] text-white' : 'text-[#73788A]'}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function DashboardScreen({ audience, onAudienceChange }: { audience: Audience; onAudienceChange: (next: Audience) => void }) {
  const quickActions = [
    { label: 'Airtime', icon: Smartphone },
    { label: 'Data', icon: Wifi },
    { label: 'Pay', icon: Receipt },
    { label: 'Wallet', icon: WalletCards },
    { label: 'POS', icon: ScanLine },
  ];
  return (
    <div className="space-y-3 px-5 py-4">
      <div className="rounded-2xl bg-[#171A4A] p-4 text-white">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-semibold text-white/55">Available balance</p>
          <WalletCards size={15} className="text-[#F4B33F]" />
        </div>
        <p className="mt-2 font-display text-2xl font-extrabold tracking-[-.06em]">₦24,850.00</p>
        <p className="mt-1 text-[8px] font-semibold text-white/45">Illustrative account view</p>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold text-[#171A4A]">Quick services</p>
          <span className="text-[8px] font-semibold text-[#85899A]">View all</span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {quickActions.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-xl bg-[#F0F1F7] px-1 py-2 text-center">
              <Icon size={13} className="text-[#171A4A]" />
              <span className="text-[7px] font-bold text-[#73788A]">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold text-[#171A4A]">Recent activity</p>
          <span className="text-[8px] font-semibold text-[#85899A]">See all</span>
        </div>
        <div className="mt-2 divide-y divide-[#E9EAF0] rounded-xl border border-[#E4E6ED] bg-white px-3">
          {[
            { label: 'Data Purchase', detail: 'MTN 10GB', amount: '-₦3,500', icon: Wifi, color: '#91B7FF' },
            { label: 'Airtime', detail: 'MTN', amount: '-₦1,000', icon: Smartphone, color: '#F4B33F' },
            { label: 'Wallet Deposit', detail: 'Balance added', amount: '+₦10,000', icon: WalletCards, color: '#A7C997' },
          ].map(({ label, detail, amount, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-2 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}40` }}><Icon size={13} className="text-[#171A4A]" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9px] font-extrabold text-[#171A4A]">{label}</p>
                <p className="mt-0.5 text-[8px] font-semibold text-[#85899A]">{detail}</p>
              </div>
              <span className={`text-[9px] font-extrabold ${amount.startsWith('+') ? 'text-[#2E9B68]' : 'text-[#171A4A]'}`}>{amount}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[#E4E6ED] bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-extrabold text-[#171A4A]">Service pricing view</p>
            <p className="mt-0.5 text-[8px] font-semibold text-[#85899A]">Illustrative only</p>
          </div>
          <AudienceToggle audience={audience} onChange={onAudienceChange} />
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F0F1F7] px-2.5 py-2">
          <span className="text-[8px] font-bold text-[#73788A]">MTN 10GB data</span>
          <span className="text-[10px] font-extrabold text-[#171A4A]">{audience === 'agent' ? '₦3,300' : '₦3,500'}</span>
        </div>
      </div>
    </div>
  );
}

function ProductPhone({
  service,
  onAction,
  actionMessage,
  stage,
  audience,
  onAudienceChange,
}: {
  service: Service;
  onAction: () => void;
  actionMessage: string;
  stage: DemoStage;
  audience: Audience;
  onAudienceChange: (next: Audience) => void;
}) {
  const Icon = service.icon;
  const stages: { key: DemoStage; label: string }[] = [
    { key: 'select', label: 'Select' },
    { key: 'process', label: 'Process' },
    { key: 'confirm', label: 'Confirm' },
  ];
  return (
    <div className="relative mx-auto w-[min(100%,350px)]">
      <div className="absolute -inset-4 rounded-[3rem] bg-[#F4B33F]/10 blur-2xl" />
      <div className="relative rounded-[2.6rem] border-[7px] border-[#252844] bg-[#080A18] p-2 shadow-[0_30px_80px_rgba(8,10,24,.32)]">
        <div className="overflow-hidden rounded-[2rem] bg-[#F7F8FC]">
          <div className="flex items-center justify-between bg-[#171A4A] px-5 pb-3 pt-4 text-[10px] font-semibold text-white/70">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <Wifi size={12} />
              <BatteryMedium size={13} />
            </div>
          </div>
          <div className="bg-[#171A4A] px-5 pb-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlowMark inverse />
                <span className="font-display text-sm font-extrabold tracking-[-.04em]">LAUPAY</span>
              </div>
              <CircleUserRound size={21} className="text-white/70" />
            </div>
            <div className="mt-7 flex items-end justify-between">
              <div>
                <p className="text-[10px] text-white/55">Good afternoon, Ada</p>
                <p className="mt-1 font-display text-2xl font-extrabold tracking-[-.06em]">{stage === 'dashboard' ? 'Your dashboard' : 'What’s next?'}</p>
              </div>
            </div>
          </div>
          {stage === 'dashboard' ? (
            <DashboardScreen audience={audience} onAudienceChange={onAudienceChange} />
          ) : (
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-center justify-between" aria-label={`Flow stage: ${stage}`}>
              {stages.map(({ key, label }, index) => (
                <div key={key} className="flex flex-1 items-center">
                  <div className={`flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-[.12em] transition-colors duration-500 ${stage === key ? 'text-[#B17819]' : stages.findIndex((item) => item.key === stage) > index ? 'text-[#2E9B68]' : 'text-[#A0A4B2]'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] transition-all duration-500 ${stage === key ? 'bg-[#F4B33F] text-[#171A4A] shadow-[0_0_0_4px_rgba(244,179,63,.14)]' : stages.findIndex((item) => item.key === stage) > index ? 'bg-[#DDF2E7] text-[#2E9B68]' : 'bg-[#EDEEF4] text-[#A0A4B2]'}`}>
                      {stages.findIndex((item) => item.key === stage) > index ? <Check size={11} strokeWidth={3} /> : index + 1}
                    </span>
                    {label}
                  </div>
                  {index < stages.length - 1 && <span className={`mx-2 h-px flex-1 transition-colors duration-500 ${stages.findIndex((item) => item.key === stage) > index ? 'bg-[#79BD98]' : 'bg-[#E2E4EB]'}`} />}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-[#6C7188]">Selected service</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${service.accent}35`, color: '#171A4A' }}>
                    <Icon size={16} />
                  </span>
                  <span className="font-display text-sm font-extrabold text-[#171A4A]">{service.label}</span>
                </div>
              </div>
              <Ellipsis size={19} className="text-[#9A9EAF]" />
            </div>
            <div className="rounded-2xl border border-[#E4E6ED] bg-white p-4">
              <p className="text-[10px] font-semibold text-[#73788A]">{service.meta}</p>
              <p className="mt-1.5 font-display text-xl font-extrabold tracking-[-.05em] text-[#171A4A]">{service.amount}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#EDEEF4]">
                <div className="h-full w-[68%] rounded-full" style={{ backgroundColor: service.accent }} />
              </div>
            </div>
            <button
              type="button"
              onClick={onAction}
              className="flex w-full items-center justify-between rounded-xl bg-[#171A4A] px-4 py-3.5 text-left text-xs font-extrabold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {service.action}
              <ArrowRight size={15} className="text-[#F4B33F]" />
            </button>
            <div className="min-h-9 text-center" role="status" aria-live="polite">
              {stage === 'confirm' ? (
                <>
                  <p className="text-[11px] font-extrabold text-[#2E9B68]">Transaction confirmed</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#6C7188]">Your service is ready.</p>
                </>
              ) : stage === 'process' ? (
                <p className="text-[10px] font-semibold text-[#B17819]">Processing...</p>
              ) : (
                <p className="text-[10px] font-semibold text-[#6C7188]">{actionMessage || 'Ready for your next step.'}</p>
              )}
            </div>
          </div>
          )}
          <div className="flex justify-around border-t border-[#E9EAF0] bg-white py-3 text-[9px] font-bold text-[#9397A7]">
            <span className="text-[#171A4A]">Home</span><span>Activity</span><span>Help</span>
          </div>
        </div>
      </div>
      <div className="absolute -right-5 top-[38%] hidden items-center gap-2 rounded-xl border border-[#E2E4EB] bg-white px-3 py-2 text-[10px] font-bold text-[#171A4A] shadow-[0_14px_30px_rgba(23,26,74,.1)] sm:flex">
        <span className="h-2 w-2 rounded-full bg-[#F4B33F]" /> One clear next step
      </div>
    </div>
  );
}

function Home() {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeService, setActiveService] = useState<ServiceKey>('airtime');
  const [actionMessage, setActionMessage] = useState('');
  const [demoStage, setDemoStage] = useState<DemoStage>('dashboard');
  const [audience, setAudience] = useState<Audience>('customer');
  const [rotationPaused, setRotationPaused] = useState(false);
  const [modal, setModal] = useState<'login' | 'get-started' | null>(null);
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

  const runDemoAction = () => {
    pauseForInteraction();
    setActionMessage(`${active.label} preview selected.`);
    setDemoStage('process');
    window.setTimeout(() => setDemoStage('confirm'), 1100);
    window.setTimeout(() => setActionMessage(''), 3800);
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
            <button type="button" onClick={() => setModal('login')} className="rounded-full border border-white/20 px-4 py-2.5 text-[11px] font-extrabold text-white transition-colors hover:bg-white/10">
              Login
            </button>
            <button type="button" onClick={() => setModal('get-started')} className="rounded-full bg-[#F4B33F] px-4 py-2.5 text-[11px] font-extrabold text-[#171A4A] transition-transform hover:-translate-y-0.5">
              Get Started
            </button>
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
                <button type="button" onClick={() => setModal('login')} className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white">Login</button>
                <button type="button" onClick={() => setModal('get-started')} className="rounded-full bg-[#F4B33F] px-4 py-2 text-xs font-bold text-[#171A4A]">Get Started</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative overflow-hidden bg-[#171A4A] pb-16 pt-32 text-white sm:pb-24 sm:pt-40">
          <div className="absolute -right-40 top-0 h-[520px] w-[520px] rounded-full border border-white/[.05]" />
          <div className="absolute -right-24 top-24 h-[340px] w-[340px] rounded-full border border-[#F4B33F]/[.10]" />
          <div className="section-shell relative">
            <div className="grid items-center gap-14 lg:grid-cols-[.95fr_1.05fr] lg:gap-8">
              <div className="max-w-[610px]">
                <div className="reveal inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F4B33F]" /> Digital services, connected
                </div>
                <h1 className="reveal reveal-delay-1 mt-7 max-w-[650px] font-display text-[clamp(2.8rem,7.5vw,6.2rem)] font-extrabold leading-[.96] tracking-[-.085em] text-balance">
                  Everyday digital services.<br /><span className="flow-word-shift">One simple flow.</span>
                </h1>
                <p className="reveal reveal-delay-2 mt-7 max-w-[470px] text-[15px] leading-7 text-white/65 sm:text-[17px]">
                  Airtime, data, payments, wallet services, and more — brought together so your next transaction feels clear from the start.
                </p>
                <div className="reveal reveal-delay-3 mt-9 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => scrollTo('demo')} className="group inline-flex items-center gap-3 rounded-full bg-[#F4B33F] px-5 py-3.5 text-xs font-extrabold text-[#171A4A] transition-transform hover:-translate-y-1">
                    Get Started <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </button>
                  <button type="button" onClick={() => setModal('login')} className="inline-flex items-center gap-3 rounded-full border border-white/20 px-5 py-3.5 text-xs font-extrabold text-white transition-colors hover:bg-white/10">
                    Login
                  </button>
                </div>
              </div>
              <div className="reveal reveal-delay-2 lg:pl-8">
                    <BridgeArtwork activeService={activeService} />
              </div>
            </div>
          </div>
        </section>

        <section id="flow" className="bg-background py-24 sm:py-32">
          <div className="section-shell">
            <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">Everyday value</p>
                <h2 className="mt-5 max-w-[500px] font-display text-4xl font-extrabold leading-[1.02] tracking-[-.065em] sm:text-5xl">
                  More value in every <span className="flow-word-shift">flow.</span>
                </h2>
              </div>
              <p className="max-w-[530px] text-[15px] leading-7 text-muted-foreground">
                Quality services, clear purchasing, and a platform that works for customers and agents every day.
              </p>
            </div>
            <div className="mt-14 grid gap-3 lg:grid-cols-[1fr_1fr_.8fr]">
              <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-8">
                <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-[#F4B33F]/25" />
                <div className="relative flex items-center justify-between">
                  <span className="rounded-full border border-border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em]">For customers</span>
                  <Smartphone size={20} className="text-[#B17819] dark:text-[#F4B33F]" />
                </div>
                <h3 className="relative mt-12 font-display text-2xl font-extrabold tracking-[-.05em]">Quality digital services.</h3>
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
                <h3 className="relative mt-12 font-display text-2xl font-extrabold tracking-[-.05em]">Better business value.</h3>
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

        <section id="demo" className="bg-[#F0F1F7] py-24 dark:bg-[#0D0F21] sm:py-32">
          <div className="section-shell">
            <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">A look inside</p>
                <h2 className="mt-5 max-w-[500px] font-display text-4xl font-extrabold leading-[1.02] tracking-[-.065em] sm:text-5xl">Open LAUPAY. See what’s next.</h2>
              </div>
              <p className="max-w-[330px] text-sm leading-6 text-muted-foreground">Start at your dashboard, then choose a service.</p>
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
                        onClick={() => { pauseForInteraction(); setActiveService(item.key); setDemoStage('select'); setActionMessage(''); }}
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
                    <div className="rounded-xl bg-secondary p-3 font-bold"><span className="block text-[10px] font-semibold text-muted-foreground">{demoStage === 'dashboard' ? 'Balance' : 'Select'}</span><span className="mt-1 block">{demoStage === 'dashboard' ? '₦24,850.00' : `Choose ${active.label}`}</span></div>
                    <MoveRight className="hidden text-[#B17819] sm:block dark:text-[#F4B33F]" size={18} />
                    <div className="rounded-xl bg-secondary p-3 font-bold"><span className="block text-[10px] font-semibold text-muted-foreground">{demoStage === 'confirm' ? 'Confirm' : demoStage === 'process' ? 'Process' : 'Next'}</span><span className="mt-1 block">{demoStage === 'confirm' ? 'Service ready' : demoStage === 'process' ? 'Processing...' : active.action}</span></div>
                  </div>
                  <button type="button" onClick={() => scrollTo('journeys')} className="mt-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#8D6116] hover:text-[#171A4A] dark:text-[#F4B33F] dark:hover:text-white">
                    See how people use it <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <ProductPhone service={active} onAction={runDemoAction} actionMessage={actionMessage} stage={demoStage} audience={audience} onAudienceChange={setAudience} />
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="bg-background py-24 sm:py-32">
          <div className="section-shell">
            <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">One place, useful things</p>
                <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-[-.065em] sm:text-5xl">The everyday, joined up.</h2>
                <p className="mt-5 max-w-[360px] text-sm leading-6 text-muted-foreground">A service should feel close at hand, whether it is in your pocket or across the counter.</p>
                <button type="button" onClick={() => scrollTo('demo')} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#171A4A] px-5 py-3.5 text-xs font-extrabold text-white transition-transform hover:-translate-y-0.5 dark:bg-[#F4B33F] dark:text-[#171A4A]">Explore the preview <ArrowRight size={14} /></button>
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

        <section id="journeys" className="bg-[#171A4A] py-24 text-white sm:py-32">
          <div className="section-shell">
            <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow text-[#F4B33F]">Different days, same clarity</p>
                <h2 className="mt-5 max-w-[550px] font-display text-4xl font-extrabold leading-[1.02] tracking-[-.065em] sm:text-5xl">Built around real moments.</h2>
              </div>
              <p className="max-w-[340px] text-sm leading-6 text-white/55">The bridge works from both sides: for the person making a request and the person helping it happen.</p>
            </div>
            <div className="mt-14 grid gap-3 lg:grid-cols-2">
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

        <section id="security" className="bg-[#F0F1F7] py-24 dark:bg-[#0D0F21] sm:py-32">
          <div className="section-shell">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">Built with care</p>
                <h2 className="mt-5 max-w-[460px] font-display text-4xl font-extrabold leading-[1.02] tracking-[-.065em] sm:text-5xl">Built with security at every step.</h2>
                <p className="mt-5 max-w-[390px] text-sm leading-6 text-muted-foreground">Clear choices, clear confirmations, and useful status updates keep you in control.</p>
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

        <section id="future" className="bg-background py-24 sm:py-32">
          <div className="section-shell">
            <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
              <div>
                <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">The direction</p>
                <h2 className="mt-5 max-w-[480px] font-display text-4xl font-extrabold leading-[1.02] tracking-[-.065em] sm:text-5xl">Today, then tomorrow.</h2>
                 <p className="mt-5 max-w-[390px] text-sm leading-6 text-muted-foreground">Useful services first, with more connected possibilities ahead.</p>
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
                <div className="relative mt-28 grid grid-cols-2 gap-10">
                  <div><span className="font-mono text-3xl font-bold text-[#B17819] dark:text-[#F4B33F]">01</span><h3 className="mt-4 font-display text-xl font-extrabold tracking-[-.04em]">Useful today</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Airtime, data, payments, wallets, and POS — a clear starting point for everyday needs.</p></div>
                  <div><span className="font-mono text-3xl font-bold text-[#171A4A] dark:text-white">02</span><h3 className="mt-4 font-display text-xl font-extrabold tracking-[-.04em]">Ready for more</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">A connected foundation for future digital services, without losing the simple flow.</p></div>
                </div>
                <div className="absolute bottom-7 left-7 right-7 rounded-xl bg-secondary px-4 py-3 text-xs font-bold sm:bottom-10 sm:left-10 sm:right-10"><span className="text-[#B17819] dark:text-[#F4B33F]">{story === 'today' ? 'TODAY' : 'TOMORROW'}</span><span className="ml-2 text-muted-foreground">{story === 'today' ? 'Start with the essentials.' : 'Keep the connection moving.'}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F0F1F7] py-24 dark:bg-[#0D0F21] sm:py-32">
          <div className="section-shell">
            <div className="mx-auto max-w-[650px] text-center">
                 <p className="eyebrow text-[#B17819] dark:text-[#F4B33F]">Good to know</p>
                 <h2 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-[-.065em] sm:text-5xl">A few useful answers.</h2>
            </div>
            <div className="mx-auto mt-12 max-w-[760px] border-t border-border">
              {faqs.map((item, index) => (
                <div key={item.question} className="border-b border-border">
                  <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="flex w-full items-center justify-between gap-5 py-5 text-left font-display text-sm font-extrabold sm:text-base" aria-expanded={openFaq === index}>
                    {item.question}<ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${openFaq === index ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><p className="overflow-hidden pr-10 text-sm leading-6 text-muted-foreground">{item.answer}</p></div>
                  {openFaq === index && <div className="h-5" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#171A4A] py-24 text-white sm:py-32">
          <div className="section-shell relative overflow-hidden rounded-3xl border border-white/10 bg-[#11142A] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute -left-16 -top-28 h-64 w-64 rounded-full border border-[#F4B33F]/15" />
            <div className="absolute -bottom-32 -right-20 h-72 w-72 rounded-full border border-white/10" />
            <div className="relative mx-auto max-w-[680px]">
              <FlowMark inverse />
              <h2 className="mt-7 font-display text-4xl font-extrabold leading-[1.02] tracking-[-.07em] sm:text-6xl">Make everyday services simpler.</h2>
              <p className="mx-auto mt-5 max-w-[480px] text-sm leading-6 text-white/55">Choose a service and follow the flow from start to finish.</p>
              <button type="button" onClick={() => scrollTo('demo')} className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#F4B33F] px-5 py-3.5 text-xs font-extrabold text-[#171A4A] transition-transform hover:-translate-y-1">See the flow <ArrowRight size={15} /></button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#11142A] py-10 text-white">
        <div className="section-shell flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5"><FlowMark inverse /><span className="font-display text-[17px] font-extrabold tracking-[-.06em]">LAUPAY</span></div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-bold text-white/45"><a className="hover:text-white" href="#services">Services</a><a className="hover:text-white" href="#security">Security</a><a className="hover:text-white" href="#future">Our horizon</a><button type="button" onClick={() => setModal('login')} className="hover:text-white">Login</button></div>
           <p className="text-[10px] font-semibold text-white/30">© 2026 LAUPAY. Digital services, simply connected.</p>
        </div>
      </footer>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080A18]/70 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={() => setModal(null)}>
          <div className="w-full max-w-[430px] rounded-3xl bg-card p-7 text-card-foreground shadow-[0_30px_90px_rgba(8,10,24,.3)] sm:p-9" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between"><div className="rounded-xl bg-secondary p-2.5"><FlowMark /></div><button type="button" onClick={() => setModal(null)} className="rounded-full p-2 text-muted-foreground hover:bg-secondary" aria-label="Close dialog"><X size={18} /></button></div>
            <h2 id="modal-title" className="mt-7 font-display text-2xl font-extrabold tracking-[-.05em]">{modal === 'login' ? 'Login is part of the next step.' : 'You are in the right place.'}</h2>
             <p className="mt-3 text-sm leading-6 text-muted-foreground">{modal === 'login' ? 'Explore the service flows while the full account experience is being prepared.' : 'Choose a service in the product preview and follow each step from selection to confirmation.'}</p>
             <button type="button" onClick={() => { setModal(null); scrollTo('demo'); }} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#171A4A] px-4 py-3.5 text-xs font-extrabold text-white dark:bg-[#F4B33F] dark:text-[#171A4A]">{modal === 'login' ? 'Explore the flow' : 'Open the preview'} <ArrowRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArrowUpRightIcon() {
  return <ArrowDownRight size={17} className="-rotate-90 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />;
}

export default Home;