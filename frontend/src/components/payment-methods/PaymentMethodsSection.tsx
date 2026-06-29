"use client";

import { useCallback, useState } from "react";
import { CreditCard } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethodKey = "jazzcash" | "easypaisa" | "card";

interface PaymentMethodConfig {
  key: PaymentMethodKey;
  name: string;
  badge: string;
  gradient: string;
  glowColor: string;
  accentColor: string;
  logo: React.ReactNode;
  visual: React.ReactNode;
}

type ActiveState = Record<PaymentMethodKey, boolean>;

// ─── Brand Logo Components ────────────────────────────────────────────────────

function JazzCashWordmark() {
  return (
    <div style={{ lineHeight: 1.1 }}>
      <span style={{ fontSize: "21px", fontWeight: 900, letterSpacing: "-0.5px", color: "#fff" }}>
        Jazz
      </span>
      <span style={{ fontSize: "21px", fontWeight: 900, letterSpacing: "-0.5px", color: "#FFD166" }}>
        Cash
      </span>
    </div>
  );
}

function EasyPaisaWordmark() {
  return (
    <div style={{ lineHeight: 1.1 }}>
      <span style={{ fontSize: "21px", fontWeight: 900, letterSpacing: "-0.5px", color: "#fff" }}>
        easy
      </span>
      <span style={{ fontSize: "21px", fontWeight: 900, letterSpacing: "-0.5px", color: "#6EE7B7" }}>
        paisa
      </span>
    </div>
  );
}

function CardWordmark() {
  return (
    <div style={{ lineHeight: 1.2 }}>
      <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.3px", color: "#fff" }}>
        Credit &amp; Debit
      </div>
      <div style={{ fontSize: "12px", fontWeight: 500, color: "rgba(255,255,255,0.55)", letterSpacing: "0.02em" }}>
        Card Payments
      </div>
    </div>
  );
}

// ─── Brand Visuals ────────────────────────────────────────────────────────────

function MobileWalletVisual({ accentColor }: { accentColor: string }) {
  return (
    <svg viewBox="0 0 52 36" width="52" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="1" width="24" height="34" rx="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
      <rect x="17" y="6" width="18" height="22" rx="1.5" fill="rgba(255,255,255,0.08)" />
      <rect x="21" y="30" width="10" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <circle cx="9" cy="14" r="3" fill={accentColor} opacity="0.8" />
      <path d="M3 10 A9 9 0 0 1 15 10" stroke={accentColor} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
      <path d="M1 7 A13 13 0 0 1 17 7" stroke={accentColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <text x="22" y="21" fontFamily="Arial" fontWeight="900" fontSize="10" fill="rgba(255,255,255,0.5)">Rs</text>
    </svg>
  );
}

function ChipAndNetworks() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <svg viewBox="0 0 32 24" width="32" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="30" height="22" rx="3" fill="#C9A227" stroke="#A07D10" strokeWidth="0.8" />
        <rect x="6" y="6" width="20" height="12" rx="1.5" fill="#B8921E" stroke="#9A7A18" strokeWidth="0.5" />
        <line x1="16" y1="1" x2="16" y2="23" stroke="#9A7A18" strokeWidth="0.7" />
        <line x1="1" y1="12" x2="31" y2="12" stroke="#9A7A18" strokeWidth="0.7" />
        <line x1="11" y1="6" x2="11" y2="18" stroke="#9A7A18" strokeWidth="0.5" />
        <line x1="21" y1="6" x2="21" y2="18" stroke="#9A7A18" strokeWidth="0.5" />
      </svg>
      <svg viewBox="0 0 54 18" width="48" height="16" xmlns="http://www.w3.org/2000/svg">
        <text x="1" y="15" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="18" fill="white" letterSpacing="1.5" fontStyle="italic">VISA</text>
      </svg>
      <svg viewBox="0 0 44 28" width="38" height="24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="mc-clip">
            <circle cx="28" cy="14" r="13" />
          </clipPath>
        </defs>
        <circle cx="16" cy="14" r="13" fill="#EB001B" />
        <circle cx="28" cy="14" r="13" fill="#F79E1B" />
        <circle cx="16" cy="14" r="13" fill="#FF5F00" clipPath="url(#mc-clip)" />
      </svg>
    </div>
  );
}

