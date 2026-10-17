import { useState, useCallback, useEffect, useRef, useMemo, memo } from "react";
import {
  Signal, Wifi, Battery, Play, Settings, Layers,
  BarChart2, Radio, Download, FileText, Share2, Pencil,
  Sliders, Monitor, Cast, RefreshCw, Zap, Maximize2,
  CheckCircle, Laptop, Grid3X3, Minus, ChevronDown,
  ChevronRight, Activity, FolderOpen, Clock, Lock,
  ExternalLink, ChevronLeft, User, Bell, CreditCard,
  LogOut, Globe, Building2, Mail, Phone, MessageCircle,
  MessageSquare, Megaphone, AlertCircle, Plus, Upload, X, Tag,
  LayoutList, Star, Search, ArrowUpDown, ListFilter, Trash2, Copy, Link, Eye, Info, Ellipsis,
} from "lucide-react";
import LoginPage, { type UserInfo } from "./components/LoginPage";

const AUTH_STORAGE_KEY = "antenna-auth";

function loadStoredUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

function userInitial(name: string) {
  return name.trim().charAt(0) || "用";
}

// ── Palette (light mode — SimScale-style) ─────────────────────────────
const C = {
  bg:        "#f8f9fa",
  sidebar:   "#ffffff",
  topbar:    "#ffffff",
  panel:     "#ffffff",
  border:    "#e5e7eb",
  borderA:   "#dadce0",
  accent:    "#1a73e8",
  accentL:   "#1a73e8",
  accentD:   "#e8f0fe",
  text1:     "#202124",
  text2:     "#5f6368",
  text3:     "#9aa0a6",
  green:     "#34a853",
  amber:     "#f29900",
};

// ── SVG Line Chart (replaces recharts) ───────────────────────────────
function SvgLineChart({ data, xKey, yKey, stroke, yDomain, yTicks, xTickIdxs, yFmt = String, xFmt = String }: {
  data: Record<string, number>[];
  xKey: string; yKey: string; stroke: string;
  yDomain: [number, number]; yTicks: number[]; xTickIdxs: number[];
  yFmt?: (v: number) => string; xFmt?: (v: number) => string;
}) {
  const VW = 480, VH = 180;
  const pad = { t: 8, r: 10, b: 26, l: 38 };
  const W = VW - pad.l - pad.r, H = VH - pad.t - pad.b;
  const [yMin, yMax] = yDomain;
  const px = (i: number) => pad.l + (i / (data.length - 1)) * W;
  const py = (v: number) => pad.t + H - ((v - yMin) / (yMax - yMin)) * H;
  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d[yKey]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: "100%", display: "block" }}>
      {yTicks.map(v => (
        <g key={v}>
          <line x1={pad.l} y1={py(v)} x2={pad.l + W} y2={py(v)} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" strokeDasharray="3,3" />
          <text x={pad.l - 4} y={py(v)} textAnchor="end" dominantBaseline="middle" fill={C.text2} fontSize="8" fontFamily="monospace">{yFmt(v)}</text>
        </g>
      ))}
      {xTickIdxs.map(i => (
        <text key={i} x={px(i)} y={pad.t + H + 14} textAnchor="middle" fill={C.text2} fontSize="8" fontFamily="Inter">{xFmt(data[i][xKey])}</text>
      ))}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + H} stroke={C.borderA} strokeWidth="0.5" />
      <line x1={pad.l} y1={pad.t + H} x2={pad.l + W} y2={pad.t + H} stroke={C.borderA} strokeWidth="0.5" />
      <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────
const S11_DATA = Array.from({ length: 81 }, (_, i) => {
  const f = 1.5 + i * 0.03125, f0 = 2.45, bw = 0.10;
  const s11 = -0.35 - 17.95 * Math.exp(-((f - f0) ** 2) / (bw ** 2));
  return { freq: parseFloat(f.toFixed(3)), s11: parseFloat(s11.toFixed(2)) };
});

const VSWR_DATA = S11_DATA.map(({ freq, s11 }) => {
  const mag = Math.pow(10, s11 / 20);
  return { freq, vswr: parseFloat(Math.min((1 + mag) / (1 - mag), 15).toFixed(3)) };
});

// ── Polar Pattern ─────────────────────────────────────────────────────
function PolarPattern({ size = 240 }: { size?: number }) {
  const cx = size / 2, cy = size / 2;
  const maxR = size / 2 - 26;
  const toR = (dBi: number) => maxR * Math.max(0, (dBi + 25) / 33);

  const buildPath = (fn: (t: number) => number) =>
    Array.from({ length: 361 }, (_, i) => {
      const t = (i * Math.PI) / 180, g = fn(t);
      const dBi = 6.2 + 10 * Math.log10(Math.max(g, 1e-6)), r = toR(dBi);
      return `${i === 0 ? "M" : "L"}${(cx + r * Math.sin(t)).toFixed(1)},${(cy - r * Math.cos(t)).toFixed(1)}`;
    }).join(" ") + "Z";

  const ePath = buildPath((t) => { const c = Math.cos(t); return c >= 0 ? Math.pow(c, 1.8) : Math.pow(-c, 1.8) * 0.14; });
  const hPath = buildPath((t) => { const c = Math.cos(t), s = Math.sin(t); return Math.max(c >= 0 ? Math.pow(c, 1.3) * Math.pow(1 - 0.4 * s * s, 0.8) : Math.pow(-c, 1.8) * 0.2, 0); });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0, 30, 60, 90, 120, 150].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return <line key={deg} x1={cx + maxR * Math.sin(r)} y1={cy - maxR * Math.cos(r)} x2={cx - maxR * Math.sin(r)} y2={cy + maxR * Math.cos(r)} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />;
      })}
      {[6, 0, -10, -20].map((dBi) => {
        const r = toR(dBi);
        return (
          <g key={dBi}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.borderA} strokeWidth="0.5" strokeDasharray={dBi === 6 ? "3,2" : undefined} />
            <text x={cx + r + 2} y={cy - 3} fill={C.text3} fontSize="7" fontFamily="Inter">{dBi}</text>
          </g>
        );
      })}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const r = (deg * Math.PI) / 180, lr = maxR + 14;
        return <text key={deg} x={cx + lr * Math.sin(r)} y={cy - lr * Math.cos(r)} fill={C.text3} fontSize="7" textAnchor="middle" dominantBaseline="middle" fontFamily="Inter">{deg}°</text>;
      })}
      <path d={hPath} fill="rgba(52,168,83,0.07)" stroke={C.green} strokeWidth="1" strokeDasharray="4,2" />
      <path d={ePath} fill="rgba(26,115,232,0.1)" stroke={C.accent} strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={2} fill={C.accent} />
      <circle cx={cx} cy={cy - toR(6.2)} r={2.5} fill={C.accent} stroke="rgba(255,255,255,0.8)" strokeWidth="0.5" />
      <text x={cx + 5} y={cy - toR(6.2)} fill={C.accent} fontSize="7" fontFamily="Inter">6.2dBi</text>
      <line x1={cx - 30} y1={size - 12} x2={cx - 18} y2={size - 12} stroke={C.accent} strokeWidth="1.5" />
      <text x={cx - 16} y={size - 9} fill={C.text2} fontSize="7" fontFamily="Inter">E面</text>
      <line x1={cx + 10} y1={size - 12} x2={cx + 22} y2={size - 12} stroke={C.green} strokeWidth="1" strokeDasharray="4,2" />
      <text x={cx + 24} y={size - 9} fill={C.text2} fontSize="7" fontFamily="Inter">H面</text>
    </svg>
  );
}

// ── 3D Antenna SVG ────────────────────────────────────────────────────
function AntennaView3D({ width = 380, height = 260 }: { width?: number; height?: number }) {
  const S = 0.62;
  const isoX = (x: number, y: number) => width / 2 + (x - y) * Math.cos(Math.PI / 6) * S;
  const isoY = (x: number, y: number, z: number) => height * 0.68 + (x + y) * Math.sin(Math.PI / 6) * S - z * S * 1.2;
  const pts = (c: [number, number, number][]) => c.map(([x, y, z]) => `${isoX(x, y)},${isoY(x, y, z)}`).join(" ");
  const GW = 95, GH = 74, SH = 9, PW = 42, PH = 34, PZ = SH;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Ground plane */}
      <polygon points={pts([[-GW/2,-GH/2,0],[GW/2,-GH/2,0],[GW/2,GH/2,0],[-GW/2,GH/2,0]])} fill="#c8d4e0" stroke="#b0bec8" strokeWidth="0.8" />
      {/* Substrate front face */}
      <polygon points={pts([[-GW/2,GH/2,0],[GW/2,GH/2,0],[GW/2,GH/2,SH],[-GW/2,GH/2,SH]])} fill="rgba(180,210,250,0.5)" stroke="#a8c4e0" strokeWidth="0.5" />
      {/* Substrate side face */}
      <polygon points={pts([[GW/2,-GH/2,0],[GW/2,GH/2,0],[GW/2,GH/2,SH],[GW/2,-GH/2,SH]])} fill="rgba(180,210,250,0.4)" stroke="#a0bcd8" strokeWidth="0.5" />
      {/* Substrate top face */}
      <polygon points={pts([[-GW/2,-GH/2,SH],[GW/2,-GH/2,SH],[GW/2,GH/2,SH],[-GW/2,GH/2,SH]])} fill="rgba(200,220,250,0.3)" stroke="#b0cce8" strokeWidth="0.5" />
      {/* Feed probe */}
      <polygon points={pts([[-2,GH/2,SH],[2,GH/2,SH],[2,PH/2,SH],[-2,PH/2,SH]])} fill="#b09030" stroke="#c8a828" strokeWidth="0.4" />
      {/* Patch — gold */}
      <polygon points={pts([[-PW/2,-PH/2,PZ],[PW/2,-PH/2,PZ],[PW/2,PH/2,PZ],[-PW/2,PH/2,PZ]])} fill="#d4a017" stroke="#e8b820" strokeWidth="0.7" opacity="0.92" />
      <text x={isoX(0,-PH/2-5)} y={isoY(0,-PH/2-5,PZ)} fill="#b08010" fontSize="8" textAnchor="middle" fontFamily="Inter">Patch</text>
      <text x={isoX(-GW/2-4,0)} y={isoY(-GW/2-4,0,SH/2)} fill={C.text3} fontSize="7" textAnchor="end" fontFamily="Inter">εr=4.4</text>
      {/* Connector */}
      <line x1={isoX(0,GH/2+5)} y1={isoY(0,GH/2+5,0)} x2={isoX(0,GH/2)} y2={isoY(0,GH/2,SH)} stroke="#8090a0" strokeWidth="1.5" />
      <circle cx={isoX(0,GH/2+5)} cy={isoY(0,GH/2+5,0)} r={2.5} fill="#6070a0" />
      {/* Axis */}
      <line x1={isoX(0,0,SH)} y1={isoY(0,0,SH)} x2={isoX(28,0,SH)} y2={isoY(28,0,SH)} stroke="#c04040" strokeWidth="0.8" opacity="0.6" />
      <line x1={isoX(0,0,SH)} y1={isoY(0,0,SH)} x2={isoX(0,28,SH)} y2={isoY(0,28,SH)} stroke="#40a040" strokeWidth="0.8" opacity="0.6" />
      <line x1={isoX(0,0,SH)} y1={isoY(0,0,SH)} x2={isoX(0,0,SH+22)} y2={isoY(0,0,SH+22)} stroke="#4060c0" strokeWidth="0.8" opacity="0.6" />
      <text x={isoX(31,0)} y={isoY(31,0,SH)} fill="#c06060" fontSize="7" fontFamily="Inter">X</text>
      <text x={isoX(0,31)} y={isoY(0,31,SH)} fill="#60a060" fontSize="7" fontFamily="Inter">Y</text>
      <text x={isoX(0,0)} y={isoY(0,0,SH+25)} fill="#6080c0" fontSize="7" fontFamily="Inter">Z</text>
      {/* Radiation rings */}
      {[16, 26, 36].map((r, i) => (
        <ellipse key={r} cx={isoX(0,0)} cy={isoY(0,0,PZ+r)} rx={r * 0.9 * S} ry={r * 0.35 * S} fill="none" stroke={C.accent} strokeWidth="0.5" opacity={0.3 - i * 0.07}>
          <animate attributeName="opacity" values={`${0.3-i*0.07};0.05;${0.3-i*0.07}`} dur={`${2.2+i*0.5}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
      {/* Dimension line */}
      <line x1={isoX(-PW/2,-PH/2-9)} y1={isoY(-PW/2,-PH/2-9,PZ)} x2={isoX(PW/2,-PH/2-9)} y2={isoY(PW/2,-PH/2-9,PZ)} stroke={C.borderA} strokeWidth="0.7" />
      <text x={(isoX(-PW/2,-PH/2-9)+isoX(PW/2,-PH/2-9))/2} y={(isoY(-PW/2,-PH/2-9,PZ)+isoY(PW/2,-PH/2-9,PZ))/2-4} fill={C.text2} fontSize="7" textAnchor="middle" fontFamily="Inter">L=38.5mm</text>
    </svg>
  );
}


// ── Distributed Panel ─────────────────────────────────────────────────

// ── Sidebar sub-components ────────────────────────────────────────────
function SectionHeader({ label, sidebarCollapsed }: { label: string; sidebarCollapsed?: boolean }) {
  if (sidebarCollapsed) return null;
  return (
    <div className="flex items-center gap-1.5 w-full text-left"
      style={{ padding: "14px 16px 5px", background: "transparent", border: "none" }}>
      <span style={{ fontSize: 12, color: C.text3, fontWeight: 400 }}>{label}</span>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, external, collapsed }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string; active?: boolean; onClick?: () => void; external?: boolean;
  collapsed?: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const handleEnter = () => {
    if (collapsed) {
      tooltipTimer.current = setTimeout(() => {
        setShowTooltip(true);
        // Position tooltip after render
        setTimeout(() => {
          if (btnRef.current && tipRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            tipRef.current.style.top = (r.top + r.height / 2) + "px";
            tipRef.current.style.transform = "translateY(-50%)";
            tipRef.current.style.left = (r.right + 10) + "px";
          }
        }, 0);
      }, 500);
    }
  };
  const handleLeave = () => {
    if (tooltipTimer.current) { clearTimeout(tooltipTimer.current); tooltipTimer.current = null; }
    setShowTooltip(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className="flex items-center gap-2.5 text-left transition-colors"
        style={{
          display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 10,
          width: collapsed ? "calc(100% - 8px)" : "calc(100% - 16px)",
          margin: collapsed ? "1px 4px" : "1px 8px",
          padding: collapsed ? "7px 0" : "7px 10px",
          borderRadius: 6,
          background: active ? C.accentD : "transparent",
          color: active ? C.accent : C.text2,
          fontSize: 13,
          fontWeight: active ? 500 : 400,
          cursor: "pointer", border: "none",
        }}
        onMouseEnterCapture={(e) => { if (!active && !collapsed) e.currentTarget.style.background = "#f1f3f4"; }}
        onMouseLeaveCapture={(e) => { if (!active && !collapsed) e.currentTarget.style.background = "transparent"; }}
      >
        <Icon size={collapsed ? 18 : 15} style={{ flexShrink: 0, color: active ? C.accent : C.text2 }} />
        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        {!collapsed && external && <ExternalLink size={10} style={{ color: C.text3 }} />}
      </button>
      {collapsed && showTooltip && (
        <div ref={tipRef} style={{
          position: "fixed", top: 0, left: 0, zIndex: 100,
          background: "#333", color: "#fff", fontSize: 11, fontWeight: 500,
          padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          pointerEvents: "none",
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── Personal Center ───────────────────────────────────────────────────
function ProfileCenter({ user, onLogout, initialTab }: { user: UserInfo; onLogout: () => void; initialTab?: "info" | "share" | "storage" | "uploadlog" }) {
  const [tab, setTab] = useState<"info" | "share" | "storage" | "uploadlog">(initialTab || "info");
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: "#f8f9fa" }}>
      {/* Header card */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "20px 28px 16px", flexShrink: 0 }}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#e91e8c", fontSize: 24, fontWeight: 700, color: "#fff" }}>{userInitial(user.name)}</div>
          <div className="flex-1">
            <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text1, marginBottom: 2 }}>{user.name}</h1>
            <p style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>天线工程师 · 华为终端 BG</p>
            <div className="flex items-center gap-4" style={{ fontSize: 11, color: C.text3 }}>
              <span className="flex items-center gap-1"><Mail size={10} />{user.email}</span>
              <span className="flex items-center gap-1"><Building2 size={10} />深圳研发中心</span>
              <span className="flex items-center gap-1"><Phone size={10} />+86 138 xxxx 8888</span>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ fontSize: 12, color: C.text2, border: `1px solid ${C.borderA}`, background: "#fff", cursor: "pointer" }}>
            <LogOut size={12} />退出登录
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-4" style={{ borderBottom: `1px solid ${C.border}`, marginBottom: -17 }}>
          {(["info", "share", "storage", "uploadlog"] as const).map((t, i) => {
            const labels = ["基本信息", "共享记录", "存储空间", "上传记录"];
            return (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 pb-3 pt-1"
                style={{ fontSize: 13, fontWeight: tab === t ? 500 : 400, color: tab === t ? C.accent : C.text2, background: "transparent", border: "none", borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent", cursor: "pointer" }}>
                {labels[i]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "20px 28px" }}>
        {tab === "info" && (
          <div className="grid grid-cols-2 gap-4">
            {/* Left: basic form */}
            <div className="rounded-xl p-5" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 16 }}>个人资料</h3>
              {[
                { label: "姓名", value: user.name },
                { label: "邮箱", value: user.email },
                { label: "手机", value: "+86 138 xxxx 8888" },
                { label: "单位", value: "华为终端 BG" },
                { label: "职位", value: "天线工程师" },
                { label: "所在城市", value: "深圳" },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>{label}</div>
                  <input defaultValue={value} style={{ width: "100%", padding: "6px 10px", fontSize: 12, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 6, background: "#fff", outline: "none" }} />
                </div>
              ))}
              <button className="mt-2 px-4 py-2 rounded-lg w-full"
                style={{ background: C.accent, color: "#fff", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer" }}>
                保存更改
              </button>
            </div>
            {/* Right: notifications + security */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl p-5" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 14 }}>通知设置</h3>
                {[
                  ["仿真完成通知", true],
                  ["资源超限预警", true],
                  ["系统更新公告", false],
                  ["团队协作消息", true],
                ].map(([label, on]) => (
                  <div key={label as string} className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: C.text2 }}>{label as string}</span>
                    <div style={{ width: 32, height: 18, borderRadius: 9, background: on ? C.accent : "#dadce0", position: "relative", cursor: "pointer" }}>
                      <div style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-5" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 14 }}>账号安全</h3>
                {[
                  { label: "修改密码", icon: Lock, desc: "上次修改：30天前" },
                  { label: "两步验证", icon: Bell, desc: "已启用" },
                  { label: "登录记录", icon: Clock, desc: "查看最近活动" },
                ].map(({ label, icon: Icon, desc }) => (
                  <button key={label} className="flex items-center gap-3 w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                    style={{ background: "transparent", border: "none", cursor: "pointer", marginBottom: 2 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.accentD }}>
                      <Icon size={13} style={{ color: C.accent }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: C.text1, fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: 10, color: C.text3 }}>{desc}</div>
                    </div>
                    <ChevronRight size={13} style={{ marginLeft: "auto", color: C.text3 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "share" && (
          <div className="flex-1 overflow-y-auto" style={{ padding: "20px 28px" }}>
            {/* 共享记录列表 */}
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>共享记录</h3>
              </div>
              {[
                { name: "5G毫米波天线阵列设计", type: "项目", from: "team_lead", date: "2026-07-15", action: "打开项目", actionIcon: ExternalLink },
                { name: "喇叭天线仿真模板",       type: "模板", from: "rf_engineer", date: "2026-07-12", action: "使用模板", actionIcon: Download },
                { name: "S11 回波损耗对比图",     type: "图表", from: "lucky123", date: "2026-07-08", action: "查看图片", actionIcon: Eye },
                { name: "MIMO 平板天线",          type: "项目", from: "rf_engineer", date: "2026-06-30", action: "打开项目", actionIcon: ExternalLink },
                { name: "贴片天线增益方向图",     type: "图表", from: "team_lead", date: "2026-06-22", action: "查看图片", actionIcon: Eye },
                { name: "偶极子天线模板",         type: "模板", from: "lucky123", date: "2026-06-15", action: "使用模板", actionIcon: Download },
              ].map(({ name, type, from, date, action, actionIcon: ActionIcon }) => (
                <div key={name + date} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: type === "项目" ? C.accentD : type === "模板" ? "rgba(52,168,83,0.08)" : "rgba(124,58,237,0.08)" }}>
                    {type === "项目" ? <FolderOpen size={18} style={{ color: C.accent }} />
                      : type === "模板" ? <Grid3X3 size={18} style={{ color: C.green }} />
                      : <Eye size={18} style={{ color: "#7c3aed" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text1 }}>{name}</span>
                      <span style={{
                        fontSize: 9, padding: "2px 8px", borderRadius: 4,
                        background: type === "项目" ? C.accentD : type === "模板" ? "rgba(52,168,83,0.08)" : "rgba(124,58,237,0.08)",
                        color: type === "项目" ? C.accent : type === "模板" ? C.green : "#7c3aed",
                        border: `1px solid ${type === "项目" ? C.accent : type === "模板" ? "rgba(52,168,83,0.3)" : "rgba(124,58,237,0.3)"}`,
                      }}>
                        {type}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>
                      <span style={{ color: C.text2, fontWeight: 500 }}>{from}</span> 分享
                      <span style={{ marginLeft: 8 }}>{date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5" style={{ fontSize: 11, color: C.accent, background: C.accentD, border: "none", padding: "5px 12px", borderRadius: 6, cursor: "pointer" }}>
                      <ActionIcon size={11} />{action}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "storage" && (
          <div className="flex-1 overflow-y-auto" style={{ padding: "20px 28px" }}>
            {/* 存储概览卡片 */}
            <div className="flex gap-4 mb-4">
              <div className="flex-[2] rounded-xl p-5" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>存储空间总览</h3>
                  <span style={{ fontSize: 11, color: C.text3 }}>2.4 GB / 10 GB</span>
                </div>
                {/* 环形进度条 */}
                <div className="flex items-center gap-6">
                  <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f3f4" strokeWidth="10" />
                      <circle cx="60" cy="60" r="50" fill="none" stroke={C.accent} strokeWidth="10"
                        strokeDasharray={`${(24 / 100) * 314} 314`} strokeLinecap="round"
                        transform="rotate(-90 60 60)" />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: C.text1 }}>24%</span>
                      <span style={{ fontSize: 10, color: C.text3 }}>已使用</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    {[
                      { label: "项目文件", size: "1.2 GB", pct: 50, color: C.accent },
                      { label: "仿真结果", size: "0.8 GB", pct: 33, color: C.green },
                      { label: "模板与模型", size: "0.2 GB", pct: 9, color: "#7c3aed" },
                      { label: "其他", size: "0.2 GB", pct: 8, color: C.amber },
                    ].map(({ label, size, pct, color }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                          <div className="flex items-center gap-2">
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                            <span style={{ fontSize: 11, color: C.text2 }}>{label}</span>
                          </div>
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: C.text1 }}>{size}</span>
                        </div>
                        <div style={{ height: 4, background: "#f1f3f4", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 快捷操作 */}
              <div className="flex-1 rounded-xl p-5" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 16 }}>快捷操作</h3>
                <div className="flex flex-col gap-2">
                  {[
                    { icon: Download, label: "清理缓存文件", desc: "释放临时仿真数据", color: C.accent },
                    { icon: FileText, label: "导出并删除", desc: "下载旧结果后清理", color: C.green },
                    { icon: RefreshCw, label: "自动清理设置", desc: "配置自动清理规则", color: "#7c3aed" },
                  ].map(({ icon: Icon, label, desc, color }) => (
                    <button key={label} className="flex items-center gap-3 w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                      style={{ background: "transparent", border: "none", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                        <Icon size={15} style={{ color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: C.text1, fontWeight: 500 }}>{label}</div>
                        <div style={{ fontSize: 10, color: C.text3 }}>{desc}</div>
                      </div>
                      <ChevronRight size={13} style={{ marginLeft: "auto", color: C.text3 }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {tab === "uploadlog" && (
          <div className="flex-1 overflow-y-auto" style={{ padding: "20px 28px" }}>
            {/* Upload history list */}
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>上传记录</h3>
              </div>
              {[
                { name: "2.4GHz 贴片天线模板", type: "模板上传", target: "模板库", status: "已完成", date: "2026-07-21 09:30", id: "UP-20260721-001" },
                { name: "宽带偶极子 V2 模板", type: "模板上传", target: "模板库", status: "已完成", date: "2026-07-20 15:42", id: "UP-20260720-002" },
                { name: "Ku 波段缝隙阵模板", type: "模板上传", target: "模板库", status: "已拒绝", date: "2026-07-18 16:55", id: "UP-20260718-004" },
                { name: "VHF 八木天线模板", type: "模板上传", target: "模板库", status: "已完成", date: "2026-07-15 08:10", id: "UP-20260715-005" },
              ].map(({ name, type, target, status, date, id }) => {
                const statusColor = status === "已完成" ? C.green : status === "审核中" ? C.amber : "#d93025";
                return (
                  <div key={id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: C.accentD }}>
                      <Layers size={18} style={{ color: C.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.text1 }}>{name}</span>
                        <span style={{
                          fontSize: 9, padding: "2px 8px", borderRadius: 4,
                          background: `${statusColor}15`, color: statusColor,
                          border: `1px solid ${statusColor}40`,
                        }}>
                          {status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>
                        <span>{type}</span>
                        <span style={{ margin: "0 8px" }}>→</span>
                        <span style={{ color: C.text2, fontWeight: 500 }}>{target}</span>
                        <span style={{ marginLeft: 8 }}>{date}</span>
                        <span style={{ marginLeft: 8, fontFamily: "monospace", fontSize: 9, color: C.text3 }}>{id}</span>
                      </div>
                    </div>
                    <button style={{ fontSize: 11, color: C.text2, background: "transparent", border: `1px solid ${C.borderA}`, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                      详情
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarParam({ label, value, unit, min, max, step = 0.1, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: C.text2 }}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: C.text1 }}>
          {value.toFixed(2)}<span style={{ fontSize: 9, color: C.text3 }}> {unit}</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 2, background: "#f1f3f4", borderRadius: 1 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", background: C.accent, borderRadius: 1, width: `${((value-min)/(max-min))*100}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} />
      </div>
    </div>
  );
}

// ── Workflow Steps (top bar) ──────────────────────────────────────────

// ── Static data ───────────────────────────────────────────────────────

const RECENT_PROJECTS = [
  {
    id: 1, title: "采用AI技术的模型车天线", type: "我的项目", author: "lucky123",
    date: "2026年6月25日", privacy: "私人", tag: "微带贴片",
    freq: 2.45,
    params: { patchL: 38.5, patchW: 47.2, feedPos: 12.3, er: 4.40, h: 1.6 },
    results: { s11: -18.3, gain: 6.2, vswr: 1.28, bw: 98, eff: 87.3 },
  },
  {
    id: 2, title: "5G毫米波天线阵列设计", type: "我的项目", author: "lucky123",
    date: "2026年5月18日", privacy: "团队", tag: "缝隙阵列",
    freq: 28.0,
    params: { patchL: 5.2, patchW: 4.8, feedPos: 1.8, er: 2.20, h: 0.787 },
    results: { s11: -14.7, gain: 18.4, vswr: 1.52, bw: 820, eff: 78.6 },
  },
  {
    id: 3, title: "WiFi 6E 双频天线优化", type: "空间", author: "team_lead",
    date: "2026年4月30日", privacy: "私人", tag: "偶极子",
    freq: 6.0,
    params: { patchL: 24.8, patchW: 3.2, feedPos: 5.4, er: 4.40, h: 1.6 },
    results: { s11: -12.1, gain: 3.8, vswr: 1.74, bw: 340, eff: 91.2 },
  },
];

const TEMPLATES = [
  { name: "微带贴片基础模板", category: "微带贴片", desc: "2.4/5GHz 标准微带贴片天线", freq: "2.45 GHz" },
  { name: "八木宇达标准设计", category: "八木宇达", desc: "7 单元八木，VHF/UHF 方向性应用", freq: "433 MHz" },
  { name: "偶极子阵列模板", category: "偶极子", desc: "宽带偶极子阵列，700MHz–2.7GHz", freq: "多频段" },
  { name: "缝隙天线标准模板", category: "缝隙天线", desc: "矩形缝隙，雷达/卫星通信", freq: "10 GHz" },
  { name: "MIMO 平板天线", category: "微带贴片", desc: "4×4 MIMO，支持 5G NR 频段", freq: "3.5 GHz" },
  { name: "毫米波相控阵", category: "缝隙阵列", desc: "64 单元相控阵，波束赋形", freq: "28 GHz" },
];

const MY_TEMPLATES = [
  { name: "矩形喇叭天线模板", category: "矩形喇叭", desc: "高增益 · 宽频带 · 矩形口径，适合卫星通信和雷达应用", freq: "2.45 GHz", date: "2026-07-18", type: "我的模板", privacy: "private" as const },
  { name: "2.4GHz 贴片天线", category: "微带贴片", desc: "个人优化的 2.4GHz WiFi 天线模板，S11 < -20dB", freq: "2.45 GHz", date: "2026-07-18", type: "我的模板", privacy: "private" as const },
  { name: "宽带偶极子 V2", category: "偶极子", desc: "改进型宽带偶极子，覆盖 700MHz–3GHz", freq: "多频段", date: "2026-07-12", type: "我的模板", privacy: "public" as const },
  { name: "Ku 波段缝隙阵", category: "缝隙阵列", desc: "12GHz 卫星通信缝隙阵列，增益 22dBi", freq: "12 GHz", date: "2026-06-28", type: "我的模板", privacy: "private" as const },
  { name: "VHF 八木天线", category: "八木宇达", desc: "5 单元 144MHz 业余无线电八木天线", freq: "144 MHz", date: "2026-06-15", type: "我的模板", privacy: "public" as const },
];

// ── Filter Panel ────────────────────────────────────────────────────
type FilterSelections = {
  antennaTypes: Set<string>;
  freqBands: Set<string>;
  downloaded: Set<string>;
  createdPeriod: Set<string>;
};

const emptyFilters = (): FilterSelections => ({
  antennaTypes: new Set<string>(),
  freqBands: new Set<string>(),
  downloaded: new Set<string>(),
  createdPeriod: new Set<string>(),
});

const filterHasAny = (f: FilterSelections): boolean =>
  f.antennaTypes.size > 0 || f.freqBands.size > 0 || f.downloaded.size > 0 || f.createdPeriod.size > 0;

const getFilterTags = (f: FilterSelections): string[] => {
  const tags: string[] = [];
  f.antennaTypes.forEach(v => tags.push(v));
  f.freqBands.forEach(v => tags.push(v));
  f.downloaded.forEach(v => tags.push(v));
  f.createdPeriod.forEach(v => tags.push(v));
  return tags;
};

const FILTER_ANTENNA_TYPES = ["微带贴片", "偶极子", "缝隙阵列", "八木宇达"];
const FILTER_FREQ_BANDS = ["<1GHz", "1-6GHz", ">6GHz", "毫米波"];
const FILTER_DOWNLOAD = ["已下载", "未下载"];
const FILTER_CREATED = ["今天", "本周", "本月", "更早"];

function FilterCard({ filters, setFilters, onClose }: {
  filters: FilterSelections;
  setFilters: React.Dispatch<React.SetStateAction<FilterSelections>>;
  onClose: () => void;
}) {
  const toggle = (cat: keyof FilterSelections, val: string) => {
    if (cat === "createdPeriod") {
      const cur = new Set(filters.createdPeriod);
      if (cur.has(val)) cur.delete(val); else { cur.clear(); cur.add(val); }
      setFilters(prev => ({ ...prev, createdPeriod: cur }));
    } else if (cat === "downloaded") {
      const cur = new Set(filters.downloaded);
      if (cur.has(val)) cur.delete(val); else { cur.clear(); cur.add(val); }
      setFilters(prev => ({ ...prev, downloaded: cur }));
    } else {
      const cur = new Set(filters[cat]);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      setFilters(prev => ({ ...prev, [cat]: cur }));
    }
  };

  const Row = ({ label, options, cat }: { label: string; options: string[]; cat: keyof FilterSelections }) => (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 10, fontWeight: 500, color: C.text1, marginBottom: 6 }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const sel = (filters[cat] as Set<string>).has(o);
          return (
            <button key={o} onClick={() => toggle(cat, o)}
              style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                background: sel ? C.accent : "transparent",
                color: sel ? "#fff" : C.text2,
                border: sel ? `1.5px solid ${C.accent}` : `1px solid ${C.borderA}`,
                fontWeight: sel ? 500 : 400,
                whiteSpace: "nowrap",
              }}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: "absolute", top: "100%", left: 0, marginTop: 6,
      background: "#fff", border: `1px solid ${C.border}`,
      borderRadius: 12, boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
      zIndex: 15, padding: "16px 18px 12px", width: 340,
    }}>
      <Row label="天线类型" options={FILTER_ANTENNA_TYPES} cat="antennaTypes" />
      <Row label="工作频段" options={FILTER_FREQ_BANDS} cat="freqBands" />
      <Row label="下载状态" options={FILTER_DOWNLOAD} cat="downloaded" />
      <Row label="创建时间" options={FILTER_CREATED} cat="createdPeriod" />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <button onClick={() => { setFilters(emptyFilters()); }}
          style={{ fontSize: 10, color: "#d93025", background: "transparent", border: "none", cursor: "pointer" }}>
          清除全部
        </button>
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg"
          style={{ fontSize: 10, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
          确认
        </button>
      </div>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────
function ProjectCard({ id, title, type, author, date, privacy, tag, freq, params, results, onOpen, favorited, onToggleFav, onMoreClick }: {
  id: number; title: string; type: string; author: string; date: string; privacy: string; tag: string;
  freq?: number; params?: Record<string, number>; results?: Record<string, number>; onOpen?: () => void;
  favorited?: boolean; onToggleFav?: (id: number) => void;
  onMoreClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleEnter = () => {
    tipTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const r = cardRef.current.getBoundingClientRect();
        setTipPos({ x: r.left + r.width / 2, y: r.bottom });
      }
      setShowTip(true);
    }, 700);
  };
  const handleLeave = () => {
    if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null; }
    setShowTip(false);
  };

  return (
    <div ref={cardRef} onClick={onOpen} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", position: "relative" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; handleEnter(); }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; handleLeave(); }}>
      <div style={{ height: 110, background: "#f1f3f4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Radio size={22} style={{ color: "#dadce0" }} />
        <span style={{ fontSize: 11, color: C.text3 }}>No preview available</span>
      </div>
      <div style={{ padding: "10px 13px 12px" }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: C.accent, background: C.accentD, padding: "1px 7px", borderRadius: 4, fontWeight: 500 }}>{tag}</span>
        </div>
        <h3 style={{ fontSize: 12, fontWeight: 500, color: C.text1, marginBottom: 6, lineHeight: 1.4 }}>{title}</h3>
        <div style={{ fontSize: 10, color: C.text2, marginBottom: 4 }} className="flex items-center gap-1">
          <FolderOpen size={9} />{type}
        </div>
        <div className="flex items-center justify-between" style={{ fontSize: 10, color: C.text3 }}>
          <span className="flex items-center gap-1"><Clock size={9} />{date}</span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ border: `1px solid ${C.borderA}` }}>
            <Lock size={8} />{privacy}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.text3 }}>
          <span>统计数据</span><span>0</span><span>0</span><span>0</span>
        </div>
      </div>
      <button
        aria-label={`打开${title}的更多操作`}
        title="更多操作"
        onClick={(e) => { e.stopPropagation(); onMoreClick?.(e); }}
        style={{
          position: "absolute", top: 8, right: 8,
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(255,255,255,0.94)", border: `1px solid ${C.borderA}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.text2, zIndex: 2,
        }}>
        <Ellipsis size={18} />
      </button>

      {/* Favorite star */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav?.(id); }}
        style={{
          position: "absolute", bottom: 10, right: 10,
          width: 26, height: 26, borderRadius: "50%",
          background: favorited ? "rgba(242,153,0,0.1)" : "rgba(0,0,0,0.04)",
          border: favorited ? "1px solid rgba(242,153,0,0.3)" : "1px solid transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { if (!favorited) e.currentTarget.style.background = "rgba(242,153,0,0.08)"; }}
        onMouseLeave={(e) => { if (!favorited) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "transparent"; } }}>
        <Star size={13}
          fill={favorited ? "#f29900" : "none"}
          stroke={favorited ? "#f29900" : C.text3}
          style={{ transition: "all 0.15s" }} />
      </button>

      {/* Hover summary tooltip — fixed position to escape card overflow */}
      {showTip && (
        <div style={{
          position: "fixed", left: tipPos.x, top: tipPos.y,
          transform: "translate(-50%, 4px)", zIndex: 1000,
          background: "#fff", border: `1px solid ${C.border}`,
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          padding: "14px 16px", minWidth: 240, maxWidth: 300,
          cursor: "default",
        }}
        onMouseEnter={() => { if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null; } }}
        onMouseLeave={handleLeave}>
          {/* Arrow */}
          <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderBottom: `6px solid #fff` }} />
          <p style={{ fontSize: 12, fontWeight: 600, color: C.text1, marginBottom: 10 }}>{title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: C.accentD, color: C.accent, fontWeight: 500 }}>{tag}</span>
            {freq && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(52,168,83,0.08)", color: C.green, fontWeight: 500, border: "1px solid rgba(52,168,83,0.18)" }}>f₀={freq} GHz</span>}
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "#f1f3f4", color: C.text2 }}>{privacy}</span>
          </div>
          {/* Params */}
          {params && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 9, color: C.text3, marginBottom: 4 }}>几何参数</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
                {Object.entries(params).map(([k, v]) => (
                  <div key={k} className="flex justify-between" style={{ fontSize: 10 }}>
                    <span style={{ color: C.text3 }}>{{ patchL: "L", patchW: "W", feedPos: "d", er: "εr", h: "h" }[k] || k}</span>
                    <span style={{ fontFamily: "monospace", color: C.text2 }}>{v}{k === "er" ? "" : " mm"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Results */}
          {results && (
            <div>
              <p style={{ fontSize: 9, color: C.text3, marginBottom: 4 }}>关键指标</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px" }}>
                {Object.entries(results).slice(0, 4).map(([k, v]) => (
                  <div key={k} className="flex justify-between" style={{ fontSize: 10 }}>
                    <span style={{ color: C.text3 }}>{{ s11: "S11", gain: "增益", vswr: "VSWR", bw: "带宽", eff: "效率" }[k] || k}</span>
                    <span style={{ fontFamily: "monospace", color: v > 0 && k !== "s11" ? C.green : C.accent, fontWeight: 500 }}>{v}{{ s11: " dB", gain: " dBi", vswr: "", bw: " MHz", eff: "%" }[k] || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 9, color: C.text3, display: "flex", justifyContent: "space-between" }}>
            <span>{author} · {date}</span>
            <span>{type}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New Template Modal ────────────────────────────────────────────────
function NewTemplateModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { name: string; type: string; freq: string; notes: string }) => void }) {
  const [step, setStep] = useState<"upload" | "info">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState("");
  const [antennaType, setAntennaType] = useState("");
  const [freqTag, setFreqTag] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useCallback((node: HTMLInputElement | null) => { /* stable ref */ if (node) node.value = ""; }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const canNext = file !== null;
  const canSubmit = name.trim() && antennaType && freqTag.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), type: antennaType, freq: freqTag.trim(), notes: notes.trim() });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto rounded-xl overflow-hidden"
        style={{ width: 480, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Plus size={15} style={{ color: C.accent }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>新增模板</span>
          </div>
          <button onClick={onClose} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 px-5 py-3" style={{ background: "#fafbfc", borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: step === "upload" ? C.accent : C.green, color: "#fff", fontSize: 10, fontWeight: 700 }}>
              {step === "upload" ? "1" : "✓"}
            </div>
            <span style={{ fontSize: 11, fontWeight: step === "upload" ? 600 : 400, color: step === "upload" ? C.text1 : C.text2 }}>上传文件</span>
          </div>
          <div style={{ width: 24, height: 1, background: C.borderA }} />
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: step === "info" ? C.accent : "#f1f3f4", color: step === "info" ? "#fff" : C.text3, fontSize: 10, fontWeight: 700 }}>
              2
            </div>
            <span style={{ fontSize: 11, fontWeight: step === "info" ? 600 : 400, color: step === "info" ? C.text1 : C.text3 }}>补充信息</span>
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: "20px 24px", minHeight: 240 }}>
          {step === "upload" && (
            <>
              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => document.getElementById("tmpl-file-input")?.click()}
                style={{
                  border: `2px dashed ${dragOver ? C.accent : file ? C.green : C.borderA}`,
                  borderRadius: 12,
                  padding: "32px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? C.accentD : file ? "rgba(52,168,83,0.04)" : "#fafbfc",
                  transition: "all 0.15s",
                }}>
                <input
                  id="tmpl-file-input"
                  ref={fileRef}
                  type="file"
                  accept=".hfss,.cst,.json,.s2p,.txt,.csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  style={{ display: "none" }}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(52,168,83,0.1)" }}>
                      <CheckCircle size={22} style={{ color: C.green }} />
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.text1 }}>{file.name}</p>
                    <p style={{ fontSize: 10, color: C.text3 }}>{(file.size / 1024 / 1024).toFixed(1)} MB · 点击重新选择</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.accentD }}>
                      <Upload size={18} style={{ color: C.accent }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: C.text1, marginBottom: 2 }}>拖拽文件到此处或<span style={{ color: C.accent }}> 点击选择</span></p>
                      <p style={{ fontSize: 10, color: C.text3 }}>支持 .hfss .cst .json .s2p .txt .csv 格式</p>
                    </div>
                  </div>
                )}
              </div>
              {/* File name preview */}
              {file && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 10, color: C.text3, marginBottom: 4 }}>模板名称（可修改）</p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ width: "100%", padding: "7px 12px", fontSize: 12, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => (e.target.style.borderColor = C.accent)}
                    onBlur={(e) => (e.target.style.borderColor = C.borderA)}
                  />
                </div>
              )}
            </>
          )}

          {step === "info" && (
            <>
              {/* File summary */}
              {file && (
                <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg" style={{ background: "#f8f9fa", border: `1px solid ${C.border}` }}>
                  <FileText size={14} style={{ color: C.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.text1, flex: 1 }}>{file.name}</span>
                  <span style={{ fontSize: 10, color: C.text3 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              )}

              {/* Antenna type */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 6 }}>天线类型 <span style={{ color: "#d93025" }}>*</span></p>
                <div className="flex flex-wrap gap-2">
                  {["微带贴片", "偶极子", "缝隙阵列", "八木宇达", "螺旋天线", "Vivaldi", "其他"].map((t) => (
                    <button key={t} onClick={() => setAntennaType(t)}
                      style={{
                        fontSize: 11, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                        background: antennaType === t ? C.accentD : "#f8f9fa",
                        color: antennaType === t ? C.accent : C.text2,
                        border: antennaType === t ? `1.5px solid ${C.accent}` : `1px solid ${C.borderA}`,
                        fontWeight: antennaType === t ? 500 : 400,
                      }}>
                      <Tag size={10} style={{ marginRight: 4 }} />
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Freq band */}
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 6 }}>频段标签 <span style={{ color: "#d93025" }}>*</span></p>
                <input
                  value={freqTag}
                  onChange={(e) => setFreqTag(e.target.value)}
                  placeholder="例如: 2.4GHz WiFi · 28GHz毫米波 · 多频段 · 433MHz ISM"
                  style={{ width: "100%", padding: "7px 12px", fontSize: 12, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                  onFocus={(e) => (e.target.style.borderColor = C.accent)}
                  onBlur={(e) => (e.target.style.borderColor = C.borderA)}
                />
              </div>

              {/* Design notes */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 6 }}>设计思路与注释</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="描述设计目标、优化策略、参考资料或备注说明…"
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", fontSize: 12, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", resize: "vertical", minHeight: 72, boxSizing: "border-box", fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderColor = C.accent)}
                  onBlur={(e) => (e.target.style.borderColor = C.borderA)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
          <button onClick={step === "upload" ? onClose : () => setStep("upload")}
            style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
            {step === "upload" ? "取消" : "← 返回上传"}
          </button>
          {step === "upload" ? (
            <button onClick={() => { if (canNext) setStep("info"); }} disabled={!canNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
              style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: canNext ? C.accent : C.borderA, border: "none", cursor: canNext ? "pointer" : "default" }}>
              下一步 <ChevronRight size={13} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
              style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: canSubmit ? C.accent : C.borderA, border: "none", cursor: canSubmit ? "pointer" : "default" }}>
              <CheckCircle size={13} />创建模板
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload to Library Modal ─────────────────────────────────────────
function UploadToLibraryModal({ templates, onClose, onUpload }: {
  templates: Array<{ name: string; category: string; desc: string; freq: string; privacy: "private" | "public" }>;
  onClose: () => void;
  onUpload: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const privateOnly = templates.filter(t => t.privacy === "private");

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === privateOnly.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(privateOnly.map(t => t.name)));
    }
  };

  const canSubmit = selected.size > 0 && category.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    onUpload(Array.from(selected));
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto rounded-xl overflow-hidden"
        style={{ width: 520, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <Upload size={15} style={{ color: C.accent }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>上传模板到模板库</span>
          </div>
          <button onClick={onClose} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        {/* Info hint */}
        <div style={{ padding: "10px 20px", background: C.accentD, borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.accent, lineHeight: 1.5 }}>
          选择要公开分享的私人模板，审核通过后将发布到公共模板库供其他用户使用。
        </div>

        {/* Template selection */}
        <div style={{ padding: "16px 20px", maxHeight: 240, overflowY: "auto", scrollbarWidth: "none" }}>
          {privateOnly.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Lock size={20} style={{ color: C.text3 }} />
              <p style={{ fontSize: 12, color: C.text3 }}>暂无私人模板可上传</p>
              <p style={{ fontSize: 10, color: C.text3 }}>请先在"我的模板"中创建私人模板</p>
            </div>
          ) : (
            <>
              {/* Select all */}
              <div className="flex items-center gap-2 mb-3">
                <button onClick={toggleAll}
                  style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected.size === privateOnly.length ? C.accent : C.borderA}`, background: selected.size === privateOnly.length ? C.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {selected.size === privateOnly.length && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                </button>
                <span style={{ fontSize: 12, color: C.text2, fontWeight: 500 }}>全选所有私人模板 ({privateOnly.length})</span>
                <span style={{ fontSize: 10, color: C.text3, marginLeft: 4 }}>已选 {selected.size} 个</span>
              </div>
              {privateOnly.map(t => (
                <button key={t.name} onClick={() => toggle(t.name)}
                  className="flex items-center gap-3 w-full text-left rounded-lg mb-1.5"
                  style={{
                    padding: "9px 12px",
                    background: selected.has(t.name) ? C.accentD : "#f8f9fa",
                    border: selected.has(t.name) ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                    cursor: "pointer",
                  }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected.has(t.name) ? C.accent : C.borderA}`, background: selected.has(t.name) ? C.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {selected.has(t.name) && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.text1 }}>{t.name}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 500, padding: "1px 6px", borderRadius: 3,
                        background: "rgba(242,153,0,0.1)", color: "#e08a00",
                        border: "1px solid rgba(242,153,0,0.25)",
                        display: "flex", alignItems: "center", gap: 2,
                      }}>
                        <Lock size={7} />私人
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                      <span style={{ color: C.green }}>{t.category}</span> · {t.freq} · {t.desc.slice(0, 24)}…
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Notes + category */}
        <div style={{ padding: "0 20px 16px" }}>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 5 }}>天线类型 <span style={{ color: "#d93025" }}>*</span></p>
            <div className="flex flex-wrap gap-1.5">
              {["微带贴片", "偶极子", "缝隙阵列", "八木宇达", "螺旋天线", "Vivaldi", "其他"].map((t) => (
                <button key={t} onClick={() => setCategory(t)}
                  style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                    background: category === t ? C.accent : "#f8f9fa",
                    color: category === t ? "#fff" : C.text2,
                    border: category === t ? `1.5px solid ${C.accent}` : `1px solid ${C.borderA}`,
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 5 }}>上传说明</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="描述模板特点、适用场景、关键指标等，帮助审核人员理解…"
              rows={2}
              style={{ width: "100%", padding: "7px 12px", fontSize: 12, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", resize: "vertical", minHeight: 56, boxSizing: "border-box", fontFamily: "inherit" }}
              onFocus={(e) => (e.target.style.borderColor = C.accent)}
              onBlur={(e) => (e.target.style.borderColor = C.borderA)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
          <button onClick={onClose}
            style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 14px" }}>
            取消
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
            style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: canSubmit ? C.accent : C.borderA, border: "none", cursor: canSubmit ? "pointer" : "default" }}>
            <Globe size={13} />提交到模板库
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────
function TemplateCard({ name, category, desc, freq, privacy, favorited, onToggleFav, onMoreClick }: { name: string; category: string; desc: string; freq: string; privacy?: "private" | "public"; favorited?: boolean; onToggleFav?: (name: string) => void; onMoreClick?: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", position: "relative" }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}>
      <div style={{ height: 80, background: C.accentD, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <Radio size={28} style={{ color: C.accent, opacity: 0.4 }} />
        {privacy && (
          <span style={{
            position: "absolute", top: 8, right: 8,
            fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 4,
            background: privacy === "private" ? "rgba(242,153,0,0.1)" : "rgba(26,115,232,0.1)",
            color: privacy === "private" ? "#e08a00" : C.accent,
            border: privacy === "private" ? "1px solid rgba(242,153,0,0.25)" : `1px solid rgba(26,115,232,0.25)`,
            display: "flex", alignItems: "center", gap: 3,
          }}>
            {privacy === "private" ? <><Lock size={8} />私人</> : <><Globe size={8} />公开</>}
          </span>
        )}
      </div>
      <div style={{ padding: "10px 13px 36px" }}>
        <div style={{ marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: C.green, background: "rgba(52,168,83,0.08)", padding: "1px 7px", borderRadius: 4, border: "1px solid rgba(52,168,83,0.18)" }}>{category}</span>
        </div>
        <h3 style={{ fontSize: 12, fontWeight: 500, color: C.text1, marginBottom: 4 }}>{name}</h3>
        <p style={{ fontSize: 10, color: C.text2, marginBottom: 6, lineHeight: 1.4 }}>{desc}</p>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 10, color: C.text3, fontFamily: "monospace" }}>{freq}</span>
          <button style={{ fontSize: 10, color: C.accent, background: C.accentD, border: "none", padding: "3px 10px", borderRadius: 5, cursor: "pointer" }}>使用模板</button>
        </div>
      </div>
      <button
        aria-label={`打开${name}的更多操作`}
        title="更多操作"
        onClick={(e) => { e.stopPropagation(); onMoreClick?.(e); }}
        style={{
          position: "absolute", top: 8, left: 8,
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(255,255,255,0.94)", border: `1px solid ${C.borderA}`,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.text2, zIndex: 2,
        }}>
        <Ellipsis size={18} />
      </button>

      {/* Favorite star */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav?.(name); }}
        style={{
          position: "absolute", bottom: 10, right: 10,
          width: 26, height: 26, borderRadius: "50%",
          background: favorited ? "rgba(242,153,0,0.1)" : "rgba(0,0,0,0.04)",
          border: favorited ? "1px solid rgba(242,153,0,0.3)" : "1px solid transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { if (!favorited) e.currentTarget.style.background = "rgba(242,153,0,0.08)"; }}
        onMouseLeave={(e) => { if (!favorited) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "transparent"; } }}>
        <Star size={13}
          fill={favorited ? "#f29900" : "none"}
          stroke={favorited ? "#f29900" : C.text3}
          style={{ transition: "all 0.15s" }} />
      </button>
    </div>
  );
}

// ── Template Detail View ─────────────────────────────────────────────
type DetailSection = "overview" | "geometry" | "material" | "simulation" | "results" | "sparam" | "pattern";
const DETAIL_SECTIONS: { key: DetailSection; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }[] = [
  { key: "overview",   label: "基本参数",  icon: Info },
  { key: "geometry",   label: "几何尺寸",  icon: Maximize2 },
  { key: "material",   label: "材料属性",  icon: Layers },
  { key: "simulation", label: "仿真设置",  icon: Settings },
  { key: "results",    label: "仿真结果",  icon: BarChart2 },
  { key: "sparam",     label: "S参数曲线", icon: Activity },
  { key: "pattern",    label: "辐射方向图", icon: Radio },
];

function TemplateDetail({ template, onBack }: { template: { name: string; category: string; desc: string; freq: string; date: string; privacy: "private" | "public" }; onBack: () => void }) {
  const [section, setSection] = useState<DetailSection>("overview");
  const [expandedParam, setExpandedParam] = useState<string | null>(null);

  // Mock detail data derived from template
  const detailData = {
    type: template.category,
    freq: template.freq,
    desc: template.desc,
    geometry: { patchL: "38.5 mm", patchW: "47.2 mm", subH: "1.6 mm", feedPos: "12.3 mm", groundW: "120 mm", groundL: "100 mm" },
    material: { substrate: "FR4", er: "4.40", tand: "0.020", conductor: "铜 (Copper)", thickness: "35 μm" },
    simulation: { solver: "FDTD", fStart: "1.5 GHz", fEnd: "4.0 GHz", mesh: "精细 (Fine)", boundary: "PML 吸收", ports: "1 (波导端口)" },
    results: { s11: "-18.3 dB", gain: "6.2 dBi", vswr: "1.28", bw: "98 MHz", eff: "87.3%", impedance: "48.2 Ω", beamwidth: "68°" },
  };

  const renderParamRow = (label: string, value: string, unit?: string) => (
    <div key={label} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: C.text2 }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "monospace", color: C.text1, fontWeight: 500 }}>{value}{unit ? <span style={{ fontSize: 10, color: C.text3, marginLeft: 3 }}>{unit}</span> : null}</span>
    </div>
  );

  const renderSectionContent = () => {
    switch (section) {
      case "overview":
        return (
          <div>
            {(template.category === "矩形喇叭" || template.category === "圆形喇叭") && (
              <div style={{ background: C.accentD, borderRadius: 14, padding: "24px 32px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src="./template-horn.png" alt="喇叭天线模板" style={{ width: "100%", maxWidth: 420, borderRadius: 12 }} />
              </div>
            )}
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 14 }}>基本参数</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px" }}>
              {renderParamRow("天线类型", detailData.type)}
              {renderParamRow("设计频率", detailData.freq)}
              {renderParamRow("描述", detailData.desc)}
              {renderParamRow("创建时间", template.date)}
              {renderParamRow("可见性", template.privacy === "private" ? "私人" : "公开")}
            </div>
          </div>
        );
      case "geometry":
        return (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 14 }}>几何尺寸</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 16 }}>
              {Object.entries(detailData.geometry).map(([k, v]) => renderParamRow(
                { patchL: "贴片长度 L", patchW: "贴片宽度 W", subH: "基板厚度 h", feedPos: "馈电偏移 d", groundW: "地板宽度", groundL: "地板长度" }[k] || k, v, "mm"
              ))}
            </div>
            {/* Mini sketch */}
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(template.category === "矩形喇叭" || template.category === "圆形喇叭") ? <img src="./template-horn.png" alt="喇叭天线" style={{ width: "100%", maxWidth: 320, borderRadius: 12 }} /> : null}
              {template.category === "微带贴片" && <PatchSketch />}
              {template.category === "偶极子" && <DipoleSketch />}
              {template.category === "缝隙阵列" && <SlotSketch />}
              {template.category === "八木宇达" && <YagiSketch />}
            </div>
          </div>
        );
      case "material":
        return (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 14 }}>材料属性</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 16 }}>
              {Object.entries(detailData.material).map(([k, v]) => renderParamRow(
                { substrate: "基板材料", er: "相对介电常数 εr", tand: "损耗正切 tanδ", conductor: "导体材料", thickness: "导体厚度" }[k] || k, v
              ))}
            </div>
            {/* Material comparison cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {MATERIALS.slice(0, 4).map(m => (
                <div key={m.id} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${detailData.material.substrate === m.name ? C.accent : C.border}`, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: m.color, border: "1px solid #ccc", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: C.text1 }}>{m.name}</span>
                    <span style={{ fontSize: 9, color: C.text3, marginLeft: 6, fontFamily: "monospace" }}>εr={m.er} tanδ={m.tand}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "simulation":
        return (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 14 }}>仿真设置</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px" }}>
              {Object.entries(detailData.simulation).map(([k, v]) => renderParamRow(
                { solver: "求解器", fStart: "起始频率", fEnd: "终止频率", mesh: "网格精度", boundary: "边界条件", ports: "端口设置" }[k] || k, v
              ))}
            </div>
          </div>
        );
      case "results":
        return (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 14 }}>仿真结果</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px", marginBottom: 16 }}>
              {Object.entries(detailData.results).map(([k, v]) => {
                const isGood = { s11: true, gain: true, vswr: true, bw: true, eff: true, impedance: true, beamwidth: true }[k];
                return (
                  <div key={k} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: C.text2 }}>
                      {{ s11: "S11 回波损耗", gain: "增益", vswr: "VSWR", bw: "-10dB 带宽", eff: "辐射效率", impedance: "输入阻抗", beamwidth: "半功率波束宽" }[k] || k}
                    </span>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: isGood ? C.green : "#d93025", fontWeight: 600 }}>{v}</span>
                  </div>
                );
              })}
            </div>
            {/* Quick summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "S11", value: "-18.3 dB", good: true },
                { label: "增益", value: "6.2 dBi", good: true },
                { label: "VSWR", value: "1.28", good: true },
                { label: "带宽", value: "98 MHz", good: true },
                { label: "效率", value: "87.3%", good: true },
                { label: "阻抗", value: "48.2 Ω", good: true },
              ].map(({ label, value, good }) => (
                <div key={label} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.text3, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: good ? C.green : "#d93025" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "sparam":
        return (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 14 }}>S11 回波损耗</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 16px" }}>
              <SvgLineChart data={S11_DATA} xKey="freq" yKey="s11" stroke={C.accent}
                yDomain={[-20, 2]} yTicks={[-20, -15, -10, -5, 0]}
                xTickIdxs={[0, 20, 40, 60, 80]}
                yFmt={v => `${v}dB`} xFmt={v => `${v.toFixed(1)}G`} />
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10 }}>
                {[
                  { label: "最小值", value: "-18.3 dB @ 2.45 GHz" },
                  { label: "-10 dB 带宽", value: "2.40 – 2.50 GHz (98 MHz)" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 9, color: C.text3, display: "block" }}>{label}</span>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: C.text1, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "pattern":
        return (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text1, marginBottom: 14 }}>2D 辐射方向图</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <PolarPattern size={260} />
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
                <div className="flex items-center gap-1.5">
                  <div style={{ width: 12, height: 2, background: C.accent }} />
                  <span style={{ fontSize: 10, color: C.text2 }}>E面 (6.2 dBi)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div style={{ width: 12, height: 2, background: C.green, borderTop: "2px dashed #34a853" }} />
                  <span style={{ fontSize: 10, color: C.text2 }}>H面</span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa" }}>
      {/* Breadcrumb bar */}
      <div className="flex items-center gap-2 flex-shrink-0"
        style={{ padding: "0 20px", height: 38, background: "#fff", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} className="flex items-center gap-1"
          style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
          <ChevronLeft size={13} />我的模板
        </button>
        <ChevronRight size={11} style={{ color: C.text3 }} />
        <span style={{ fontSize: 12, color: C.text1, fontWeight: 500 }}>{template.name}</span>
        <span className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded"
          style={{ fontSize: 10, color: template.privacy === "private" ? "#e08a00" : C.accent, background: template.privacy === "private" ? "rgba(242,153,0,0.08)" : C.accentD, border: template.privacy === "private" ? "1px solid rgba(242,153,0,0.25)" : `1px solid rgba(26,115,232,0.25)` }}>
          {template.privacy === "private" ? <><Lock size={8} />私人</> : <><Globe size={8} />公开</>}
        </span>
      </div>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left sidebar ── */}
        <div style={{ width: 208, background: "#fff", borderRight: `1px solid ${C.border}`, overflow: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
          {DETAIL_SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button key={s.key} onClick={() => { setSection(s.key); setExpandedParam(null); }}
                className="flex items-center gap-2.5 w-full text-left transition-colors"
                style={{
                  padding: "10px 16px",
                  background: active ? C.accentD : "transparent",
                  border: "none",
                  borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? C.accent : C.text2,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f8f9fa"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <Icon size={14} style={{ color: active ? C.accent : C.text2, flexShrink: 0 }} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Right detail panel ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px", scrollbarWidth: "none" }}>
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}

// ── New Project Creation Wizard ──────────────────────────────────────
const NEWPROJ_TREE: TreeNode[] = [
  { id: "horn", label: "喇叭天线", icon: Radio, children: [
    { id: "horn-rect",  label: "矩形喇叭", icon: Grid3X3 },
    { id: "horn-circ",  label: "圆形喇叭", icon: Activity },
  ]},
  { id: "yagi",   label: "八木天线",       icon: Sliders },
  { id: "patch",  label: "微带贴片天线",   icon: Layers },
  { id: "array",  label: "天线阵列",       icon: Grid3X3 },
];

const TEMPLATE_LABEL: Record<string, string> = {
  "horn-rect": "矩形喇叭天线", "horn-circ": "圆形喇叭天线",
  "yagi": "八木天线", "patch": "微带贴片天线", "array": "天线阵列",
};
const TEMPLATE_DESC: Record<string, string> = {
  "horn-rect": "高增益 · 宽频带 · 矩形口径", "horn-circ": "旋转对称 · 低交叉极化 · 圆形口径",
  "yagi": "定向高增益 · 结构简单 · 端射", "patch": "低剖面 · 易集成 · 线/圆极化",
  "array": "波束可控 · 高增益 · 多阵元",
};

function NewProjectWizard({ projectFolder, onBack, onCreate, editMode, editStepId, onCancel, onConfirm }: { projectFolder: string; onBack: () => void; onCreate: (name: string, template: string) => void; editMode?: boolean; editStepId?: string; onCancel?: () => void; onConfirm?: () => void }) {
  const editStepMap: Record<string, number> = { "dp-freq": 2, "dp-radiation": 3, "dp-structure": 4, "dp-variables": 5, "dp-objective": 6, "dp-algorithm": 7 };
  const initialEditStep = editStepId ? (editStepMap[editStepId] || 2) : 2;
  const [wizStep, setWizStep] = useState(editMode ? initialEditStep : 0);
  const [selNode, setSelNode] = useState("horn-rect");
  const [sidebarW, setSidebarW] = useState(300);
  const [projName, setProjName] = useState("");
  const [savePath, setSavePath] = useState("C:/Users/AntennaDesign/Projects/" + projectFolder);
  // ── Step 3: radiation range settings ──
  const [thetaStart, setThetaStart] = useState("");
  const [thetaEnd, setThetaEnd] = useState("");
  const [thetaStep, setThetaStep] = useState("");
  const [phiStart, setPhiStart] = useState("");
  const [phiEnd, setPhiEnd] = useState("");
  const [phiStep, setPhiStep] = useState("");
  // ── Step 4: design variable settings (horn antenna params) ──
  const HORN_PARAMS = [
    { key: "a" as const,       label: "波导宽度 a (in)",          tentative: "4.3" },
    { key: "b" as const,       label: "波导高度 b (in)",          tentative: "2.15" },
    { key: "wlength" as const, label: "波导波长 wlength (in)",    tentative: "1.23" },
    { key: "a1" as const,      label: "喇叭口径宽度 a1 (in)",     tentative: "20.5" },
    { key: "b1" as const,      label: "喇叭口径高度 b1 (in)",     tentative: "15.18" },
    { key: "plength" as const, label: "喇叭长度 plength (in)",    tentative: "22.47" },
  ] as const;
  const [hornMin, setHornMin] = useState<string[]>(["","","","","",""]);
  const [hornMax, setHornMax] = useState<string[]>(["","","","","",""]);
  const [hornTent, setHornTent] = useState<string[]>(HORN_PARAMS.map(p => p.tentative));
  const [hornOpt, setHornOpt] = useState<boolean[]>([true, true, true, true, true, true]);
  // (legacy — used by step 5)
  const [arrElementCount, setArrElementCount] = useState("");
  const [arrUniform, setArrUniform] = useState("是");
  const [arrType, setArrType] = useState("全向阵列");
  const [arrPhaseNoise, setArrPhaseNoise] = useState("");
  const [arrMonteCarlo, setArrMonteCarlo] = useState("");

  // ── Step 6: axis ratio/gain constraint & return loss constraint ──
  type GainConRow = { id: number; checked: boolean; constraint: string; thetaStart: string; thetaEnd: string; phiStart: string; phiEnd: string; calc: string; conType: string; errorVal: string; threshold: string; weight: string };
  type RLConRow = { id: number; checked: boolean; rlType: string; calc: string; conType: string; errorVal: string; realThreshold: string; imagThreshold: string; weight: string };
  const nextGainConId = useRef(1);
  const nextRLConId = useRef(1);
  const [gainConRows, setGainConRows] = useState<GainConRow[]>([]);
  const [rlConRows, setRLConRows] = useState<RLConRow[]>([]);

  // Build theta/phi dropdown options from step 3 values
  const thStart = parseFloat(thetaStart), thEnd = parseFloat(thetaEnd), thStep = parseFloat(thetaStep) || 1;
  const thetaOpts: string[] = [];
  if (!isNaN(thStart) && !isNaN(thEnd) && thStart <= thEnd) {
    for (let v = thStart; v <= thEnd + 0.001; v += thStep) thetaOpts.push(String(Math.round(v * 10) / 10));
  }
  const phStart = parseFloat(phiStart), phEnd = parseFloat(phiEnd), phStep = parseFloat(phiStep) || 1;
  const phiOpts: string[] = [];
  if (!isNaN(phStart) && !isNaN(phEnd) && phStart <= phEnd) {
    for (let v = phStart; v <= phEnd + 0.001; v += phStep) phiOpts.push(String(Math.round(v * 10) / 10));
  }

  if (wizStep !== 6) { }

  const addGainConRow = () => {
    const id = nextGainConId.current++;
    setGainConRows(prev => [...prev, { id, checked: false, constraint: "轴比 (dB)", thetaStart, thetaEnd, phiStart, phiEnd, calc: "average", conType: "<=", errorVal: "", threshold: "", weight: "1" }]);
  };
  const delGainConRows = () => { setGainConRows(prev => prev.filter(r => !r.checked)); };
  const toggleGainCon = (id: number) => { setGainConRows(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r)); };
  const setGainCon = (id: number, k: keyof GainConRow, v: string) => { setGainConRows(prev => prev.map(r => r.id === id ? { ...r, [k]: v } : r)); };

  const addRLConRow = () => {
    const id = nextRLConId.current++;
    setRLConRows(prev => [...prev, { id, checked: false, rlType: "驻波比", calc: "average", conType: "<=", errorVal: "", realThreshold: "", imagThreshold: "", weight: "1" }]);
  };
  const delRLConRows = () => { setRLConRows(prev => prev.filter(r => !r.checked)); };
  const toggleRLCon = (id: number) => { setRLConRows(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r)); };
  const setRLCon = (id: number, k: keyof RLConRow, v: string) => { setRLConRows(prev => prev.map(r => r.id === id ? { ...r, [k]: v } : r)); };

  // ── Step 7: algorithm settings ──
  const [algoName, setAlgoName] = useState("DCNSGA_II");
  const [algoMaxEnv, setAlgoMaxEnv] = useState("5");
  const [algoMaxGen, setAlgoMaxGen] = useState("5");
  const [algoPopSize, setAlgoPopSize] = useState("3");
  const [algoProcs, setAlgoProcs] = useState("2");
  const [algoEvalTime, setAlgoEvalTime] = useState("1000");
  const [algoResume, setAlgoResume] = useState("是");

  // ── Step 5: gain target & return loss settings ──
  type GainRow = { id: number; checked: boolean; target: string; thetaStart: string; thetaEnd: string; phiStart: string; phiEnd: string; calc: string; optType: string };
  type RLRow = { id: number; checked: boolean; rlType: string; calc: string; optType: string };
  const nextGainId = useRef(1);
  const nextRLId = useRef(1);
  const [gainRows, setGainRows] = useState<GainRow[]>([]);
  const [rlRows, setRLRows] = useState<RLRow[]>([]);
  const [r0Real, setR0Real] = useState("");
  const [r0Imag, setR0Imag] = useState("");

  // Init R0 defaults on first render of wizStep===5
  const step5Init = useRef(false);
  if (wizStep === 5 && !step5Init.current) {
    step5Init.current = true;
    if (r0Real === "" && r0Imag === "") { setR0Real("50"); setR0Imag("0"); }
  }
  if (wizStep !== 5) { step5Init.current = false; }

  const addGainRow = () => {
    const id = nextGainId.current++;
    setGainRows(prev => [...prev, { id, checked: false, target: "轴比 (dB)", thetaStart, thetaEnd, phiStart, phiEnd, calc: "average", optType: "min" }]);
  };
  const delGainRows = () => { setGainRows(prev => prev.filter(r => !r.checked)); };
  const toggleGain = (id: number) => { setGainRows(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r)); };
  const setGain = (id: number, k: keyof GainRow, v: string) => { setGainRows(prev => prev.map(r => r.id === id ? { ...r, [k]: v } : r)); };

  const addRLRow = () => {
    const id = nextRLId.current++;
    setRLRows(prev => [...prev, { id, checked: false, rlType: "驻波比", calc: "average", optType: "min" }]);
  };
  const delRLRows = () => { setRLRows(prev => prev.filter(r => !r.checked)); };
  const toggleRL = (id: number) => { setRLRows(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r)); };
  const setRL = (id: number, k: keyof RLRow, v: string) => { setRLRows(prev => prev.map(r => r.id === id ? { ...r, [k]: v } : r)); };

  // Sync algoName when entering step 7 (all state vars now declared)
  useEffect(() => {
    if (wizStep !== 7 || editMode) return;
    const hasC = gainConRows.length > 0 || rlConRows.length > 0;
    const multi = gainRows.length > 1;
    const defaultAlgo = !multi ? (hasC ? "DCNSGA_II" : "DifferentialEvolution")
      : (hasC ? "DCNSGA_III" : "NSGA_III");
    setAlgoName(defaultAlgo);
  }, [wizStep, editMode]);

  // ── Step 5 legacy: design variable settings ──
  const [r1Min, setR1Min] = useState("");
  const [r1Max, setR1Max] = useState("");
  const [r1Tentative, setR1Tentative] = useState("");
  const [r1Optimize, setR1Optimize] = useState(false);
  // Angle rows computed from arrElementCount: each has min/max/tentative/checked
  const elemCount = parseInt(arrElementCount) || 0;
  const defaultAngle = elemCount > 0 ? String(Math.round(360 / elemCount)) : "";
  const [angleMin, setAngleMin] = useState<string[]>([]);
  const [angleMax, setAngleMax] = useState<string[]>([]);
  const [angleTent, setAngleTent] = useState<string[]>([]);
  const [angleOpt, setAngleOpt] = useState<boolean[]>([]);
  useEffect(() => {
    if (elemCount > 0) {
      setAngleMin(Array(elemCount).fill("0"));
      setAngleMax(Array(elemCount).fill("180"));
      setAngleTent(Array(elemCount).fill(defaultAngle));
      setAngleOpt(Array(elemCount).fill(false));
    }
  }, [arrElementCount]);

  // ── Step 2: frequency band settings ──
  const [freqRows, setFreqRows] = useState<{ id: number; band: string; min: string; max: string; count: string; checked: boolean }[]>([
    { id: 1, band: "Sweep1", min: "", max: "", count: "", checked: false },
  ]);
  const nextFreqId = useRef(2);

  const addFreqRow = () => {
    const id = nextFreqId.current++;
    setFreqRows(prev => [...prev, { id, band: "Sweep" + id, min: "", max: "", count: "", checked: false }]);
  };
  const delFreqRows = () => {
    setFreqRows(prev => prev.filter(r => !r.checked));
  };
  const updateFreqRow = (id: number, field: string, val: string) => {
    setFreqRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };
  const toggleFreqRow = (id: number) => {
    setFreqRows(prev => prev.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
  };

  const getSubtitle = () => {
    if (wizStep === 0) return "选择模板";
    if (wizStep === 1) return "项目名称设置";
    if (wizStep === 2) return "频段范围设置";
    if (wizStep === 3) return "辐射范围设置";
    if (wizStep === 4) return "设计变量设置";
    if (wizStep === 5) return "";
    if (wizStep === 6) return "";
    if (wizStep === 7) return "算法参数设置";
    return "参数设置";
  };

  const getTitle = () => {
    if (editMode) return getSubtitle();
    if (wizStep <= 1) return "优天线新建项目向导";
    return `优天线创建项目（${wizStep-1}/6）`;
  };

  const WIZARD_H = wizStep <= 1 ? 620 : 520;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.15)" }}>
      <div className="rounded-2xl overflow-hidden"
        style={{ width: 1080, height: WIZARD_H, background: "#fff", boxShadow: "0 16px 56px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.accent }}><Radio size={13} style={{ color: "#fff" }} /></div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>{getTitle()}</span>
            </div>
            <button onClick={() => editMode ? onCancel?.() : onBack()} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
          </div>
          {!editMode && getSubtitle() && <div style={{ padding: "2px 20px 8px", fontSize: 11, color: C.text3 }}>{getSubtitle()}</div>}
        </div>

        {wizStep === 0 && (
          <>
            <div className="flex flex-1 overflow-hidden">
              <div style={{ width: sidebarW, background: "#fafbfc", borderRight: `1px solid ${C.border}`, overflowY: "auto", scrollbarWidth: "none", padding: "8px 0", flexShrink: 0 }}>
                <FileTree tree={NEWPROJ_TREE} selected={selNode} onSelect={setSelNode} level={0} />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: "24px 28px", background: "#fff" }}>
                <div style={{ background: C.accentD, borderRadius: 12, padding: "20px 28px", marginBottom: 16 }}>
                  {/* Rectangular horn */}
                  {selNode === "horn-rect" && <img src="./template-horn.png" alt="矩形喇叭天线" style={{ width: "100%", maxWidth: 300, borderRadius: 12 }} />}
                  {/* Circular horn */}
                  {selNode === "horn-circ" && <svg width="200" height="140" viewBox="0 0 200 140"><ellipse cx="100" cy="70" rx="48" ry="36" fill="none" stroke={C.accent} strokeWidth="1.8"/><path d="M100,34 L120,75 L100,106 L80,75 Z" fill="none" stroke={C.accent} strokeWidth="0.6" strokeDasharray="3,2"/><rect x="30" y="55" width="25" height="30" fill="none" stroke={C.accent} strokeWidth="1.2" rx="1"/><line x1="30" y1="70" x2="10" y2="70" stroke={C.accent} strokeWidth="1"/><circle cx="10" cy="70" r="2.5" fill={C.accent}/><text x="100" y="135" textAnchor="middle" fill={C.text3} fontSize="9">圆形喇叭 · 圆锥形口径</text></svg>}
                  {/* Yagi */}
                  {selNode === "yagi" && <svg width="200" height="140" viewBox="0 0 200 140"><line x1="20" y1="70" x2="180" y2="70" stroke={C.accent} strokeWidth="1.5"/><line x1="30" y1="40" x2="30" y2="100" stroke={C.accent} strokeWidth="1.8"/><line x1="70" y1="35" x2="70" y2="105" stroke={C.accent} strokeWidth="1.3"/><line x1="105" y1="35" x2="105" y2="105" stroke={C.accent} strokeWidth="1.3"/><line x1="145" y1="33" x2="145" y2="107" stroke={C.accent} strokeWidth="1.5"/><line x1="175" y1="38" x2="175" y2="102" stroke={C.accent} strokeWidth="1"/><text x="30" y="115" textAnchor="middle" fill={C.text3} fontSize="7">反射器</text><text x="100" y="115" textAnchor="middle" fill={C.text3} fontSize="7">引向器</text><text x="100" y="135" textAnchor="middle" fill={C.text3} fontSize="9">八木 · 端射阵列</text></svg>}
                  {/* Patch */}
                  {selNode === "patch" && <svg width="200" height="140" viewBox="0 0 200 140"><rect x="55" y="25" width="90" height="60" fill="rgba(26,115,232,0.1)" stroke={C.accent} strokeWidth="1.8" rx="2"/><rect x="60" y="30" width="80" height="50" fill={C.accent} opacity="0.25" stroke={C.accent} strokeWidth="1.2" rx="1"/><rect x="45" y="93" width="110" height="14" fill="rgba(180,210,250,0.5)" stroke="#b0c8e0" strokeWidth="0.8" rx="1"/><text x="100" y="45" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">Patch</text><line x1="65" y1="80" x2="85" y2="60" stroke={C.accent} strokeWidth="0.6" strokeDasharray="2,2"/><text x="100" y="118" textAnchor="middle" fill={C.text3} fontSize="7">基板 FR4 · εr=4.4</text><text x="100" y="135" textAnchor="middle" fill={C.text3} fontSize="9">微带贴片 · 平面天线</text></svg>}
                  {/* Array */}
                  {selNode === "array" && <svg width="200" height="140" viewBox="0 0 200 140"><rect x="40" y="20" width="120" height="85" fill="none" stroke={C.accent} strokeWidth="1" strokeDasharray="4,3" rx="4"/>{[0,1,2].map(r => [0,1,2,3].map(c => <circle key={`${r}-${c}`} cx={60+c*30} cy={38+r*28} r="3.5" fill={C.accent} opacity="0.7"/>))}<line x1="180" y1="62" x2="160" y2="62" stroke={C.accent} strokeWidth="0.8"/><circle cx="180" cy="62" r="2.5" fill={C.accent}/><text x="100" y="128" textAnchor="middle" fill={C.text3} fontSize="7">3×4 矩形栅格阵列</text><text x="100" y="140" textAnchor="middle" fill={C.text3} fontSize="9">天线阵列 · 波束可调</text></svg>}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text1, marginBottom: 4, textAlign: "center" }}>
                  {TEMPLATE_LABEL[selNode]}</h3>
                <p style={{ fontSize: 11, color: C.text3 }}>{TEMPLATE_DESC[selNode]}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              <button onClick={onBack} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
              <button onClick={() => { setWizStep(1); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                下一步 <ChevronRight size={13} />
              </button>
            </div>
          </>
        )}

        {wizStep === 1 && (
          <>
            <div className="flex-1 flex" style={{ padding: "20px 40px", background: "#fff", alignItems: "flex-start" }}>
              <div style={{ width: "100%", maxWidth: 460 }}>
                <div className="flex items-center gap-3 mb-5 py-2 px-3 rounded-lg" style={{ background: C.accentD }}>
                  <Radio size={16} style={{ color: C.accent }} />
                  <span style={{ fontSize: 12, color: C.text1 }}>已选：{TEMPLATE_LABEL[selNode]}</span>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 6 }}>项目名称</p>
                  <input value={projName} onChange={e => setProjName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: 13, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              <button onClick={() => setWizStep(0)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
                <ChevronLeft size={13} />上一步
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => { onCreate(projName.trim() || "新建项目", selNode); setWizStep(2); }}
                  disabled={!projName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: projName.trim() ? C.accent : C.borderA, border: "none", cursor: projName.trim() ? "pointer" : "default" }}>
                  创建项目并继续 <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: frequency band settings ── */}
        {wizStep === 2 && (
          <>
            <div className="flex-1 overflow-y-auto" style={{ padding: "16px 28px", background: "#fff", scrollbarWidth: "none" }}>
              {/* Table header */}
              <div className="flex items-center" style={{ padding: "8px 10px", background: "#f8f9fa", borderRadius: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: C.text2 }}>
                <span style={{ width: 32, textAlign: "center" }}>☐</span>
                <span style={{ flex: 2, fontSize: 12, fontWeight: 600, color: "#111" }}>频段</span>
                <span style={{ flex: 2, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#111" }}>频率下限 (MHz)</span>
                <span style={{ flex: 2, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#111" }}>频率上限 (MHz)</span>
                <span style={{ flex: 1.5, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#111" }}>频点个数</span>
              </div>
              {/* Rows */}
              {freqRows.map((r) => (
                <div key={r.id} className="flex items-center" style={{ padding: "5px 10px", borderBottom: `1px solid ${C.border}`, marginBottom: 2 }}>
                  <div style={{ width: 32, display: "flex", justifyContent: "center" }}>
                    <button onClick={() => toggleFreqRow(r.id)}
                      style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${r.checked ? C.accent : C.borderA}`, background: r.checked ? C.accent : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {r.checked && <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </button>
                  </div>
                  <span style={{ flex: 2, fontSize: 12, fontFamily: "monospace", color: C.text1 }}>{r.band}</span>
                  <div style={{ flex: 2, padding: "0 4px" }}>
                    <input value={r.min} onChange={e => updateFreqRow(r.id, "min", e.target.value)}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 12, fontFamily: "monospace", color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                  </div>
                  <div style={{ flex: 2, padding: "0 4px" }}>
                    <input value={r.max} onChange={e => updateFreqRow(r.id, "max", e.target.value)}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 12, fontFamily: "monospace", color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                  </div>
                  <div style={{ flex: 1.5, padding: "0 4px" }}>
                    <input value={r.count} onChange={e => updateFreqRow(r.id, "count", e.target.value)}
                      style={{ width: "100%", padding: "5px 8px", fontSize: 12, fontFamily: "monospace", color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                  </div>
                </div>
              ))}
              {/* Add / Delete buttons */}
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={addFreqRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 11, color: C.accent, background: C.accentD, border: `1px solid ${C.borderA}`, cursor: "pointer" }}>
                  <Plus size={12} />添加行
                </button>
                <button onClick={delFreqRows} disabled={!freqRows.some(r => r.checked)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 11, color: freqRows.some(r => r.checked) ? "#d93025" : C.text3, background: freqRows.some(r => r.checked) ? "rgba(217,48,37,0.06)" : "#f1f3f4", border: `1px solid ${freqRows.some(r => r.checked) ? "rgba(217,48,37,0.3)" : C.borderA}`, cursor: freqRows.some(r => r.checked) ? "pointer" : "default" }}>
                  <Trash2 size={12} />删除行
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              {editMode ? (<>
                <button onClick={() => onCancel?.()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                <button onClick={() => onConfirm?.()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
              </>) : (<>
                <div />
                <button onClick={() => { setWizStep(3); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  下一步 <ChevronRight size={13} />
                </button>
              </>)}
            </div>
          </>
        )}

        {/* ── Step 3: Radiation range settings ── */}
        {wizStep === 3 && (
          <>
            <div className="flex-1 overflow-y-auto" style={{ padding: "24px 32px", background: "#fff", scrollbarWidth: "none" }}>
              <div style={{ display: "flex", gap: 28 }}>
                {/* Left: Theta */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 12 }}>θ 角度范围</p>
                  {[
                    { key: "thetaStart", label: "起始 θ (°)", value: thetaStart, setter: (v:string)=>setThetaStart(v) },
                    { key: "thetaEnd", label: "终止 θ (°)", value: thetaEnd, setter: (v:string)=>setThetaEnd(v) },
                    { key: "thetaStep", label: "θ 步长 (°)", value: thetaStep, setter: (v:string)=>setThetaStep(v) },
                  ].map(({ key, label, value, setter }) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 4 }}>{label}</p>
                      <input value={value} onChange={e => setter(e.target.value)}
                        style={{ width: "100%", padding: "7px 12px", fontSize: 12, fontFamily: "monospace", color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                    </div>
                  ))}
                </div>
                {/* Right: Phi */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 12 }}>φ 角度范围</p>
                  {[
                    { key: "phiStart", label: "起始 φ (°)", value: phiStart, setter: (v:string)=>setPhiStart(v) },
                    { key: "phiEnd", label: "终止 φ (°)", value: phiEnd, setter: (v:string)=>setPhiEnd(v) },
                    { key: "phiStep", label: "φ 步长 (°)", value: phiStep, setter: (v:string)=>setPhiStep(v) },
                  ].map(({ key, label, value, setter }) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 4 }}>{label}</p>
                      <input value={value} onChange={e => setter(e.target.value)}
                        style={{ width: "100%", padding: "7px 12px", fontSize: 12, fontFamily: "monospace", color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              {editMode ? (<>
                <button onClick={() => onCancel?.()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                <button onClick={() => onConfirm?.()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
              </>) : (<>
                <button onClick={() => setWizStep(2)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
                  <ChevronLeft size={13} />上一步
                </button>
                <button onClick={() => { setWizStep(4); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  下一步 <ChevronRight size={13} />
                </button>
              </>)}
            </div>
          </>
        )}

        {/* ── Step 4: Design variable settings (horn antenna) ── */}
        {wizStep === 4 && (
          <>
            <div className="flex flex-1 overflow-hidden">
              {/* Left: table */}
              <div style={{ width: "50%", overflowY: "auto", scrollbarWidth: "none", padding: "10px 12px", background: "#fff", flexShrink: 0 }}>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                {/* Table header */}
                <div className="flex items-center" style={{ padding: "9px 14px", background: "#f8f9fa", borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.text2 }}>
                  <span style={{ flex: 3 }}>设计参数</span>
                  <span style={{ flex: 2, textAlign: "center" }}>最小值</span>
                  <span style={{ flex: 2, textAlign: "center" }}>最大值</span>
                  <span style={{ flex: 2, textAlign: "center" }}>暂定值</span>
                  <span style={{ width: 60, textAlign: "center" }}>是否优化</span>
                </div>

                {HORN_PARAMS.map((p, i) => (
                  <div key={p.key} className="flex items-center" style={{ padding: "7px 14px", borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    <span style={{ flex: 3, fontSize: 12, fontWeight: 600, color: "#111" }}>{p.label}</span>
                    <div style={{ flex: 2, padding: "0 4px" }}>
                      <input value={hornMin[i]} onChange={e => { const nv = [...hornMin]; nv[i] = e.target.value; setHornMin(nv); }}
                        style={{ width: "100%", padding: "5px 6px", fontSize: 11, fontWeight: 500, fontFamily: "monospace", color: "#111", border: `1px solid ${C.borderA}`, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                    </div>
                    <div style={{ flex: 2, padding: "0 4px" }}>
                      <input value={hornMax[i]} onChange={e => { const nv = [...hornMax]; nv[i] = e.target.value; setHornMax(nv); }}
                        style={{ width: "100%", padding: "5px 6px", fontSize: 11, fontWeight: 500, fontFamily: "monospace", color: "#111", border: `1px solid ${C.borderA}`, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                    </div>
                    <div style={{ flex: 2, padding: "0 4px" }}>
                      <input value={hornTent[i]} onChange={e => {
                        const v = e.target.value; const nv = [...hornTent]; nv[i] = v; setHornTent(nv);
                      }}
                        style={{ width: "100%", padding: "5px 6px", fontSize: 11, fontWeight: 500, fontFamily: "monospace", color: "#111", border: `1px solid ${C.borderA}`, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                        onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                    </div>
                    <div style={{ width: 60, display: "flex", justifyContent: "center" }}>
                      <button onClick={() => { const nv = [...hornOpt]; nv[i] = !nv[i]; setHornOpt(nv); }}
                        style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${hornOpt[i] ? C.accent : C.borderA}`, background: hornOpt[i] ? C.accent : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {hornOpt[i] && <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>✓</span>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>

              {/* Right: template preview */}
              <div style={{ flex: 1, background: "#fafbfc", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 26px" }}>
                <div style={{ background: C.accentD, borderRadius: 14, padding: "24px 28px", marginBottom: 14 }}>
                  {selNode === "horn-rect" && <img src="./template-horn.png" alt="矩形喇叭天线" style={{ width: "100%", maxWidth: 280, borderRadius: 14 }} />}
                  {selNode === "horn-circ" && <svg width="170" height="130" viewBox="0 0 170 130"><ellipse cx="85" cy="65" rx="42" ry="34" fill="none" stroke={C.accent} strokeWidth="2.2"/><path d="M85,31 L108,67 L85,99 L62,67 Z" fill="none" stroke={C.accent} strokeWidth="0.8" strokeDasharray="4,3"/><rect x="15" y="48" width="20" height="34" fill="none" stroke={C.accent} strokeWidth="1.4" rx="1"/><line x1="15" y1="65" x2="5" y2="65" stroke={C.accent} strokeWidth="1.2"/><circle cx="5" cy="65" r="2" fill={C.accent}/><text x="85" y="126" textAnchor="middle" fill={C.text3} fontSize="8">圆形喇叭</text></svg>}
                  {selNode === "yagi" && <svg width="170" height="130" viewBox="0 0 170 130"><line x1="10" y1="65" x2="160" y2="65" stroke={C.accent} strokeWidth="1.5"/><line x1="22" y1="30" x2="22" y2="100" stroke={C.accent} strokeWidth="2.2"/><line x1="62" y1="33" x2="62" y2="97" stroke={C.accent} strokeWidth="1.6"/><line x1="100" y1="33" x2="100" y2="97" stroke={C.accent} strokeWidth="1.6"/><line x1="138" y1="30" x2="138" y2="100" stroke={C.accent} strokeWidth="1.8"/><line x1="160" y1="36" x2="160" y2="94" stroke={C.accent} strokeWidth="1.2"/><text x="85" y="126" textAnchor="middle" fill={C.text3} fontSize="8">八木天线</text></svg>}
                  {selNode === "patch" && <svg width="170" height="130" viewBox="0 0 170 130"><rect x="42" y="22" width="86" height="58" fill="rgba(26,115,232,0.1)" stroke={C.accent} strokeWidth="2.2" rx="2"/><rect x="48" y="28" width="74" height="46" fill={C.accent} opacity="0.3" stroke={C.accent} strokeWidth="1.5" rx="1"/><rect x="32" y="88" width="106" height="12" fill="rgba(180,210,250,0.5)" stroke="#b0c8e0" strokeWidth="0.8" rx="1"/><text x="85" y="55" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">Patch</text><text x="85" y="126" textAnchor="middle" fill={C.text3} fontSize="8">微带贴片</text></svg>}
                  {selNode === "array" && <svg width="170" height="130" viewBox="0 0 170 130"><rect x="30" y="15" width="110" height="80" fill="none" stroke={C.accent} strokeWidth="1.3" strokeDasharray="5,4" rx="5"/>{[0,1].map(r => [0,1,2,3].map(c => <circle key={`${r}-${c}`} cx={48+c*27} cy={33+r*42} r="3.5" fill={C.accent} opacity="0.65"/>))}<line x1="150" y1="55" x2="140" y2="55" stroke={C.accent} strokeWidth="1"/><circle cx="150" cy="55" r="2.5" fill={C.accent}/><text x="85" y="126" textAnchor="middle" fill={C.text3} fontSize="8">天线阵列</text></svg>}
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text1, textAlign: "center", marginBottom: 4 }}>
                  {TEMPLATE_LABEL[selNode]}</p>
                <p style={{ fontSize: 11, color: C.text3, textAlign: "center", marginBottom: 8 }}>{TEMPLATE_DESC[selNode]}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              {editMode ? (<>
                <button onClick={() => onCancel?.()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                <button onClick={() => onConfirm?.()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
              </>) : (<>
                <button onClick={() => setWizStep(3)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
                  <ChevronLeft size={13} />上一步
                </button>
                <button onClick={() => { setWizStep(5); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  下一步 <ChevronRight size={13} />
                </button>
              </>)}
            </div>
          </>
        )}

        {/* ── Step 5: Gain target / Return loss settings ── */}
        {wizStep === 5 && (
          <>
            <div className="flex-1 overflow-y-auto" style={{ padding: "10px 16px", background: "#fff", scrollbarWidth: "none" }}>
              {/* ── Gain/AR target table ── */}
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 6 }}>轴比/增益目标设置</p>
              <div style={{ marginBottom: 16 }}>
                <div className="flex items-center" style={{ padding: "5px 12px", background: "#f8f9fa", borderRadius: "8px 8px 0 0", border: "1px solid " + C.border, borderBottom: "none", fontSize: 11, fontWeight: 600, color: C.text2, gap: 4 }}>
                  <span style={{ width: 24, textAlign: "center", flexShrink: 0 }}></span>
                  <span style={{ flex: 1.5 }}>目标</span>
                  <span style={{ flex: 1, textAlign: "center" }}>起始θ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>终止θ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>起始φ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>终止φ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>计算方式</span>
                  <span style={{ flex: 1, textAlign: "center" }}>优化类型</span>
                </div>
                {gainRows.map(r => (
                  <div key={r.id} className="flex items-center" style={{ padding: "4px 12px", border: "1px solid " + C.border, borderTop: "none", gap: 4 }}>
                    <button onClick={() => toggleGain(r.id)} style={{ width: 20, height: 16, borderRadius: 3, border: "1.5px solid " + (r.checked ? C.accent : C.borderA), background: r.checked ? C.accent : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.checked && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </button>
                    <select value={r.target} onChange={e => setGain(r.id, "target", e.target.value)} style={{ flex: 1.5, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["轴比 (dB)","总增益 (dB)","水平增益 (dB)","垂直增益 (dB)","右旋增益 (dB)","左旋增益 (dB)"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.thetaStart} onChange={e => setGain(r.id, "thetaStart", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(thetaOpts.length ? thetaOpts : [thetaStart || r.thetaStart]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.thetaEnd} onChange={e => setGain(r.id, "thetaEnd", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(thetaOpts.length ? thetaOpts : [thetaEnd || r.thetaEnd]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.phiStart} onChange={e => setGain(r.id, "phiStart", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(phiOpts.length ? phiOpts : [phiStart || r.phiStart]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.phiEnd} onChange={e => setGain(r.id, "phiEnd", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(phiOpts.length ? phiOpts : [phiEnd || r.phiEnd]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.calc} onChange={e => setGain(r.id, "calc", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["average","min","max","rms"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.optType} onChange={e => setGain(r.id, "optType", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["min","max"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "6px 0" }}>
                  <button onClick={addGainRow} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: C.accent, background: C.accentD, border: "1px solid " + C.borderA, cursor: "pointer" }}><Plus size={10} />添加行</button>
                  <button onClick={delGainRows} disabled={!gainRows.some(r => r.checked)} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: gainRows.some(r => r.checked) ? "#d93025" : C.text3, background: gainRows.some(r => r.checked) ? "rgba(217,48,37,0.06)" : "#f1f3f4", border: "1px solid " + (gainRows.some(r => r.checked) ? "rgba(217,48,37,0.3)" : C.borderA), cursor: gainRows.some(r => r.checked) ? "pointer" : "default" }}><Trash2 size={10} />删除行</button>
                </div>
              </div>

              {/* ── Return loss target table ── */}
              <div className="flex items-center gap-4" style={{ marginBottom: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>回波损失目标设置</p>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 11, color: C.text2 }}>R0设置：</span>
                  <span style={{ fontSize: 11, color: C.text2 }}>R0实部</span>
                  <input value={r0Real} onChange={e => setR0Real(e.target.value)}
                    style={{ width: 72, padding: "3px 8px", fontSize: 11, fontFamily: "monospace", color: C.text1, border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                  <span style={{ fontSize: 11, color: C.text2 }}>R0虚部：</span>
                  <input value={r0Imag} onChange={e => setR0Imag(e.target.value)}
                    style={{ width: 72, padding: "3px 8px", fontSize: 11, fontFamily: "monospace", color: C.text1, border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div className="flex items-center" style={{ padding: "5px 12px", background: "#f8f9fa", borderRadius: "8px 8px 0 0", border: "1px solid " + C.border, borderBottom: "none", fontSize: 11, fontWeight: 600, color: C.text2, gap: 4 }}>
                  <span style={{ width: 24, textAlign: "center", flexShrink: 0 }}></span>
                  <span style={{ flex: 2 }}>回波损失类型</span>
                  <span style={{ flex: 1.5, textAlign: "center" }}>计算方式</span>
                  <span style={{ flex: 1.5, textAlign: "center" }}>优化类型</span>
                </div>
                {rlRows.map(r => (
                  <div key={r.id} className="flex items-center" style={{ padding: "4px 12px", border: "1px solid " + C.border, borderTop: "none", gap: 4 }}>
                    <button onClick={() => toggleRL(r.id)} style={{ width: 20, height: 16, borderRadius: 3, border: "1.5px solid " + (r.checked ? C.accent : C.borderA), background: r.checked ? C.accent : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.checked && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </button>
                    <select value={r.rlType} onChange={e => setRL(r.id, "rlType", e.target.value)} style={{ flex: 2, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["驻波比","S参数 (dB)","阻抗 (Ω)"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.calc} onChange={e => setRL(r.id, "calc", e.target.value)} style={{ flex: 1.5, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["average","min","max","rms"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.optType} onChange={e => setRL(r.id, "optType", e.target.value)} style={{ flex: 1.5, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["min","max"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "6px 0" }}>
                  <button onClick={addRLRow} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: C.accent, background: C.accentD, border: "1px solid " + C.borderA, cursor: "pointer" }}><Plus size={10} />添加行</button>
                  <button onClick={delRLRows} disabled={!rlRows.some(r => r.checked)} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: rlRows.some(r => r.checked) ? "#d93025" : C.text3, background: rlRows.some(r => r.checked) ? "rgba(217,48,37,0.06)" : "#f1f3f4", border: "1px solid " + (rlRows.some(r => r.checked) ? "rgba(217,48,37,0.3)" : C.borderA), cursor: rlRows.some(r => r.checked) ? "pointer" : "default" }}><Trash2 size={10} />删除行</button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              {editMode ? (<>
                <button onClick={() => onCancel?.()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                <button onClick={() => onConfirm?.()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
              </>) : (<>
                <button onClick={() => setWizStep(4)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
                  <ChevronLeft size={13} />上一步
                </button>
                <button onClick={() => { setWizStep(6); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  下一步 <ChevronRight size={13} />
                </button>
              </>)}
            </div>
          </>)}
        {/* ── Step 6: Constraint settings ── */}
        {wizStep === 6 && (<>
            <div className="flex-1 overflow-y-auto" style={{ padding: "10px 16px", background: "#fff", scrollbarWidth: "none" }}>
              {/* ── AR/Gain constraint table ── */}
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 6 }}>轴比/增益约束设置</p>
              <div style={{ marginBottom: 14 }}>
                <div className="flex items-center" style={{ padding: "5px 12px", background: "#f8f9fa", borderRadius: "8px 8px 0 0", border: "1px solid " + C.border, borderBottom: "none", fontSize: 11, fontWeight: 600, color: C.text2, gap: 4 }}>
                  <span style={{ width: 24, textAlign: "center", flexShrink: 0 }}></span>
                  <span style={{ flex: 1.2 }}>约束</span>
                  <span style={{ flex: 1, textAlign: "center" }}>起始θ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>终止θ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>起始φ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>终止φ (°)</span>
                  <span style={{ flex: 1, textAlign: "center" }}>计算方式</span>
                  <span style={{ flex: 0.8, textAlign: "center" }}>约束类型</span>
                  <span style={{ flex: 0.8, textAlign: "center" }}>误差值</span>
                  <span style={{ flex: 0.8, textAlign: "center" }}>阈值</span>
                  <span style={{ flex: 0.8, textAlign: "center" }}>权值</span>
                </div>
                {gainConRows.map(r => (
                  <div key={r.id} className="flex items-center" style={{ padding: "4px 12px", border: "1px solid " + C.border, borderTop: "none", gap: 4 }}>
                    <button onClick={() => toggleGainCon(r.id)} style={{ width: 20, height: 16, borderRadius: 3, border: "1.5px solid " + (r.checked ? C.accent : C.borderA), background: r.checked ? C.accent : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.checked && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </button>
                    <select value={r.constraint} onChange={e => setGainCon(r.id, "constraint", e.target.value)} style={{ flex: 1.2, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["轴比 (dB)","总增益 (dB)","水平增益 (dB)","垂直增益 (dB)","右旋增益 (dB)","左旋增益 (dB)"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.thetaStart} onChange={e => setGainCon(r.id, "thetaStart", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(thetaOpts.length ? thetaOpts : [thetaStart || r.thetaStart]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.thetaEnd} onChange={e => setGainCon(r.id, "thetaEnd", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(thetaOpts.length ? thetaOpts : [thetaEnd || r.thetaEnd]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.phiStart} onChange={e => setGainCon(r.id, "phiStart", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(phiOpts.length ? phiOpts : [phiStart || r.phiStart]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.phiEnd} onChange={e => setGainCon(r.id, "phiEnd", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {(phiOpts.length ? phiOpts : [phiEnd || r.phiEnd]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.calc} onChange={e => setGainCon(r.id, "calc", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["average","min","max","rms"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.conType} onChange={e => setGainCon(r.id, "conType", e.target.value)} style={{ flex: 0.8, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["<=",">=","="].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={r.errorVal} onChange={e => setGainCon(r.id, "errorVal", e.target.value)} disabled={r.conType !== "="} style={{ flex: 0.8, padding: "4px", fontSize: 11, fontFamily: "monospace", color: r.conType !== "=" ? C.text3 : "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box", background: r.conType !== "=" ? "#f5f5f5" : "#fff", minWidth: 0 }} />
                    <input value={r.threshold} onChange={e => setGainCon(r.id, "threshold", e.target.value)} style={{ flex: 0.8, padding: "4px", fontSize: 11, fontFamily: "monospace", color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box", minWidth: 0 }} />
                    <input value={r.weight} onChange={e => setGainCon(r.id, "weight", e.target.value)} style={{ flex: 0.8, padding: "4px", fontSize: 11, fontFamily: "monospace", color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box", minWidth: 0 }} />
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "6px 0" }}>
                  <button onClick={addGainConRow} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: C.accent, background: C.accentD, border: "1px solid " + C.borderA, cursor: "pointer" }}><Plus size={10} />添加行</button>
                  <button onClick={delGainConRows} disabled={!gainConRows.some(r => r.checked)} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: gainConRows.some(r => r.checked) ? "#d93025" : C.text3, background: gainConRows.some(r => r.checked) ? "rgba(217,48,37,0.06)" : "#f1f3f4", border: "1px solid " + (gainConRows.some(r => r.checked) ? "rgba(217,48,37,0.3)" : C.borderA), cursor: gainConRows.some(r => r.checked) ? "pointer" : "default" }}><Trash2 size={10} />删除行</button>
                </div>
              </div>

              {/* ── Return loss constraint table ── */}
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111", marginBottom: 6 }}>回波损失约束设置</p>
              <div style={{ marginBottom: 14 }}>
                <div className="flex items-center" style={{ padding: "5px 12px", background: "#f8f9fa", borderRadius: "8px 8px 0 0", border: "1px solid " + C.border, borderBottom: "none", fontSize: 11, fontWeight: 600, color: C.text2, gap: 4 }}>
                  <span style={{ width: 24, textAlign: "center", flexShrink: 0 }}></span>
                  <span style={{ flex: 1.5 }}>回波损失类型</span>
                  <span style={{ flex: 1.2, textAlign: "center" }}>计算方式</span>
                  <span style={{ flex: 1, textAlign: "center" }}>约束类型</span>
                  <span style={{ flex: 1, textAlign: "center" }}>误差值</span>
                  <span style={{ flex: 1, textAlign: "center" }}>实部阈值</span>
                  <span style={{ flex: 1, textAlign: "center" }}>虚部阈值</span>
                  <span style={{ flex: 1, textAlign: "center" }}>权值</span>
                </div>
                {rlConRows.map(r => (
                  <div key={r.id} className="flex items-center" style={{ padding: "4px 12px", border: "1px solid " + C.border, borderTop: "none", gap: 4 }}>
                    <button onClick={() => toggleRLCon(r.id)} style={{ width: 20, height: 16, borderRadius: 3, border: "1.5px solid " + (r.checked ? C.accent : C.borderA), background: r.checked ? C.accent : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {r.checked && <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>✓</span>}
                    </button>
                    <select value={r.rlType} onChange={e => setRLCon(r.id, "rlType", e.target.value)} style={{ flex: 1.5, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["驻波比","S参数 (dB)","阻抗 (Ω)"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.calc} onChange={e => setRLCon(r.id, "calc", e.target.value)} style={{ flex: 1.2, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["average","min","max","rms"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <select value={r.conType} onChange={e => setRLCon(r.id, "conType", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", minWidth: 0 }}>
                      {["<=",">=","="].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={r.errorVal} onChange={e => setRLCon(r.id, "errorVal", e.target.value)} disabled={r.conType !== "="} style={{ flex: 1, padding: "4px", fontSize: 11, fontFamily: "monospace", color: r.conType !== "=" ? C.text3 : "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box", background: r.conType !== "=" ? "#f5f5f5" : "#fff", minWidth: 0 }} />
                    <input value={r.realThreshold} onChange={e => setRLCon(r.id, "realThreshold", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, fontFamily: "monospace", color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box", minWidth: 0 }} />
                    <input value={r.imagThreshold} onChange={e => setRLCon(r.id, "imagThreshold", e.target.value)} disabled={r.rlType !== "阻抗 (Ω)"} style={{ flex: 1, padding: "4px", fontSize: 11, fontFamily: "monospace", color: r.rlType !== "阻抗 (Ω)" ? C.text3 : "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box", background: r.rlType !== "阻抗 (Ω)" ? "#f5f5f5" : "#fff", minWidth: 0 }} />
                    <input value={r.weight} onChange={e => setRLCon(r.id, "weight", e.target.value)} style={{ flex: 1, padding: "4px", fontSize: 11, fontFamily: "monospace", color: "#111", border: "1px solid " + C.borderA, borderRadius: 4, outline: "none", textAlign: "center", boxSizing: "border-box", minWidth: 0 }} />
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "6px 0" }}>
                  <button onClick={addRLConRow} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: C.accent, background: C.accentD, border: "1px solid " + C.borderA, cursor: "pointer" }}><Plus size={10} />添加行</button>
                  <button onClick={delRLConRows} disabled={!rlConRows.some(r => r.checked)} className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ fontSize: 10, color: rlConRows.some(r => r.checked) ? "#d93025" : C.text3, background: rlConRows.some(r => r.checked) ? "rgba(217,48,37,0.06)" : "#f1f3f4", border: "1px solid " + (rlConRows.some(r => r.checked) ? "rgba(217,48,37,0.3)" : C.borderA), cursor: rlConRows.some(r => r.checked) ? "pointer" : "default" }}><Trash2 size={10} />删除行</button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
              {editMode ? (<>
                <button onClick={() => onCancel?.()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                <button onClick={() => onConfirm?.()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
              </>) : (<>
                <button onClick={() => setWizStep(5)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}><ChevronLeft size={13} />上一步</button>
                <button onClick={() => { setWizStep(7); }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>下一步 <ChevronRight size={13} /></button>
              </>)}
            </div>
          </>)}
        {/* ── Step 7: Algorithm parameter settings ── */}
        {wizStep === 7 && (<>
            <div className="flex-1 overflow-y-auto" style={{ padding: "14px 24px", background: "#fff", scrollbarWidth: "none" }}>
              {/* Algorithm selector — computed from step 5/6 state */}
              {(() => {
                const hasC = gainConRows.length > 0 || rlConRows.length > 0;
                const multi = gainRows.length > 1;
                const opts: { value: string; label: string }[] = [];
                if (!multi) {
                  opts.push({ value: hasC ? "DCNSGA_II" : "DifferentialEvolution", label: hasC ? "DCNSGA_II" : "DifferentialEvolution" });
                } else {
                  if (hasC) {
                    opts.push({ value: "DCNSGA_III", label: "DCNSGA_III" });
                  } else {
                    opts.push({ value: "NSGA_III", label: "NSGA-III" });
                    opts.push({ value: "MOEA_D", label: "MOEA/D" });
                  }
                }
                const current = opts.some(o => o.value === algoName) ? algoName : opts[0]?.value || "DCNSGA_II";
                return (
                  <select value={current} onChange={e => setAlgoName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", fontSize: 13, fontWeight: 500, color: "#111", border: "1px solid " + C.borderA, borderRadius: 8, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box", marginBottom: 20 }}>
                    {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                );
              })()}

              {/* Algorithm detail table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid " + C.border }}>
                {[
                  { label: "最大环境状态", key: "maxEnv", value: algoMaxEnv, setter: setAlgoMaxEnv },
                  { label: "允许最大代数", key: "maxGen", value: algoMaxGen, setter: setAlgoMaxGen },
                  { label: "种群规模", key: "popSize", value: algoPopSize, setter: setAlgoPopSize },
                  { label: "启动进程数", key: "procs", value: algoProcs, setter: setAlgoProcs },
                  { label: "评估容忍时间", key: "evalTime", value: algoEvalTime, setter: setAlgoEvalTime },
                ].map(({ label, value, setter }) => (
                  <div key={label} className="flex items-center justify-between" style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, fontSize: 12, fontWeight: 600, color: "#111" }}>
                    <span>{label}</span>
                    <input value={value} onChange={e => setter(e.target.value)}
                      style={{ width: 100, padding: "5px 10px", fontSize: 12, fontWeight: 500, fontFamily: "monospace", color: "#111", border: "1px solid " + C.borderA, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
                  </div>
                ))}
                <div className="flex items-center justify-between" style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#111" }}>
                  <span>启用断点续算</span>
                  <select value={algoResume} onChange={e => setAlgoResume(e.target.value)}
                    style={{ width: 100, padding: "5px 10px", fontSize: 12, fontWeight: 500, border: "1px solid " + C.borderA, borderRadius: 6, outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box" }}>
                    <option value="是">是</option>
                    <option value="否">否</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
              {editMode ? (<>
                <button onClick={() => onCancel?.()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                <button onClick={() => onConfirm?.()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
              </>) : (<>
                <button onClick={() => setWizStep(6)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}><ChevronLeft size={13} />上一步</button>
                <button onClick={() => { onBack(); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
                  <CheckCircle size={13} />完成
                </button>
              </>)}
            </div>
          </>)}
      </div>
    </div>
  );
}

// ── Antenna type data ─────────────────────────────────────────────────
const ANTENNA_DEFS = [
  { id: 0, name: "微带贴片", freq: "0.5–10 GHz", gain: "5–8 dBi", bw: "窄带 ~5%", uses: "手机、WiFi、GPS、卫星导航", desc: "印刷在介质基板上的矩形贴片，体积小、易与PCB集成，适合中等增益平面天线应用。" },
  { id: 1, name: "偶极子", freq: "HF – 微波", gain: "2.15 dBi", bw: "中等 ~10%", uses: "广播、业余无线电、参考天线", desc: "最简单的线天线，全向辐射，理论增益2.15dBi，可折叠或弯折适应安装。" },
  { id: 2, name: "缝隙阵列", freq: "3–100 GHz", gain: "15–30 dBi", bw: "较宽 10–20%", uses: "雷达、卫星、5G毫米波", desc: "在金属接地板上开缝，通过缝间距控制方向图，适合高增益宽带阵列。" },
  { id: 3, name: "八木宇达", freq: "30–3000 MHz", gain: "6–20 dBi", bw: "窄带", uses: "电视接收、业余无线电、定向通信", desc: "由反射器、激励振子和引向器组成，高方向性，结构简单，常用于VHF/UHF。" },
];

const MATERIALS = [
  { id: "fr4",    name: "FR4",           er: 4.40, tand: 0.020,  h: 1.6,   color: "#f5f0d8" },
  { id: "r4003",  name: "Rogers 4003C",  er: 3.55, tand: 0.0027, h: 0.813, color: "#d8eef5" },
  { id: "r5880",  name: "Rogers 5880",   er: 2.20, tand: 0.0009, h: 0.787, color: "#d8f5e8" },
  { id: "ptfe",   name: "PTFE",          er: 2.08, tand: 0.0002, h: 1.0,   color: "#ead8f5" },
  { id: "alumina",name: "氧化铝陶瓷",    er: 9.80, tand: 0.0001, h: 0.635, color: "#f5e8d8" },
  { id: "custom", name: "自定义",         er: 3.00, tand: 0.010,  h: 1.0,   color: "#f0f0f0" },
];

// ── Antenna sketch SVGs ───────────────────────────────────────────────
function PatchSketch() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80">
      <rect x="6" y="60" width="84" height="7" fill="#c0cedd" stroke="#a0b8cc" strokeWidth="0.8" />
      <rect x="12" y="42" width="72" height="18" fill="rgba(180,210,250,0.4)" stroke="#a0bcd8" strokeWidth="0.7" />
      <rect x="22" y="30" width="52" height="14" fill="#d4a017" stroke="#c8a028" strokeWidth="0.8" />
      <rect x="45" y="42" width="6" height="18" fill="#b09030" />
      <line x1="48" y1="67" x2="48" y2="74" stroke="#708090" strokeWidth="2" />
      <circle cx="48" cy="76" r="3" fill="#607080" />
      <text x="8" y="76" fill={C.text3} fontSize="7" fontFamily="Inter">地板</text>
      <text x="34" y="40" fill={C.text3} fontSize="7" fontFamily="Inter">Patch</text>
      <text x="58" y="53" fill={C.text3} fontSize="7" fontFamily="Inter">εr</text>
    </svg>
  );
}
function DipoleSketch() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80">
      <line x1="8" y1="40" x2="42" y2="40" stroke="#1a73e8" strokeWidth="3" strokeLinecap="round" />
      <line x1="54" y1="40" x2="88" y2="40" stroke="#1a73e8" strokeWidth="3" strokeLinecap="round" />
      <line x1="46" y1="40" x2="46" y2="20" stroke="#888" strokeWidth="1.5" />
      <line x1="50" y1="40" x2="50" y2="20" stroke="#888" strokeWidth="1.5" />
      <line x1="42" y1="20" x2="54" y2="20" stroke="#aaa" strokeWidth="1" />
      <text x="10" y="36" fill={C.text3} fontSize="7" fontFamily="Inter">臂1</text>
      <text x="62" y="36" fill={C.text3} fontSize="7" fontFamily="Inter">臂2</text>
      <text x="36" y="17" fill={C.text3} fontSize="7" fontFamily="Inter">馈点</text>
    </svg>
  );
}
function SlotSketch() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80">
      <rect x="6" y="8" width="84" height="64" fill="#c8d4e0" stroke="#a0b4c4" strokeWidth="0.8" />
      {[20, 40, 60].map(y => (
        <g key={y}>
          <rect x="18" y={y} width="24" height="6" fill="#f8f9fa" stroke="#8090a0" strokeWidth="0.5" />
          <rect x="54" y={y} width="24" height="6" fill="#f8f9fa" stroke="#8090a0" strokeWidth="0.5" />
        </g>
      ))}
      <text x="8" y="78" fill={C.text3} fontSize="7" fontFamily="Inter">缝隙阵列</text>
    </svg>
  );
}
function YagiSketch() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80">
      <line x1="48" y1="8" x2="48" y2="72" stroke="#c0c0a8" strokeWidth="1" />
      <line x1="12" y1="20" x2="12" y2="60" stroke="#8090a0" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="26" y1="24" x2="26" y2="56" stroke="#1a73e8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="44" y1="27" x2="44" y2="53" stroke="#5090c8" strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="29" x2="60" y2="51" stroke="#5090c8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="74" y1="31" x2="74" y2="49" stroke="#5090c8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="86" y1="33" x2="86" y2="47" stroke="#5090c8" strokeWidth="1" strokeLinecap="round" />
      <text x="6" y="76" fill={C.text3} fontSize="6" fontFamily="Inter">反射</text>
      <text x="20" y="76" fill={C.text2} fontSize="6" fontFamily="Inter">振子</text>
      <text x="38" y="76" fill={C.text3} fontSize="6" fontFamily="Inter">引向器</text>
    </svg>
  );
}

const SKETCHES = [PatchSketch, DipoleSketch, SlotSketch, YagiSketch];

// ── Workspace param slider (wider, with +/-) ──────────────────────────
function WParam({ label, value, unit, min, max, step = 0.1, onChange }: {
  label: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.text2 }}>{label}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(4))))}
            style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${C.borderA}`, background: "#fff", fontSize: 12, cursor: "pointer", color: C.text2, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: C.text1, minWidth: 48, textAlign: "center" }}>{value.toFixed(2)} {unit}</span>
          <button onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(4))))}
            style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${C.borderA}`, background: "#fff", fontSize: 12, cursor: "pointer", color: C.text2, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
      </div>
      <div style={{ position: "relative", height: 4, background: "#f1f3f4", borderRadius: 2 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", background: C.accent, borderRadius: 2, width: `${((value - min) / (max - min)) * 100}%` }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer" }} />
      </div>
    </div>
  );
}
// ── Project Detail (tree navigation) ──────────────────────────────────
type TreeNode = { id: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; children?: TreeNode[]; };

const PROJECT_TREE: TreeNode[] = [
  { id: "design-params",  label: "设计参数展示",  icon: FolderOpen, children: [
    { id: "dp-freq",     label: "频段范围设置",       icon: Radio },
    { id: "dp-radiation",label: "辐射范围设置",       icon: Maximize2 },
    { id: "dp-structure",label: "设计变量设置",   icon: Settings },
    { id: "dp-variables",label: "目标设置",        icon: Sliders },
    { id: "dp-objective",label: "约束设置",        icon: BarChart2 },
    { id: "dp-algorithm",label: "算法参数设置",        icon: Activity },
  ]},
  { id: "results",   label: "结果展示",  icon: BarChart2, children: [] as TreeNode[] },
];

// ── Individual tree node (each has its own hook scope) ──────────────────
const TreeNodeItem = memo(function TreeNodeItem({ node, selected, onSelect, onMoreClick, lv }: {
  node: TreeNode; selected: string; onSelect: (id: string) => void;
  onMoreClick?: (id: string, label: string, e: React.MouseEvent<HTMLElement>) => void; lv: number;
}) {
  const hasChildren = node.children !== undefined && node.children.length > 0;
  const active = selected === node.id;
  const [open, setOpen] = useState(hasChildren);
  const Icon = node.icon;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) { setOpen(!open); }
          else { onSelect(node.id); }
        }}
        style={{
          display: "flex", alignItems: "center", gap: 5, width: "100%", textAlign: "left",
          padding: `6px ${8 + lv * 14}px`,
          fontSize: lv === 0 ? 12 : 10.5, fontWeight: active ? 600 : 400,
          color: active ? C.accent : lv === 0 ? C.text1 : C.text2,
          background: active ? C.accentD : "transparent",
          border: "none", borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent",
          cursor: "pointer", transition: "background 0.1s",
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f8f9fa"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
        {hasChildren && (
          <ChevronRight size={10} style={{
            color: C.text3, flexShrink: 0,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }} />
        )}
        {hasChildren && <span style={{ width: 2 }} />}
        <Icon size={lv === 0 ? 13 : 11} style={{
          color: active ? C.accent : C.text2, flexShrink: 0,
          opacity: hasChildren ? 0.8 : 1,
        }} />
        <span style={{ flex: 1 }}>{node.label}</span>
        <span
          role="button"
          tabIndex={0}
          aria-label={`打开${node.label}的更多操作`}
          title="更多操作"
          onClick={(e) => { e.stopPropagation(); onMoreClick?.(node.id, node.label, e); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.click();
            }
          }}
          style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.text2, cursor: "pointer", touchAction: "manipulation",
          }}>
          <Ellipsis size={15} />
        </span>
        {hasChildren && !open && (
          <ChevronRight size={9} style={{ color: C.text3, opacity: 0.5, flexShrink: 0 }} />
        )}
      </button>
      {hasChildren && open && node.children && (
        <FileTree tree={node.children} selected={selected} onSelect={onSelect} onMoreClick={onMoreClick} level={lv + 1} />
      )}
    </div>
  );
});

function FileTree({ tree, selected, onSelect, onMoreClick, level }: { tree: TreeNode[]; selected: string; onSelect: (id: string) => void; onMoreClick?: (id: string, label: string, e: React.MouseEvent<HTMLElement>) => void; level: number }) {
  const lv = level ?? 0;
  return (
    <div>
      {tree.map(node => (
        <TreeNodeItem key={node.id} node={node} selected={selected} onSelect={onSelect} onMoreClick={onMoreClick} lv={lv} />
      ))}
    </div>
  );
}

// ── 3D Surface Plot ──────────────────────────────────────────────────
function Surface3D({ width, height }: { width?: number; height?: number }) {
  const w = width ?? 420, h = height ?? 240;
  const cx = w * 0.45, cy = h * 0.55;
  const S = 0.55;
  const px = (x: number, y: number) => cx + (x - y) * Math.cos(Math.PI / 6) * S;
  const py = (x: number, y: number, z: number) => cy + (x + y) * Math.sin(Math.PI / 6) * S - z * S * 0.8;
  const gridSize = 14;
  const surfData: number[][] = Array.from({ length: gridSize }, (_, i) =>
    Array.from({ length: gridSize }, (_, j) => {
      const dx = (i - gridSize / 2) / (gridSize / 5);
      const dy = (j - gridSize / 2) / (gridSize / 5);
      const r = Math.sqrt(dx * dx + dy * dy);
      return r < 2.2 ? -18 - 10 * Math.exp(-r * r / 1.6) - 4 * Math.cos(r * 2.5) * Math.exp(-r / 2) : -2 + Math.random() * 0.5;
    })
  );
  const xRange = 40, yRange = 40, zMin = -28, zRange = 30;
  const wires: string[] = [];
  for (let i = 0; i < gridSize; i++) {
    let rowPts = "", colPts = "";
    for (let j = 0; j < gridSize; j++) {
      const x = (i / (gridSize - 1)) * xRange, y = (j / (gridSize - 1)) * yRange, z = ((surfData[i][j] - zMin) / zRange) * 55;
      const p = `${px(x, y).toFixed(1)},${py(x, y, z).toFixed(1)}`;
      if (j === 0) rowPts = `M${p}`; else rowPts += ` L${p}`;
      const x2 = (j / (gridSize - 1)) * xRange, y2 = (i / (gridSize - 1)) * yRange, z2 = ((surfData[j][i] - zMin) / zRange) * 55;
      const p2 = `${px(x2, y2).toFixed(1)},${py(x2, y2, z2).toFixed(1)}`;
      if (j === 0) colPts = `M${p2}`; else colPts += ` L${p2}`;
    }
    wires.push(rowPts, colPts);
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="surfGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor="#40c0ff" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect x={px(0, 0) - 30} y={py(0, 0, 0)} width={60 * S} height={60 * S * 0.4} fill="none" stroke={C.borderA} strokeWidth="0.5" rx="1" transform={`rotate(-30 ${px(0,0)} ${py(0,0,0)})`} />
      {wires.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={i % gridSize < gridSize / 2 ? C.accent : "#40c0ff"} strokeWidth="0.6" opacity="0.45" />
      ))}
      <line x1={cx} y1={cy} x2={cx + 45 * S} y2={cy + 45 * S * 0.4} stroke="#c04040" strokeWidth="0.8" />
      <line x1={cx} y1={cy} x2={cx - 45 * S} y2={cy + 45 * S * 0.4} stroke="#40a040" strokeWidth="0.8" />
      <line x1={cx} y1={cy} x2={cx} y2={cy - 50 * S} stroke="#4060c0" strokeWidth="0.8" />
      <text x={cx + 48 * S} y={cy + 48 * S * 0.4} fill="#c06060" fontSize="7">f</text>
      <text x={cx - 52 * S} y={cy + 48 * S * 0.4} fill="#60a060" fontSize="7">{'θ'}</text>
      <text x={cx - 4} y={cy - 55 * S} fill="#6080c0" fontSize="7">|S11|</text>
    </svg>
  );
}

// ── 3D Polar Plot ─────────────────────────────────────────────────────
function Polar3D({ size }: { size?: number }) {
  const s = size ?? 260;
  const cx = s / 2, cy = s * 0.52;
  const R = s * 0.33;

  const ellipses: { cy2: number; rx: number; ry: number; op: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    ellipses.push({ cy2: cy - R * 0.35 + t * R * 0.7, rx: R * (0.3 + 0.7 * (1 - Math.abs(t - 0.5) * 1.6)), ry: R * 0.25 * (1 - Math.abs(t - 0.5) * 1.4), op: 0.15 + t * 0.3 });
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <line x1={cx} y1={cy - R * 1.1} x2={cx} y2={cy + R * 0.55} stroke={C.borderA} strokeWidth="0.5" />
      <text x={cx + 4} y={cy - R * 1.15} fill={C.text3} fontSize="7">Z</text>
      <ellipse cx={cx} cy={cy + R * 0.35} rx={R * 0.95} ry={R * 0.3} fill="none" stroke={C.borderA} strokeWidth="0.5" strokeDasharray="3,2" />
      <ellipse cx={cx} cy={cy - R * 0.0} rx={R * 0.85} ry={R * 0.28} fill="none" stroke={C.borderA} strokeWidth="0.5" strokeDasharray="3,2" />
      {ellipses.map((e, i) => (
        <ellipse key={i} cx={cx} cy={e.cy2} rx={e.rx} ry={e.ry} fill="none" stroke="rgba(26,115,232,0.5)" strokeWidth="0.7" opacity={e.op} />
      ))}
      <path d={Array.from({ length: 61 }, (_, i) => {
        const t = (i / 60) * Math.PI * 2;
        const rVal = 0.3 + 0.7 * Math.abs(Math.cos(t * 2)) * Math.pow(Math.sin(t), 2);
        const x = cx + R * rVal * 0.9 * Math.cos(t);
        const y = cy + R * 0.35 * (Math.cos(t) * 0.4) - R * rVal * Math.sin(t) * 0.4;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ") + "Z"} fill="rgba(26,115,232,0.06)" stroke={C.accent} strokeWidth="0.9" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r = (deg * Math.PI) / 180;
        const topY = cy - R * 0.35;
        const botY = cy + R * 0.35;
        const xOff = R * 0.15 * Math.sin(r);
        return (
          <line key={deg} x1={cx + xOff * 0.3} y1={topY} x2={cx + xOff} y2={botY}
            stroke="rgba(26,115,232,0.15)" strokeWidth="0.5" />
        );
      })}
      <line x1={cx - R} y1={cy + R * 0.35} x2={cx + R} y2={cy + R * 0.35} stroke={C.borderA} strokeWidth="0.5" />
      <text x={cx + R + 3} y={cy + R * 0.35 + 3} fill={C.text3} fontSize="7">X</text>
      <line x1={cx} y1={cy - R + R * 0.35} x2={cx} y2={cy + R + R * 0.35} stroke={C.borderA} strokeWidth="0.5" />
      <text x={cx - 5} y={cy - R + R * 0.35 - 3} fill={C.text3} fontSize="7">Y</text>
      <text x={cx + 4} y={cy - R * 0.5} fill={C.accent} fontSize="9" fontWeight="600">6.2 dBi</text>
      <circle cx={cx} cy={cy - R * 0.35 + 4} r={2} fill={C.accent} />
    </svg>
  );
}

// ── Shared optimization log data ──────────────────────────────────────
const ALL_OPT_LOGS = [
  "[00:00] 初始化 DCNSGA_II 优化算法，种群规模: 50",
  "[00:01] 加载天线结构参数... 贴片尺寸: L=38.5mm, W=47.2mm",
  "[00:02] 设置频率扫描范围: 1.5–4.0 GHz，频点: 81",
  "[00:03] 网格划分中... 自适应网格精度: 标准",
  "[00:05] 网格划分完成，单元数: 12,480",
  "[00:06] 开始电磁仿真... 求解器: MoM (矩量法)",
  "[00:08] 仿真进度 15% — 评估 S11 参数...",
  "[00:11] 仿真进度 32% — 计算远场辐射方向图...",
  "[00:14] 仿真进度 48% — 评估增益与效率...",
  "[00:17] 仿真进度 63% — 计算 VSWR...",
  "[00:20] 仿真进度 79% — 评估阻抗匹配...",
  "[00:22] 仿真进度 91% — 收敛检查...",
  "[00:24] 第1代适应度评估完成，最优: 0.612",
  "[00:27] 第2代 — 交叉操作 (概率 0.80)，变异操作 (概率 0.05)",
  "[00:30] 第5代 — 精英保留 5 个体，最优适应度: 0.701",
  "[00:33] 第10代 — 锦标赛选择，最优适应度: 0.763",
  "[00:37] 第20代 — 种群多样性保持良好",
  "[00:40] 第30代 — 局部精细化搜索启动",
  "[00:44] 第50代 — 最优适应度: 0.871，约束违反量: 0",
  "[00:48] 第65代 — 收敛趋势明显，帕累托前沿形成",
  "[00:52] 第75代 — 最优适应度: 0.921",
  "[00:57] 第85代 — 适应度变化 < 0.001，接近收敛",
  "[01:01] 第90代 — 最优适应度: 0.943，满足收敛判据",
  "[01:03] 优化完成！总耗时: 63 秒",
  "[01:04] 最优解: r1 = 42.8 mm",
  "[01:04] 方位角测向误差: 0.427° (满足约束 ≤ 1.0°)",
  "[01:05] S11 @ 2.45GHz: -24.7 dB (改善 6.4 dB)",
  "[01:05] 增益: 7.8 dBi (改善 1.6 dBi)",
  "[01:05] VSWR: 1.12 (改善 0.16)",
  "[01:06] ✓ 优化报告已生成，结果已保存至项目目录",
];

function ProjectDetail({ project, onBack }: { project: (typeof RECENT_PROJECTS)[0]; onBack: () => void }) {
  const [selNode, setSelNode] = useState("");
  const [sidebarW, setSidebarW] = useState(218);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const [subCtxMenu, setSubCtxMenu] = useState<{ id: string; label: string; x: number; y: number } | null>(null);
  const [subRenameTarget, setSubRenameTarget] = useState<string | null>(null);
  const [subRenameValue, setSubRenameValue] = useState("");
  const [paramPopup, setParamPopup] = useState<string | null>(null);
  const [subShareModal, setSubShareModal] = useState(false);
  const [subShareLabel, setSubShareLabel] = useState("");
  const [subShareExpiry, setSubShareExpiry] = useState("7");
  const [subShareStep, setSubShareStep] = useState<"settings" | "link">("settings");
  const [subShareLink, setSubShareLink] = useState("");

  // ── Optimization state ──
  type OptStatus = "idle" | "running" | "paused" | "completed";
  const [optStatus, setOptStatus] = useState<OptStatus>("idle");
  const [optLogs, setOptLogs] = useState<string[]>([]);
  const [optResults, setOptResults] = useState<Array<{ idx: number; constraint: string; totalGain: string; vswr: string; pheno: string }> | null>(null);
  const optIdxRef = useRef(0);
  const optTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildOptimizationResults = useCallback(() => [
    { idx: 1, constraint: "满足", totalGain: "", vswr: "", pheno: "" },
  ], []);

  useEffect(() => {
    if (optStatus !== "running") return;

    let cancelled = false;
    const scheduleNextLog = () => {
      optTimerRef.current = setTimeout(() => {
        if (cancelled) return;

        const nextIndex = optIdxRef.current;
        if (nextIndex < ALL_OPT_LOGS.length) {
          const nextLog = ALL_OPT_LOGS[nextIndex];
          optIdxRef.current = nextIndex + 1;
          setOptLogs(previous => [...previous, nextLog]);
          scheduleNextLog();
          return;
        }

        setOptResults(buildOptimizationResults());
        setOptLogs([...ALL_OPT_LOGS]);
        setOptStatus("completed");
      }, 350);
    };

    scheduleNextLog();
    return () => {
      cancelled = true;
      if (optTimerRef.current) {
        clearTimeout(optTimerRef.current);
        optTimerRef.current = null;
      }
    };
  }, [optStatus, buildOptimizationResults]);

  const handleStartOpt = () => {
    if (optStatus === "idle") {
      optIdxRef.current = 0;
      setOptLogs([]);
      setOptResults(null);
      setSelNode("");
      setParamPopup(null);
    }
    if (optStatus === "idle" || optStatus === "paused") setOptStatus("running");
  };
  const handlePauseOpt = () => setOptStatus("paused");
  const handleStopOpt = () => {
    if (optTimerRef.current) clearTimeout(optTimerRef.current);
    optTimerRef.current = null;
    optIdxRef.current = 0;
    setOptStatus("idle");
    setOptLogs([]);
    setOptResults(null);
    setSelNode("");
    setParamPopup(null);
  };

  // ── Generated result children (dynamic tree nodes) ──
  const [genNodes, setGenNodes] = useState<{ parentId: string; id: string; label: string; icon: React.ComponentType<{ size?: number }>; isFolder?: boolean }[]>([]);

  // ── 2D 矩形图 parameter settings modal ──
  const [rect2dModal, setRect2dModal] = useState(false);
  const [rect2dFreqSweep, setRect2dFreqSweep] = useState("Sweep1");
  const [rect2dPrimary, setRect2dPrimary] = useState("Phi");
  const [rect2dPrimaryAll, setRect2dPrimaryAll] = useState("ALL");
  const [rect2dX, setRect2dX] = useState("Phi");
  const [rect2dY, setRect2dY] = useState("deg(方位角测向误差)");
  const [rect2dCategory, setRect2dCategory] = useState("轴比");
  const [rect2dValueMode, setRect2dValueMode] = useState<"all" | "select">("all");
  const [rect2dPhiVal, setRect2dPhiVal] = useState("ALL");
  const [rect2dFunction, setRect2dFunction] = useState("dB");
  const [rect2dSubItems, setRect2dSubItems] = useState<string[]>(["轴比"]);
  const [rect2dFreqVal, setRect2dFreqVal] = useState("ALL");
  const [rect2dPrimarySelected, setRect2dPrimarySelected] = useState("ALL");  // replaces rect2dPrimaryAll dropdown
  const [rect2dPrimaryPopup, setRect2dPrimaryPopup] = useState(false);
  const [rect2dPopupMode, setRect2dPopupMode] = useState<"all" | "select">("all");
  const [rect2dPopupSel, setRect2dPopupSel] = useState("");

  // Compute the available values for the Primary Sweep "..." picker
  const getSweepValues = (key: string) => {
    const vals: string[] = [];
    if (key === "Phi") for (let d = 0; d <= 360; d += 10) vals.push(`${d}°`);
    else if (key === "Theta") for (let d = -30; d <= 30; d += 5) vals.push(`${d}°`);
    else for (let m = 1700; m <= 2600; m += 100) vals.push(`${m.toFixed(2)}MHz`);
    return vals;
  };

  // ── 3D 矩形图 parameter settings modal (shared for 原始 / 插值) ──
  const [rect3dModal, setRect3dModal] = useState(false);
  const [rect3dFreqSweep, setRect3dFreqSweep] = useState("Sweep1");
  const [rect3dPrimary, setRect3dPrimary] = useState("Phi");
  const [rect3dPrimaryAll, setRect3dPrimaryAll] = useState("ALL");
  const [rect3dPrimarySelected, setRect3dPrimarySelected] = useState("ALL");
  const [rect3dPrimaryPopup, setRect3dPrimaryPopup] = useState(false);
  const [rect3dPopupMode, setRect3dPopupMode] = useState<"all" | "select">("all");
  const [rect3dPopupSel, setRect3dPopupSel] = useState("");
  const [rect3dSecondary, setRect3dSecondary] = useState("Theta");
  const [rect3dSecondarySelected, setRect3dSecondarySelected] = useState("ALL");
  const [rect3dSecondaryPopup, setRect3dSecondaryPopup] = useState(false);
  const [rect3dSecPopupMode, setRect3dSecPopupMode] = useState<"all" | "select">("all");
  const [rect3dSecPopupSel, setRect3dSecPopupSel] = useState("");
  const [rect3dX, setRect3dX] = useState("Theta");
  const [rect3dY, setRect3dY] = useState("Phi");
  const [rect3dZ, setRect3dZ] = useState("deg(方位角测向误差)");
  const [rect3dCategory, setRect3dCategory] = useState("轴比");
  const [rect3dValueMode, setRect3dValueMode] = useState<"all" | "select">("all");
  const [rect3dFunction, setRect3dFunction] = useState("dB");
  const [rect3dSubItems, setRect3dSubItems] = useState<string[]>(["轴比"]);
  const [rect3dFreqVal, setRect3dFreqVal] = useState("ALL");

  // ── 2D 极化图 parameter settings modal ──
  const [polar2dModal, setPolar2dModal] = useState(false);
  const [polar2dFreqSweep, setPolar2dFreqSweep] = useState("Sweep1");
  const [polar2dPrimary, setPolar2dPrimary] = useState("Phi");
  const [polar2dPrimaryAll, setPolar2dPrimaryAll] = useState("ALL");
  const [polar2dPrimarySelected, setPolar2dPrimarySelected] = useState("ALL");
  const [polar2dPrimaryPopup, setPolar2dPrimaryPopup] = useState(false);
  const [polar2dPopupMode, setPolar2dPopupMode] = useState<"all" | "select">("all");
  const [polar2dPopupSel, setPolar2dPopupSel] = useState("");
  const [polar2dPolar, setPolar2dPolar] = useState("deg(方位角测向误差)");
  const [polar2dCategory, setPolar2dCategory] = useState("轴比");
  const [polar2dValueMode, setPolar2dValueMode] = useState<"all" | "select">("all");
  const [polar2dFunction, setPolar2dFunction] = useState("dB");
  const [polar2dSubItems, setPolar2dSubItems] = useState<string[]>(["轴比"]);
  const [polar2dFreqVal, setPolar2dFreqVal] = useState("ALL");
  const [polar2dThetaVal, setPolar2dThetaVal] = useState("ALL");

  // ── 3D 极化图 parameter settings modal ──
  const [polar3dModal, setPolar3dModal] = useState(false);
  const [polar3dFreqSweep, setPolar3dFreqSweep] = useState("Sweep1");
  const [polar3dPrimary, setPolar3dPrimary] = useState("Phi");
  const [polar3dPrimarySelected, setPolar3dPrimarySelected] = useState("ALL");
  const [polar3dPrimaryPopup, setPolar3dPrimaryPopup] = useState(false);
  const [polar3dPriPopupMode, setPolar3dPriPopupMode] = useState<"all" | "select">("all");
  const [polar3dPriPopupSel, setPolar3dPriPopupSel] = useState("");
  const [polar3dSecondary, setPolar3dSecondary] = useState("Theta");
  const [polar3dSecondarySelected, setPolar3dSecondarySelected] = useState("ALL");
  const [polar3dSecondaryPopup, setPolar3dSecondaryPopup] = useState(false);
  const [polar3dSecPopupMode, setPolar3dSecPopupMode] = useState<"all" | "select">("all");
  const [polar3dSecPopupSel, setPolar3dSecPopupSel] = useState("");
  const [polar3dCategory, setPolar3dCategory] = useState("轴比");
  const [polar3dValueMode, setPolar3dValueMode] = useState<"all" | "select">("all");
  const [polar3dFunction, setPolar3dFunction] = useState("dB");
  const [polar3dSubItems, setPolar3dSubItems] = useState<string[]>(["轴比"]);
  const [polar3dFreqVal, setPolar3dFreqVal] = useState("ALL");

  // ── Shared Families state per modal (row labels depend on Primary Sweep) ──
  type FamKey = "Freq" | "Phi" | "Theta";
  const SWEEP_VALUES: Record<FamKey, string[]> = {
    Phi: Array.from({length: 37}, (_, i) => `${i * 10}°`),
    Theta: Array.from({length: 13}, (_, i) => `${-30 + i * 5}°`),
    Freq: Array.from({length: 10}, (_, i) => `${(1700 + i * 100).toFixed(2)}MHz`),
  };
  const ALL_FAM_KEYS: FamKey[] = ["Phi", "Theta", "Freq"];
  // Helper: returns the two keys NOT matching `exclude`
  function remainingKeys(exclude: string): FamKey[] {
    return ALL_FAM_KEYS.filter(k => k !== exclude) as FamKey[];
  }

  // 2D rect families
  const [rect2dFamVals, setRect2dFamVals] = useState<Record<string, string>>({});
  const [rect2dFamPopup, setRect2dFamPopup] = useState<string | null>(null);
  const [rect2dFamPopupMode, setRect2dFamPopupMode] = useState<"all" | "select">("all");
  const [rect2dFamPopupSel, setRect2dFamPopupSel] = useState("");

  // 3D rect families
  const [rect3dFamVals, setRect3dFamVals] = useState<Record<string, string>>({});
  const [rect3dFamPopup, setRect3dFamPopup] = useState<string | null>(null);
  const [rect3dFamPopupMode, setRect3dFamPopupMode] = useState<"all" | "select">("all");
  const [rect3dFamPopupSel, setRect3dFamPopupSel] = useState("");

  // 2D polar families
  const [polar2dFamVals, setPolar2dFamVals] = useState<Record<string, string>>({});
  const [polar2dFamPopup, setPolar2dFamPopup] = useState<string | null>(null);
  const [polar2dFamPopupMode, setPolar2dFamPopupMode] = useState<"all" | "select">("all");
  const [polar2dFamPopupSel, setPolar2dFamPopupSel] = useState("");

  // 3D polar families (only one remaining var after Primary + Secondary)
  const [polar3dFamVals, setPolar3dFamVals] = useState<Record<string, string>>({});
  const [polar3dFamPopup, setPolar3dFamPopup] = useState<string | null>(null);
  const [polar3dFamPopupMode, setPolar3dFamPopupMode] = useState<"all" | "select">("all");
  const [polar3dFamPopupSel, setPolar3dFamPopupSel] = useState("");

  const CATEGORY_GROUPS: Record<string, string[]> = {
    "轴比": ["轴比"],
    "增益": ["总增益", "水平增益", "垂直增益", "右旋增益", "左旋增益"],
    "驻波比": ["驻波比"],
    "S参数": ["S(1,1)"],
    "阻抗": ["Z(1,1)"],
  };
  const FAMILY_LABELS: Record<string, string> = { Phi: "Phi", Theta: "Theta", Freq: "Freq" };
  const FUNCTION_OPTIONS: Record<string, string[]> = {
    "轴比": ["dB", "None"],
    "增益": ["dB", "None"],
    "驻波比": ["None"],
    "S参数": ["dB", "None"],
    "阻抗": ["实部", "虚部"],
  };
  const CATEGORY_NAMES = Object.keys(CATEGORY_GROUPS);

  // ── Stabilized callbacks for FileTree (prevent re-renders during optimization) ──
  const handleTreeSelect = useCallback((id: string) => {
    if (id.startsWith("dp-")) {
      setParamPopup(id);
      setSelNode("");
    } else if (id.startsWith("gen-")) {
      setSelNode(id);
      setParamPopup(null);
      setRect2dModal(false);
    } else {
      setSelNode(id);
      setParamPopup(null);
    }
  }, []);
  const handleMoreClick = useCallback((id: string, label: string, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSubCtxMenu({ id, label, x: Math.min(rect.right, window.innerWidth - 210), y: Math.min(rect.bottom + 4, window.innerHeight - 240) });
  }, []);
  const selectedNode = paramPopup ? paramPopup : selNode;

  // Dynamic tree: merge generated folders/files + results table
  const displayTree = useMemo(() => {
    let base = PROJECT_TREE.map(n => ({ ...n, children: n.children ? [...n.children] : undefined }));
    // Inject results table node when optimization completed
    if (optResults && optStatus === "completed") {
      base = base.map(n => {
        if (n.id === "results" && n.children && !n.children.some(c => c.id === "opt-results-table")) {
          return { ...n, children: [...n.children, { id: "opt-results-table", label: "目标结果表格", icon: FileText }] };
        }
        return n;
      });
    }
    // Merge generated folder hierarchy: folders go under results, files go under folders
    if (genNodes.length > 0) {
      base = base.map(n => {
        if (n.id !== "results" || !n.children) return n;
        const existingIds = new Set(n.children.map(c => c.id));
        // 1) Collect top-level gen folders (parentId = "results")
        const genFolders = genNodes.filter(g => g.parentId === "results" && g.isFolder && !existingIds.has(g.id));
        // 2) For each gen folder, collect its child files
        const mergedChildren = [...n.children];
        for (const gf of genFolders) {
          const childFiles = genNodes.filter(g => g.parentId === gf.id && !g.isFolder);
          mergedChildren.push({
            id: gf.id, label: gf.label, icon: gf.icon,
            children: childFiles.map(f => ({ id: f.id, label: f.label, icon: f.icon })),
          });
        }
        // 3) Also add any top-level gen files (parentId = "results" and not folder) directly
        const topFiles = genNodes.filter(g => g.parentId === "results" && !g.isFolder && !existingIds.has(g.id));
        for (const tf of topFiles) {
          mergedChildren.push({ id: tf.id, label: tf.label, icon: tf.icon });
        }
        return { ...n, children: mergedChildren };
      });
    }
    return base;
  }, [optResults, optStatus, genNodes]);

  // Escape key cleanup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSubCtxMenu(null); setSubRenameTarget(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); dragging.current = true; };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !sidebarRef.current) return;
      const parentRect = sidebarRef.current.parentElement!.getBoundingClientRect();
      const w = Math.max(160, Math.min(380, e.clientX - parentRect.left));
      setSidebarW(w);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const renderContent = () => {
    const p = project;
    // Generated nodes — show chart image based on selection
    if (selNode.startsWith("gen-")) {
      const genNode = genNodes.find(g => g.id === selNode);
      const genLabel = genNode?.label || "二维矩形图";
      const parentFolder = genNodes.find(g => g.id === genNode?.parentId);
      const folderLabel = parentFolder?.label || "";

      // Map subItem keyword to category image prefix
      const keywordMap: Record<string, string> = {
        "S(1,1)": "S参数",
        "驻波比": "驻波比",
        "Z(1,1)": "阻抗",
        "总增益": "总增益",
        "轴比": "轴比",
      };
      let chartImg = "./chart-result.png";
      for (const [keyword, prefix] of Object.entries(keywordMap)) {
        if (genLabel.includes(keyword)) {
          chartImg = `./charts/${prefix}${folderLabel}.png`;
          break;
        }
      }

      return (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>{genLabel}</h3>
          <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={chartImg} alt="图表结果" style={{ width: "100%", maxWidth: 600, borderRadius: 8 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 10, fontSize: 10, fontFamily: "monospace", color: C.text2 }}>
            <span>最小值: <b style={{ color: C.accent }}>−18.3 dB @ 2.45 GHz</b></span>
            <span>−10 dB 带宽: <b style={{ color: C.green }}>98 MHz (2.40–2.50 GHz)</b></span>
          </div>
        </div>
      );
    }
    switch (selNode) {
      case "overview":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 16 }}>项目概览</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                {[
                  ["项目名称", p.title], ["项目类型", p.type], ["天线类型", p.tag], ["设计频率", `${p.freq} GHz`],
                  ["作者", p.author], ["创建时间", p.date], ["可见性", p.privacy], ["ID", `PROJ-${p.id.toString().padStart(4, "0")}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: C.text3 }}>{k}</span>
                    <span style={{ fontSize: 11, color: C.text1, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "S11", value: `${p.results.s11} dB`, color: C.accent },
                { label: "增益", value: `${p.results.gain} dBi`, color: C.green },
                { label: "VSWR", value: `${p.results.vswr}`, color: "#7c3aed" },
                { label: "带宽", value: `${p.results.bw} MHz`, color: C.amber },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.text3, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "params-structure":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>天线结构 / 环境参数</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.text1, marginBottom: 12 }}>结构尺寸</p>
                {Object.entries(p.params).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 10, color: C.text3 }}>{{ patchL: "贴片长度 L", patchW: "贴片宽度 W", feedPos: "馈电偏移 d", er: "介电常数 εr", h: "基板厚度 h" }[k] || k}</span>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: C.text1, fontWeight: 500 }}>{v}{k === "er" ? "" : " mm"}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.text1, marginBottom: 12 }}>环境参数</p>
                {[
                  ["环境温度", "25 °C"], ["基板材料", "FR4"], ["导体材料", "铜 (Copper)"],
                  ["安装方式", "平面贴装"], ["接地平面", "120 × 100 mm"], ["屏蔽条件", "无屏蔽"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 10, color: C.text3 }}>{k}</span>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: C.text1, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="./template-horn.png" alt="天线模板" style={{ width: "100%", maxWidth: 480, borderRadius: 12 }} />
            </div>
          </div>
        );
      case "params-freq":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>频率 / 辐射范围参数</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                {[
                  ["设计频率", `${p.freq} GHz`], ["频率范围", "1.5 – 4.0 GHz"], ["波长 λ", `${(300/p.freq).toFixed(1)} mm`],
                  ["极化方式", "线极化"], ["波束宽度", "68° (H面) / 72° (E面)"], ["最大增益方向", "θ = 0° (法向)"],
                  ["旁瓣电平", "< −12 dB"], ["前后比", "14.5 dB"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: C.text3 }}>{k}</span>
                    <span style={{ fontSize: 11, color: C.text1, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "S11", value: `${p.results.s11} dB`, color: C.accent },
                { label: "增益", value: `${p.results.gain} dBi`, color: C.green },
                { label: "VSWR", value: `${p.results.vswr}`, color: "#7c3aed" },
                { label: "带宽", value: `${p.results.bw} MHz`, color: C.amber },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.text3, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        );
      case "params-target":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>目标 / 约束参数</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                {[
                  ["优化目标", "最小化 S11 + 最大化增益"], ["S11 目标", "≤ −18 dB"], ["增益目标", "≥ 6.2 dBi"],
                  ["VSWR 约束", "≤ 1.5 @ 2.45GHz"], ["带宽约束", "≥ 80 MHz @ −10dB"], ["尺寸约束", "L ≤ 40 mm, W ≤ 50 mm"],
                  ["基板约束", "εr = 4.40 (固定)"], ["阻抗约束", "45 Ω ≤ Zin ≤ 55 Ω"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: C.text3 }}>{k}</span>
                    <span style={{ fontSize: 11, color: C.text1, fontWeight: 500, fontFamily: "monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: "rgba(52,168,83,0.06)", border: "1px solid rgba(52,168,83,0.2)" }}>
              <p style={{ fontSize: 11, color: C.text2, lineHeight: 1.6 }}>所有约束均已满足 ✓
              <br />S11 实测 −18.3 dB ≤ −18 dB · 增益 6.2 dBi ≥ 6.2 dBi · VSWR 1.28 ≤ 1.5 · 带宽 98 MHz ≥ 80 MHz</p>
            </div>
          </div>
        );
      case "params-algo":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>优化算法参数</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px" }}>
                {[
                  ["优化算法", "遗传算法 (GA)"], ["种群大小", "50"], ["迭代代数", "90"],
                  ["交叉概率", "0.80"], ["变异概率", "0.05"], ["选择策略", "锦标赛选择"],
                  ["精英保留", "5 个体"], ["收敛判据", "适应度变化 < 0.001"], ["运行时间", "~17 秒"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11, color: C.text3 }}>{k}</span>
                    <span style={{ fontSize: 11, color: C.text1, fontWeight: 500, fontFamily: "monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "opt-rect2d":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>S11 回波损耗 (2D 矩形图)</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
              <SvgLineChart data={S11_DATA} xKey="freq" yKey="s11" stroke={C.accent}
                yDomain={[-20, 2]} yTicks={[-20, -15, -10, -5, 0]} xTickIdxs={[0, 20, 40, 60, 80]}
                yFmt={v => `${v}dB`} xFmt={v => `${v.toFixed(1)}G`} />
              <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 10, fontSize: 10, fontFamily: "monospace", color: C.text2 }}>
                <span>最小值: <b style={{ color: C.accent }}>−18.3 dB @ 2.45 GHz</b></span>
                <span>−10 dB 带宽: <b style={{ color: C.green }}>98 MHz (2.40–2.50 GHz)</b></span>
              </div>
            </div>
          </div>
        );
      case "opt-rect3d":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>3D 矩形图 (S参数曲面)</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Surface3D width={440} height={260} />
              <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 10, color: C.text2 }}>
                <span>X轴: 频率 1.5–4.0 GHz</span>
                <span>Y轴: 扫描角度 −180°~180°</span>
                <span>Z轴: |S11| (dB)</span>
              </div>
            </div>
          </div>
        );
      case "opt-polar2d":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>2D 辐射方向图 (极化图)</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <PolarPattern size={280} />
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div className="flex items-center gap-1.5"><div style={{ width: 12, height: 2, background: C.accent }} /><span style={{ fontSize: 10, color: C.text2 }}>E面 (6.2 dBi)</span></div>
                <div className="flex items-center gap-1.5"><div style={{ width: 12, height: 0, borderTop: "2px dashed #34a853" }} /><span style={{ fontSize: 10, color: C.text2 }}>H面</span></div>
              </div>
            </div>
          </div>
        );
      case "opt-polar3d":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>3D 辐射方向图</h3>
            <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Polar3D size={300} />
              <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 10, color: C.text2 }}>
                <span>最大增益: 6.2 dBi</span>
                <span>波束宽度: 68°</span>
                <span>前后比: 14.5 dB</span>
              </div>
            </div>
          </div>
        );
      case "opt-table":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>优化结果表格</h3>
            <div className="rounded-xl overflow-hidden mb-4" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
              <div className="flex items-center" style={{ padding: "10px 16px", background: "#fafbfc", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flex: 1.5, fontSize: 10, fontWeight: 600, color: C.text2 }}>指标</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>优化前</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>优化后</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>改善量</span>
                <span style={{ width: 70, fontSize: 10, fontWeight: 600, color: C.text2, textAlign: "center" }}>状态</span>
              </div>
              {[
                ["S11 @ 2.45GHz", `${p.results.s11} dB`, "-24.7 dB", "↑ 6.4 dB", true],
                ["增益", `${p.results.gain} dBi`, "7.8 dBi", "↑ 1.6 dBi", true],
                ["VSWR", `${p.results.vswr}`, "1.12", "↓ 0.16", true],
                ["−10dB 带宽", `${p.results.bw} MHz`, "143 MHz", "↑ 45 MHz", true],
                ["辐射效率", `${p.results.eff}%`, "92.1%", "↑ 4.8%", true],
                ["输入阻抗", "48.2 Ω", "49.8 Ω", "Δ 1.6 Ω", true],
                ["半功率波束宽", "68°", "64°", "↓ 4°", true],
              ].map(([label, before, after, delta, good], i) => (
                <div key={i} className="flex items-center" style={{ padding: "9px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ flex: 1.5, fontSize: 11, color: C.text1 }}>{label}</span>
                  <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: C.text3 }}>{before}</span>
                  <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: C.text1, fontWeight: 600 }}>{after}</span>
                  <span style={{ flex: 1, fontSize: 10, color: good ? C.green : "#d93025", fontWeight: 600, fontFamily: "monospace" }}>{delta}</span>
                  <span style={{ width: 70, textAlign: "center" }}>
                    <CheckCircle size={13} style={{ color: C.green }} />
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
              <div className="flex items-center" style={{ padding: "10px 16px", background: "#fafbfc", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>频率 (GHz)</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>S11 (dB)</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>VSWR</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>阻抗 (Ω)</span>
              </div>
              {S11_DATA.filter((_, i) => i % 8 === 0).slice(0, 8).map((d, i) => {
                const mag = Math.pow(10, d.s11 / 20);
                const vswr = Math.min((1 + mag) / (1 - mag), 15);
                return (
                  <div key={i} className="flex items-center" style={{ padding: "7px 16px", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: C.text1 }}>{d.freq.toFixed(3)}</span>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: d.s11 < -10 ? C.green : "#d93025", fontWeight: 600 }}>{d.s11.toFixed(2)}</span>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: vswr < 2 ? C.green : "#d93025" }}>{vswr.toFixed(2)}</span>
                    <span style={{ flex: 1, fontSize: 10, fontFamily: "monospace", color: C.text2 }}>{(45 + Math.random() * 10).toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      // ── Design parameter leaf nodes ──
      case "dp-freq":
        return (<div><h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>频段范围设置</h3><div style={{ background: "#fff", borderRadius: 10, border: "1px solid " + C.border, padding: "14px 18px", display: "flex", gap: 20 }}><div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 8 }}>频段参数</p><p style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>在项目创建向导中填写的天线工作频段。</p><div style={{ marginTop: 14, display: "flex", gap: 6 }}><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>确认</button><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: C.text2, background: "#f1f3f4", border: "1px solid " + C.borderA, cursor: "pointer" }}>取消</button></div></div><div style={{ width: 200, background: C.accentD, borderRadius: 12, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="140" height="110" viewBox="0 0 140 110"><circle cx="70" cy="55" r="28" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2" />{[0,60,120,180,240,300].map((deg,i) => { const r=deg*Math.PI/180; return <circle key={i} cx={70+28*Math.cos(r)} cy={55+28*Math.sin(r)} r="2.5" fill={C.accent} />; })}<circle cx="70" cy="55" r="1.5" fill="#333" /><text x="70" y="98" textAnchor="middle" fill={C.text3} fontSize="8">理想点源圆阵</text></svg></div></div></div>);
      case "dp-radiation":
        return (<div><h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>辐射范围设置</h3><div style={{ background: "#fff", borderRadius: 10, border: "1px solid " + C.border, padding: "14px 18px", display: "flex", gap: 20 }}><div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 8 }}>θ / φ 扫描范围</p><p style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>在项目创建向导中填写的辐射方向图扫描角度。</p><div style={{ marginTop: 14, display: "flex", gap: 6 }}><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>确认</button><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: C.text2, background: "#f1f3f4", border: "1px solid " + C.borderA, cursor: "pointer" }}>取消</button></div></div><div style={{ width: 200, background: C.accentD, borderRadius: 12, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="140" height="110" viewBox="0 0 140 110"><circle cx="70" cy="55" r="28" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2" />{[0,60,120,180,240,300].map((deg,i) => { const r=deg*Math.PI/180; return <circle key={i} cx={70+28*Math.cos(r)} cy={55+28*Math.sin(r)} r="2.5" fill={C.accent} />; })}<circle cx="70" cy="55" r="1.5" fill="#333" /><text x="70" y="98" textAnchor="middle" fill={C.text3} fontSize="8">理想点源圆阵</text></svg></div></div></div>);
      case "dp-structure":
        return (<div><h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>设计变量设置</h3><div style={{ background: "#fff", borderRadius: 10, border: "1px solid " + C.border, padding: "14px 18px", display: "flex", gap: 20 }}><div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 8 }}>阵列结构与环境</p><p style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>包含阵元个数、是否均匀阵列、阵列类型等结构参数。</p><div style={{ marginTop: 14, display: "flex", gap: 6 }}><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>确认</button><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: C.text2, background: "#f1f3f4", border: "1px solid " + C.borderA, cursor: "pointer" }}>取消</button></div></div><div style={{ width: 200, background: C.accentD, borderRadius: 12, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="140" height="110" viewBox="0 0 140 110"><circle cx="70" cy="55" r="28" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2" />{[0,60,120,180,240,300].map((deg,i) => { const r=deg*Math.PI/180; return <circle key={i} cx={70+28*Math.cos(r)} cy={55+28*Math.sin(r)} r="2.5" fill={C.accent} />; })}<circle cx="70" cy="55" r="1.5" fill="#333" /><text x="70" y="98" textAnchor="middle" fill={C.text3} fontSize="8">理想点源圆阵</text></svg></div></div></div>);
      case "dp-variables":
        return (<div><h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>目标设置</h3><div style={{ background: "#fff", borderRadius: 10, border: "1px solid " + C.border, padding: "14px 18px", display: "flex", gap: 20 }}><div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 8 }}>优化变量</p><p style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>设置圆阵半径和阵元角度的优化范围。</p><div style={{ marginTop: 14, display: "flex", gap: 6 }}><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>确认</button><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: C.text2, background: "#f1f3f4", border: "1px solid " + C.borderA, cursor: "pointer" }}>取消</button></div></div><div style={{ width: 200, background: C.accentD, borderRadius: 12, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="140" height="110" viewBox="0 0 140 110"><circle cx="70" cy="55" r="28" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2" />{[0,60,120,180,240,300].map((deg,i) => { const r=deg*Math.PI/180; return <circle key={i} cx={70+28*Math.cos(r)} cy={55+28*Math.sin(r)} r="2.5" fill={C.accent} />; })}<circle cx="70" cy="55" r="1.5" fill="#333" /><text x="70" y="98" textAnchor="middle" fill={C.text3} fontSize="8">理想点源圆阵</text></svg></div></div></div>);
      case "dp-objective":
        return (<div><h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>约束设置</h3><div style={{ background: "#fff", borderRadius: 10, border: "1px solid " + C.border, padding: "14px 18px", display: "flex", gap: 20 }}><div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 8 }}>优化目标与约束</p><p style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>设置测向误差目标和约束条件。</p><div style={{ marginTop: 14, display: "flex", gap: 6 }}><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>确认</button><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: C.text2, background: "#f1f3f4", border: "1px solid " + C.borderA, cursor: "pointer" }}>取消</button></div></div><div style={{ width: 200, background: C.accentD, borderRadius: 12, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="140" height="110" viewBox="0 0 140 110"><circle cx="70" cy="55" r="28" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2" />{[0,60,120,180,240,300].map((deg,i) => { const r=deg*Math.PI/180; return <circle key={i} cx={70+28*Math.cos(r)} cy={55+28*Math.sin(r)} r="2.5" fill={C.accent} />; })}<circle cx="70" cy="55" r="1.5" fill="#333" /><text x="70" y="98" textAnchor="middle" fill={C.text3} fontSize="8">理想点源圆阵</text></svg></div></div></div>);
      case "dp-algorithm":
        return (<div><h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>算法参数设置</h3><div style={{ background: "#fff", borderRadius: 10, border: "1px solid " + C.border, padding: "14px 18px", display: "flex", gap: 20 }}><div style={{ flex: 1 }}><p style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 8 }}>优化算法配置</p><p style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>选择 DCNSGA_II/III 算法并设置超参数。</p><div style={{ marginTop: 14, display: "flex", gap: 6 }}><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>确认</button><button className="px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: C.text2, background: "#f1f3f4", border: "1px solid " + C.borderA, cursor: "pointer" }}>取消</button></div></div><div style={{ width: 200, background: C.accentD, borderRadius: 12, padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="140" height="110" viewBox="0 0 140 110"><circle cx="70" cy="55" r="28" fill="none" stroke={C.accent} strokeWidth="1.5" strokeDasharray="4,2" />{[0,60,120,180,240,300].map((deg,i) => { const r=deg*Math.PI/180; return <circle key={i} cx={70+28*Math.cos(r)} cy={55+28*Math.sin(r)} r="2.5" fill={C.accent} />; })}<circle cx="70" cy="55" r="1.5" fill="#333" /><text x="70" y="98" textAnchor="middle" fill={C.text3} fontSize="8">理想点源圆阵</text></svg></div></div></div>);
      case "opt-results-table":
        return (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text1, marginBottom: 14 }}>目标结果表格</h3>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid " + C.border, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflowX: "auto" }}>
              {optResults ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#fafbfc", borderBottom: "1px solid " + C.border }}>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: C.text2, fontSize: 10, whiteSpace: "nowrap" }}>序号</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: C.text2, fontSize: 10, whiteSpace: "nowrap" }}>约束条件</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: C.text2, fontSize: 10, whiteSpace: "nowrap" }}>总增益</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: C.text2, fontSize: 10, whiteSpace: "nowrap" }}>驻波比</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, color: C.text2, fontSize: 10, whiteSpace: "nowrap" }}>pheno(a,b,wlength,a1,b1,plength)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optResults.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: "1px solid " + C.border, background: ri % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontFamily: "monospace", color: C.text1, fontWeight: 500 }}>{row.idx}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                            color: row.constraint === "满足" ? C.green : "#d93025",
                            background: row.constraint === "满足" ? "rgba(52,168,83,0.1)" : "rgba(217,48,37,0.1)",
                          }}>{row.constraint}</span>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontFamily: "monospace", color: C.text1 }}>{row.totalGain || "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontFamily: "monospace", color: C.text1 }}>{row.vswr || "—"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center", fontFamily: "monospace", color: C.text2, fontSize: 10 }}>{row.pheno || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: C.text3, fontSize: 12 }}>暂无优化结果数据</div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa" }}>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      <div className="flex items-center gap-2 flex-shrink-0"
        style={{ padding: "0 20px", height: 38, background: "#fff", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} className="flex items-center gap-1"
          style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
          <ChevronLeft size={13} />项目列表
        </button>
        <ChevronRight size={11} style={{ color: C.text3 }} />
        <span style={{ fontSize: 12, color: C.text1, fontWeight: 500 }}>{project.title}</span>
        <span className="flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded"
          style={{ fontSize: 10, color: C.accent, background: C.accentD, border: `1px solid rgba(26,115,232,0.2)` }}>
          {project.tag}
        </span>
        <div style={{ flex: 1 }} />
        {/* ── Optimization control buttons ── */}
        {optStatus === "idle" && (
          <button onClick={handleStartOpt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
            <Play size={12} />启动
          </button>
        )}
        {(optStatus === "running" || optStatus === "paused") && (
          <>
            {optStatus === "running" ? (
              <button onClick={handlePauseOpt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mr-2"
                style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.amber, border: "none", cursor: "pointer" }}>
                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><rect x="0" y="0" width="3.5" height="12" rx="0.5"/><rect x="6.5" y="0" width="3.5" height="12" rx="0.5"/></svg>暂停
              </button>
            ) : (
              <button onClick={handleStartOpt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mr-2"
                style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
                <Play size={12} />继续
              </button>
            )}
            <button onClick={handleStopOpt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
              style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: "#d93025", border: "none", cursor: "pointer" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="0" y="0" width="10" height="10" rx="1"/></svg>停止
            </button>
          </>
        )}
        {optStatus === "completed" && (
          <button onClick={handleStopOpt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ fontSize: 12, fontWeight: 500, color: C.text2, background: "#f1f3f4", border: `1px solid ${C.borderA}`, cursor: "pointer" }}>
            <RefreshCw size={12} />重置
          </button>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* ── Resizable tree sidebar ── */}
        <div ref={sidebarRef} style={{ width: sidebarW, height: "100%", background: "#fff", borderRight: `1px solid ${C.border}`, overflow: "auto", scrollbarWidth: "none", flexShrink: 0, paddingTop: 6, paddingBottom: 12, position: "relative" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#fff" }}>
            <p style={{ fontSize: 10, color: C.text3, padding: "0 12px 6px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.title}</p>
          </div>
          <div style={{ ['--sidebar-width' as string]: `${sidebarW}px` } as React.CSSProperties}>
            <FileTree tree={displayTree} selected={selectedNode} onSelect={handleTreeSelect} level={0}
              onMoreClick={handleMoreClick} />
          </div>
        </div>

        {/* ── Draggable splitter ── */}
        <div
          onMouseDown={onMouseDown}
          style={{
            width: 5, flexShrink: 0, cursor: "col-resize",
            background: dragging.current ? C.accent : "transparent",
            zIndex: 5,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.accent)}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
        </div>

        {/* ── Content panel ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px", scrollbarWidth: "none" }}>
          {selNode ? renderContent() : (
            /* Default: show template image */
            <div className="flex flex-col items-center justify-center h-full" style={{ gap: 16 }}>
              <div style={{ background: C.accentD, borderRadius: 14, padding: "30px 40px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <img src="./template-horn.png" alt="天线模板" style={{ width: "100%", maxWidth: 480, borderRadius: 14 }} />
              </div>
              {optStatus === "idle" && (
                <p style={{ fontSize: 11, color: C.text3 }}>从左侧文件树选择节点查看详情</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Optimization console (bottom of page) — hidden when completed ── */}
      {optStatus !== "idle" && optStatus !== "completed" && (
        <div className="flex-shrink-0" style={{ background: "#fff", borderTop: `1px solid ${C.border}`, padding: "10px 20px" }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: optStatus === "running" ? C.green : optStatus === "paused" ? C.amber : optStatus === "completed" ? C.accent : C.text3 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text1 }}>
                {optStatus === "running" ? "优化进行中…" : optStatus === "paused" ? "优化已暂停" : optStatus === "completed" ? "优化完成 ✓" : ""}
              </span>
            </div>
            <span style={{ fontSize: 10, color: C.text3 }}>{optLogs.length} / {ALL_OPT_LOGS.length} 条日志</span>
          </div>
          <div style={{
            background: "#fff", borderRadius: 8, border: `1px solid ${C.borderA}`,
            padding: "10px 14px", maxHeight: 160, overflowY: "auto", scrollbarWidth: "thin",
            fontFamily: "Consolas, 'Courier New', monospace", fontSize: 11, lineHeight: 1.7, color: C.text1,
          }}>
            {optLogs.length === 0 && (
              <div style={{ color: C.text3, fontStyle: "italic" }}>等待优化启动…</div>
            )}
            {optLogs.map((line, i) => (
              <div key={i} style={{
                color: line.includes("✓") || line.includes("完成") || line.includes("改善") ? C.green : line.includes("✗") ? "#d93025" : line.includes("第") && line.includes("代") ? C.accent : C.text1,
              }}>
                {line}
              </div>
            ))}
            {optStatus === "running" && (
              <div style={{ color: C.accent, marginTop: 2 }}>
                <span style={{ animation: "blink 1s step-end infinite" }}>▌</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Parameter settings popup modal (NewProjectWizard in edit mode) ── */}
      {paramPopup && (
        <NewProjectWizard
          projectFolder={project.title}
          onBack={() => setParamPopup(null)}
          onCreate={() => setParamPopup(null)}
          editMode
          editStepId={paramPopup}
          onCancel={() => setParamPopup(null)}
          onConfirm={() => setParamPopup(null)}
        />
      )}

      {/* ── 2D 矩形图 parameter settings modal ── */}
      {rect2dModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.15)" }}>
          <div className="rounded-xl overflow-hidden" style={{ width: 1020, maxHeight: "85%", background: "#fff", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ borderBottom: "1px solid " + C.border }}>
              <div className="flex items-center justify-between px-6 py-3">
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>二维矩形图参数设置</span>
                <button onClick={() => setRect2dModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", background: "#fff", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Row: Frequency Sweep — dropdown fills to right edge */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Frequency Sweep：</span>
                <select value={rect2dFreqSweep} onChange={e => setRect2dFreqSweep(e.target.value)}
                  style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                  <option value="Sweep1">Sweep1</option>
                </select>
              </div>

              {/* Row: Primary Sweep — two dropdowns side by side, ALL fills to right edge */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Primary Sweep：</span>
                <select value={rect2dPrimary} onChange={e => { setRect2dPrimary(e.target.value); setRect2dPrimarySelected("ALL"); }}
                  style={{ width: 120, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  {["Phi","Theta","Freq"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                    {rect2dPrimarySelected}
                  </div>
                  <button onClick={() => { setRect2dPrimaryPopup(true); setRect2dPopupMode("all"); }}
                    style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", cursor: "pointer" }}>…</button>
                </div>
              </div>

              {/* ── Primary Sweep value picker popup ── */}
              {rect2dPrimaryPopup && (() => {
                const sweepVals = getSweepValues(rect2dPrimary);
                return (
                  <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                    <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                      <div style={{ borderBottom: "1px solid " + C.border }}>
                        <div className="flex items-center justify-between px-5 py-3">
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values</span>
                          <button onClick={() => setRect2dPrimaryPopup(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                        </div>
                      </div>
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="rect2dPopupMode" checked={rect2dPopupMode === "all"} onChange={() => setRect2dPopupMode("all")} />Use All Values
                        </label>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="rect2dPopupMode" checked={rect2dPopupMode === "select"} onChange={() => setRect2dPopupMode("select")} />Select Values
                        </label>
                      </div>
                      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                        {sweepVals.map(v => {
                          const sel = rect2dPopupSel === v;
                          const hilite = rect2dPopupMode === "all" || sel;
                          return (
                            <button key={v}
                              onClick={() => {
                                if (rect2dPopupMode === "all") return;
                                setRect2dPopupSel(v);
                              }}
                              style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "6px 24px", fontSize: 12,
                                color: hilite ? C.accent : C.text2,
                                background: sel ? C.accentD : "transparent",
                                border: "none", cursor: rect2dPopupMode === "all" ? "default" : "pointer",
                                opacity: hilite ? 1 : 0.4,
                              }}>
                              {v}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                        <button onClick={() => setRect2dPrimaryPopup(false)}
                          style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                        <button onClick={() => {
                          if (rect2dPopupMode === "all") setRect2dPrimarySelected("ALL");
                          else setRect2dPrimarySelected(rect2dPopupSel || sweepVals[0]);
                          setRect2dPrimaryPopup(false);
                        }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                          style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Row: X — display box */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>X：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                  {rect2dPrimary}
                </div>
              </div>

              {/* Row: Y — display box */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Y：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                  {rect2dFunction}({(rect2dValueMode === "all" ? CATEGORY_GROUPS[rect2dCategory] : rect2dSubItems).join(", ")})
                </div>
              </div>

              {/* Three-column panel */}
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <div style={{ flex: 1.3, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Category</div>
                  <div style={{ padding: "4px 0" }}>
                    {CATEGORY_NAMES.map(cat => (
                      <button key={cat} onClick={() => { setRect2dCategory(cat); setRect2dSubItems([CATEGORY_GROUPS[cat][0]]); setRect2dFunction(FUNCTION_OPTIONS[cat][0]); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", fontSize: 11,
                          color: rect2dCategory === cat ? C.accent : C.text1,
                          background: rect2dCategory === cat ? C.accentD : "transparent",
                          border: "none", cursor: "pointer", fontWeight: rect2dCategory === cat ? 600 : 400 }}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, display: "flex", gap: 16 }}>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="rect2dValues" checked={rect2dValueMode === "all"} onChange={() => setRect2dValueMode("all")} />Use all values
                    </label>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="rect2dValues" checked={rect2dValueMode === "select"} onChange={() => setRect2dValueMode("select")} />Select values
                    </label>
                  </div>
                  <div style={{ padding: "4px 0" }}>
                    {(CATEGORY_GROUPS[rect2dCategory] || []).map(item => {
                      const checked = rect2dValueMode === "all" || rect2dSubItems.includes(item);
                      return (
                        <button key={item} onClick={() => {
                          if (rect2dValueMode === "all") return;
                          setRect2dSubItems(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]);
                        }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 14px", fontSize: 11,
                            color: checked ? C.accent : C.text1,
                            background: checked ? C.accentD : "transparent",
                            border: "none", cursor: rect2dValueMode === "all" ? "default" : "pointer", fontWeight: checked ? 600 : 400 }}>{item}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 0.8, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Function</div>
                  <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {(FUNCTION_OPTIONS[rect2dCategory] || ["None"]).map(fn => (
                      <label key={fn} style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="radio" name="rect2dFunc" checked={rect2dFunction === fn} onChange={() => setRect2dFunction(fn)} />{fn}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Families — dynamic rows based on Primary Sweep */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>Families：</span>
                <div className="rounded-lg overflow-hidden mt-2" style={{ border: "1px solid " + C.border }}>
                  <div className="flex items-center" style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 10, fontWeight: 600, color: C.text2, gap: 6 }}>
                    <span style={{ width: 80, flexShrink: 0 }}>Variable</span>
                    <span style={{ flex: 1 }}>Values</span>
                    <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>Edit</span>
                  </div>
                  {remainingKeys(rect2dPrimary).map((key, idx) => (
                    <div key={key} className="flex items-center" style={{ padding: "5px 12px", gap: 6, fontSize: 11, color: C.text1, borderBottom: idx === 0 ? "1px solid " + C.border : "none" }}>
                      <span style={{ width: 80, flexShrink: 0, fontWeight: 500 }}>{FAMILY_LABELS[key]}</span>
                      <div style={{ flex: 1, padding: "4px 8px", fontSize: 11, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 4, background: "#f8f9fa", textAlign: "center" }}>
                        {rect2dFamVals[key] || "ALL"}
                      </div>
                      <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                        <button onClick={() => { setRect2dFamPopup(key); setRect2dFamPopupMode("all"); }}
                          style={{ fontSize: 16, background: "transparent", border: "none", cursor: "pointer", color: C.text2, padding: 0 }}>…</button>
                      </span>
                    </div>
                  ))}
                </div>
                {/* Families value picker popup */}
                {rect2dFamPopup && (() => {
                  const vals = SWEEP_VALUES[rect2dFamPopup as FamKey] || [];
                  return (
                    <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                      <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                        <div style={{ borderBottom: "1px solid " + C.border }}>
                          <div className="flex items-center justify-between px-5 py-3">
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {rect2dFamPopup}</span>
                            <button onClick={() => setRect2dFamPopup(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                          </div>
                        </div>
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="rect2dFamMode" checked={rect2dFamPopupMode === "all"} onChange={() => setRect2dFamPopupMode("all")} />Use All Values
                          </label>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="rect2dFamMode" checked={rect2dFamPopupMode === "select"} onChange={() => setRect2dFamPopupMode("select")} />Select Values
                          </label>
                        </div>
                        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                          {vals.map(v => {
                            const sel = rect2dFamPopupSel === v;
                            const hilite = rect2dFamPopupMode === "all" || sel;
                            return (
                              <button key={v} onClick={() => { if (rect2dFamPopupMode === "all") return; setRect2dFamPopupSel(v); }}
                                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12,
                                  color: hilite ? C.accent : C.text2, background: sel ? C.accentD : "transparent",
                                  border: "none", cursor: rect2dFamPopupMode === "all" ? "default" : "pointer", opacity: hilite ? 1 : 0.4 }}>{v}</button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                          <button onClick={() => setRect2dFamPopup(null)}
                            style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                          <button onClick={() => {
                            if (rect2dFamPopupMode === "all") setRect2dFamVals(prev => ({ ...prev, [rect2dFamPopup!]: "ALL" }));
                            else setRect2dFamVals(prev => ({ ...prev, [rect2dFamPopup!]: rect2dFamPopupSel || vals[0] }));
                            setRect2dFamPopup(null);
                          }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                            style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
              <button onClick={() => setRect2dModal(false)}
                style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>关闭</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  <Download size={13} />导出
                </button>
                <button onClick={() => {
                  const label = `${rect2dSubItems.join(", ")}-二维矩形图`;
                  const fileId = `gen-${Date.now()}`;
                  const folderId = "folder-rect2d";
                  setGenNodes(prev => {
                    const next = [...prev];
                    // Ensure folder exists
                    if (!next.some(g => g.id === folderId)) {
                      next.push({ parentId: "results", id: folderId, label: "二维矩形图", icon: FolderOpen, isFolder: true });
                    }
                    // Add file under folder
                    next.push({ parentId: folderId, id: fileId, label, icon: Activity });
                    return next;
                  });
                  setRect2dModal(false);
                }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
                  <CheckCircle size={13} />生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D 矩形图 parameter settings modal (原始 / 插值) ── */}
      {rect3dModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.15)" }}>
          <div className="rounded-xl overflow-hidden" style={{ width: 1020, maxHeight: "85%", background: "#fff", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ borderBottom: "1px solid " + C.border }}>
              <div className="flex items-center justify-between px-6 py-3">
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>三维矩形图参数设置</span>
                <button onClick={() => setRect3dModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", background: "#fff", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 12 }}>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Frequency Sweep：</span>
                <select value={rect3dFreqSweep} onChange={e => setRect3dFreqSweep(e.target.value)}
                  style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                  <option value="Sweep1">Sweep1</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Primary Sweep：</span>
                <select value={rect3dPrimary} onChange={e => { setRect3dPrimary(e.target.value); setRect3dPrimarySelected("ALL"); }}
                  style={{ width: 120, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  {["Phi","Theta","Freq"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                    {rect3dPrimarySelected}
                  </div>
                  <button onClick={() => { setRect3dPrimaryPopup(true); setRect3dPopupMode("all"); }}
                    style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", cursor: "pointer" }}>…</button>
                </div>
              </div>

              {/* Primary popup */}
              {rect3dPrimaryPopup && (() => {
                const vals: string[] = [];
                if (rect3dPrimary === "Phi") for (let d = 0; d <= 360; d += 10) vals.push(`${d}°`);
                else if (rect3dPrimary === "Theta") for (let d = -30; d <= 30; d += 5) vals.push(`${d}°`);
                else for (let m = 1700; m <= 2600; m += 100) vals.push(`${m.toFixed(2)}MHz`);
                return (
                  <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                    <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                      <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {rect3dPrimary}</span>
                        <button onClick={() => setRect3dPrimaryPopup(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                      </div></div>
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="rect3dPop" checked={rect3dPopupMode === "all"} onChange={() => setRect3dPopupMode("all")} />Use All Values
                        </label>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="rect3dPop" checked={rect3dPopupMode === "select"} onChange={() => setRect3dPopupMode("select")} />Select Values
                        </label>
                      </div>
                      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                        {vals.map(v => { const sel = rect3dPopupSel === v; const h = rect3dPopupMode === "all" || sel;
                          return (<button key={v} onClick={() => { if (rect3dPopupMode === "all") return; setRect3dPopupSel(v); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12, color: h ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none", cursor: rect3dPopupMode === "all" ? "default" : "pointer", opacity: h ? 1 : 0.4 }}>{v}</button>); })}
                      </div>
                      <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                        <button onClick={() => setRect3dPrimaryPopup(false)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                        <button onClick={() => { if (rect3dPopupMode === "all") setRect3dPrimarySelected("ALL"); else setRect3dPrimarySelected(rect3dPopupSel || vals[0]); setRect3dPrimaryPopup(false); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                      </div>
                    </div>
                  </div>
                );})()}

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Secondary Sweep：</span>
                <select value={rect3dSecondary} onChange={e => { setRect3dSecondary(e.target.value); setRect3dSecondarySelected("ALL"); }}
                  style={{ width: 120, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  {["Phi","Theta","Freq"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                    {rect3dSecondarySelected}
                  </div>
                  <button onClick={() => { setRect3dSecondaryPopup(true); setRect3dSecPopupMode("all"); }}
                    style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", cursor: "pointer" }}>…</button>
                </div>
              </div>

              {/* Secondary popup */}
              {rect3dSecondaryPopup && (() => {
                const vals: string[] = [];
                if (rect3dSecondary === "Phi") for (let d = 0; d <= 360; d += 10) vals.push(`${d}°`);
                else if (rect3dSecondary === "Theta") for (let d = -30; d <= 30; d += 5) vals.push(`${d}°`);
                else for (let m = 1700; m <= 2600; m += 100) vals.push(`${m.toFixed(2)}MHz`);
                return (
                  <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                    <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                      <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {rect3dSecondary}</span>
                        <button onClick={() => setRect3dSecondaryPopup(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                      </div></div>
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="rect3dSecPop" checked={rect3dSecPopupMode === "all"} onChange={() => setRect3dSecPopupMode("all")} />Use All Values
                        </label>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="rect3dSecPop" checked={rect3dSecPopupMode === "select"} onChange={() => setRect3dSecPopupMode("select")} />Select Values
                        </label>
                      </div>
                      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                        {vals.map(v => { const sel = rect3dSecPopupSel === v; const h = rect3dSecPopupMode === "all" || sel;
                          return (<button key={v} onClick={() => { if (rect3dSecPopupMode === "all") return; setRect3dSecPopupSel(v); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12, color: h ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none", cursor: rect3dSecPopupMode === "all" ? "default" : "pointer", opacity: h ? 1 : 0.4 }}>{v}</button>); })}
                      </div>
                      <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                        <button onClick={() => setRect3dSecondaryPopup(false)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                        <button onClick={() => { if (rect3dSecPopupMode === "all") setRect3dSecondarySelected("ALL"); else setRect3dSecondarySelected(rect3dSecPopupSel || vals[0]); setRect3dSecondaryPopup(false); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                      </div>
                    </div>
                  </div>
                );})()}

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>X：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                  {rect3dPrimary}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Y：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                  {rect3dSecondary}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Z：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                  {rect3dFunction}({(rect3dValueMode === "all" ? CATEGORY_GROUPS[rect3dCategory] : rect3dSubItems).join(", ")})
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <div style={{ flex: 1.3, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Category</div>
                  <div style={{ padding: "4px 0" }}>
                    {CATEGORY_NAMES.map(cat => (
                      <button key={cat} onClick={() => { setRect3dCategory(cat); setRect3dSubItems([CATEGORY_GROUPS[cat][0]]); setRect3dFunction(FUNCTION_OPTIONS[cat][0]); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", fontSize: 11,
                          color: rect3dCategory === cat ? C.accent : C.text1,
                          background: rect3dCategory === cat ? C.accentD : "transparent",
                          border: "none", cursor: "pointer", fontWeight: rect3dCategory === cat ? 600 : 400 }}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, display: "flex", gap: 16 }}>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="rect3dValues" checked={rect3dValueMode === "all"} onChange={() => setRect3dValueMode("all")} />Use all values
                    </label>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="rect3dValues" checked={rect3dValueMode === "select"} onChange={() => setRect3dValueMode("select")} />Select values
                    </label>
                  </div>
                  <div style={{ padding: "4px 0" }}>
                    {(CATEGORY_GROUPS[rect3dCategory] || []).map(item => {
                      const checked = rect3dValueMode === "all" || rect3dSubItems.includes(item);
                      return (
                        <button key={item} onClick={() => {
                          if (rect3dValueMode === "all") return;
                          setRect3dSubItems(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]);
                        }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 14px", fontSize: 11,
                            color: checked ? C.accent : C.text1,
                            background: checked ? C.accentD : "transparent",
                            border: "none", cursor: rect3dValueMode === "all" ? "default" : "pointer", fontWeight: checked ? 600 : 400 }}>{item}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 0.8, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Function</div>
                  <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {(FUNCTION_OPTIONS[rect3dCategory] || ["None"]).map(fn => (
                      <label key={fn} style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="radio" name="rect3dFunc" checked={rect3dFunction === fn} onChange={() => setRect3dFunction(fn)} />{fn}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>Families：</span>
                <div className="rounded-lg overflow-hidden mt-2" style={{ border: "1px solid " + C.border }}>
                  <div className="flex items-center" style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 10, fontWeight: 600, color: C.text2, gap: 6 }}>
                    <span style={{ width: 80, flexShrink: 0 }}>Variable</span>
                    <span style={{ flex: 1 }}>Values</span>
                    <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>Edit</span>
                  </div>
                  {ALL_FAM_KEYS.filter(k => k !== rect3dPrimary && k !== rect3dSecondary).map((key, idx) => (
                    <div key={key} className="flex items-center" style={{ padding: "5px 12px", gap: 6, fontSize: 11, color: C.text1, borderBottom: idx === 0 ? "1px solid " + C.border : "none" }}>
                      <span style={{ width: 80, flexShrink: 0, fontWeight: 500 }}>{FAMILY_LABELS[key]}</span>
                      <div style={{ flex: 1, padding: "4px 8px", fontSize: 11, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 4, background: "#f8f9fa", textAlign: "center" }}>
                        {rect3dFamVals[key] || SWEEP_VALUES[key]?.[0] || "ALL"}
                      </div>
                      <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                        <button onClick={() => { setRect3dFamPopup(key); setRect3dFamPopupMode("all"); }}
                          style={{ fontSize: 16, background: "transparent", border: "none", cursor: "pointer", color: C.text2, padding: 0 }}>…</button>
                      </span>
                    </div>
                  ))}
                </div>
                {rect3dFamPopup && (() => {
                  const vals = SWEEP_VALUES[rect3dFamPopup as FamKey] || [];
                  return (
                    <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                      <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                        <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {rect3dFamPopup}</span>
                          <button onClick={() => setRect3dFamPopup(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                        </div></div>
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="rect3dFamMode" checked={rect3dFamPopupMode === "all"} onChange={() => setRect3dFamPopupMode("all")} />Use All Values
                          </label>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="rect3dFamMode" checked={rect3dFamPopupMode === "select"} onChange={() => setRect3dFamPopupMode("select")} />Select Values
                          </label>
                        </div>
                        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                          {vals.map(v => {
                            const sel = rect3dFamPopupSel === v; const hilite = rect3dFamPopupMode === "all" || sel;
                            return (<button key={v} onClick={() => { if (rect3dFamPopupMode === "all") return; setRect3dFamPopupSel(v); }}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12,
                                color: hilite ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none",
                                cursor: rect3dFamPopupMode === "all" ? "default" : "pointer", opacity: hilite ? 1 : 0.4 }}>{v}</button>);
                          })}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                          <button onClick={() => setRect3dFamPopup(null)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                          <button onClick={() => {
                            if (rect3dFamPopupMode === "all") setRect3dFamVals(prev => ({ ...prev, [rect3dFamPopup!]: "ALL" }));
                            else setRect3dFamVals(prev => ({ ...prev, [rect3dFamPopup!]: rect3dFamPopupSel || vals[0] }));
                            setRect3dFamPopup(null);
                          }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
              <button onClick={() => setRect3dModal(false)}
                style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>关闭</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  <Download size={13} />导出
                </button>
                <button onClick={() => {
                  const label = `${rect3dSubItems.join(", ")}-三维矩形图`;
                  const fileId = `gen-${Date.now()}`;
                  const folderId = "folder-rect3d";
                  const folderLabel = "三维矩形图";
                  setGenNodes(prev => {
                    const next = [...prev];
                    if (!next.some(g => g.id === folderId)) {
                      next.push({ parentId: "results", id: folderId, label: folderLabel, icon: FolderOpen, isFolder: true });
                    }
                    next.push({ parentId: folderId, id: fileId, label, icon: Activity });
                    return next;
                  });
                  setRect3dModal(false);
                }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
                  <CheckCircle size={13} />生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2D 极化图 parameter settings modal ── */}
      {polar2dModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.15)" }}>
          <div className="rounded-xl overflow-hidden" style={{ width: 1020, maxHeight: "85%", background: "#fff", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ borderBottom: "1px solid " + C.border }}>
              <div className="flex items-center justify-between px-6 py-3">
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>二维极化图参数设置</span>
                <button onClick={() => setPolar2dModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", background: "#fff", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 12 }}>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Frequency Sweep：</span>
                <select value={polar2dFreqSweep} onChange={e => setPolar2dFreqSweep(e.target.value)}
                  style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                  <option value="Sweep1">Sweep1</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Primary Sweep：</span>
                <select value={polar2dPrimary} onChange={e => { setPolar2dPrimary(e.target.value); setPolar2dPrimarySelected("ALL"); }}
                  style={{ width: 120, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  {["Phi","Theta","Freq"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                    {polar2dPrimarySelected}
                  </div>
                  <button onClick={() => { setPolar2dPrimaryPopup(true); setPolar2dPopupMode("all"); }}
                    style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", cursor: "pointer" }}>…</button>
                </div>
              </div>

              {polar2dPrimaryPopup && (() => {
                const vals = getSweepValues(polar2dPrimary);
                return (
                  <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                    <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                      <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {polar2dPrimary}</span>
                        <button onClick={() => setPolar2dPrimaryPopup(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                      </div></div>
                      <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="polar2dPop" checked={polar2dPopupMode === "all"} onChange={() => setPolar2dPopupMode("all")} />Use All Values
                        </label>
                        <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="polar2dPop" checked={polar2dPopupMode === "select"} onChange={() => setPolar2dPopupMode("select")} />Select Values
                        </label>
                      </div>
                      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                        {vals.map(v => { const sel = polar2dPopupSel === v; const h = polar2dPopupMode === "all" || sel;
                          return (<button key={v} onClick={() => { if (polar2dPopupMode === "all") return; setPolar2dPopupSel(v); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12, color: h ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none", cursor: polar2dPopupMode === "all" ? "default" : "pointer", opacity: h ? 1 : 0.4 }}>{v}</button>); })}
                      </div>
                      <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                        <button onClick={() => setPolar2dPrimaryPopup(false)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                        <button onClick={() => { if (polar2dPopupMode === "all") setPolar2dPrimarySelected("ALL"); else setPolar2dPrimarySelected(polar2dPopupSel || vals[0]); setPolar2dPrimaryPopup(false); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                      </div>
                    </div>
                  </div>
                );})()}

              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Polar：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                  {polar2dFunction}({(polar2dValueMode === "all" ? CATEGORY_GROUPS[polar2dCategory] : polar2dSubItems).join(", ")})
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <div style={{ flex: 1.3, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Category</div>
                  <div style={{ padding: "4px 0" }}>
                    {CATEGORY_NAMES.map(cat => (
                      <button key={cat} onClick={() => { setPolar2dCategory(cat); setPolar2dSubItems([CATEGORY_GROUPS[cat][0]]); setPolar2dFunction(FUNCTION_OPTIONS[cat][0]); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", fontSize: 11,
                          color: polar2dCategory === cat ? C.accent : C.text1,
                          background: polar2dCategory === cat ? C.accentD : "transparent",
                          border: "none", cursor: "pointer", fontWeight: polar2dCategory === cat ? 600 : 400 }}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, display: "flex", gap: 16 }}>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="polar2dValues" checked={polar2dValueMode === "all"} onChange={() => setPolar2dValueMode("all")} />Use all values
                    </label>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="polar2dValues" checked={polar2dValueMode === "select"} onChange={() => setPolar2dValueMode("select")} />Select values
                    </label>
                  </div>
                  <div style={{ padding: "4px 0" }}>
                    {(CATEGORY_GROUPS[polar2dCategory] || []).map(item => {
                      const checked = polar2dValueMode === "all" || polar2dSubItems.includes(item);
                      return (
                        <button key={item} onClick={() => {
                          if (polar2dValueMode === "all") return;
                          setPolar2dSubItems(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]);
                        }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 14px", fontSize: 11,
                            color: checked ? C.accent : C.text1,
                            background: checked ? C.accentD : "transparent",
                            border: "none", cursor: polar2dValueMode === "all" ? "default" : "pointer", fontWeight: checked ? 600 : 400 }}>{item}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 0.8, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Function</div>
                  <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {(FUNCTION_OPTIONS[polar2dCategory] || ["None"]).map(fn => (
                      <label key={fn} style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="radio" name="polar2dFunc" checked={polar2dFunction === fn} onChange={() => setPolar2dFunction(fn)} />{fn}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>Families：</span>
                <div className="rounded-lg overflow-hidden mt-2" style={{ border: "1px solid " + C.border }}>
                  <div className="flex items-center" style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 10, fontWeight: 600, color: C.text2, gap: 6 }}>
                    <span style={{ width: 80, flexShrink: 0 }}>Variable</span>
                    <span style={{ flex: 1 }}>Values</span>
                    <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>Edit</span>
                  </div>
                  {remainingKeys(polar2dPrimary).map((key, idx) => (
                    <div key={key} className="flex items-center" style={{ padding: "5px 12px", gap: 6, fontSize: 11, color: C.text1, borderBottom: idx === 0 ? "1px solid " + C.border : "none" }}>
                      <span style={{ width: 80, flexShrink: 0, fontWeight: 500 }}>{FAMILY_LABELS[key]}</span>
                      <div style={{ flex: 1, padding: "4px 8px", fontSize: 11, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 4, background: "#f8f9fa", textAlign: "center" }}>
                        {polar2dFamVals[key] || "ALL"}
                      </div>
                      <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                        <button onClick={() => { setPolar2dFamPopup(key); setPolar2dFamPopupMode("all"); }}
                          style={{ fontSize: 16, background: "transparent", border: "none", cursor: "pointer", color: C.text2, padding: 0 }}>…</button>
                      </span>
                    </div>
                  ))}
                </div>
                {polar2dFamPopup && (() => {
                  const vals = SWEEP_VALUES[polar2dFamPopup as FamKey] || [];
                  return (
                    <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                      <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                        <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {polar2dFamPopup}</span>
                          <button onClick={() => setPolar2dFamPopup(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                        </div></div>
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="polar2dFamMode" checked={polar2dFamPopupMode === "all"} onChange={() => setPolar2dFamPopupMode("all")} />Use All Values
                          </label>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="polar2dFamMode" checked={polar2dFamPopupMode === "select"} onChange={() => setPolar2dFamPopupMode("select")} />Select Values
                          </label>
                        </div>
                        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                          {vals.map(v => {
                            const sel = polar2dFamPopupSel === v; const hilite = polar2dFamPopupMode === "all" || sel;
                            return (<button key={v} onClick={() => { if (polar2dFamPopupMode === "all") return; setPolar2dFamPopupSel(v); }}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12,
                                color: hilite ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none",
                                cursor: polar2dFamPopupMode === "all" ? "default" : "pointer", opacity: hilite ? 1 : 0.4 }}>{v}</button>);
                          })}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                          <button onClick={() => setPolar2dFamPopup(null)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                          <button onClick={() => {
                            if (polar2dFamPopupMode === "all") setPolar2dFamVals(prev => ({ ...prev, [polar2dFamPopup!]: "ALL" }));
                            else setPolar2dFamVals(prev => ({ ...prev, [polar2dFamPopup!]: polar2dFamPopupSel || vals[0] }));
                            setPolar2dFamPopup(null);
                          }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
              <button onClick={() => setPolar2dModal(false)}
                style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>关闭</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  <Download size={13} />导出
                </button>
                <button onClick={() => {
                  const label = `${polar2dSubItems.join(", ")}-二维极化图`;
                  const fileId = `gen-${Date.now()}`;
                  const folderId = "folder-polar2d";
                  setGenNodes(prev => {
                    const next = [...prev];
                    if (!next.some(g => g.id === folderId)) {
                      next.push({ parentId: "results", id: folderId, label: "二维极化图", icon: FolderOpen, isFolder: true });
                    }
                    next.push({ parentId: folderId, id: fileId, label, icon: Activity });
                    return next;
                  });
                  setPolar2dModal(false);
                }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
                  <CheckCircle size={13} />生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D 极化图 parameter settings modal ── */}
      {polar3dModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.15)" }}>
          <div className="rounded-xl overflow-hidden" style={{ width: 1020, maxHeight: "85%", background: "#fff", boxShadow: "0 16px 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ borderBottom: "1px solid " + C.border }}>
              <div className="flex items-center justify-between px-6 py-3">
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>三维极化图参数设置</span>
                <button onClick={() => setPolar3dModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", background: "#fff", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Frequency Sweep：</span>
                <select value={polar3dFreqSweep} onChange={e => setPolar3dFreqSweep(e.target.value)}
                  style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                  <option value="Sweep1">Sweep1</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Primary Sweep：</span>
                <select value={polar3dPrimary} onChange={e => { setPolar3dPrimary(e.target.value); setPolar3dPrimarySelected("ALL"); }}
                  style={{ width: 120, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  {["Phi","Theta","Freq"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>{polar3dPrimarySelected}</div>
                  <button onClick={() => { setPolar3dPrimaryPopup(true); setPolar3dPriPopupMode("all"); }}
                    style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", cursor: "pointer" }}>…</button>
                </div>
              </div>
              {polar3dPrimaryPopup && (() => { const vals = getSweepValues(polar3dPrimary); return (
                <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                  <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                    <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {polar3dPrimary}</span>
                      <button onClick={() => setPolar3dPrimaryPopup(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                    </div></div>
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                      <label style={{ fontSize: 11 }}><input type="radio" name="polar3dPri" checked={polar3dPriPopupMode === "all"} onChange={() => setPolar3dPriPopupMode("all")} /> Use All Values</label>
                      <label style={{ fontSize: 11 }}><input type="radio" name="polar3dPri" checked={polar3dPriPopupMode === "select"} onChange={() => setPolar3dPriPopupMode("select")} /> Select Values</label>
                    </div>
                    <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0" }}>
                      {vals.map(v => { const sel = polar3dPriPopupSel === v; const h = polar3dPriPopupMode === "all" || sel;
                        return (<button key={v} onClick={() => { if (polar3dPriPopupMode === "all") return; setPolar3dPriPopupSel(v); }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12, color: h ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none", cursor: polar3dPriPopupMode === "all" ? "default" : "pointer", opacity: h ? 1 : 0.4 }}>{v}</button>); })}
                    </div>
                    <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                      <button onClick={() => setPolar3dPrimaryPopup(false)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                      <button onClick={() => { if (polar3dPriPopupMode === "all") setPolar3dPrimarySelected("ALL"); else setPolar3dPrimarySelected(polar3dPriPopupSel || vals[0]); setPolar3dPrimaryPopup(false); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                    </div>
                  </div>
                </div>); })()}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Secondary Sweep：</span>
                <select value={polar3dSecondary} onChange={e => { setPolar3dSecondary(e.target.value); setPolar3dSecondarySelected("ALL"); }}
                  style={{ width: 120, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#fff", cursor: "pointer", flexShrink: 0 }}>
                  {["Phi","Theta","Freq"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <div style={{ flex: 1, display: "flex", gap: 6 }}>
                  <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>{polar3dSecondarySelected}</div>
                  <button onClick={() => { setPolar3dSecondaryPopup(true); setPolar3dSecPopupMode("all"); }}
                    style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", cursor: "pointer" }}>…</button>
                </div>
              </div>
              {polar3dSecondaryPopup && (() => { const vals = getSweepValues(polar3dSecondary); return (
                <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                  <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                    <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {polar3dSecondary}</span>
                      <button onClick={() => setPolar3dSecondaryPopup(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                    </div></div>
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                      <label style={{ fontSize: 11 }}><input type="radio" name="polar3dSec" checked={polar3dSecPopupMode === "all"} onChange={() => setPolar3dSecPopupMode("all")} /> Use All Values</label>
                      <label style={{ fontSize: 11 }}><input type="radio" name="polar3dSec" checked={polar3dSecPopupMode === "select"} onChange={() => setPolar3dSecPopupMode("select")} /> Select Values</label>
                    </div>
                    <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0" }}>
                      {vals.map(v => { const sel = polar3dSecPopupSel === v; const h = polar3dSecPopupMode === "all" || sel;
                        return (<button key={v} onClick={() => { if (polar3dSecPopupMode === "all") return; setPolar3dSecPopupSel(v); }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12, color: h ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none", cursor: polar3dSecPopupMode === "all" ? "default" : "pointer", opacity: h ? 1 : 0.4 }}>{v}</button>); })}
                    </div>
                    <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                      <button onClick={() => setPolar3dSecondaryPopup(false)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                      <button onClick={() => { if (polar3dSecPopupMode === "all") setPolar3dSecondarySelected("ALL"); else setPolar3dSecondarySelected(polar3dSecPopupSel || vals[0]); setPolar3dSecondaryPopup(false); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                    </div>
                  </div>
                </div>); })()}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>X：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>{polar3dPrimary}</div>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Y：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>{polar3dSecondary}</div>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111", width: 140, flexShrink: 0, textAlign: "right" }}>Polar：</span>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 12, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 6, background: "#f8f9fa", textAlign: "center" }}>
                  {polar3dFunction}({(polar3dValueMode === "all" ? CATEGORY_GROUPS[polar3dCategory] : polar3dSubItems).join(", ")})
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <div style={{ flex: 1.3, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Category</div>
                  <div style={{ padding: "4px 0" }}>
                    {CATEGORY_NAMES.map(cat => (
                      <button key={cat} onClick={() => { setPolar3dCategory(cat); setPolar3dSubItems([CATEGORY_GROUPS[cat][0]]); setPolar3dFunction(FUNCTION_OPTIONS[cat][0]); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 14px", fontSize: 11,
                          color: polar3dCategory === cat ? C.accent : C.text1,
                          background: polar3dCategory === cat ? C.accentD : "transparent",
                          border: "none", cursor: "pointer", fontWeight: polar3dCategory === cat ? 600 : 400 }}>{cat}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, display: "flex", gap: 16 }}>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="polar3dValues" checked={polar3dValueMode === "all"} onChange={() => setPolar3dValueMode("all")} />Use all values
                    </label>
                    <label style={{ fontSize: 10, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                      <input type="radio" name="polar3dValues" checked={polar3dValueMode === "select"} onChange={() => setPolar3dValueMode("select")} />Select values
                    </label>
                  </div>
                  <div style={{ padding: "4px 0" }}>
                    {(CATEGORY_GROUPS[polar3dCategory] || []).map(item => {
                      const checked = polar3dValueMode === "all" || polar3dSubItems.includes(item);
                      return (
                        <button key={item} onClick={() => {
                          if (polar3dValueMode === "all") return;
                          setPolar3dSubItems(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]);
                        }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 14px", fontSize: 11,
                            color: checked ? C.accent : C.text1,
                            background: checked ? C.accentD : "transparent",
                            border: "none", cursor: polar3dValueMode === "all" ? "default" : "pointer", fontWeight: checked ? 600 : 400 }}>{item}</button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ flex: 0.8, border: "1px solid " + C.border, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 11, fontWeight: 600, color: C.text2 }}>Select Function</div>
                  <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {(FUNCTION_OPTIONS[polar3dCategory] || ["None"]).map(fn => (
                      <label key={fn} style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="radio" name="polar3dFunc" checked={polar3dFunction === fn} onChange={() => setPolar3dFunction(fn)} />{fn}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>Families：</span>
                <div className="rounded-lg overflow-hidden mt-2" style={{ border: "1px solid " + C.border }}>
                  <div className="flex items-center" style={{ padding: "6px 12px", background: "#f8f9fa", borderBottom: "1px solid " + C.border, fontSize: 10, fontWeight: 600, color: C.text2, gap: 6 }}>
                    <span style={{ width: 80, flexShrink: 0 }}>Variable</span>
                    <span style={{ flex: 1 }}>Values</span>
                    <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>Edit</span>
                  </div>
                  {ALL_FAM_KEYS.filter(k => k !== polar3dPrimary && k !== polar3dSecondary).map((key, idx) => (
                    <div key={key} className="flex items-center" style={{ padding: "5px 12px", gap: 6, fontSize: 11, color: C.text1 }}>
                      <span style={{ width: 80, flexShrink: 0, fontWeight: 500 }}>{FAMILY_LABELS[key]}</span>
                      <div style={{ flex: 1, padding: "4px 8px", fontSize: 11, color: C.text1, border: "1px solid " + C.borderA, borderRadius: 4, background: "#f8f9fa", textAlign: "center" }}>
                        {polar3dFamVals[key] || SWEEP_VALUES[key]?.[0] || "ALL"}
                      </div>
                      <span style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                        <button onClick={() => { setPolar3dFamPopup(key); setPolar3dFamPopupMode("all"); }}
                          style={{ fontSize: 16, background: "transparent", border: "none", cursor: "pointer", color: C.text2, padding: 0 }}>…</button>
                      </span>
                    </div>
                  ))}
                </div>
                {polar3dFamPopup && (() => {
                  const vals = SWEEP_VALUES[polar3dFamPopup as FamKey] || [];
                  return (
                    <div className="absolute inset-0 z-70 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.12)" }}>
                      <div className="rounded-xl overflow-hidden" style={{ width: 480, maxHeight: "70%", background: "#fff", boxShadow: "0 12px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column" }}>
                        <div style={{ borderBottom: "1px solid " + C.border }}><div className="flex items-center justify-between px-5 py-3">
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>Select Values — {polar3dFamPopup}</span>
                          <button onClick={() => setPolar3dFamPopup(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
                        </div></div>
                        <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, display: "flex", gap: 20 }}>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="polar3dFamMode" checked={polar3dFamPopupMode === "all"} onChange={() => setPolar3dFamPopupMode("all")} />Use All Values
                          </label>
                          <label style={{ fontSize: 11, color: C.text1, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <input type="radio" name="polar3dFamMode" checked={polar3dFamPopupMode === "select"} onChange={() => setPolar3dFamPopupMode("select")} />Select Values
                          </label>
                        </div>
                        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0", scrollbarWidth: "thin" }}>
                          {vals.map(v => {
                            const sel = polar3dFamPopupSel === v; const hilite = polar3dFamPopupMode === "all" || sel;
                            return (<button key={v} onClick={() => { if (polar3dFamPopupMode === "all") return; setPolar3dFamPopupSel(v); }}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 24px", fontSize: 12,
                                color: hilite ? C.accent : C.text2, background: sel ? C.accentD : "transparent", border: "none",
                                cursor: polar3dFamPopupMode === "all" ? "default" : "pointer", opacity: hilite ? 1 : 0.4 }}>{v}</button>);
                          })}
                        </div>
                        <div className="flex items-center justify-end gap-3 px-5 py-3" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
                          <button onClick={() => setPolar3dFamPopup(null)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                          <button onClick={() => {
                            if (polar3dFamPopupMode === "all") setPolar3dFamVals(prev => ({ ...prev, [polar3dFamPopup!]: "ALL" }));
                            else setPolar3dFamVals(prev => ({ ...prev, [polar3dFamPopup!]: polar3dFamPopupSel || vals[0] }));
                            setPolar3dFamPopup(null);
                          }} className="flex items-center gap-1.5 px-4 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}><CheckCircle size={13} />确认</button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3.5" style={{ borderTop: "1px solid " + C.border, background: "#fafbfc" }}>
              <button onClick={() => setPolar3dModal(false)}
                style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>关闭</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                  <Download size={13} />导出
                </button>
                <button onClick={() => {
                  const label = `${polar3dSubItems.join(", ")}-三维极化图`;
                  const fileId = `gen-${Date.now()}`;
                  const folderId = "folder-polar3d";
                  setGenNodes(prev => {
                    const next = [...prev];
                    if (!next.some(g => g.id === folderId)) {
                      next.push({ parentId: "results", id: folderId, label: "三维极化图", icon: FolderOpen, isFolder: true });
                    }
                    next.push({ parentId: folderId, id: fileId, label, icon: Activity });
                    return next;
                  });
                  setPolar3dModal(false);
                }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
                  <CheckCircle size={13} />生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-node context menu ── */}
      {subCtxMenu && subCtxMenu.id === "results" && (
        <>
          <div className="fixed inset-0 z-70" onClick={() => setSubCtxMenu(null)} />
          <div className="fixed z-80"
            style={{ left: subCtxMenu.x, top: subCtxMenu.y, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.14)", padding: "4px", minWidth: 200 }}>
            {[
              { id: "rect2d",     label: "创建二维矩形图",       icon: Activity },
              { id: "rect3d", label: "创建三维矩形图", icon: Grid3X3 },
              { id: "polar2d",    label: "创建二维极化图",       icon: Radio },
              { id: "polar3d",    label: "创建三维极化图",       icon: Globe },
              { id: "table",      label: "创建数据表格",         icon: FileText },
            ].map(item => (
              <button key={item.id}
                onClick={() => {
                  setSubCtxMenu(null);
                  if (item.id === "rect2d") { setRect2dModal(true); setSelNode(""); }
                  if (item.id === "rect3d") { setRect3dModal(true); setSelNode(""); }
                  if (item.id === "polar2d") { setPolar2dModal(true); setSelNode(""); }
                  if (item.id === "polar3d") { setPolar3dModal(true); setSelNode(""); }
                }}
                className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <item.icon size={13} style={{ color: C.text2 }} />{item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {subCtxMenu && subCtxMenu.id !== "results" && (
        <>
          <div className="fixed inset-0 z-70" onClick={() => setSubCtxMenu(null)} />
          <div className="fixed z-80"
            style={{ left: subCtxMenu.x, top: subCtxMenu.y, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.14)", padding: "4px", minWidth: 148 }}>
            <button onClick={() => { setSubRenameTarget(subCtxMenu.id); setSubRenameValue(subCtxMenu.label); setSubCtxMenu(null); }}
              className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
              style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Pencil size={13} style={{ color: C.text2 }} />重命名
            </button>
            <button onClick={() => { setSubShareLabel(subCtxMenu!.label); setSubShareModal(true); setSubCtxMenu(null); }}
              className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
              style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Share2 size={13} style={{ color: C.text2 }} />分享
            </button>
            <button onClick={() => { setSubCtxMenu(null); }}
              className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
              style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Download size={13} style={{ color: C.text2 }} />另存为
            </button>
            <div style={{ height: 1, background: C.border, margin: "2px 0" }} />
            <button onClick={() => { setSubCtxMenu(null); }}
              className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
              style={{ fontSize: 12, color: "#d93025", background: "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#fef0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Trash2 size={13} style={{ color: "#d93025" }} />删除
            </button>
          </div>
        </>
      )}

      {/* ── Sub-node rename modal ── */}
      {subRenameTarget && (
        <div className="absolute inset-0 z-90 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-xl overflow-hidden"
            style={{ width: 360, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2">
                <Pencil size={15} style={{ color: C.accent }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>重命名子节点</span>
              </div>
              <button onClick={() => setSubRenameTarget(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 11, color: C.text2, marginBottom: 10 }}>输入新的节点名称：</p>
              <input
                value={subRenameValue}
                onChange={(e) => setSubRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subRenameValue.trim()) {
                    setSubRenameTarget(null);
                  }
                }}
                autoFocus
                style={{ width: "100%", padding: "8px 12px", fontSize: 13, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                onFocus={(e) => (e.target.style.borderColor = C.accent)}
                onBlur={(e) => (e.target.style.borderColor = C.borderA)}
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              <button onClick={() => setSubRenameTarget(null)}
                style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 14px" }}>
                取消
              </button>
              <button onClick={() => {
                if (subRenameValue.trim()) {
                  setSubRenameTarget(null);
                }
              }} disabled={!subRenameValue.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: subRenameValue.trim() ? C.accent : C.borderA, border: "none", cursor: subRenameValue.trim() ? "pointer" : "default" }}>
                <CheckCircle size={13} />确认改名
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share modal (project detail) ── */}
      {subShareModal && (
        <div className="absolute inset-0 z-90 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-xl overflow-hidden"
            style={{ width: 480, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-2">
                <Share2 size={15} style={{ color: C.accent }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>分享{project.title}-{subShareLabel}</span>
              </div>
              <button onClick={() => setSubShareModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}><X size={15} /></button>
            </div>
            <div className="flex items-center gap-3 px-5 py-3" style={{ background: "#fafbfc", borderBottom: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700 }}>1</div>
                <span style={{ fontSize: 11, fontWeight: subShareStep === "settings" ? 600 : 400, color: C.text1 }}>设置</span>
              </div>
              <div style={{ width: 32, height: 1, background: subShareStep === "link" ? C.accent : C.borderA }} />
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: subShareStep === "link" ? C.accent : "#f1f3f4", color: subShareStep === "link" ? "#fff" : C.text3, fontSize: 10, fontWeight: 700 }}>2</div>
                <span style={{ fontSize: 11, fontWeight: subShareStep === "link" ? 600 : 400, color: subShareStep === "link" ? C.text1 : C.text3 }}>生成链接</span>
              </div>
            </div>
            <div style={{ padding: "20px 24px", minHeight: 160 }}>
              {subShareStep === "settings" && (
                <>
                  <p style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>分享内容</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 18 }}>{project.title}-{subShareLabel}</p>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.text1, marginBottom: 10 }}>链接有效期</p>
                  <div className="flex gap-2">
                    {["1","7","15","30"].map(v => (
                      <button key={v} onClick={() => setSubShareExpiry(v)}
                        style={{ flex: 1, padding: "8px 4px", fontSize: 12, fontWeight: subShareExpiry === v ? 600 : 400,
                          color: subShareExpiry === v ? C.accent : C.text2, background: subShareExpiry === v ? C.accentD : "#f8f9fa",
                          border: subShareExpiry === v ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", textAlign: "center" }}>{v} 天</button>
                    ))}
                  </div>
                </>
              )}
              {subShareStep === "link" && (
                <>
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: "#f8f9fa", border: `1px solid ${C.border}` }}>
                    <FileText size={14} style={{ color: C.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.text1, flex: 1 }}>{project.title}-{subShareLabel}</span>
                    <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 4, background: "rgba(242,153,0,0.08)", color: C.amber }}>{subShareExpiry} 天</span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 6 }}>分享链接</p>
                  <div className="flex items-center gap-2 mb-4">
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#f8f9fa", border: `1px solid ${C.borderA}`, borderRadius: 8, fontSize: 11, fontFamily: "monospace", color: C.accent, overflow: "hidden" }}>
                      <Link size={12} style={{ color: C.accent, flexShrink: 0 }} /><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{subShareLink}</span>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(subShareLink); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                      style={{ fontSize: 11, color: C.accent, background: C.accentD, border: `1px solid rgba(26,115,232,0.2)`, cursor: "pointer", whiteSpace: "nowrap" }}><Copy size={11} />复制</button>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(52,168,83,0.04)", border: "1px solid rgba(52,168,83,0.12)" }}>
                    <p style={{ fontSize: 10, color: C.text2 }}>✓ 链接已生成 · 有效期 {subShareExpiry} 天 · 过期后自动失效</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
              {subShareStep === "settings" ? (
                <>
                  <button onClick={() => setSubShareModal(false)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                  <button onClick={() => { setSubShareLink(`https://antennadesign.huawei.com/share/${project.title}-${subShareLabel}/${Math.random().toString(36).substring(2,8)}`); setSubShareStep("link"); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                    style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>下一步 <ChevronRight size={13} /></button>
                </>
              ) : (
                <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => setSubShareModal(false)} style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>关闭</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Optimization Center ───────────────────────────────────────────────
const OPT_ALGORITHMS = [
  { id: "sweep", name: "参数扫描", icon: Grid3X3, desc: "网格遍历参数空间，适合低维问题，结果可靠" },
  { id: "gd",    name: "梯度下降", icon: Activity, desc: "沿梯度方向迭代更新，收敛快，可能陷入局部最优" },
  { id: "ga",    name: "遗传算法", icon: Layers, desc: "模拟自然选择进化，全局搜索能力强，适合多目标" },
  { id: "pso",   name: "粒子群算法", icon: Radio, desc: "群体智能优化，平衡全局/局部搜索，适合连续空间" },
];

const OPT_BEFORE = { patchL: 38.5, patchW: 47.2, feedPos: 12.3, er: 4.40, s11: -18.3, gain: 6.2, vswr: 1.28, bw: 98, eff: 87.3 };
const OPT_AFTER  = { patchL: 37.2, patchW: 45.8, feedPos: 11.7, er: 4.40, s11: -24.7, gain: 7.8, vswr: 1.12, bw: 143, eff: 92.1 };

const OPT_LOGS: Record<string, string[]> = {
  sweep: ["[00:00] 初始化参数扫描，网格点数: 512","[00:02] 扫描进度 25%…","[00:05] 扫描进度 50%…","[00:08] 扫描进度 75%…","[00:10] 扫描完成，最优点定位","[00:12] 局部细化搜索…","[00:14] ✓ 优化完成，S11 改善 6.4 dB"],
  gd:    ["[00:00] 初始化梯度下降，步长: 0.01","[00:01] 第1步，梯度范数: 0.342","[00:03] 第10步，梯度范数: 0.201","[00:06] 第25步，梯度范数: 0.089","[00:09] 第50步，梯度范数: 0.021","[00:11] 收敛判据满足 (<0.001)","[00:12] ✓ 优化完成，S11 改善 6.4 dB"],
  ga:    ["[00:00] 初始化遗传算法，种群大小: 50","[00:01] 第1代，最优适应度: 0.612","[00:04] 第20代，最优适应度: 0.763","[00:08] 第50代，最优适应度: 0.871","[00:12] 第75代，最优适应度: 0.921","[00:15] 第90代，最优适应度: 0.943","[00:17] 局部精细化…","[00:19] ✓ 优化完成，S11 改善 6.4 dB"],
  pso:   ["[00:00] 初始化粒子群，粒子数: 30","[00:01] 迭代第5次，全局最优: 0.643","[00:04] 迭代第20次，全局最优: 0.798","[00:08] 迭代第50次，全局最优: 0.903","[00:12] 迭代第80次，全局最优: 0.941","[00:15] 粒子群收敛","[00:17] ✓ 优化完成，S11 改善 6.4 dB"],
};

// ── Message Center Data ──────────────────────────────────────────────
const MESSAGE_DATA: Record<string, Array<{ id: number; title: string; content: string; from: string; time: string; read: boolean; type?: string }>> = {
  interaction: [
    { id: 2,  title: "评论回复", content: "lucky123 回复了您在「采用AI技术的模型车天线」中的评论：「S11 参数优化后是否验证过带宽变化？」", from: "lucky123", time: "2026-07-21 10:15", read: false, type: "comment" },
    { id: 4,  title: "评论回复", content: 'team_lead 在「WiFi 6E 双频天线优化」中 @ 了您："请确认馈电偏移参数是否符合仿真要求"', from: "team_lead", time: "2026-07-19 09:08", read: true, type: "comment" },
  ],
  admin: [
    { id: 10, title: "平台公告", content: "【重要】优天线 Pro v3.2 将于 2026年8月1日发布，新增 AI 辅助优化功能与多物理场耦合仿真模块，届时系统将停机维护约4小时。", from: "系统管理员", time: "2026-07-20 08:00", read: false, type: "announce" },
    { id: 11, title: "运营通知", content: "2026年Q3仿真资源配额已更新：专业版用户每月可享50次仿真与20000 CPU小时。请合理规划使用。", from: "运营团队", time: "2026-07-15 12:00", read: false, type: "ops" },
    { id: 12, title: "平台公告", content: "分布式仿真功能已全面升级，现支持跨设备任务流转与实时进度同步。MateBook / 工作站 / 平板均可作为计算节点。", from: "系统管理员", time: "2026-07-10 09:30", read: true, type: "announce" },
    { id: 13, title: "运营通知", content: "「天线优化」模块新增粒子群算法 (PSO)，适合连续空间多目标优化，已在模板库中提供示例项目。", from: "运营团队", time: "2026-07-05 16:00", read: true, type: "ops" },
    { id: 14, title: "平台公告", content: "安全提醒：请及时更新账号密码，开启两步验证以保护您的仿真数据安全。企业版用户请联系IT管理员配置SSO。", from: "系统管理员", time: "2026-07-01 10:00", read: true, type: "announce" },
  ],
  system: [
    { id: 20, title: "优化完成", content: "项目「采用AI技术的模型车天线」优化任务已完成。S11 从 -18.3dB 改善至 -24.7dB，增益提升至 7.8dBi。点击查看详细报告。", from: "系统", time: "2026-07-21 15:42", read: false, type: "opt-done" },
    { id: 21, title: "任务异常", content: "项目「5G毫米波天线阵列设计」仿真任务在网格划分阶段失败，原因：内存不足。建议启用分布式仿真或将网格精度降至'标准'。", from: "系统", time: "2026-07-21 08:15", read: false, type: "error" },
    { id: 22, title: "优化完成", content: "项目「WiFi 6E 双频天线优化」参数扫描已完成，共评估512组参数组合，最优S11为 -12.1dB。", from: "系统", time: "2026-07-19 22:10", read: true, type: "opt-done" },
    { id: 23, title: "任务异常", content: "自动清理任务执行失败：无法删除文件 'farfield_pattern_v1.txt'，文件可能正在被其他进程使用。", from: "系统", time: "2026-07-18 03:00", read: true, type: "error" },
    { id: 24, title: "优化完成", content: "批量参数扫描任务「微带贴片基础模板」已完成，生成了200组频率响应数据，可前往项目查看。", from: "系统", time: "2026-07-16 18:30", read: true, type: "opt-done" },
    { id: 25, title: "系统提醒", content: "您已连续使用仿真资源超过8小时，建议休息并检查任务队列，避免资源空转。", from: "系统", time: "2026-07-15 23:55", read: true, type: "reminder" },
  ],
};

// ── AI Assistant Chat ────────────────────────────────────────────────
function AIAssistant() {
  type Msg = { role: "user" | "ai"; text: string; time: string };
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "你好！我是优天线 AI 助手。我可以帮你分析天线设计问题、推荐优化策略、解答技术疑问。有什么可以帮到你的吗？", time: formatTime(new Date()) },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  function formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  const scrollBottom = () => {
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 50);
  };

  const aiReplies = [
    "根据您目前的喇叭天线设计参数（波导宽度 a=4.3in，喇叭口径 a1=20.5in），建议将 b1 从 15.18in 调整为 17.2in 以改善阻抗匹配，预期 S11 可从 −18.3dB 改善至 −22.5dB。",
    "对于微带贴片天线的工作频率 2.45GHz，基板厚度 h=1.6mm 与介电常数 εr=4.40 的组合是合理的。不过如果改用 εr=2.2 的基板（如 Rogers 5880），带宽可以提升约 30%，但天线尺寸会增大。",
    "DCNSGA_II 算法适合您当前的约束优化问题。如果目标函数计算开销较大，可以尝试将种群规模从 50 减小到 30，迭代代数从 90 增加到 120，这样可以在相近运行时间下获得更好的帕累托前沿。",
    "您选择的八木天线增益约为 12-15 dBi，方向性好。如果需要在更宽频带内保持低驻波比，可以考虑对数周期天线作为替代方案。",
    "从仿真结果来看，S11=−18.3dB 已满足 ≤−15dB 的常规要求，VSWR=1.28 也在 2.0 以下。如果目标是商用基站天线标准（S11≤−20dB），可以从馈电偏移 d 和贴片宽度 W 两个参数同时优化。",
    "天线阵列设计中，阵元间距通常取 0.5λ~0.7λ 时扫描性能最优。对于您 2.45GHz 的设计，波长 λ≈122mm，建议阵元间距取 65~85mm 范围。",
    "相位扰动参数设为 0 表示无噪声情况。如果需要模拟真实环境，建议设置为 5°~15° 的均匀分布噪声，蒙特卡洛次数 ≥100 次时统计结果趋于稳定。",
    "圆极化微带贴片可以通过切角或双馈电实现。轴比带宽通常远小于阻抗带宽，如果要求轴比 ≤3dB 覆盖 2.4~2.5GHz，推荐使用双馈电方案。",
  ];

  const sendMessage = () => {
    const text = input.trim();
    if (!text || thinking) return;
    const now = formatTime(new Date());
    setMessages(prev => [...prev, { role: "user", text, time: now }]);
    setInput("");
    setThinking(true);
    scrollBottom();
    setTimeout(() => {
      const reply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
      setMessages(prev => [...prev, { role: "ai", text: reply, time: formatTime(new Date()) }]);
      setThinking(false);
      scrollBottom();
    }, 800 + Math.random() * 1200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa" }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0"
        style={{ padding: "0 20px", height: 48, background: "#fff", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #1a73e8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MessageSquare size={16} style={{ color: "#fff" }} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text1 }}>AI 天线设计助手</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: C.text3 }}>在线 · 随时为您解答</span>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, marginLeft: 6 }} />
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto" style={{ padding: "16px 20px", scrollbarWidth: "thin" }}>
        <div style={{ maxWidth: 960 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 20, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: m.role === "ai" ? "linear-gradient(135deg, #1a73e8, #7c3aed)" : C.accentD,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {m.role === "ai"
                  ? <MessageSquare size={14} style={{ color: "#fff" }} />
                  : <User size={14} style={{ color: C.accent }} />}
              </div>
              {/* Bubble */}
              <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  background: m.role === "user" ? C.accent : "#fff",
                  color: m.role === "user" ? "#fff" : C.text1,
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                  border: m.role === "ai" ? `1px solid ${C.border}` : "none",
                  padding: "10px 16px", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap",
                  boxShadow: m.role === "ai" ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
                }}>
                  {m.text}
                </div>
                <span style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>{m.time}</span>
              </div>
            </div>
          ))}
          {/* Thinking indicator */}
          {thinking && (
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #1a73e8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageSquare size={14} style={{ color: "#fff" }} />
              </div>
              <div style={{ background: "#fff", borderRadius: "4px 16px 16px 16px", border: `1px solid ${C.border}`, padding: "14px 20px" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0,1,2].map(d => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: C.text3, animation: `blink 1.4s ease-in-out ${d*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0" style={{ background: "#fff", borderTop: `1px solid ${C.border}`, padding: "12px 20px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="输入天线设计问题，按 Enter 发送，Shift+Enter 换行..."
            rows={2}
            style={{
              flex: 1, padding: "8px 14px", fontSize: 13, color: C.text1,
              border: `1px solid ${C.borderA}`, borderRadius: 10, outline: "none",
              resize: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
            }}
            onFocus={e => e.target.style.borderColor = C.accent}
            onBlur={e => e.target.style.borderColor = C.borderA}
          />
          <button onClick={sendMessage} disabled={!input.trim() || thinking}
            style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: (input.trim() && !thinking) ? C.accent : C.borderA,
              border: "none", cursor: (input.trim() && !thinking) ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}>
            <ChevronRight size={18} style={{ color: "#fff" }} />
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 10, color: C.text3, marginTop: 8 }}>AI 助手基于天线设计知识库提供建议，具体设计请以仿真结果为准</p>
      </div>
    </div>
  );
}

// ── AI Chat Popup (floating) ─────────────────────────────────────────
function AIChatPopup({ onClose }: { onClose: () => void }) {
  type Msg = { role: "user" | "ai"; text: string };
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "你好！有什么天线设计问题我可以帮您解答？" },
  ]);
  const [inp, setInp] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const aiReplies = [
    "根据您目前的喇叭天线设计参数，建议将 b1 从 15.18in 调整为 17.2in 以改善阻抗匹配。",
    "对于 2.45GHz 微带贴片，基板 h=1.6mm 与 εr=4.40 组合合理。改用 Rogers 5880 (εr=2.2) 可提升带宽约30%。",
    "DCNSGA_II 算法适合当前约束优化。建议种群规模 30、迭代 120 代，可获更好帕累托前沿。",
    "八木天线增益 12-15 dBi，方向性好。如需宽带低驻波，可考虑对数周期天线。",
    "S11=−18.3dB 已满足常规要求。如需商用基站标准(≤−20dB)，建议同时优化馈电偏移和贴片宽度。",
    "阵列设计中阵元间距取 0.5λ~0.7λ 时扫描性能最优。2.45GHz 下建议间距 65~85mm。",
    "圆极化贴片可通过切角或双馈电实现。轴比带宽要求覆盖 2.4~2.5GHz 时推荐双馈电方案。",
    "阻抗匹配方面，可调整馈电点位置，实测 Zin 值越接近 50Ω 越好。",
  ];

  const send = () => {
    const t = inp.trim();
    if (!t || thinking) return;
    setMsgs(prev => [...prev, { role: "user", text: t }]);
    setInp(""); setThinking(true);
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 50);
    setTimeout(() => {
      setMsgs(prev => [...prev, { role: "ai", text: aiReplies[Math.floor(Math.random() * aiReplies.length)] }]);
      setThinking(false);
      setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 50);
    }, 600 + Math.random() * 1000);
  };

  return (
    <div style={{
      position: "fixed", bottom: 88, right: 24, zIndex: 200,
      width: 380, height: 480, background: "#fff",
      borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-shrink-0"
        style={{ padding: "10px 14px", background: "linear-gradient(135deg, #1a73e8, #7c3aed)" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageSquare size={14} style={{ color: "#fff" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", flex: 1 }}>AI 天线助手</span>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#5eff6b" }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.85)" }}>在线</span>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "4px 6px", cursor: "pointer", marginLeft: 4 }}>
          <X size={14} style={{ color: "#fff" }} />
        </button>
      </div>

      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto" style={{ padding: "10px 12px", scrollbarWidth: "thin", background: "#f8f9fa" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 12, flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
              background: m.role === "ai" ? "linear-gradient(135deg, #1a73e8, #7c3aed)" : C.accentD,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {m.role === "ai" ? <MessageSquare size={10} style={{ color: "#fff" }} /> : <User size={10} style={{ color: C.accent }} />}
            </div>
            <div style={{
              maxWidth: "80%", background: m.role === "user" ? C.accent : "#fff",
              color: m.role === "user" ? "#fff" : C.text1,
              borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
              padding: "7px 12px", fontSize: 12, lineHeight: 1.55,
              border: m.role === "ai" ? `1px solid ${C.border}` : "none",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #1a73e8, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={10} style={{ color: "#fff" }} />
            </div>
            <div style={{ background: "#fff", borderRadius: "4px 14px 14px 14px", border: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", gap: 4 }}>
              {[0,1,2].map(d => <div key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: C.text3, animation: `blink 1.4s ease-in-out ${d*0.2}s infinite` }} />)}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0" style={{ borderTop: `1px solid ${C.border}`, padding: "8px 10px", background: "#fff" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <textarea value={inp} onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="输入问题，Enter 发送…" rows={2}
            style={{ flex: 1, padding: "6px 10px", fontSize: 12, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.4, boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.borderA} />
          <button onClick={send} disabled={!inp.trim() || thinking}
            style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: (inp.trim() && !thinking) ? C.accent : C.borderA, border: "none", cursor: (inp.trim() && !thinking) ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={14} style={{ color: "#fff" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message Center ───────────────────────────────────────────────────
function MessageCenter({ initialTab }: { initialTab?: "interaction" | "admin" | "system" }) {
  const [tab, setTab] = useState<"interaction" | "admin" | "system">(initialTab || "interaction");
  const [messages, setMessages] = useState(MESSAGE_DATA);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const markRead = (id: number) => {
    setMessages(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = next[k].map(m => m.id === id ? { ...m, read: true } : m);
      }
      return next;
    });
  };

  const markAllRead = () => {
    setMessages(prev => {
      const next = { ...prev };
      next[tab] = next[tab].map(m => ({ ...m, read: true }));
      return next;
    });
  };

  const unreadCount = (key: string) => messages[key].filter(m => !m.read).length;
  const totalUnread = Object.values(messages).reduce((sum, msgs) => sum + msgs.filter(m => !m.read).length, 0);

  const tabLabels: Record<string, string> = { interaction: "互动消息", admin: "管理员消息", system: "系统通知" };
  const tabIcons: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = { interaction: MessageCircle, admin: Megaphone, system: AlertCircle };

  const typeIcon = (type?: string) => {
    if (type === "collab") return Share2;
    if (type === "comment") return MessageSquare;
    if (type === "announce") return Megaphone;
    if (type === "ops") return FileText;
    if (type === "opt-done") return CheckCircle;
    if (type === "error") return AlertCircle;
    if (type === "reminder") return Bell;
    return Bell;
  };

  const typeColor = (type?: string) => {
    if (type === "collab" || type === "comment") return C.accent;
    if (type === "announce") return "#7c3aed";
    if (type === "ops") return C.green;
    if (type === "opt-done") return C.green;
    if (type === "error") return "#d93025";
    if (type === "reminder") return C.amber;
    return C.text2;
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: "#f8f9fa" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "16px 28px 0", flexShrink: 0 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <div className="flex items-center gap-3">
            <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text1 }}>消息中心</h1>
            {totalUnread > 0 && (
              <span style={{ fontSize: 11, color: "#fff", background: "#d93025", padding: "2px 10px", borderRadius: 10, fontWeight: 600 }}>
                {totalUnread} 条未读
              </span>
            )}
          </div>
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
            style={{ fontSize: 11, color: C.accent, background: C.accentD, border: "none", cursor: "pointer" }}>
            <CheckCircle size={12} />全部已读
          </button>
        </div>
      </div>

      {/* ── Tab row + connector bridge + card (连体卡片) ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ padding: "0 28px" }}>
        {/* Spacer from header */}
        <div style={{ height: 14, flexShrink: 0 }} />

        {/* Tab row */}
        <div className="flex items-end gap-0 flex-shrink-0" style={{ position: "relative", zIndex: 2 }}>
          {(["interaction", "admin", "system"] as const).map((t) => {
            const Icon = tabIcons[t];
            const active = tab === t;
            const count = unreadCount(t);
            return (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: active ? "10px 20px 8px" : "10px 20px 12px",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? C.accent : C.text2,
                  background: active ? "#fff" : "transparent",
                  border: "none",
                  borderBottom: active ? `4px solid #fff` : "4px solid transparent",
                  borderRadius: active ? "10px 10px 0 0" : "0",
                  cursor: "pointer",
                  position: "relative" as const,
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = C.accent; e.currentTarget.style.background = "rgba(248,249,250,0.6)"; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = C.text2; e.currentTarget.style.background = "transparent"; } }}>
                <Icon size={14} style={{ color: active ? C.accent : C.text2, transition: "color 0.2s" }} />
                {tabLabels[t]}
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "#fff", background: count > 0 && active ? C.accent : "#d93025",
                    minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px", transition: "background 0.2s",
                  }}>{count}</span>
                )}
              </button>
            );
          })}
          <div style={{ flex: 1, borderBottom: `4px solid ${C.borderA}`, marginBottom: 0 }} />
        </div>

        {/* ── Connector bridge strip ── */}
        <div style={{ height: 8, flexShrink: 0, position: "relative", zIndex: 1 }}>
          {/* Layered bridge bars: background fills grey, active tab's column gets blue */}
          <div style={{ position: "absolute", inset: 0, background: "#fff" }} />
          {/* Background grey bar across full width */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: C.border }} />
        </div>

        {/* ── Card body — 抽拉式下拉卡片 ── */}
        <div
          className="flex-1 overflow-hidden flex flex-col"
          style={{
            background: "#fff",
            borderRadius: "0 10px 10px 10px",
            border: `1px solid ${C.border}`,
            borderTop: `1px solid ${C.border}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            position: "relative",
            zIndex: 0,
          }}>
          {/* Card inner header */}
          <div style={{
            padding: "12px 20px",
            borderBottom: `1px solid ${C.border}`,
            background: "#fafbfc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.text1 }}>{tabLabels[tab]}</span>
            <span style={{ fontSize: 10, color: C.text3 }}>{messages[tab].length} 条消息</span>
          </div>

          {/* Message list — animated slide-down */}
          <div
            key={tab}
            className="flex-1 overflow-y-auto"
            style={{
              scrollbarWidth: "none",
              animation: "pullDown 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}>
            <style>{`
              @keyframes pullDown {
                from { opacity: 0; transform: translateY(-18px); clip-path: inset(0 0 100% 0); }
                to   { opacity: 1; transform: translateY(0);     clip-path: inset(0 0 0 0); }
              }
            `}</style>
            {messages[tab].length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ padding: "40px 20px" }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#f1f3f4" }}>
                  <Bell size={22} style={{ color: C.text3 }} />
                </div>
                <p style={{ fontSize: 12, color: C.text3 }}>暂无消息</p>
              </div>
            ) : (
              messages[tab].map((msg) => {
                const Icon = typeIcon(msg.type);
                const iconColor = typeColor(msg.type);
                const isExpanded = expandedId === msg.id;
                return (
                  <div key={msg.id} style={{
                    borderBottom: `1px solid ${C.border}`,
                    background: msg.read ? "transparent" : "rgba(26,115,232,0.02)",
                    transition: "background 0.15s",
                  }}>
                    <button
                      onClick={() => {
                        setExpandedId(isExpanded ? null : msg.id);
                        if (!msg.read) markRead(msg.id);
                      }}
                      className="flex items-start gap-3 w-full text-left"
                      style={{
                        padding: "12px 20px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        opacity: msg.read ? 0.75 : 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}12` }}>
                          <Icon size={16} style={{ color: iconColor }} />
                        </div>
                        {!msg.read && (
                          <div style={{
                            position: "absolute", top: -3, right: -3,
                            width: 9, height: 9, borderRadius: "50%",
                            background: "#d93025", border: "2px solid #fff",
                          }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: msg.read ? 400 : 600, color: C.text1 }}>{msg.title}</span>
                          <span style={{ fontSize: 10, color: C.text3 }}>· {msg.from}</span>
                        </div>
                        <p style={{
                          fontSize: 11, color: C.text2, lineHeight: 1.5,
                          display: "-webkit-box", WebkitLineClamp: isExpanded ? undefined : 1, WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}>{msg.content}</p>
                        <span style={{ fontSize: 10, color: C.text3, marginTop: 4, display: "inline-block" }}>{msg.time}</span>
                      </div>
                      <ChevronDown size={14} style={{
                        color: C.text3, flexShrink: 0, marginTop: 2,
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }} />
                    </button>
                    {isExpanded && (
                      <div style={{
                        padding: "12px 20px 14px 56px",
                        background: "#f8f9fa",
                        borderTop: `1px solid ${C.border}`,
                      }}>
                        <p style={{ fontSize: 12, color: C.text1, lineHeight: 1.7 }}>{msg.content}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                            style={{ fontSize: 11, color: C.accent, background: C.accentD, border: "none", cursor: "pointer" }}>
                            <ExternalLink size={10} />查看详情
                          </button>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                            style={{ fontSize: 11, color: C.text2, background: "#fff", border: `1px solid ${C.borderA}`, cursor: "pointer" }}>
                            标记未读
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type OptProject = (typeof RECENT_PROJECTS)[0];

// ── Metric badge for project selector ────────────────────────────────
function MetricPill({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <span style={{ fontSize: 9, fontFamily: "monospace", padding: "2px 7px", borderRadius: 4,
      background: good === false ? "rgba(217,48,37,0.07)" : "rgba(26,115,232,0.07)",
      color: good === false ? "#d93025" : C.accent, marginRight: 4 }}>
      {label} {value}
    </span>
  );
}

// ── Optimization workspace (after project is chosen) ──────────────────
function OptWorkspace({ project, onBack }: { project: OptProject; onBack: () => void }) {
  const [algorithm, setAlgorithm] = useState("ga");
  const [objectives, setObjectives] = useState({
    s11:  { on: true,  weight: 40, target: project.results.s11 - 6 },
    gain: { on: true,  weight: 30, target: +(project.results.gain + 1.5).toFixed(1) },
    bw:   { on: true,  weight: 20, target: Math.round(project.results.bw * 1.4) },
    vswr: { on: false, weight: 10, target: +(project.results.vswr * 0.85).toFixed(2) },
    eff:  { on: false, weight: 0,  target: Math.min(98, project.results.eff + 5) },
  });
  const [ranges, setRanges] = useState({
    patchL:  { min: +(project.params.patchL * 0.85).toFixed(1), max: +(project.params.patchL * 1.15).toFixed(1), locked: false },
    patchW:  { min: +(project.params.patchW * 0.85).toFixed(1), max: +(project.params.patchW * 1.15).toFixed(1), locked: false },
    feedPos: { min: +(project.params.feedPos * 0.7).toFixed(1),  max: +(project.params.feedPos * 1.3).toFixed(1),  locked: false },
    er:      { min: project.params.er, max: project.params.er, locked: true },
  });
  const [optState, setOptState] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [vizTab, setVizTab] = useState(0);

  // Derived optimized results (scaled from project's actual results)
  const optAfter = {
    s11: +(project.results.s11 - 6.4).toFixed(1),
    gain: +(project.results.gain + 1.6).toFixed(1),
    vswr: +(project.results.vswr * 0.875).toFixed(2),
    bw: Math.round(project.results.bw * 1.46),
    eff: Math.min(99, +(project.results.eff + 4.8).toFixed(1)),
    patchL: +(project.params.patchL * 0.967).toFixed(1),
    patchW: +(project.params.patchW * 0.970).toFixed(1),
    feedPos: +(project.params.feedPos * 0.951).toFixed(1),
  };

  const handleRun = () => {
    setOptState("running"); setProgress(0); setLog([]);
    const msgs = OPT_LOGS[algorithm];
    let msgIdx = 0;
    const iv = setInterval(() => {
      setProgress(p => {
        const np = p + 1.5;
        const threshold = (msgIdx + 1) / msgs.length * 100;
        if (np >= threshold && msgIdx < msgs.length) {
          setLog(l => [...l, msgs[msgIdx++]]);
        }
        if (np >= 100) { clearInterval(iv); setOptState("done"); return 100; }
        return np;
      });
    }, 65);
  };

  const setObj = (k: keyof typeof objectives, field: string, val: unknown) =>
    setObjectives(o => ({ ...o, [k]: { ...o[k], [field]: val } }));
  const setRange = (k: keyof typeof ranges, field: string, val: unknown) =>
    setRanges(r => ({ ...r, [k]: { ...r[k], [field]: val } }));

  const OBJ_LABELS: Record<string, [string, string, string]> = {
    s11:  ["S11 最小化", "目标 ≤", "dB"],
    gain: ["增益最大化", "目标 ≥", "dBi"],
    bw:   ["带宽最大化", "目标 ≥", "MHz"],
    vswr: ["VSWR 最小化","目标 ≤", ""],
    eff:  ["效率最大化", "目标 ≥", "%"],
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa" }}>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-shrink-0"
        style={{ padding: "0 20px", height: 38, background: "#fff", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} className="flex items-center gap-1"
          style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
          <ChevronLeft size={13} />天线优化
        </button>
        <ChevronRight size={11} style={{ color: C.text3 }} />
        <span style={{ fontSize: 12, color: C.text1, fontWeight: 500 }}>{project.title}</span>
        <span style={{ fontSize: 10, color: C.accent, background: C.accentD, padding: "1px 8px", borderRadius: 4, marginLeft: 4 }}>{project.tag}</span>
        <span style={{ fontSize: 10, color: C.text3, marginLeft: 4 }}>{project.freq} GHz</span>
      </div>

      {/* Main workspace row */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ── Left config panel ── */}
      <div style={{ width: 252, background: "#fff", borderRight: `1px solid ${C.border}`, overflow: "auto", scrollbarWidth: "none" as const, flexShrink: 0 }}>
        <div style={{ padding: "12px 14px" }}>

          {/* Objectives */}
          <p style={{ fontSize: 11, fontWeight: 600, color: C.text1, marginBottom: 10 }}>优化目标</p>
          {Object.entries(objectives).map(([k, obj]) => {
            const [label, prefix, unit] = OBJ_LABELS[k];
            return (
              <div key={k} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2" style={{ marginBottom: obj.on ? 6 : 0 }}>
                  <button onClick={() => setObj(k as keyof typeof objectives, "on", !obj.on)}
                    style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${obj.on ? C.accent : C.borderA}`, background: obj.on ? C.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    {obj.on && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                  </button>
                  <span style={{ fontSize: 11, color: obj.on ? C.text1 : C.text3, flex: 1 }}>{label}</span>
                  {obj.on && (
                    <span style={{ fontSize: 10, color: C.accent, fontFamily: "monospace", background: C.accentD, padding: "1px 6px", borderRadius: 4 }}>
                      {prefix} {obj.target}{unit}
                    </span>
                  )}
                </div>
                {obj.on && (
                  <div>
                    <div className="flex items-center justify-between" style={{ fontSize: 9, color: C.text3, marginBottom: 3 }}>
                      <span>权重</span><span>{obj.weight}%</span>
                    </div>
                    <div style={{ position: "relative", height: 3, background: "#f1f3f4", borderRadius: 2 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", background: C.accent, borderRadius: 2, width: `${obj.weight}%` }} />
                      <input type="range" min={0} max={60} value={obj.weight}
                        onChange={e => setObj(k as keyof typeof objectives, "weight", +e.target.value)}
                        style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Algorithm */}
          <p style={{ fontSize: 11, fontWeight: 600, color: C.text1, margin: "12px 0 8px" }}>优化算法</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            {OPT_ALGORITHMS.map(a => (
              <button key={a.id} onClick={() => setAlgorithm(a.id)}
                style={{ padding: "8px 6px", borderRadius: 8, textAlign: "center", cursor: "pointer",
                  background: algorithm === a.id ? C.accentD : "#f8f9fa",
                  border: algorithm === a.id ? `1.5px solid ${C.accent}` : `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, fontWeight: algorithm === a.id ? 600 : 400, color: algorithm === a.id ? C.accent : C.text1, marginBottom: 2 }}>{a.name}</p>
                <p style={{ fontSize: 9, color: C.text3, lineHeight: 1.3 }}>{a.desc.slice(0, 18)}…</p>
              </button>
            ))}
          </div>
          <div style={{ background: "#f8f9fa", borderRadius: 8, padding: "8px 10px", marginBottom: 14, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 10, color: C.text2, lineHeight: 1.5 }}>{OPT_ALGORITHMS.find(a => a.id === algorithm)?.desc}</p>
          </div>

          {/* Parameter ranges */}
          <p style={{ fontSize: 11, fontWeight: 600, color: C.text1, marginBottom: 8 }}>参数范围</p>
          {Object.entries(ranges).map(([k, r]) => {
            const labels: Record<string, string> = { patchL: "贴片长度 L", patchW: "贴片宽度 W", feedPos: "馈电偏移 d", er: "介电常数 εr" };
            const units: Record<string, string> = { patchL: "mm", patchW: "mm", feedPos: "mm", er: "" };
            return (
              <div key={k} style={{ marginBottom: 10 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: r.locked ? C.text3 : C.text2 }}>{labels[k]}</span>
                  <button onClick={() => setRange(k as keyof typeof ranges, "locked", !r.locked)}
                    style={{ fontSize: 9, color: r.locked ? C.amber : C.green, background: "transparent", border: `1px solid ${r.locked ? "#f9a825" : C.green}`, padding: "1px 7px", borderRadius: 4, cursor: "pointer" }}>
                    {r.locked ? "🔒 锁定" : "🔓 可调"}
                  </button>
                </div>
                {!r.locked && (
                  <div className="flex items-center gap-2" style={{ fontSize: 10, fontFamily: "monospace" }}>
                    <input type="number" value={r.min} onChange={e => setRange(k as keyof typeof ranges, "min", +e.target.value)}
                      style={{ width: 52, padding: "3px 6px", border: `1px solid ${C.borderA}`, borderRadius: 4, fontSize: 10, color: C.text1, background: "#fff" }} />
                    <span style={{ color: C.text3 }}>–</span>
                    <input type="number" value={r.max} onChange={e => setRange(k as keyof typeof ranges, "max", +e.target.value)}
                      style={{ width: 52, padding: "3px 6px", border: `1px solid ${C.borderA}`, borderRadius: 4, fontSize: 10, color: C.text1, background: "#fff" }} />
                    <span style={{ color: C.text3 }}>{units[k]}</span>
                  </div>
                )}
                {r.locked && (
                  <p style={{ fontSize: 10, color: C.text3, fontFamily: "monospace" }}>{r.min} {units[k]} (固定)</p>
                )}
              </div>
            );
          })}

          {/* Run button */}
          <button onClick={handleRun} disabled={optState === "running"}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl mt-4"
            style={{ fontSize: 12, fontWeight: 600, background: optState === "running" ? "#f1f3f4" : C.accent, color: optState === "running" ? C.text3 : "#fff", border: "none", cursor: optState === "running" ? "default" : "pointer" }}>
            {optState === "running" ? <><RefreshCw size={13} className="animate-spin" />优化运行中…</> : <><Play size={13} />开始优化</>}
          </button>
          {optState === "done" && (
            <button className="w-full flex items-center justify-center gap-2 py-2 rounded-xl mt-2"
              style={{ fontSize: 11, fontWeight: 500, background: "#fff", color: C.green, border: `1px solid ${C.green}`, cursor: "pointer" }}>
              <CheckCircle size={12} />应用优化参数
            </button>
          )}
        </div>
      </div>

      {/* ── Right result panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Tab bar */}
        <div className="flex items-center flex-shrink-0" style={{ background: "#fff", borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
          {["收敛历史", "参数演化", "结果对比"].map((t, i) => (
            <button key={t} onClick={() => setVizTab(i)}
              style={{ padding: "10px 14px", fontSize: 12, fontWeight: vizTab === i ? 500 : 400, color: vizTab === i ? C.accent : C.text2, background: "transparent", border: "none", borderBottom: vizTab === i ? `2px solid ${C.accent}` : "2px solid transparent", cursor: "pointer" }}>
              {t}
            </button>
          ))}
          {optState !== "idle" && (
            <div className="ml-auto flex items-center gap-2">
              {optState === "running" && (
                <div className="flex items-center gap-2">
                  <div style={{ width: 100, height: 4, background: "#f1f3f4", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: C.accent, borderRadius: 2, transition: "width 0.1s" }} />
                  </div>
                  <span style={{ fontSize: 10, color: C.text2, fontFamily: "monospace" }}>{progress.toFixed(0)}%</span>
                </div>
              )}
              {optState === "done" && (
                <span style={{ fontSize: 10, color: C.green, fontWeight: 500 }}>✓ 优化完成</span>
              )}
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden" style={{ padding: "16px 20px" }}>

          {/* 收敛历史 */}
          {vizTab === 0 && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 11, color: C.text2 }}>适应度函数值 vs 迭代次数</p>
                {optState === "idle" && <p style={{ fontSize: 10, color: C.text3 }}>点击"开始优化"查看收敛过程</p>}
              </div>
              <div style={{ flex: 1 }}>
                {optState !== "idle" ? (
                  <SvgLineChart
                    data={CONV_DATA.slice(0, optState === "running" ? Math.ceil(progress) : 100)}
                    xKey="iter" yKey="fitness" stroke={C.accent}
                    yDomain={[0.5, 1.0]} yTicks={[0.5, 0.6, 0.7, 0.8, 0.9, 1.0]}
                    xTickIdxs={[0, 24, 49, 74, 99].filter(i => i < (optState === "running" ? Math.ceil(progress) : 100))}
                    yFmt={v => v.toFixed(1)} xFmt={v => `${v}`} />
                ) : (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.accentD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Activity size={28} style={{ color: C.accent }} />
                    </div>
                    <p style={{ fontSize: 12, color: C.text2 }}>选择优化目标和算法，然后点击"开始优化"</p>
                  </div>
                )}
              </div>
              {/* Optimizer log */}
              {log.length > 0 && (
                <div style={{ marginTop: 12, background: "#1e2430", borderRadius: 8, padding: "8px 12px", maxHeight: 100, overflow: "auto", scrollbarWidth: "none" as const }}>
                  {log.map((l, i) => (
                    <div key={i} style={{ fontSize: 9.5, fontFamily: "monospace", color: l.includes("✓") ? "#34a853" : "#7090b0", marginBottom: 2 }}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 参数演化 */}
          {vizTab === 1 && (
            <div style={{ height: "100%" }}>
              {optState === "idle" ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 12, color: C.text3 }}>运行优化后查看参数演化轨迹</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 11, color: C.text2, marginBottom: 14 }}>各参数在优化过程中的取值变化</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "贴片长度 L (mm)", before: project.params.patchL,  after: optAfter.patchL,  min: ranges.patchL.min,  max: ranges.patchL.max },
                      { label: "贴片宽度 W (mm)", before: project.params.patchW,  after: optAfter.patchW,  min: ranges.patchW.min,  max: ranges.patchW.max },
                      { label: "馈电偏移 d (mm)", before: project.params.feedPos, after: optAfter.feedPos, min: ranges.feedPos.min, max: ranges.feedPos.max },
                      { label: "介电常数 εr",     before: project.params.er,      after: project.params.er, min: project.params.er, max: project.params.er },
                    ].map(({ label, before, after, min, max }) => {
                      const range = max - min;
                      const beforePct = range > 0 ? ((before - min) / range) * 100 : 50;
                      const afterPct  = range > 0 ? ((after - min) / range) * 100 : 50;
                      return (
                        <div key={label} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                          <p style={{ fontSize: 10, color: C.text2, marginBottom: 10 }}>{label}</p>
                          <div style={{ position: "relative", height: 28, background: "#f1f3f4", borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
                            <div style={{ position: "absolute", left: `${beforePct}%`, top: 0, bottom: 0, width: 2, background: "#dadce0" }} />
                            <div style={{ position: "absolute", left: `${afterPct}%`, top: 4, bottom: 4, width: 4, background: C.accent, borderRadius: 2 }} />
                          </div>
                          <div className="flex items-center justify-between" style={{ fontSize: 10 }}>
                            <span style={{ color: C.text3 }}>初始: <span style={{ fontFamily: "monospace", color: C.text2 }}>{before}</span></span>
                            <span style={{ color: C.accent }}>最优: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{after}</span></span>
                            <span style={{ color: before === after ? C.text3 : Math.abs(after - before) > 0 ? C.green : C.amber, fontSize: 9 }}>
                              {before === after ? "固定" : `Δ${(after - before).toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 结果对比 */}
          {vizTab === 2 && (
            <div style={{ height: "100%", overflow: "auto", scrollbarWidth: "none" as const }}>
              {optState === "idle" ? (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 12, color: C.text3 }}>运行优化后查看性能对比</p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 11, color: C.text2, marginBottom: 12 }}>
                    {optState === "running" ? "优化进行中，结果预览…" : "优化完成 — 性能全面提升"}
                  </p>
                  {/* Performance metrics comparison */}
                  <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 12 }}>
                    <div className="flex" style={{ background: "#f8f9fa", borderBottom: `1px solid ${C.border}`, padding: "8px 16px" }}>
                      {["指标", "优化前", "优化后", "改善"].map(h => (
                        <span key={h} style={{ flex: h === "指标" ? 1.5 : 1, fontSize: 10, fontWeight: 600, color: C.text2 }}>{h}</span>
                      ))}
                    </div>
                    {[
                      { label: `S11 @ ${project.freq}GHz`, before: `${project.results.s11} dB`,  after: `${optAfter.s11} dB`,   delta: `↑ ${(-optAfter.s11 + project.results.s11).toFixed(1)} dB`, good: true },
                      { label: "增益",                     before: `${project.results.gain} dBi`, after: `${optAfter.gain} dBi`, delta: `↑ ${(optAfter.gain-project.results.gain).toFixed(1)} dBi`, good: true },
                      { label: "VSWR",                     before: `${project.results.vswr}`,    after: `${optAfter.vswr}`,     delta: `↓ ${(project.results.vswr-optAfter.vswr).toFixed(2)}`,     good: true },
                      { label: "-10dB 带宽",               before: `${project.results.bw} MHz`,  after: `${optAfter.bw} MHz`,   delta: `↑ ${optAfter.bw-project.results.bw} MHz`,                  good: true },
                      { label: "辐射效率",                 before: `${project.results.eff}%`,    after: `${optAfter.eff}%`,     delta: `↑ ${(optAfter.eff-project.results.eff).toFixed(1)}%`,       good: true },
                    ].map(({ label, before, after, delta, good }) => (
                      <div key={label} className="flex items-center" style={{ padding: "9px 16px", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ flex: 1.5, fontSize: 11, color: C.text2 }}>{label}</span>
                        <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: C.text3 }}>{before}</span>
                        <span style={{ flex: 1, fontSize: 11, fontFamily: "monospace", color: C.text1, fontWeight: 600 }}>{after}</span>
                        <span style={{ flex: 1, fontSize: 10, color: good ? C.green : "#d93025", fontWeight: 600 }}>{delta}</span>
                      </div>
                    ))}
                  </div>
                  {/* Parameter comparison */}
                  <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    <div style={{ background: "#f8f9fa", borderBottom: `1px solid ${C.border}`, padding: "8px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.text2 }}>最优参数</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0 }}>
                      {[
                        { label: "贴片长度 L", before: `${project.params.patchL} mm`,  after: `${optAfter.patchL} mm` },
                        { label: "贴片宽度 W", before: `${project.params.patchW} mm`,  after: `${optAfter.patchW} mm` },
                        { label: "馈电偏移 d", before: `${project.params.feedPos} mm`, after: `${optAfter.feedPos} mm` },
                        { label: "介电常数 εr", before: `${project.params.er}`,        after: `${project.params.er}` },
                      ].map(({ label, before, after }) => (
                        <div key={label} style={{ padding: "10px 14px", borderRight: `1px solid ${C.border}` }}>
                          <p style={{ fontSize: 9, color: C.text3, marginBottom: 4 }}>{label}</p>
                          <p style={{ fontSize: 11, fontFamily: "monospace", color: C.text1, fontWeight: 600, marginBottom: 2 }}>{after}</p>
                          <p style={{ fontSize: 9, color: C.text3, textDecoration: "line-through" }}>{before}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      </div>{/* end main workspace row */}
    </div>
  );
}

// ── Optimization Center — project selector first ───────────────────────
function OptimizationCenter() {
  const [selProject, setSelProject] = useState<OptProject | null>(null);
  if (selProject) return <OptWorkspace project={selProject} onBack={() => setSelProject(null)} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8f9fa" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${C.border}`, background: "#fff", flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text1, marginBottom: 4 }}>天线优化</h1>
        <p style={{ fontSize: 12, color: C.text2 }}>选择一个已完成仿真的项目，基于其参数和结果进行优化</p>
      </div>

      {/* Algorithm intro strip */}
      <div className="flex gap-3 flex-shrink-0" style={{ padding: "10px 24px", background: "#fff", borderBottom: `1px solid ${C.border}`, overflowX: "auto", scrollbarWidth: "none" as const }}>
        {OPT_ALGORITHMS.map(a => (
          <div key={a.id} className="flex items-center gap-2 flex-shrink-0 rounded-lg px-3 py-1.5"
            style={{ background: "#f8f9fa", border: `1px solid ${C.border}` }}>
            <a.icon size={13} style={{ color: C.accent }} />
            <span style={{ fontSize: 11, color: C.text1, fontWeight: 500 }}>{a.name}</span>
            <span style={{ fontSize: 10, color: C.text3 }}>·</span>
            <span style={{ fontSize: 10, color: C.text2 }}>{a.desc.slice(0, 14)}…</span>
          </div>
        ))}
      </div>

      {/* Project cards */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", scrollbarWidth: "none" as const }}>
        <p style={{ fontSize: 11, color: C.text3, marginBottom: 12 }}>可优化的项目（已包含仿真结果）</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {RECENT_PROJECTS.map(p => (
            <div key={p.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              {/* Antenna icon */}
              <div style={{ width: 52, height: 52, borderRadius: 10, background: C.accentD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Radio size={24} style={{ color: C.accent, opacity: 0.7 }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{p.title}</span>
                  <span style={{ fontSize: 10, color: C.accent, background: C.accentD, padding: "1px 8px", borderRadius: 4 }}>{p.tag}</span>
                </div>
                <div className="flex items-center gap-3" style={{ fontSize: 10, color: C.text3, marginBottom: 8 }}>
                  <span className="flex items-center gap-1"><FolderOpen size={9} />{p.type}</span>
                  <span className="flex items-center gap-1"><Clock size={9} />{p.date}</span>
                  <span style={{ fontFamily: "monospace" }}>f₀ = {p.freq} GHz</span>
                </div>
                {/* Current metrics */}
                <div className="flex flex-wrap gap-1">
                  <MetricPill label="S11" value={`${p.results.s11} dB`} good={p.results.s11 <= -10} />
                  <MetricPill label="增益" value={`${p.results.gain} dBi`} />
                  <MetricPill label="VSWR" value={`${p.results.vswr}`} good={p.results.vswr <= 1.5} />
                  <MetricPill label="BW" value={`${p.results.bw} MHz`} />
                  <MetricPill label="η" value={`${p.results.eff}%`} />
                </div>
              </div>

              {/* Improvement potential badge */}
              <div style={{ textAlign: "center", flexShrink: 0, marginRight: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>
                  +{(6 + p.id * 0.8).toFixed(0)}%
                </div>
                <div style={{ fontSize: 9, color: C.text3 }}>预估提升空间</div>
              </div>

              {/* CTA */}
              <button onClick={() => setSelProject(p)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg flex-shrink-0"
                style={{ fontSize: 12, fontWeight: 600, background: C.accent, color: "#fff", border: "none", cursor: "pointer" }}>
                <Sliders size={13} />开始优化
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────
type NavKey = "mine" | "mytemplates" | "templates" | "workflow" | "profile" | "messages" | "aichat";

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(loadStoredUser);
  const [activeNav, setActiveNav] = useState<NavKey>("mine");
  const [profileTab, setProfileTab] = useState<"info" | "share" | "storage">("info");
  const [messagesTab, setMessagesTab] = useState<"interaction" | "admin" | "system">("interaction");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNewTmplModal, setShowNewTmplModal] = useState(false);
  const [showUploadLibModal, setShowUploadLibModal] = useState(false);
  const [showAcceptTmplModal, setShowAcceptTmplModal] = useState(false);
  const [showAcceptProjModal, setShowAcceptProjModal] = useState(false);
  const [showAIChatPopup, setShowAIChatPopup] = useState(false);
  const [acceptLinkValue, setAcceptLinkValue] = useState("");
  const [templateViewMode, setTemplateViewMode] = useState<"grid" | "list">("grid");
  const [myTemplates, setMyTemplates] = useState(MY_TEMPLATES);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const toggleFav = useCallback((id: number) => {
    setFavorites(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  // Dismiss context menu on nav / Escape
  useEffect(() => { setCtxMenu(null); setRenameTarget(null); setDetailTemplate(null); setProjCtxMenu(null); setProjRenameTarget(null); }, [activeNav]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setCtxMenu(null); setRenameTarget(null); setProjCtxMenu(null); setProjRenameTarget(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── 我的项目 search/filter/sort state ──
  const [projFilters, setProjFilters] = useState<FilterSelections>(emptyFilters);
  const [projFilterOpen, setProjFilterOpen] = useState(false);
  const [projSortBy, setProjSortBy] = useState<"created" | "modified" | "name">("created");
  const [projSortOpen, setProjSortOpen] = useState(false);
  const [projViewMode, setProjViewMode] = useState<"grid" | "list">("grid");

  // ── Template search state ──
  const [tmplFilters, setTmplFilters] = useState<FilterSelections>(emptyFilters);
  const [tmplFilterOpen, setTmplFilterOpen] = useState(false);
  const [tmplSortBy, setTmplSortBy] = useState<"created" | "modified" | "name">("created");
  const [tmplSortOpen, setTmplSortOpen] = useState(false);
  const [tmplFavorites, setTmplFavorites] = useState<Set<string>>(new Set());
  const toggleTmplFav = useCallback((name: string) => {
    setTmplFavorites(prev => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  }, []);
  // ── Context menu ──
  const [ctxMenu, setCtxMenu] = useState<{ name: string; x: number; y: number } | null>(null);
  const [projCtxMenu, setProjCtxMenu] = useState<{ id: number; name: string; x: number; y: number } | null>(null);
  const [projRenameTarget, setProjRenameTarget] = useState<number | null>(null);
  const [projRenameValue, setProjRenameValue] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareTarget, setShareTarget] = useState<string | null>(null);
  const [detailTemplate, setDetailTemplate] = useState<{ name: string; category: string; desc: string; freq: string; date: string; privacy: "private" | "public" } | null>(null);
  const [sharePermission, setSharePermission] = useState<"view" | "copy">("view");
  const [shareExpiry, setShareExpiry] = useState("7");
  const [shareLink, setShareLink] = useState("");
  const [shareStep, setShareStep] = useState<"perm" | "link">("perm");
  const [showProjShareModal, setShowProjShareModal] = useState(false);
  const [projShareName, setProjShareName] = useState("");
  const [projShareResults, setProjShareResults] = useState(false);
  const [projShareExpiry, setProjShareExpiry] = useState("7");
  const [projShareStep, setProjShareStep] = useState<"settings" | "link">("settings");
  const [projShareLink, setProjShareLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [openProject, setOpenProject] = useState<(typeof RECENT_PROJECTS)[0] | null>(null);
  // ── Folder / project warehouse state ──
  const [projectFolders, setProjectFolders] = useState([
    { name: "5G 毫米波项目", date: "2026-07-15" },
    { name: "WiFi 天线设计", date: "2026-06-20" },
    { name: "卫星通信阵列", date: "2026-05-10" },
  ]);
  const [folderProjects, setFolderProjects] = useState<Record<string, (typeof RECENT_PROJECTS)>>({
    "5G 毫米波项目": [RECENT_PROJECTS[0], RECENT_PROJECTS[1]],
    "WiFi 天线设计": [RECENT_PROJECTS[2], { ...RECENT_PROJECTS[1], id: 4, title: "28GHz 阵列优化", freq: 28, tag: "毫米波相控阵", results: { s11: -16.5, gain: 20.1, vswr: 1.35, bw: 520, eff: 82.4 } }],
    "卫星通信阵列": [{ ...RECENT_PROJECTS[2], id: 5, title: "Ku 波段卫星天线", freq: 12, tag: "缝隙阵列", results: { s11: -15.8, gain: 18.6, vswr: 1.42, bw: 380, eff: 79.8 } }],
  });
  const [projectFolder, setProjectFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showNewProjWizard, setShowNewProjWizard] = useState(false);
  const [newProjName, setNewProjName] = useState("");

  const [activeStep, setActiveStep] = useState(5);
  const [antennaType, setAntennaType] = useState(0);

  const [params, setParams] = useState({ freq: 2.45, patchL: 38.5, patchW: 47.2, subH: 1.6, er: 4.40, feedPos: 12.3 });
  const setParam = useCallback((key: keyof typeof params) => (v: number) => setParams(p => ({ ...p, [key]: v })), []);

  const handleLogin = (info: UserInfo) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(info));
    setUser(info);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setActiveNav("mine");
    setOpenProject(null);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f8f9fa", fontFamily: "'Inter', 'Noto Sans SC', sans-serif" }}>

                {!user ? (
                  <LoginPage onLogin={handleLogin} />
                ) : (<>


                {/* FULL-WIDTH TOP BAR */}
                <div className="flex items-center gap-3 px-4 flex-shrink-0"
                  style={{ height: 48, background: "#ffffff", borderBottom: `1px solid ${C.border}` }}>
                  {/* Logo */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.accent }}>
                      <Radio size={13} className="text-white" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text1, whiteSpace: "nowrap" }}>优天线</span>
                  </div>

                  <div style={{ flex: 1 }} />
                  {/* Right controls */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Pink avatar */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                      style={{ background: "#e91e8c" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{userInitial(user.name)}</span>
                    </div>
                  </div>
                </div>

                {/* BODY: Sidebar + Main */}
                <div className="flex flex-1 overflow-hidden">

                  {/* ══ LEFT SIDEBAR ══ */}
                  <div className="flex flex-col flex-shrink-0" style={{ width: sidebarCollapsed ? 56 : 220, background: "#ffffff", borderRight: `1px solid ${C.border}`, transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", paddingTop: 4 }}>

                      {/* ∨ 项目 section — mirrors SimScale exactly */}
                      <SectionHeader label="项目" sidebarCollapsed={sidebarCollapsed} />
                      <NavItem icon={FolderOpen} label="项目仓库" active={activeNav === "mine"}      onClick={() => setActiveNav("mine")} collapsed={sidebarCollapsed} />
                      <NavItem icon={Grid3X3}    label="模板广场"   active={activeNav === "templates"} onClick={() => setActiveNav("templates")} collapsed={sidebarCollapsed} />
                      <NavItem icon={Layers}   label="我的模板" active={activeNav === "mytemplates"} onClick={() => setActiveNav("mytemplates")} collapsed={sidebarCollapsed} />


                      {/* ∨ 账号 section */}
                      <SectionHeader label="账号" sidebarCollapsed={sidebarCollapsed} />
                      <NavItem icon={User} label="个人中心" active={activeNav === "profile"} onClick={() => { setActiveNav("profile"); setProfileTab("info"); }} collapsed={sidebarCollapsed} />
                      <NavItem icon={Bell} label="消息中心" active={activeNav === "messages"} onClick={() => setActiveNav("messages")} collapsed={sidebarCollapsed} />
                      <NavItem icon={MessageSquare} label="AI助手" active={activeNav === "aichat"} onClick={() => setActiveNav("aichat")} collapsed={sidebarCollapsed} />
                    </div>

                    {/* ── Storage bar ── */}
                    {!sidebarCollapsed && (
                      <div style={{ padding: "10px 14px", flexShrink: 0 }}>
                        <div
                          onClick={() => { setActiveNav("profile"); setProfileTab("storage"); }}
                          className="rounded-xl p-3"
                          style={{ background: "#fff", border: `1px solid ${C.border}`, cursor: "pointer", transition: "box-shadow 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.text2 }}>存储空间</span>
                            <span style={{ fontSize: 10, fontFamily: "monospace", color: C.accent, fontWeight: 600 }}>24%</span>
                          </div>
                          <div style={{ height: 4, background: "#f1f3f4", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: "24%", background: C.accent, borderRadius: 2, transition: "width 0.3s" }} />
                          </div>
                          <div style={{ fontSize: 9, color: C.text3, marginTop: 5 }}>
                            已用 12.5 GB / 50 GB
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Collapse toggle ── */}
                    <div style={{ borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                      <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="flex items-center w-full"
                        style={{
                          padding: sidebarCollapsed ? "10px 0" : "10px 16px",
                          justifyContent: sidebarCollapsed ? "center" : "flex-start",
                          gap: 8,
                          color: C.text2, fontSize: 11, fontWeight: 500,
                          background: "transparent", border: "none",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        {sidebarCollapsed ? (
                          <ChevronRight size={14} style={{ color: C.text3 }} />
                        ) : (
                          <>
                            <ChevronLeft size={14} style={{ color: C.text3 }} />
                            <span>折叠侧边栏</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ══ MAIN CONTENT ══ */}
                  <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#f8f9fa", position: "relative" }}>

                    {/* Project detail overlay */}
                    {openProject && (
                      <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "#f8f9fa" }}>
                        <ProjectDetail project={openProject} onBack={() => setOpenProject(null)} />
                      </div>
                    )}

                    {/* Template detail overlay */}
                    {detailTemplate && (
                      <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "#f8f9fa" }}>
                        <TemplateDetail template={detailTemplate} onBack={() => setDetailTemplate(null)} />
                      </div>
                    )}

                    {/* ── Project right-click context menu ── */}
                    {projCtxMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setProjCtxMenu(null)} />
                        <div className="fixed z-50"
                          style={{ left: projCtxMenu.x, top: projCtxMenu.y, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.14)", padding: "4px", minWidth: 148 }}>
                          <button onClick={() => { setProjRenameTarget(projCtxMenu.id); setProjRenameValue(projCtxMenu.name); setProjCtxMenu(null); }}
                            className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                            style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                            <Pencil size={13} style={{ color: C.text2 }} />重命名
                          </button>
                          <button onClick={() => { setShowProjShareModal(true); setProjShareName(projCtxMenu.name); setProjShareStep("settings"); setProjShareLink(""); setProjCtxMenu(null); }}
                            className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                            style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                            <Share2 size={13} style={{ color: C.text2 }} />分享
                          </button>
                          <button onClick={() => { setProjCtxMenu(null); }}
                            className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                            style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                            <Copy size={13} style={{ color: C.text2 }} />复制
                          </button>
                          <div style={{ height: 1, background: C.border, margin: "2px 0" }} />
                          <button onClick={() => { setProjCtxMenu(null); }}
                            className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                            style={{ fontSize: 12, color: "#d93025", background: "transparent", border: "none", cursor: "pointer" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#fef0f0")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                            <Trash2 size={13} style={{ color: "#d93025" }} />删除
                          </button>
                        </div>
                      </>
                    )}

                    {/* ── Project rename modal ── */}
                    {projRenameTarget !== null && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto rounded-xl overflow-hidden"
                          style={{ width: 360, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
                          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-2">
                              <Pencil size={15} style={{ color: C.accent }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>重命名项目</span>
                            </div>
                            <button onClick={() => setProjRenameTarget(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
                              <X size={15} />
                            </button>
                          </div>
                          <div style={{ padding: "20px 24px" }}>
                            <p style={{ fontSize: 11, color: C.text2, marginBottom: 10 }}>输入新的项目名称：</p>
                            <input
                              value={projRenameValue}
                              onChange={(e) => setProjRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && projRenameValue.trim()) {
                                  // update in all project lists - mock
                                  setProjRenameTarget(null);
                                }
                              }}
                              autoFocus
                              style={{ width: "100%", padding: "8px 12px", fontSize: 13, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                              onFocus={(e) => (e.target.style.borderColor = C.accent)}
                              onBlur={(e) => (e.target.style.borderColor = C.borderA)}
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                            <button onClick={() => setProjRenameTarget(null)}
                              style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 14px" }}>
                              取消
                            </button>
                            <button onClick={() => {
                              if (projRenameValue.trim()) {
                                setProjRenameTarget(null);
                              }
                            }} disabled={!projRenameValue.trim()}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                              style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: projRenameValue.trim() ? C.accent : C.borderA, border: "none", cursor: projRenameValue.trim() ? "pointer" : "default" }}>
                              <CheckCircle size={13} />确认改名
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Project share modal ── */}
                    {showProjShareModal && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto rounded-xl overflow-hidden"
                          style={{ width: 480, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
                          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-2">
                              <Share2 size={15} style={{ color: C.accent }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>分享项目</span>
                            </div>
                            <button onClick={() => setShowProjShareModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}><X size={15} /></button>
                          </div>

                          {/* Step indicator */}
                          <div className="flex items-center gap-3 px-5 py-3" style={{ background: "#fafbfc", borderBottom: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700 }}>1</div>
                              <span style={{ fontSize: 11, fontWeight: projShareStep === "settings" ? 600 : 400, color: C.text1 }}>设置</span>
                            </div>
                            <div style={{ width: 32, height: 1, background: projShareStep === "link" ? C.accent : C.borderA }} />
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: projShareStep === "link" ? C.accent : "#f1f3f4", color: projShareStep === "link" ? "#fff" : C.text3, fontSize: 10, fontWeight: 700 }}>2</div>
                              <span style={{ fontSize: 11, fontWeight: projShareStep === "link" ? 600 : 400, color: projShareStep === "link" ? C.text1 : C.text3 }}>生成链接</span>
                            </div>
                          </div>

                          <div style={{ padding: "20px 24px", minHeight: 200 }}>
                            {projShareStep === "settings" && (
                              <>
                                <p style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>项目名称</p>
                                <p style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 18 }}>{projShareName}</p>

                                <div className="flex items-center justify-between mb-4 p-3 rounded-lg" style={{ background: "#f8f9fa", border: `1px solid ${C.border}` }}>
                                  <div>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: C.text1 }}>包含项目结果</span>
                                    <p style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>分享时将包含仿真结果与优化数据</p>
                                  </div>
                                  <button onClick={() => setProjShareResults(!projShareResults)}
                                    style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                                      background: projShareResults ? C.accent : "#dadce0", position: "relative", transition: "background 0.15s" }}>
                                    <div style={{ position: "absolute", top: 2, left: projShareResults ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                                  </button>
                                </div>

                                <p style={{ fontSize: 12, fontWeight: 500, color: C.text1, marginBottom: 10 }}>链接有效期</p>
                                <div className="flex gap-2">
                                  {[
                                    { v: "1", label: "1 天" },
                                    { v: "7", label: "7 天" },
                                    { v: "15", label: "15 天" },
                                    { v: "30", label: "30 天" },
                                  ].map(({ v, label }) => (
                                    <button key={v} onClick={() => setProjShareExpiry(v)}
                                      style={{
                                        flex: 1, padding: "8px 4px", fontSize: 12, fontWeight: projShareExpiry === v ? 600 : 400,
                                        color: projShareExpiry === v ? C.accent : C.text2,
                                        background: projShareExpiry === v ? C.accentD : "#f8f9fa",
                                        border: projShareExpiry === v ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                                        borderRadius: 8, cursor: "pointer", textAlign: "center",
                                      }}>
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}

                            {projShareStep === "link" && (
                              <>
                                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: "#f8f9fa", border: `1px solid ${C.border}` }}>
                                  <FileText size={14} style={{ color: C.accent, flexShrink: 0 }} />
                                  <span style={{ fontSize: 12, color: C.text1, flex: 1 }}>{projShareName}</span>
                                  <span style={{ fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 4, background: "rgba(242,153,0,0.08)", color: C.amber, border: "1px solid rgba(242,153,0,0.2)" }}>{projShareExpiry} 天</span>
                                </div>
                                <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 6 }}>分享链接</p>
                                <div className="flex items-center gap-2 mb-4">
                                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "#f8f9fa", border: `1px solid ${C.borderA}`, borderRadius: 8, fontSize: 11, fontFamily: "monospace", color: C.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    <Link size={12} style={{ color: C.accent, flexShrink: 0 }} />
                                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{projShareLink}</span>
                                  </div>
                                  <button onClick={() => { navigator.clipboard.writeText(projShareLink); }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                                    style={{ fontSize: 11, color: C.accent, background: C.accentD, border: `1px solid rgba(26,115,232,0.2)`, cursor: "pointer", whiteSpace: "nowrap" }}>
                                    <Copy size={11} />复制
                                  </button>
                                </div>
                                <div className="p-3 rounded-lg" style={{ background: "rgba(52,168,83,0.04)", border: "1px solid rgba(52,168,83,0.12)" }}>
                                  <p style={{ fontSize: 10, color: C.text2 }}>
                                    ✓ 链接已生成 · {projShareResults ? "包含仿真结果" : "仅项目参数"} · 有效期 {projShareExpiry} 天 · 过期后自动失效
                                  </p>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                            {projShareStep === "settings" ? (
                              <>
                                <button onClick={() => setShowProjShareModal(false)}
                                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>取消</button>
                                <button onClick={() => {
                                  const base = "https://antennadesign.huawei.com/share/proj/";
                                  const code = Math.random().toString(36).substring(2, 10);
                                  setProjShareLink(`${base}${code}`);
                                  setProjShareStep("link");
                                }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                                  style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                                  下一步 <ChevronRight size={13} />
                                </button>
                              </>
                            ) : (
                              <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                                <button onClick={() => setShowProjShareModal(false)}
                                  style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>关闭</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                        {activeNav === "mine" && (() => {
                      const currentProjects = projectFolder ? (folderProjects[projectFolder] || []) : [];
                      const folderCounts: Record<string, number> = {};
                      for (const f of projectFolders) { folderCounts[f.name] = (folderProjects[f.name] || []).length; }

                      const projFilterTags = getFilterTags(projFilters);
                      const tagFiltered = currentProjects.filter(p => {
                        if (projFilters.antennaTypes.size > 0 && !projFilters.antennaTypes.has(p.tag)) return false;
                        if (projFilters.freqBands.size > 0) return true;
                        if (projFilters.downloaded.size > 0) return true;
                        if (projFilters.createdPeriod.size > 0) return true;
                        if (projFilterTags.length === 0) return true;
                        return projFilterTags.some(tag => p.tag === tag || p.title.includes(tag) || p.author.includes(tag));
                      });
                      const sorted = [...tagFiltered].sort((a, b) => {
                        if (projSortBy === "name") return a.title.localeCompare(b.title);
                        return a.date.localeCompare(b.date);
                      });

                      if (!projectFolder) {
                        // ── FOLDER LIST VIEW ──
                        return (<>
                          <div style={{ padding: "14px 24px 10px", background: "#fff", flexShrink: 0 }}>
                            <div className="flex items-center justify-between">
                              <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text1 }}>项目仓库</h1>
                              <div className="flex items-center gap-2">
                                <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                                  style={{ fontSize: 11, color: C.text2, background: "#f1f3f4", border: "1px solid "+C.borderA, cursor: "pointer" }}>
                                  <RefreshCw size={11} />
                                </button>
                                <button onClick={() => { setShowAcceptProjModal(true); setAcceptLinkValue(""); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                                  style={{ fontSize: 11, color: C.green, background: "rgba(52,168,83,0.08)", border: "1px solid rgba(52,168,83,0.25)", cursor: "pointer" }}>
                                  <Download size={10} />接收项目
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", scrollbarWidth: "none" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                              {projectFolders.map((f) => (
                                <div key={f.name} onClick={() => setProjectFolder(f.name)}
                                  style={{ background: "#fff", border: "1px solid "+C.border, borderRadius: 10, padding: "20px 14px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
                                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
                                  onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                                  <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(242,153,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                                    <FolderOpen size={26} style={{ color: "#f29900" }} />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: C.text1, marginBottom: 4 }}>{f.name}</span>
                                  <span style={{ fontSize: 10, color: C.text3 }}>{f.date} · {folderCounts[f.name] || 0} 个项目</span>
                                </div>
                              ))}
                              {showCreateFolder ? (
                                <div style={{ background: "#fff", border: "2px dashed "+C.accent, borderRadius: 10, padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                                  <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                                    placeholder="文件夹名称" autoFocus
                                    style={{ width: "100%", padding: "5px 8px", fontSize: 11, color: C.text1, border: "1px solid "+C.accent, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                                    onKeyDown={e => {
                                      if (e.key === "Enter" && newFolderName.trim() && !projectFolders.some(f => f.name === newFolderName.trim())) {
                                        setProjectFolders(prev => [...prev, { name: newFolderName.trim(), date: "刚刚" }]);
                                        setFolderProjects(prev => ({ ...prev, [newFolderName.trim()]: [] }));
                                        setNewFolderName(""); setShowCreateFolder(false);
                                      }
                                    }} />
                                  <div className="flex gap-2">
                                    <button onClick={() => {
                                      if (newFolderName.trim() && !projectFolders.some(f => f.name === newFolderName.trim())) {
                                        setProjectFolders(prev => [...prev, { name: newFolderName.trim(), date: "刚刚" }]);
                                        setFolderProjects(prev => ({ ...prev, [newFolderName.trim()]: [] }));
                                        setNewFolderName(""); setShowCreateFolder(false);
                                      }
                                    }} disabled={!newFolderName.trim() || projectFolders.some(f => f.name === newFolderName.trim())}
                                      style={{ fontSize: 10, padding: "4px 12px", borderRadius: 6, background: newFolderName.trim() && !projectFolders.some(f => f.name === newFolderName.trim()) ? C.accent : "#dadce0", color: "#fff", border: "none", cursor: "pointer" }}>创建</button>
                                    <button onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}
                                      style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "transparent", color: C.text2, border: "1px solid "+C.borderA, cursor: "pointer" }}>取消</button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => setShowCreateFolder(true)}
                                  style={{ background: "transparent", border: "2px dashed "+C.accent, borderRadius: 10, padding: "20px 14px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 130 }}>
                                  <span style={{ fontSize: 24, color: C.accent, marginBottom: 6 }}>+</span>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: C.accent }}>创建文件夹</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </>);

                      } else {
                        // ── PROJECT LIST (inside folder) ──
                        return (<>
                          <div style={{ padding: "14px 24px 6px", background: "#fff", flexShrink: 0 }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                              <button onClick={() => setProjectFolder(null)}
                                style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
                                <ChevronLeft size={13} />项目仓库
                              </button>
                              <ChevronRight size={11} style={{ color: C.text3 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{projectFolder}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span style={{ fontSize: 11, color: C.text3 }}>{sorted.length} 个项目</span>
                              <button onClick={() => { setShowAcceptProjModal(true); setAcceptLinkValue(""); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                                style={{ fontSize: 11, color: C.green, background: "rgba(52,168,83,0.08)", border: "1px solid rgba(52,168,83,0.25)", cursor: "pointer" }}>
                                <Download size={10} />接收项目
                              </button>
                            </div>
                          </div>

                          {/* Row 2: search bar + filter + sort + view toggle */}
                          <div style={{ padding: "8px 24px", background: "#fff", borderBottom: "1px solid "+C.border, flexShrink: 0 }} className="flex items-center gap-2.5">
                            <div style={{ position: "relative" }}>
                              <button onClick={() => { setProjFilterOpen(!projFilterOpen); setProjSortOpen(false); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                                style={{ fontSize: 11, color: filterHasAny(projFilters) ? C.accent : C.text2, background: filterHasAny(projFilters) ? C.accentD : "#f8f9fa", border: "1px solid "+(filterHasAny(projFilters) ? C.accent : C.borderA), cursor: "pointer", whiteSpace: "nowrap" }}>
                                <ListFilter size={12} />筛选
                              </button>
                              {projFilterOpen && <FilterCard filters={projFilters} setFilters={setProjFilters} onClose={() => setProjFilterOpen(false)} />}
                            </div>
                            <div style={{ flex: 1, position: "relative" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "#f8f9fa", border: "1px solid "+(projFilterTags.length > 0 ? C.accent : C.borderA), borderRadius: 10, minHeight: 34, boxSizing: "border-box", flexWrap: "wrap" }}>
                                {projFilterTags.map(tag => (
                                  <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 5, background: C.accentD, color: C.accent, border: "1px solid "+C.accent, whiteSpace: "nowrap" }}>
                                    {tag}
                                    <button onClick={(e) => { e.stopPropagation(); setProjFilters(prev => { const next = { ...prev }; ["antennaTypes","freqBands","downloaded","createdPeriod","privacy"].forEach(k => { if (next[k].has(tag)) next[k].delete(tag); }); return next; }); }}
                                      style={{ padding: 0, background: "none", border: "none", cursor: "pointer", color: C.accent, display: "flex" }}><X size={9} /></button>
                                  </span>
                                ))}
                                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, minWidth: 60 }}>
                                  <Search size={12} style={{ color: C.text3, flexShrink: 0 }} />
                                  <span style={{ fontSize: 11, color: C.text3 }}>{projFilterTags.length === 0 ? "点击筛选选择标签筛选项目…" : ""}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ position: "relative" }}>
                              <button onClick={() => { setProjSortOpen(!projSortOpen); setProjFilterOpen(false); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                                style={{ fontSize: 11, color: C.text2, background: "#f8f9fa", border: "1px solid "+C.borderA, cursor: "pointer", whiteSpace: "nowrap" }}><ArrowUpDown size={11} /></button>
                              {projSortOpen && (
                                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#fff", border: "1px solid "+C.border, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 10, padding: "4px", minWidth: 130 }}>
                                  {(["created","创建时间"],["modified","最近修改"],["name","名称"]).map(([k,label]) => (
                                    <button key={k} onClick={() => { setProjSortBy(k); setProjSortOpen(false); }}
                                      className="flex items-center gap-2 w-full text-left rounded-md px-3 py-2"
                                      style={{ fontSize: 11, fontWeight: projSortBy === k ? 500 : 400, color: projSortBy === k ? C.accent : C.text2, background: projSortBy === k ? C.accentD : "transparent", border: "none", cursor: "pointer" }}
                                      onMouseEnter={e => { if (projSortBy !== k) e.currentTarget.style.background = "#f8f9fa"; }}
                                      onMouseLeave={e => { if (projSortBy !== k) e.currentTarget.style.background = "transparent"; }}>
                                      <span style={{ fontSize: 9, width: 16, color: projSortBy === k ? C.accent : C.text3 }}>{projSortBy === k ? "✓" : ""}</span>{label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex rounded-md overflow-hidden" style={{ border: "1px solid "+C.borderA }}>
                              <button onClick={() => setProjViewMode("grid")} className="p-1.5" style={{ background: projViewMode === "grid" ? C.accentD : "transparent", border: "none", cursor: "pointer" }}><Grid3X3 size={12} style={{ color: projViewMode === "grid" ? C.accent : C.text3 }} /></button>
                              <button onClick={() => setProjViewMode("list")} className="p-1.5" style={{ background: projViewMode === "list" ? C.accentD : "transparent", border: "none", cursor: "pointer" }}><LayoutList size={12} style={{ color: projViewMode === "list" ? C.accent : C.text3 }} /></button>
                            </div>
                          </div>

                          {projFilterTags.length > 0 && (
                            <div style={{ padding: "4px 24px", background: "#fff", borderBottom: "1px solid "+C.border, flexShrink: 0 }} className="flex items-center gap-2">
                              <span style={{ fontSize: 10, color: C.text3, flexShrink: 0 }}>当前筛选：</span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, padding: "3px 9px", borderRadius: 6, background: C.accentD, color: C.accent, border: "1px solid "+C.accent }}>
                                {projFilterTags.join(" + ")}
                                <button onClick={() => { setProjFilters(emptyFilters()); }} style={{ padding: 0, background: "none", border: "none", cursor: "pointer", color: C.accent, display: "flex" }}><X size={9} /></button>
                              </span>
                              <span style={{ fontSize: 10, color: C.text3 }}>— {sorted.length} 个结果</span>
                              <button onClick={() => { setProjFilters(emptyFilters()); }} style={{ fontSize: 10, color: "#d93025", background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto" }}>重置筛选</button>
                            </div>
                          )}

                          <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", scrollbarWidth: "none" }} onScroll={() => setCtxMenu(null)}>
                            {showNewProjWizard && projectFolder && (
                              <NewProjectWizard
                                projectFolder={projectFolder}
                                onBack={() => setShowNewProjWizard(false)}
                                onCreate={(name, template) => {
                                  const tagMap: Record<string, string> = { "horn-rect": "矩形喇叭", "horn-circ": "圆形喇叭", "yagi": "八木天线", "patch": "微带贴片", "array": "天线阵列" };
                                  const newProj = { id: Date.now(), title: name, type: "项目仓库", author: "lucky123", date: "刚刚", privacy: "待优化", tag: tagMap[template] || "微带贴片", freq: 2.45, params: { patchL: 38.5, patchW: 47.2, feedPos: 12.3, er: 4.40, h: 1.6 }, results: { s11: -18.3, gain: 6.2, vswr: 1.28, bw: 98, eff: 87.3 } };
                                  setFolderProjects(prev => ({ ...prev, [projectFolder]: [...(prev[projectFolder] || []), newProj] }));
                                }}
                              />
                            )}

                            {projViewMode === "grid" && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                                {sorted.map((p) => <ProjectCard key={p.id} id={p.id} {...p} onOpen={() => setOpenProject(p)} favorited={favorites.has(p.id)} onToggleFav={toggleFav} onMoreClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setProjCtxMenu({ id: p.id, name: p.title, x: Math.min(rect.right, window.innerWidth - 160), y: Math.min(rect.bottom + 4, window.innerHeight - 190) }); }} />)}
                                {showCreateProject ? (
                                  <div style={{ background: "#fff", border: "2px dashed "+C.accent, borderRadius: 10, padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 200 }}>
                                    <input value={newProjName} onChange={e => setNewProjName(e.target.value)}
                                      placeholder="项目名称" autoFocus
                                      style={{ width: "80%", padding: "6px 10px", fontSize: 12, color: C.text1, border: "1px solid "+C.accent, borderRadius: 6, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                                      onKeyDown={e => {
                                        if (e.key === "Enter" && newProjName.trim() && projectFolder && !currentProjects.some(p => p.title === newProjName.trim())) {
                                          setNewProjName(""); setShowCreateProject(false);
                                        }
                                      }} />
                                    <div className="flex gap-2">
                                      <button onClick={() => { if (newProjName.trim() && !currentProjects.some(p => p.title === newProjName.trim())) { setNewProjName(""); setShowCreateProject(false); } }}
                                        disabled={!newProjName.trim() || currentProjects.some(p => p.title === newProjName.trim())}
                                        style={{ fontSize: 10, padding: "4px 14px", borderRadius: 6, background: newProjName.trim() && !currentProjects.some(p => p.title === newProjName.trim()) ? C.accent : "#dadce0", color: "#fff", border: "none", cursor: "pointer" }}>创建</button>
                                      <button onClick={() => { setShowCreateProject(false); setNewProjName(""); }} style={{ fontSize: 10, padding: "4px 12px", borderRadius: 6, background: "transparent", color: C.text2, border: "1px solid "+C.borderA, cursor: "pointer" }}>取消</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => setShowNewProjWizard(true)}
                                    style={{ background: "transparent", border: "2px dashed "+C.accent, borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 200 }}>
                                    <span style={{ fontSize: 24, color: C.accent }}>+</span>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: C.accent }}>创建项目</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {projViewMode === "list" && (
                              <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid "+C.border }}>
                                <div className="flex items-center" style={{ padding: "10px 16px", background: "#fafbfc", borderBottom: "1px solid "+C.border }}>
                                  <span style={{ flex: 2, fontSize: 10, fontWeight: 600, color: C.text3 }}>项目名称</span>
                                  <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text3 }}>天线类型</span>
                                  <span style={{ flex: 0.7, fontSize: 10, fontWeight: 600, color: C.text3 }}>频段</span>
                                  <span style={{ width: 48, fontSize: 10, fontWeight: 600, color: C.text3 }}>收藏</span>
                                  <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text3 }}>优化状态</span>
                                  <span style={{ width: 90, fontSize: 10, fontWeight: 600, color: C.text3 }}>创建时间</span>
                                  <span style={{ width: 72 }} />
                                </div>
                                {sorted.map((p) => (
                                  <div key={p.id} className="flex items-center" style={{ padding: "10px 16px", borderBottom: "1px solid "+C.border, cursor: "pointer" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    onClick={() => setOpenProject(p)}>
                                    <div className="flex items-center gap-2.5" style={{ flex: 2 }}>
                                      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: C.accentD }}><FolderOpen size={12} style={{ color: C.accent }} /></div>
                                      <span style={{ fontSize: 12, fontWeight: 500, color: C.text1 }}>{p.title}</span>
                                    </div>
                                    <span style={{ flex: 1 }}><span style={{ fontSize: 10, color: C.accent, background: C.accentD, padding: "2px 8px", borderRadius: 4 }}>{p.tag}</span></span>
                                    <span style={{ flex: 0.7, fontSize: 10, fontFamily: "monospace", color: C.text2 }}>{p.freq} GHz</span>
                                    <span style={{ width: 48, textAlign: "center" }}>
                                      <button onClick={e => { e.stopPropagation(); toggleFav(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                        <Star size={13} fill={favorites.has(p.id) ? "#f29900" : "none"} stroke={favorites.has(p.id) ? "#f29900" : C.text3} />
                                      </button>
                                    </span>
                                    <span style={{ flex: 1 }}><span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3, background: p.privacy === "已完成" ? "rgba(52,168,83,0.08)" : p.privacy === "优化中" ? C.accentD : p.privacy === "待优化" ? "rgba(242,153,0,0.08)" : "rgba(217,48,37,0.08)", color: p.privacy === "已完成" ? C.green : p.privacy === "优化中" ? C.accent : p.privacy === "待优化" ? C.amber : "#d93025", border: "1px solid "+(p.privacy === "已完成" ? "rgba(52,168,83,0.18)" : p.privacy === "优化中" ? "rgba(26,115,232,0.2)" : p.privacy === "待优化" ? "rgba(242,153,0,0.2)" : "rgba(217,48,37,0.2)") }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: p.privacy === "已完成" ? C.green : p.privacy === "优化中" ? C.accent : p.privacy === "待优化" ? C.amber : "#d93025" }} />{p.privacy}</span></span>
                                    <span style={{ width: 90, fontSize: 10, color: C.text3 }}>{p.date}</span>
                                    <div style={{ width: 72 }} className="flex items-center gap-1">
                                      <button className="p-1 rounded" style={{ color: C.text3, background: "transparent", border: "1px solid "+C.borderA, cursor: "pointer" }}><Settings size={10} /></button>
                                      <button style={{ fontSize: 10, color: C.accent, background: C.accentD, border: "none", padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>打开</button>
                                    </div>
                                  </div>
                                ))}
                                {showCreateProject ? (
                                  <div className="flex items-center" style={{ padding: "10px 16px", borderBottom: "1px solid "+C.border, gap: 10 }}>
                                    <input value={newProjName} onChange={e => setNewProjName(e.target.value)} placeholder="项目名称" autoFocus
                                      style={{ flex: 1, padding: "5px 8px", fontSize: 12, color: C.text1, border: "1px solid "+C.accent, borderRadius: 6, outline: "none", boxSizing: "border-box" }}
                                      onKeyDown={e => { if (e.key === "Enter" && newProjName.trim() && projectFolder && !currentProjects.some(p => p.title === newProjName.trim())) { setNewProjName(""); setShowCreateProject(false); } }} />
                                    <button onClick={() => { setShowCreateProject(false); setNewProjName(""); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "transparent", color: C.text2, border: "1px solid "+C.borderA, cursor: "pointer", flexShrink: 0 }}>取消</button>
                                    <button onClick={() => { if (newProjName.trim() && !currentProjects.some(p => p.title === newProjName.trim())) { setNewProjName(""); setShowCreateProject(false); } }}
                                      disabled={!newProjName.trim() || currentProjects.some(p => p.title === newProjName.trim())}
                                      style={{ fontSize: 10, padding: "4px 14px", borderRadius: 6, background: newProjName.trim() && !currentProjects.some(p => p.title === newProjName.trim()) ? C.accent : "#dadce0", color: "#fff", border: "none", cursor: "pointer", flexShrink: 0 }}>创建</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setShowNewProjWizard(true)}
                                    style={{ width: "100%", background: "transparent", border: "2px dashed "+C.accent, borderRadius: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px" }}>
                                    <span style={{ fontSize: 14, color: C.accent }}>+</span>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: C.accent }}>创建项目</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {sorted.length === 0 && !showCreateProject && (
                              <div className="flex flex-col items-center justify-center" style={{ padding: "60px 20px" }}>
                                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: "#f1f3f4" }}><Search size={26} style={{ color: C.text3 }} /></div>
                                <p style={{ fontSize: 13, color: C.text2, marginBottom: 6 }}>未找到匹配的项目</p>
                                <p style={{ fontSize: 11, color: C.text3, marginBottom: 16 }}>请尝试调整筛选条件或搜索其他关键词</p>
                                <button onClick={() => { setProjFilters(emptyFilters()); }} style={{ fontSize: 12, color: C.accent, background: "transparent", border: "1px solid "+C.borderA, padding: "6px 16px", borderRadius: 8, cursor: "pointer" }}>重置筛选</button>
                              </div>
                            )}
                          </div>
                        </>);
                      }
                  })()}

                    {activeNav === "mytemplates" && (() => {
                      const tmplFilterTags = getFilterTags(tmplFilters);
                      const tagFiltered = myTemplates.filter(t => {
                        if (tmplFilters.antennaTypes.size > 0 && !tmplFilters.antennaTypes.has(t.category)) return false;
                        if (tmplFilters.freqBands.size > 0) return true;
                        if (tmplFilters.downloaded.size > 0) return true;
                        if (tmplFilters.createdPeriod.size > 0) return true;
                        if (tmplFilterTags.length === 0) return true;
                        return tmplFilterTags.some(tag =>
                          t.category === tag || t.freq.includes(tag) || t.name.includes(tag) || t.desc.includes(tag)
                        );
                      });
                      const sorted = [...tagFiltered].sort((a, b) => {
                        if (tmplSortBy === "name") return a.name.localeCompare(b.name);
                        return a.date.localeCompare(b.date);
                      });


                      return (<>
                        {/* Row 1: title + right buttons */}
                        <div style={{ padding: "14px 24px 10px", background: "#fff", flexShrink: 0 }}>
                          <div className="flex items-center justify-between">
                            <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text1 }}>我的模板</h1>
                            <div className="flex items-center gap-2">
                              <button onClick={() => setShowUploadLibModal(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                                style={{ fontSize: 11, color: C.accent, background: C.accentD, border: `1px solid ${C.borderA}`, cursor: "pointer" }}>
                                <Upload size={10} />上传模板
                              </button>
                              <button onClick={() => { setShowAcceptTmplModal(true); setAcceptLinkValue(""); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                                style={{ fontSize: 11, color: C.green, background: "rgba(52,168,83,0.08)", border: `1px solid rgba(52,168,83,0.25)`, cursor: "pointer" }}>
                                <Download size={10} />接受模板
                              </button>
                              <button onClick={() => setShowNewTmplModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ fontSize: 11, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                                <Plus size={10} />新增模板
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: search bar + filter + sort + view toggle */}
                        <div style={{ padding: "8px 24px", background: "#fff", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }} className="flex items-center gap-2.5">
                          {/* Filter button */}
                          <div style={{ position: "relative" }}>
                            <button onClick={() => { setTmplFilterOpen(!tmplFilterOpen); setTmplSortOpen(false); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                              style={{ fontSize: 11, color: filterHasAny(tmplFilters) ? C.accent : C.text2, background: filterHasAny(tmplFilters) ? C.accentD : "#f8f9fa", border: `1px solid ${filterHasAny(tmplFilters) ? C.accent : C.borderA}`, cursor: "pointer", whiteSpace: "nowrap" }}>
                              <ListFilter size={12} />筛选
                            </button>
                            {tmplFilterOpen && (
                              <FilterCard filters={tmplFilters} setFilters={setTmplFilters} onClose={() => setTmplFilterOpen(false)} />
                            )}
                          </div>

                          {/* Search bar with dropdown suggestions */}
                          <div style={{ flex: 1, position: "relative" }}>
                            <div style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "5px 10px", background: "#f8f9fa", border: `1px solid ${tmplFilterTags.length > 0 ? C.accent : C.borderA}`, borderRadius: 10,
                              minHeight: 34, boxSizing: "border-box", flexWrap: "wrap",
                            }}>
                              {tmplFilterTags.map(tag => (
                                <span key={tag} style={{
                                  display: "inline-flex", alignItems: "center", gap: 3,
                                  fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 5,
                                  background: C.accentD, color: C.accent, border: `1px solid ${C.accent}`,
                                  whiteSpace: "nowrap",
                                }}>
                                  {tag}
                                  <button onClick={(e) => {
                                    e.stopPropagation();
                                    setTmplFilters(prev => {
                                      const next = { antennaTypes: new Set(prev.antennaTypes), freqBands: new Set(prev.freqBands), downloaded: new Set(prev.downloaded), createdPeriod: new Set(prev.createdPeriod) };
                                      (["antennaTypes", "freqBands", "downloaded", "createdPeriod"] as const).forEach(k => { next[k].delete(tag); });
                                      return next;
                                    });
                                  }}
                                    style={{ padding: 0, background: "none", border: "none", cursor: "pointer", color: C.accent, display: "flex" }}>
                                    <X size={9} />
                                  </button>
                                </span>
                              ))}
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4, minWidth: 60 }}>
                                <Search size={12} style={{ color: C.text3, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: C.text3 }}>
                                  {tmplFilterTags.length === 0 ? "点击筛选选择标签筛选模板…" : ""}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Sort button */}
                          <div style={{ position: "relative" }}>
                            <button onClick={() => { setTmplSortOpen(!tmplSortOpen); setTmplFilterOpen(false); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                              style={{ fontSize: 11, color: C.text2, background: "#f8f9fa", border: `1px solid ${C.borderA}`, cursor: "pointer", whiteSpace: "nowrap" }}>
                              <ArrowUpDown size={11} />
                            </button>
                            {tmplSortOpen && (
                              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 10, padding: "4px", minWidth: 130 }}>
                                {([["created", "创建时间"], ["modified", "最近修改"], ["name", "名称"]] as [typeof tmplSortBy, string][]).map(([k, label]) => (
                                  <button key={k} onClick={() => { setTmplSortBy(k); setTmplSortOpen(false); }}
                                    className="flex items-center gap-2 w-full text-left rounded-md px-3 py-2"
                                    style={{ fontSize: 11, fontWeight: tmplSortBy === k ? 500 : 400, color: tmplSortBy === k ? C.accent : C.text2, background: tmplSortBy === k ? C.accentD : "transparent", border: "none", cursor: "pointer" }}
                                    onMouseEnter={(e) => { if (tmplSortBy !== k) e.currentTarget.style.background = "#f8f9fa"; }}
                                    onMouseLeave={(e) => { if (tmplSortBy !== k) e.currentTarget.style.background = "transparent"; }}>
                                    <span style={{ fontSize: 9, width: 16, color: tmplSortBy === k ? C.accent : C.text3 }}>
                                      {tmplSortBy === k ? "✓" : ""}
                                    </span>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* View toggle */}
                          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.borderA}` }}>
                            <button onClick={() => setTemplateViewMode("grid")}
                              className="p-1.5"
                              style={{ background: templateViewMode === "grid" ? C.accentD : "transparent", border: "none", cursor: "pointer" }}>
                              <Grid3X3 size={12} style={{ color: templateViewMode === "grid" ? C.accent : C.text3 }} />
                            </button>
                            <button onClick={() => setTemplateViewMode("list")}
                              className="p-1.5"
                              style={{ background: templateViewMode === "list" ? C.accentD : "transparent", border: "none", cursor: "pointer" }}>
                              <LayoutList size={12} style={{ color: templateViewMode === "list" ? C.accent : C.text3 }} />
                            </button>
                          </div>
                        </div>

                        {/* Active filter tag below search */}
                        {tmplFilterTags.length > 0 && (
                          <div style={{ padding: "4px 24px", background: "#fff", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }} className="flex items-center gap-2">
                            <span style={{ fontSize: 10, color: C.text3, flexShrink: 0 }}>当前筛选：</span>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 10, fontWeight: 500, padding: "3px 9px", borderRadius: 6,
                              background: C.accentD, color: C.accent, border: `1px solid ${C.accent}`,
                            }}>
                              {tmplFilterTags.join(" + ")}
                              <button onClick={() => { setTmplFilters(emptyFilters()); }}
                                style={{ padding: 0, background: "none", border: "none", cursor: "pointer", color: C.accent, display: "flex" }}>
                                <X size={9} />
                              </button>
                            </span>
                            <span style={{ fontSize: 10, color: C.text3 }}>— {sorted.length} 个结果</span>
                            <button onClick={() => { setTmplFilters(emptyFilters()); }}
                              style={{ fontSize: 10, color: "#d93025", background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto" }}>
                              清除全部筛选
                            </button>
                          </div>
                        )}

                        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", scrollbarWidth: "none", position: "relative" }}
                          onScroll={() => setCtxMenu(null)}>
                          {showNewTmplModal && (
                            <NewTemplateModal
                              onClose={() => setShowNewTmplModal(false)}
                              onSubmit={(data) => {
                                setMyTemplates(prev => [{
                                  name: data.name,
                                  category: data.type,
                                  desc: data.notes ? (data.freq + " · " + data.notes).slice(0, 40) + (data.notes.length > 20 ? "…" : "") : data.freq,
                                  freq: data.freq,
                                  date: new Date().toISOString().slice(0, 10).replace(/-/g, "/"),
                                  type: "我的模板",
                                  privacy: "private" as const,
                                }, ...prev]);
                              }}
                            />
                          )}
                          {showUploadLibModal && (
                            <UploadToLibraryModal
                              templates={myTemplates}
                              onClose={() => setShowUploadLibModal(false)}
                              onUpload={(selectedNames) => {
                                setMyTemplates(prev => prev.map(t =>
                                  selectedNames.includes(t.name) ? { ...t, privacy: "public" as const } : t
                                ));
                              }}
                            />
                          )}

                          {/* Card grid view */}
                          {templateViewMode === "grid" && sorted.length > 0 && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                              {sorted.map((t) => (
                                <div key={t.name}
                                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ name: t.name, x: e.clientX, y: e.clientY }); }}
                                  onClick={(e) => { e.stopPropagation(); setCtxMenu(null); setDetailTemplate(t); }}>
                                  <TemplateCard {...t} favorited={tmplFavorites.has(t.name)} onToggleFav={toggleTmplFav}
                                    onMoreClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setCtxMenu({ name: t.name, x: Math.min(rect.right, window.innerWidth - 160), y: Math.min(rect.bottom + 4, window.innerHeight - 150) }); }} />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* List / table view */}
                          {templateViewMode === "list" && sorted.length > 0 && (
                            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${C.border}` }}>
                              <div className="flex items-center" style={{ padding: "10px 16px", background: "#fafbfc", borderBottom: `1px solid ${C.border}` }}>
                                <span style={{ flex: 2, fontSize: 10, fontWeight: 600, color: C.text3 }}>模板名称</span>
                                <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.text3 }}>天线类型</span>
                                <span style={{ flex: 0.7, fontSize: 10, fontWeight: 600, color: C.text3 }}>频段</span>
                                <span style={{ width: 48, fontSize: 10, fontWeight: 600, color: C.text3 }}>收藏</span>
                                <span style={{ width: 56, fontSize: 10, fontWeight: 600, color: C.text3 }}>可见性</span>
                                <span style={{ flex: 1.3, fontSize: 10, fontWeight: 600, color: C.text3 }}>设计思路</span>
                                <span style={{ width: 90, fontSize: 10, fontWeight: 600, color: C.text3 }}>创建时间</span>
                                <span style={{ width: 72 }} />
                              </div>
                              {sorted.map((t) => (
                                <div key={t.name} className="flex items-center" style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ name: t.name, x: e.clientX, y: e.clientY }); }}
                                  onClick={(e) => { e.stopPropagation(); setCtxMenu(null); setDetailTemplate(t); }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                  <div className="flex items-center gap-2.5" style={{ flex: 2 }}>
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: C.accentD }}>
                                      <FileText size={12} style={{ color: C.accent }} />
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: C.text1 }}>{t.name}</span>
                                  </div>
                                  <span style={{ flex: 1 }}>
                                    <span style={{ fontSize: 10, color: C.green, background: "rgba(52,168,83,0.08)", border: "1px solid rgba(52,168,83,0.18)", padding: "2px 8px", borderRadius: 4 }}>{t.category}</span>
                                  </span>
                                  <span style={{ flex: 0.7, fontSize: 10, fontFamily: "monospace", color: C.text2 }}>{t.freq}</span>
                                  <span style={{ width: 48, textAlign: "center" }}>
                                    <button onClick={(e) => { e.stopPropagation(); toggleTmplFav(t.name); }}
                                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                      <Star size={13} fill={tmplFavorites.has(t.name) ? "#f29900" : "none"} stroke={tmplFavorites.has(t.name) ? "#f29900" : C.text3} />
                                    </button>
                                  </span>
                                  <span style={{ width: 56 }}>
                                    <span style={{
                                      fontSize: 9, fontWeight: 500, padding: "2px 6px", borderRadius: 3,
                                      background: t.privacy === "private" ? "rgba(242,153,0,0.1)" : "rgba(26,115,232,0.1)",
                                      color: t.privacy === "private" ? "#e08a00" : C.accent,
                                      border: t.privacy === "private" ? "1px solid rgba(242,153,0,0.25)" : "1px solid rgba(26,115,232,0.25)",
                                      display: "inline-flex", alignItems: "center", gap: 2,
                                    }}>
                                      {t.privacy === "private" ? <><Lock size={7} />私人</> : <><Globe size={7} />公开</>}
                                    </span>
                                  </span>
                                  <span style={{ flex: 1.3, fontSize: 10, color: C.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{t.desc}</span>
                                  <span style={{ width: 90, fontSize: 10, color: C.text3 }}>{t.date}</span>
                                  <div style={{ width: 72 }} className="flex items-center gap-1">
                                    <button className="p-1 rounded" style={{ color: C.text3, background: "transparent", border: `1px solid ${C.borderA}`, cursor: "pointer" }}>
                                      <Settings size={10} />
                                    </button>
                                    <button style={{ fontSize: 10, color: C.accent, background: C.accentD, border: "none", padding: "3px 8px", borderRadius: 4, cursor: "pointer" }}>
                                      使用
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* ── Right-click context menu ── */}
                          {ctxMenu && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
                              <div className="fixed z-50"
                                style={{ left: ctxMenu.x, top: ctxMenu.y, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.14)", padding: "4px", minWidth: 148 }}>
                                <button onClick={() => { setRenameTarget(ctxMenu.name); setRenameValue(ctxMenu.name); setCtxMenu(null); }}
                                  className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                                  style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                  <Pencil size={13} style={{ color: C.text2 }} />重命名
                                </button>
                                <button onClick={() => { setShareTarget(ctxMenu.name); setShareStep("perm"); setSharePermission("view"); setShareLink(""); setCopiedLink(false); setCtxMenu(null); }}
                                  className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                                  style={{ fontSize: 12, color: C.text1, background: "transparent", border: "none", cursor: "pointer" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f9fa")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                  <Share2 size={13} style={{ color: C.text2 }} />分享
                                </button>
                                <div style={{ height: 1, background: C.border, margin: "2px 0" }} />
                                <button onClick={() => { setMyTemplates(prev => prev.filter(t => t.name !== ctxMenu.name)); setCtxMenu(null); }}
                                  className="flex items-center gap-2.5 w-full text-left rounded-md px-3 py-2.5"
                                  style={{ fontSize: 12, color: "#d93025", background: "transparent", border: "none", cursor: "pointer" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fef0f0")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                  <Trash2 size={13} style={{ color: "#d93025" }} />删除
                                </button>
                              </div>
                            </>
                          )}

                          {/* ── Rename modal ── */}
                          {renameTarget && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                              <div className="pointer-events-auto rounded-xl overflow-hidden"
                                style={{ width: 360, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
                                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <div className="flex items-center gap-2">
                                    <Pencil size={15} style={{ color: C.accent }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>重命名模板</span>
                                  </div>
                                  <button onClick={() => setRenameTarget(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
                                    <X size={15} />
                                  </button>
                                </div>
                                <div style={{ padding: "20px 24px" }}>
                                  <p style={{ fontSize: 11, color: C.text2, marginBottom: 10 }}>输入新的模板名称：</p>
                                  <input
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && renameValue.trim()) {
                                        setMyTemplates(prev => prev.map(t => t.name === renameTarget ? { ...t, name: renameValue.trim() } : t));
                                        setRenameTarget(null);
                                      }
                                    }}
                                    autoFocus
                                    style={{ width: "100%", padding: "8px 12px", fontSize: 13, color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                                    onFocus={(e) => (e.target.style.borderColor = C.accent)}
                                    onBlur={(e) => (e.target.style.borderColor = C.borderA)}
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                                  <button onClick={() => setRenameTarget(null)}
                                    style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 14px" }}>
                                    取消
                                  </button>
                                  <button onClick={() => {
                                    if (renameValue.trim()) {
                                      setMyTemplates(prev => prev.map(t => t.name === renameTarget ? { ...t, name: renameValue.trim() } : t));
                                      setRenameTarget(null);
                                    }
                                  }} disabled={!renameValue.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                                    style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: renameValue.trim() ? C.accent : C.borderA, border: "none", cursor: renameValue.trim() ? "pointer" : "default" }}>
                                    <CheckCircle size={13} />确认改名
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ── Share modal ── */}
                          {shareTarget && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                              <div className="pointer-events-auto rounded-xl overflow-hidden"
                                style={{ width: 440, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                                  <div className="flex items-center gap-2">
                                    <Share2 size={15} style={{ color: C.accent }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>分享模板</span>
                                  </div>
                                  <button onClick={() => setShareTarget(null)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
                                    <X size={15} />
                                  </button>
                                </div>

                                {/* Step indicator */}
                                <div className="flex items-center gap-3 px-5 py-3" style={{ background: "#fafbfc", borderBottom: `1px solid ${C.border}` }}>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700 }}>1</div>
                                    <span style={{ fontSize: 11, fontWeight: shareStep === "perm" ? 600 : 400, color: C.text1 }}>设置权限</span>
                                  </div>
                                  <div style={{ width: 32, height: 1, background: shareStep === "link" ? C.accent : C.borderA }} />
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: shareStep === "link" ? C.accent : "#f1f3f4", color: shareStep === "link" ? "#fff" : C.text3, fontSize: 10, fontWeight: 700 }}>2</div>
                                    <span style={{ fontSize: 11, fontWeight: shareStep === "link" ? 600 : 400, color: shareStep === "link" ? C.text1 : C.text3 }}>生成链接</span>
                                  </div>
                                </div>

                                {/* Step content */}
                                <div style={{ padding: "20px 24px", minHeight: 180 }}>
                                  {shareStep === "perm" && (
                                    <>
                                      <p style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>模板名称</p>
                                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 18 }}>{shareTarget}</p>
                                      <p style={{ fontSize: 12, fontWeight: 500, color: C.text1, marginBottom: 10 }}>设置访问权限</p>
                                      <div className="flex flex-col gap-3">
                                        {([
                                          { key: "view", icon: Eye, title: "仅查看", desc: "对方只能在线预览模板参数与仿真结果，无法下载或复制文件" },
                                          { key: "copy", icon: Copy, title: "可复制", desc: "对方可以查看并下载模板文件，复制到自己的项目中使用" },
                                        ] as const).map(({ key, icon: Icon, title, desc }) => {
                                          const sel = sharePermission === key;
                                          return (
                                            <button key={key} onClick={() => setSharePermission(key)}
                                              className="flex items-start gap-3 w-full text-left rounded-xl"
                                              style={{
                                                padding: "12px 14px",
                                                background: sel ? C.accentD : "#f8f9fa",
                                                border: sel ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                                                cursor: "pointer",
                                              }}>
                                              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? C.accent : C.borderA}`, background: sel ? C.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                                                {sel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
                                                  <Icon size={14} style={{ color: sel ? C.accent : C.text2 }} />
                                                  <span style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? C.accent : C.text1 }}>{title}</span>
                                                </div>
                                                <p style={{ fontSize: 10, color: C.text3, lineHeight: 1.5 }}>{desc}</p>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <p style={{ fontSize: 12, fontWeight: 500, color: C.text1, marginBottom: 10, marginTop: 20 }}>链接有效期</p>
                                      <div className="flex gap-2">
                                        {[
                                          { v: "1", label: "1 天" },
                                          { v: "7", label: "7 天" },
                                          { v: "15", label: "15 天" },
                                          { v: "30", label: "30 天" },
                                        ].map(({ v, label }) => (
                                          <button key={v} onClick={() => setShareExpiry(v)}
                                            style={{
                                              flex: 1, padding: "8px 4px", fontSize: 12, fontWeight: shareExpiry === v ? 600 : 400,
                                              color: shareExpiry === v ? C.accent : C.text2,
                                              background: shareExpiry === v ? C.accentD : "#f8f9fa",
                                              border: shareExpiry === v ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                                              borderRadius: 8, cursor: "pointer", textAlign: "center",
                                            }}>
                                            {label}
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  )}

                                  {shareStep === "link" && (
                                    <>
                                      {/* Summary */}
                                      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ background: "#f8f9fa", border: `1px solid ${C.border}` }}>
                                        <FileText size={14} style={{ color: C.accent, flexShrink: 0 }} />
                                        <span style={{ fontSize: 12, color: C.text1, flex: 1 }}>{shareTarget}</span>
                                        <span style={{
                                          fontSize: 9, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
                                          background: sharePermission === "view" ? "rgba(52,168,83,0.08)" : "rgba(26,115,232,0.08)",
                                          color: sharePermission === "view" ? C.green : C.accent,
                                          border: sharePermission === "view" ? "1px solid rgba(52,168,83,0.2)" : `1px solid rgba(26,115,232,0.2)`,
                                        }}>
                                          {sharePermission === "view" ? <><Eye size={8} /> 仅查看</> : <><Copy size={8} /> 可复制</>}
                                        </span>
                                      </div>

                                      {/* Link box */}
                                      <div style={{ marginBottom: 12 }}>
                                        <p style={{ fontSize: 11, fontWeight: 500, color: C.text1, marginBottom: 6 }}>分享链接</p>
                                        <div className="flex items-center gap-2">
                                          <input
                                            readOnly
                                            value={shareLink}
                                            style={{
                                              flex: 1, padding: "8px 12px", fontSize: 12, fontFamily: "monospace",
                                              color: C.text1, background: "#f8f9fa", border: `1px solid ${C.borderA}`,
                                              borderRadius: 8, outline: "none",
                                            }}
                                          />
                                          <button
                                            onClick={() => { navigator.clipboard.writeText(shareLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg flex-shrink-0"
                                            style={{ fontSize: 11, fontWeight: 500, color: "#fff", background: copiedLink ? C.green : C.accent, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                                            {copiedLink ? <><CheckCircle size={12} />已复制</> : <><Copy size={12} />复制</>}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Link icon */}
                                      <div className="flex flex-col items-center justify-center p-4 rounded-xl" style={{ background: C.accentD, border: `1px dashed ${C.accent}` }}>
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: "#fff" }}>
                                          <Link size={18} style={{ color: C.accent }} />
                                        </div>
                                        <p style={{ fontSize: 11, color: C.accent, textAlign: "center", lineHeight: 1.5 }}>
                                          {sharePermission === "view" ? "对方可通过此链接在线预览模板，无需登录即可查看" : "对方可通过此链接下载并复制模板，创建属于自己的副本"}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                                  <button
                                    onClick={shareStep === "perm" ? () => setShareTarget(null) : () => setShareStep("perm")}
                                    style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer" }}>
                                    {shareStep === "perm" ? "取消" : "← 返回修改权限"}
                                  </button>
                                  {shareStep === "perm" ? (
                                    <button onClick={() => {
                                      setShareLink(`https://antennadesign.huawei.com/share/tmpl/${encodeURIComponent(shareTarget)}?mode=${sharePermission}&token=${Math.random().toString(36).slice(2, 10)}`);
                                      setShareStep("link");
                                    }}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                                      style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                                      生成分享链接 <ChevronRight size={13} />
                                    </button>
                                  ) : (
                                    <button onClick={() => setShareTarget(null)}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                                      style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: C.green, border: "none", cursor: "pointer" }}>
                                      <CheckCircle size={13} />完成
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Empty state: no templates at all */}
                          {myTemplates.length === 0 && (
                            <div className="flex flex-col items-center justify-center" style={{ padding: "60px 20px" }}>
                              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: "#f1f3f4" }}>
                                <Layers size={26} style={{ color: C.text3 }} />
                              </div>
                              <p style={{ fontSize: 13, color: C.text2, marginBottom: 6 }}>暂无自定义模板</p>
                              <p style={{ fontSize: 11, color: C.text3, marginBottom: 16 }}>点击右上角"新增模板"按钮创建您的第一个模板</p>
                              <button onClick={() => setShowNewTmplModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                                style={{ fontSize: 12, color: "#fff", background: C.accent, border: "none", cursor: "pointer" }}>
                                <Plus size={12} />新增模板
                              </button>
                            </div>
                          )}
                          {/* Empty state: no search results */}
                          {myTemplates.length > 0 && sorted.length === 0 && (
                            <div className="flex flex-col items-center justify-center" style={{ padding: "60px 20px" }}>
                              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: "#f1f3f4" }}>
                                <Search size={26} style={{ color: C.text3 }} />
                              </div>
                              <p style={{ fontSize: 13, color: C.text2, marginBottom: 6 }}>未找到匹配的模板</p>
                              <p style={{ fontSize: 11, color: C.text3, marginBottom: 16 }}>请尝试调整筛选条件或搜索其他关键词</p>
                              <button onClick={() => { setTmplFilters(emptyFilters()); }}
                                style={{ fontSize: 12, color: C.accent, background: "transparent", border: `1px solid ${C.borderA}`, padding: "6px 16px", borderRadius: 8, cursor: "pointer" }}>
                                清除筛选
                              </button>
                            </div>
                          )}
                        </div>
                      </>);
                  })()}

                    {/* ── 模版库 ── */}
                    {activeNav === "templates" && (
                      <>
                        <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${C.border}`, background: "#fff", flexShrink: 0 }}>
                          <h1 style={{ fontSize: 18, fontWeight: 600, color: C.text1 }}>模版库</h1>
                        </div>
                        <div style={{ padding: "10px 24px 8px", borderBottom: `1px solid ${C.border}`, background: "#fff", flexShrink: 0 }} className="flex items-center gap-2">
                          {["全部", "微带贴片", "偶极子", "缝隙阵列", "八木宇达"].map((label, i) => (
                            <button key={label} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, cursor: "pointer", background: i === 0 ? C.accentD : "transparent", color: i === 0 ? C.accent : C.text2, border: i === 0 ? `1px solid ${C.accent}` : `1px solid ${C.borderA}` }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px", scrollbarWidth: "none" }} onScroll={() => setCtxMenu(null)}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                            {TEMPLATES.map((t) => (
                              <div key={t.name}
                                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ name: t.name, x: e.clientX, y: e.clientY }); }}
                                onClick={(e) => { e.stopPropagation(); setCtxMenu(null); setDetailTemplate({ ...t, date: "—", privacy: "public" }); }}>
                                <TemplateCard {...t} favorited={tmplFavorites.has(t.name)} onToggleFav={toggleTmplFav}
                                  onMoreClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setCtxMenu({ name: t.name, x: Math.min(rect.right, window.innerWidth - 160), y: Math.min(rect.bottom + 4, window.innerHeight - 150) }); }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}


                    {/* ── 个人中心 ── */}
                    {activeNav === "profile" && <ProfileCenter user={user} onLogout={handleLogout} initialTab={profileTab} />}

                    {/* ── 消息中心 ── */}
                    {activeNav === "messages" && <MessageCenter initialTab={messagesTab} />}

                    {/* ── AI 助手 ── */}
                    {activeNav === "aichat" && <AIAssistant />}

                    {/* ── Accept via Link Modal (template) ── */}
                    {showAcceptTmplModal && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto rounded-xl overflow-hidden"
                          style={{ width: 400, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
                          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-2">
                              <Download size={15} style={{ color: C.green }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>接受模板</span>
                            </div>
                            <button onClick={() => setShowAcceptTmplModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
                              <X size={15} />
                            </button>
                          </div>
                          <div style={{ padding: "20px 24px" }}>
                            <p style={{ fontSize: 11, color: C.text2, marginBottom: 10 }}>输入他人分享的模板链接，自动导入到"我的模板"中：</p>
                            <input
                              value={acceptLinkValue}
                              onChange={(e) => setAcceptLinkValue(e.target.value)}
                              placeholder="https://antennadesign.huawei.com/share/tmpl/..."
                              autoFocus
                              style={{ width: "100%", padding: "8px 12px", fontSize: 12, fontFamily: "monospace", color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                              onFocus={(e) => (e.target.style.borderColor = C.accent)}
                              onBlur={(e) => (e.target.style.borderColor = C.borderA)}
                            />
                            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(52,168,83,0.05)", border: "1px solid rgba(52,168,83,0.15)" }}>
                              <p style={{ fontSize: 10, color: C.text3, lineHeight: 1.5 }}>
                                💡 支持 AntennaDesign 分享链接格式。模板将自动解析并添加到您的模板库，保留原始参数与仿真设置。
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                            <button onClick={() => setShowAcceptTmplModal(false)}
                              style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 14px" }}>
                              取消
                            </button>
                            <button onClick={() => {
                              if (acceptLinkValue.trim()) {
                                setMyTemplates(prev => [{
                                  name: "导入的模板", category: "未知", desc: "通过链接导入", freq: "—",
                                  date: new Date().toISOString().slice(0, 10).replace(/-/g, "/"),
                                  type: "我的模板", privacy: "private" as const,
                                }, ...prev]);
                                setShowAcceptTmplModal(false);
                              }
                            }} disabled={!acceptLinkValue.trim()}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                              style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: acceptLinkValue.trim() ? C.green : C.borderA, border: "none", cursor: acceptLinkValue.trim() ? "pointer" : "default" }}>
                              <Download size={13} />接受并导入
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Accept via Link Modal (project) ── */}
                    {showAcceptProjModal && (
                      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto rounded-xl overflow-hidden"
                          style={{ width: 400, background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 12px 48px rgba(0,0,0,0.15)" }}>
                          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-2">
                              <Download size={15} style={{ color: C.green }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>接受项目</span>
                            </div>
                            <button onClick={() => setShowAcceptProjModal(false)} style={{ color: C.text2, background: "none", border: "none", cursor: "pointer" }}>
                              <X size={15} />
                            </button>
                          </div>
                          <div style={{ padding: "20px 24px" }}>
                            <p style={{ fontSize: 11, color: C.text2, marginBottom: 10 }}>输入他人分享的项目链接，自动导入到"我的项目"中：</p>
                            <input
                              value={acceptLinkValue}
                              onChange={(e) => setAcceptLinkValue(e.target.value)}
                              placeholder="https://antennadesign.huawei.com/share/proj/..."
                              autoFocus
                              style={{ width: "100%", padding: "8px 12px", fontSize: 12, fontFamily: "monospace", color: C.text1, border: `1px solid ${C.borderA}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
                              onFocus={(e) => (e.target.style.borderColor = C.accent)}
                              onBlur={(e) => (e.target.style.borderColor = C.borderA)}
                            />
                            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(52,168,83,0.05)", border: "1px solid rgba(52,168,83,0.15)" }}>
                              <p style={{ fontSize: 10, color: C.text3, lineHeight: 1.5 }}>
                                💡 支持 AntennaDesign 项目分享链接。项目将自动导入，包含完整的天线参数、仿真结果与优化数据。
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 px-5 py-3.5" style={{ borderTop: `1px solid ${C.border}`, background: "#fafbfc" }}>
                            <button onClick={() => setShowAcceptProjModal(false)}
                              style={{ fontSize: 12, color: C.text2, background: "transparent", border: "none", cursor: "pointer", padding: "6px 14px" }}>
                              取消
                            </button>
                            <button onClick={() => {
                              if (acceptLinkValue.trim()) {
                                setShowAcceptProjModal(false);
                              }
                            }} disabled={!acceptLinkValue.trim()}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
                              style={{ fontSize: 12, fontWeight: 500, color: "#fff", background: acceptLinkValue.trim() ? C.green : C.borderA, border: "none", cursor: acceptLinkValue.trim() ? "pointer" : "default" }}>
                              <Download size={13} />接受并导入
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
                </>)}
      {/* ── AI Assistant floating ball (hide when on AI page) ── */}
      {/* ── AI Assistant floating ball (hide when on AI page or popup open) ── */}
      {activeNav !== "aichat" && !showAIChatPopup && (
        <div
          onClick={() => setShowAIChatPopup(true)}
          title="AI 天线设计助手"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 200,
            width: 52, height: 52, borderRadius: "50%",
            background: "linear-gradient(135deg, #1a73e8, #7c3aed)",
            boxShadow: "0 4px 16px rgba(26,115,232,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(26,115,232,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(26,115,232,0.35)"; }}
        >
          <MessageSquare size={22} style={{ color: "#fff" }} />
          <div style={{
            position: "absolute", top: 2, right: 2, width: 12, height: 12,
            borderRadius: "50%", background: C.green, border: "2px solid #fff",
          }} />
        </div>
      )}

      {/* ── AI Chat popup (floating window) ── */}
      {showAIChatPopup && (
        <AIChatPopup onClose={() => setShowAIChatPopup(false)} />
      )}
    </div>
  );
}
