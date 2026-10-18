import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ShieldCheck,
  Smartphone,
  User,
  Wallet,
  Wifi,
  X,
} from "lucide-react";
import { cn } from "@app/lib/cn";
import { useReducedMotion } from "@app/hooks/useReducedMotion";
import { FlowMark } from "@/components/laupay/FlowMark";
import type { Role } from "@app/types/common";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

/**
 * Every entry below maps to a route that already exists in the app
 * (see app/AppRoutes.tsx). Nothing here is invented or preview-only.
 */
const CUSTOMER_ITEMS: NavItem[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/airtime", label: "Airtime", icon: Smartphone },
  { to: "/app/data", label: "Data", icon: Wifi },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/transactions", label: "Transactions", icon: Receipt },
  { to: "/app/security", label: "Security", icon: ShieldCheck },
  { to: "/app/profile", label: "Profile", icon: User },
];

const AGENT_ITEMS: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/airtime", label: "Airtime", icon: Smartphone },
  { to: "/app/data", label: "Data", icon: Wifi },
  { to: "/app/transactions", label: "Transactions", icon: Receipt },
  { to: "/app/profile", label: "Profile", icon: User },
];

const COLLAPSED_WIDTH = 76;
const EXPANDED_WIDTH = 264;
const STORAGE_KEY = "laupay.nav.expanded";
const HOVER_INTENT_MS = 260;
const DRAWER_MS = 300;

function readStoredExpanded(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppNav({
  role,
  mobileOpen,
  onCloseMobile,
}: {
  role: Role;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const items = role === "agent" ? AGENT_ITEMS : CUSTOMER_ITEMS;
  const reduced = useReducedMotion();

  // Desktop rail: starts collapsed, and the choice is remembered across reloads.
  const [pinned, setPinned] = useState<boolean>(readStoredExpanded);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const expanded = pinned || hovered;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(pinned));
    } catch {
      /* storage unavailable — the state still works for this session */
    }
  }, [pinned]);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  // Hover only pre-expands an unpinned rail, after a short intent delay, so a
  // quick pass-through (or reading a tooltip) never shifts the layout.
  const handleEnter = useCallback(() => {
    if (pinned || reduced) return;
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setHovered(true), HOVER_INTENT_MS);
  }, [pinned, reduced, clearHoverTimer]);

  const handleLeave = useCallback(() => {
    clearHoverTimer();
    setHovered(false);
  }, [clearHoverTimer]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  const togglePinned = useCallback(() => {
    setHovered(false);
    clearHoverTimer();
    setPinned((value) => !value);
  }, [clearHoverTimer]);

// Mobile drawer: mounted separately so it can animate both in and out.
  const [drawerMounted, setDrawerMounted] = useState(mobileOpen);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mobileOpen) {
      setDrawerMounted(true);
      const raf = window.requestAnimationFrame(() => setDrawerVisible(true));
      return () => window.cancelAnimationFrame(raf);
    }
    setDrawerVisible(false);
    const timer = window.setTimeout(() => setDrawerMounted(false), reduced ? 0 : DRAWER_MS);
    return () => window.clearTimeout(timer);
  }, [mobileOpen, reduced]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Desktop: collapsible rail. Collapsed shows the logo mark and icons only. */}
      <aside
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        style={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        className={cn(
          "relative z-20 hidden shrink-0 flex-col border-r border-white/10 bg-laupay-indigo text-white",
          "md:sticky md:top-0 md:flex md:h-screen",
          !reduced && "transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
        )}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#1B1E52_0%,#171A4A_46%,#101233_100%)]" />
          <div className="absolute -right-14 top-28 h-48 w-48 rounded-full bg-laupay-amber/[.08] blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-white/[.05] blur-3xl" />
        </div>

        <div
          className={cn(
            "relative flex h-[68px] shrink-0 items-center",
            expanded ? "gap-3 px-4" : "justify-center",
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.06]">
            <FlowMark inverse size={22} />
          </span>
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap font-display text-[17px] font-extrabold tracking-[-.06em]",
              !reduced && "transition-opacity duration-200",
              expanded ? "w-auto opacity-100" : "w-0 opacity-0",
            )}
          >
            LAUPAY
          </span>
        </div>

        <nav aria-label="Primary" className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {items.map((item) => (
            <SidebarLink
              key={item.to}
              item={item}
              expanded={expanded}
              reduced={reduced}
              end={item.to === "/app"}
            />
          ))}
        </nav>

        <div className="relative shrink-0 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={togglePinned}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-white/70",
              "hover:bg-white/[.08] hover:text-white",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-amber",
              !reduced && "transition-colors duration-150",
              expanded ? "px-3" : "justify-center px-0",
            )}
          >
            {expanded ? (
              <PanelLeftClose size={18} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={18} aria-hidden="true" />
            )}
            {expanded && <span className="whitespace-nowrap">Collapse</span>}
          </button>
        </div>
      </aside>

{/* Mobile: slide-in drawer (replaces the old always-on bottom bar). */}
      {drawerMounted && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            aria-hidden="true"
            onClick={onCloseMobile}
            className={cn(
              "absolute inset-0 bg-laupay-ink/60 backdrop-blur-sm",
              !reduced && "transition-opacity duration-300",
              drawerVisible ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            id="laupay-mobile-nav"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            className={cn(
              "absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-white/10 bg-laupay-indigo text-white",
              "shadow-[0_24px_70px_rgba(8,10,24,.45)] outline-none",
              !reduced && "transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
              drawerVisible ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#1B1E52_0%,#171A4A_46%,#101233_100%)]" />
              <div className="absolute -right-16 top-24 h-48 w-48 rounded-full bg-laupay-amber/[.08] blur-3xl" />
            </div>

            <div className="relative flex h-[68px] shrink-0 items-center justify-between border-b border-white/10 px-4">
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.06]">
                  <FlowMark inverse size={22} />
                </span>
                <span className="font-display text-[17px] font-extrabold tracking-[-.06em]">LAUPAY</span>
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="rounded-lg p-2 text-white/70 hover:bg-white/[.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-amber"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Primary" className="relative flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
              {items.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  expanded
                  reduced={reduced}
                  end={item.to === "/app"}
                  onNavigate={onCloseMobile}
                />
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function SidebarLink({
  item,
  expanded,
  reduced,
  end,
  onNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  reduced: boolean;
  end: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group/item relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laupay-amber",
          !reduced && "transition-colors duration-150",
          expanded ? "px-3" : "justify-center px-0",
          isActive
            ? "bg-white/[.10] text-white"
            : "text-white/60 hover:bg-white/[.06] hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-laupay-amber"
            />
          )}
          <Icon size={19} aria-hidden="true" className={cn("shrink-0", isActive && "text-laupay-amber")} />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap",
              !reduced && "transition-opacity duration-200",
              expanded ? "w-auto opacity-100" : "w-0 opacity-0",
            )}
          >
            {item.label}
          </span>
          {!expanded && (
            <span
              role="tooltip"
              aria-hidden="true"
              className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-laupay-indigo-deep px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/item:opacity-100"
            >
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