// ─── Config ────────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_CONFIGS: PaymentMethodConfig[] = [
  {
    key: "jazzcash",
    name: "JazzCash",
    badge: "Mobile Wallet",
    gradient: "linear-gradient(140deg, #D62828 0%, #9B1515 55%, #6D0E0E 100%)",
    glowColor: "rgba(214, 40, 40, 0.35)",
    accentColor: "#FFD166",
    logo: <JazzCashWordmark />,
    visual: <MobileWalletVisual accentColor="#FFD166" />,
  },
  {
    key: "easypaisa",
    name: "EasyPaisa",
    badge: "Mobile Wallet",
    gradient: "linear-gradient(140deg, #0A9050 0%, #076B3A 55%, #034024 100%)",
    glowColor: "rgba(10, 144, 80, 0.35)",
    accentColor: "#6EE7B7",
    logo: <EasyPaisaWordmark />,
    visual: <MobileWalletVisual accentColor="#6EE7B7" />,
  },
  {
    key: "card",
    name: "Credit / Debit Card",
    badge: "Visa \u00b7 Mastercard",
    gradient: "linear-gradient(140deg, #1E293B 0%, #0F172A 55%, #020617 100%)",
    glowColor: "rgba(99, 102, 241, 0.3)",
    accentColor: "#818CF8",
    logo: <CardWordmark />,
    visual: <ChipAndNetworks />,
  },
];

const INITIAL_ACTIVE_STATE: ActiveState = {
  jazzcash: true,
  easypaisa: true,
  card: false,
};

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  isActive: boolean;
  accentColor: string;
  onToggle: () => void;
}

function ToggleSwitch({ isActive, accentColor, onToggle }: ToggleSwitchProps) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={isActive}
      aria-label={isActive ? "Deactivate payment method" : "Activate payment method"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px 6px 8px",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,0.22)",
        background: isActive ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.25)",
        cursor: "pointer",
        backdropFilter: "blur(6px)",
        transition: "background 0.2s ease",
        outline: "none",
      }}
    >
      <div
        style={{
          width: "30px",
          height: "17px",
          borderRadius: "999px",
          background: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2.5px",
            left: isActive ? "15px" : "2.5px",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: isActive ? accentColor : "rgba(255,255,255,0.45)",
            transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease",
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
          letterSpacing: "0.01em",
          transition: "color 0.2s ease",
          userSelect: "none",
        }}
      >
        {isActive ? "Active" : "Inactive"}
      </span>
    </button>
  );
}

// ─── Payment Card ──────────────────────────────────────────────────────────────

interface PaymentCardProps {
  config: PaymentMethodConfig;
  isActive: boolean;
  onToggle: (key: PaymentMethodKey) => void;
}

function PaymentCard({ config, isActive, onToggle }: PaymentCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: "20px",
        background: config.gradient,
        padding: "20px",
        minHeight: "168px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: hovered
          ? `0 20px 48px ${config.glowColor}, 0 6px 20px rgba(0,0,0,0.18)`
          : isActive
            ? `0 6px 24px ${config.glowColor}, 0 2px 10px rgba(0,0,0,0.12)`
            : "0 2px 12px rgba(0,0,0,0.10)",
        transform: hovered ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
        transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.28s ease",
        opacity: isActive ? 1 : 0.6,
        filter: isActive ? "none" : "grayscale(0.5)",
      }}
    >
      {/* Decorative depth circles */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          borderRadius: "20px",
        }}
      >
        <div style={{ position: "absolute", top: "-52px", right: "-52px", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "absolute", bottom: "-44px", right: "20px", width: "130px", height: "130px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", top: "30px", right: "-16px", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        {/* Shimmer sweep on hover */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "-60%",
            width: "50%",
            height: "100%",
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)",
            transform: hovered ? "translateX(320%)" : "translateX(0%)",
            transition: hovered ? "transform 0.7s ease" : "none",
          }}
        />
      </div>

      {/* Top Row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <div>{config.logo}</div>
        <div
          style={{
            borderRadius: "999px",
            background: "rgba(255,255,255,0.14)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.18)",
            padding: "4px 10px",
            fontSize: "10px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.82)",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          {config.badge}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <div>{config.visual}</div>
        <ToggleSwitch isActive={isActive} accentColor={config.accentColor} onToggle={() => onToggle(config.key)} />
      </div>
    </div>
  );
}

// ─── Exported Section ─────────────────────────────────────────────────────────

export function PaymentMethodsSection() {
  const [activeState, setActiveState] = useState<ActiveState>(INITIAL_ACTIVE_STATE);

  const handleToggle = useCallback((key: PaymentMethodKey) => {
    setActiveState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E5E5", padding: "20px", marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <CreditCard size={18} strokeWidth={1.5} color="#525252" />
        <div>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#171717" }}>Payment Methods</div>
          <div style={{ fontSize: "12px", color: "#737373" }}>Organization payment options for job billing</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        {PAYMENT_METHOD_CONFIGS.map((config) => (
          <PaymentCard key={config.key} config={config} isActive={activeState[config.key]} onToggle={handleToggle} />
        ))}
      </div>
    </div>
  );
}
