import { useState, type CSSProperties, type FormEvent } from "react";
import { Radio, Eye, EyeOff, Smartphone, MessageCircle, Globe } from "lucide-react";

const C = {
  bg: "#f8f9fa",
  border: "#e5e7eb",
  borderA: "#dadce0",
  accent: "#1a73e8",
  accentD: "#e8f0fe",
  text1: "#202124",
  text2: "#5f6368",
  text3: "#9aa0a6",
  inputBg: "#f1f3f4",
  green: "#34a853",
};

export type UserInfo = {
  name: string;
  email: string;
  phone?: string;
};

type LoginPageProps = {
  onLogin: (user: UserInfo) => void;
};

function QrPlaceholder() {
  const cells = [
    "1111011", "1000010", "1011010", "1011010", "1011010", "1000010", "1111011",
    "1000001", "0010100", "1100110", "1000001", "0111001", "1001101", "1000001",
    "1011101", "0101010", "1010101", "1100011", "1011101", "1000001", "1111011",
  ];
  return (
    <svg width={148} height={148} viewBox="0 0 21 21" style={{ display: "block" }}>
      {cells.map((row, y) =>
        row.split("").map((cell, x) =>
          cell === "1" ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={C.text1} />
          ) : null
        )
      )}
      <rect x={0} y={0} width={7} height={7} fill="none" stroke={C.text1} strokeWidth={0.6} />
      <rect x={14} y={0} width={7} height={7} fill="none" stroke={C.text1} strokeWidth={0.6} />
      <rect x={0} y={14} width={7} height={7} fill="none" stroke={C.text1} strokeWidth={0.6} />
    </svg>
  );
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ account: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 13,
    color: C.text1,
    background: C.inputBg,
    border: `1px solid transparent`,
    borderRadius: 10,
    outline: "none",
    boxSizing: "border-box",
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!loginForm.account.trim() || !loginForm.password.trim()) {
      setError("请输入账号和密码");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const account = loginForm.account.trim();
      const isEmail = account.includes("@");
      onLogin({
        name: isEmail ? account.split("@")[0] : account.slice(-4).padStart(4, "用户"),
        email: isEmail ? account : `${account}@antenna.local`,
        phone: isEmail ? undefined : account,
      });
    }, 600);
  };

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const { name, email, phone, password, confirm } = registerForm;
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("请填写姓名、邮箱和密码");
      return;
    }
    if (password.length < 6) {
      setError("密码长度至少 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined });
    }, 800);
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: C.bg, fontFamily: "'Inter', 'Noto Sans SC', sans-serif" }}
    >
      {/* Top brand bar */}
      <div
        className="flex items-center gap-2 flex-shrink-0"
        style={{ height: 48, padding: "0 24px", background: "#fff", borderBottom: `1px solid ${C.border}` }}
      >
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: C.accent }}>
          <Radio size={15} className="text-white" />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>AntennaDesign</span>
        <span style={{ fontSize: 11, color: C.text3, marginLeft: 4 }}>Pro</span>
      </div>

      {/* Main login card area */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto" style={{ padding: "20px 28px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: C.text1, marginBottom: 24, letterSpacing: "-0.02em" }}>
          {mode === "login" ? "账号登录" : "注册账号"}
        </h1>

        <div
          style={{
            width: "100%",
            maxWidth: 620,
            background: "#fff",
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div className="flex" style={{ minHeight: 340 }}>
            {/* Left: QR scan */}
            <div
              className="flex flex-col items-center justify-center flex-shrink-0"
              style={{ width: "42%", padding: "28px 24px", borderRight: `1px solid ${C.border}`, background: "#fff" }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ padding: 14, background: "#fff", border: `1px solid ${C.border}`, marginBottom: 16 }}
              >
                <QrPlaceholder />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text1, marginBottom: 8, textAlign: "center" }}>
                扫码登录
              </p>
              <p style={{ fontSize: 11, color: C.text2, lineHeight: 1.6, textAlign: "center", maxWidth: 180 }}>
                请使用 AntennaDesign 移动端或 HarmonyOS 设备扫码，快速安全登录
              </p>
              <div
                className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full"
                style={{ background: C.accentD, border: `1px solid ${C.borderA}` }}
              >
                <Smartphone size={11} style={{ color: C.accent }} />
                <span style={{ fontSize: 10, color: C.accent }}>支持一碰传快速登录</span>
              </div>
            </div>

            {/* Right: form */}
            <div className="flex-1 flex flex-col" style={{ padding: "28px 32px 24px" }}>
              {mode === "login" ? (
                <form onSubmit={handleLogin} className="flex flex-col flex-1">
                  <input
                    type="text"
                    placeholder="手机号 / 邮箱 / 用户名"
                    value={loginForm.account}
                    onChange={(e) => setLoginForm((f) => ({ ...f, account: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: 12 }}
                    onFocus={(e) => (e.target.style.borderColor = C.accent)}
                    onBlur={(e) => (e.target.style.borderColor = "transparent")}
                  />
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <input
                      type={showPwd ? "text" : "password"}
                      placeholder="密码"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: 40 }}
                      onFocus={(e) => (e.target.style.borderColor = C.accent)}
                      onBlur={(e) => (e.target.style.borderColor = "transparent")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: C.text3,
                        padding: 0,
                      }}
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="flex justify-end" style={{ marginBottom: 16 }}>
                    <button
                      type="button"
                      style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      短信验证码登录
                    </button>
                  </div>

                  {error && (
                    <p style={{ fontSize: 11, color: "#d93025", marginBottom: 10, textAlign: "center" }}>{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "11px 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      background: loading ? C.text3 : C.accent,
                      border: "none",
                      borderRadius: 10,
                      cursor: loading ? "default" : "pointer",
                      marginBottom: 16,
                    }}
                  >
                    {loading ? "登录中…" : "登录"}
                  </button>

                  <div className="flex items-center justify-center gap-3" style={{ fontSize: 12 }}>
                    <button type="button" onClick={() => { setMode("register"); setError(""); }}
                      style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      注册
                    </button>
                    <span style={{ color: C.borderA }}>|</span>
                    <button type="button" style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      忘记密码
                    </button>
                    <span style={{ color: C.borderA }}>|</span>
                    <button type="button" style={{ color: C.text2, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      常见问题
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="flex flex-col flex-1">
                  <input
                    type="text"
                    placeholder="姓名"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, name: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: 10 }}
                  />
                  <input
                    type="email"
                    placeholder="邮箱"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: 10 }}
                  />
                  <input
                    type="tel"
                    placeholder="手机号（选填）"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, phone: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: 10 }}
                  />
                  <div style={{ position: "relative", marginBottom: 10 }}>
                    <input
                      type={showPwd ? "text" : "password"}
                      placeholder="设置密码（至少 6 位）"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: C.text3,
                        padding: 0,
                      }}
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div style={{ position: "relative", marginBottom: 12 }}>
                    <input
                      type={showConfirmPwd ? "text" : "password"}
                      placeholder="确认密码"
                      value={registerForm.confirm}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, confirm: e.target.value }))}
                      style={{ ...inputStyle, paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: C.text3,
                        padding: 0,
                      }}
                    >
                      {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {error && (
                    <p style={{ fontSize: 11, color: "#d93025", marginBottom: 10, textAlign: "center" }}>{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "11px 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      background: loading ? C.text3 : C.accent,
                      border: "none",
                      borderRadius: 10,
                      cursor: loading ? "default" : "pointer",
                      marginBottom: 16,
                    }}
                  >
                    {loading ? "注册中…" : "注册并登录"}
                  </button>

                  <div className="flex items-center justify-center" style={{ fontSize: 12 }}>
                    <span style={{ color: C.text2 }}>已有账号？</span>
                    <button
                      type="button"
                      onClick={() => { setMode("login"); setError(""); }}
                      style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", padding: "0 0 0 4px" }}
                    >
                      立即登录
                    </button>
                  </div>
                </form>
              )}

              {/* Third-party login */}
              <div style={{ marginTop: "auto", paddingTop: 20 }}>
                <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                  <span style={{ fontSize: 10, color: C.text3 }}>其他登录方式</span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>
                <div className="flex items-center justify-center gap-5">
                  {[
                    { icon: Radio, label: "华为账号", color: C.accent },
                    { icon: MessageCircle, label: "微信", color: C.green },
                    { icon: Globe, label: "企业 SSO", color: C.text2 },
                  ].map(({ icon: Icon, label, color }) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      onClick={() => onLogin({ name: "访客用户", email: "guest@antenna.local" })}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: `1px solid ${C.borderA}`,
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={16} style={{ color }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 10, color: C.text3, marginTop: 20, textAlign: "center", lineHeight: 1.6, maxWidth: 480 }}>
          登录即表示您同意
          <span style={{ color: C.accent, cursor: "pointer" }}> 用户协议 </span>
          和
          <span style={{ color: C.accent, cursor: "pointer" }}> 隐私政策</span>
          ，未注册手机号将自动创建账号
        </p>
      </div>
    </div>
  );
}
