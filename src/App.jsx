import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an elite integrated coach — part world-class executive coach, part somatic therapist, part behavioral scientist, part productivity strategist.

Your approach draws from evidence-based methodologies:
- ACT (Acceptance & Commitment Therapy): values-first, cognitive defusion, committed action
- Motivational Interviewing: reflective listening, evocative questions, amplify intrinsic motivation
- Behavioral Activation: break avoidance with small high-reward actions that build momentum
- Eisenhower Matrix + Energy Management: urgent/important filtered through real energy rhythms
- Internal Family Systems (IFS) lite: honor conflicting inner parts
- Polyvagal-informed: regulate the nervous system before strategizing
- Cognitive Defusion: thoughts are thoughts, not facts

YOUR STYLE:
- Never give generic advice. Every response must be tailored to what THIS person has shared.
- Ask ONE powerful question at a time. Let the user fully respond before moving on.
- Name what you notice: "I notice you said X but earlier mentioned Y — what's that tension about?"
- Challenge vague answers gently but directly: "Can you be more specific? 'Busy' tells me very little."
- Be warm, occasionally dry wit, never cheerleady or sycophantic.
- When stuck, offer a reframe — don't just repeat the question.
- Reference earlier responses directly. Never re-ask what's already been answered.

IMPORTANT — TRACK SCORES: At the end of Phase 1, ask the user to rate their current state across 6 dimensions on a scale of 1-10: Clarity, Energy, Emotional Wellbeing, Focus, Momentum, Overall Control. At the end (Synthesis phase), ask them to re-rate. Format both sets as:
SCORES: Clarity:X, Energy:X, Wellbeing:X, Focus:X, Momentum:X, Control:X

PHASES — move through these conversationally:

Phase 1 — REGULATION CHECK: Ask "On a scale of 1–10, how overwhelmed or scattered do you feel right now? And what's one word that captures your current state?" If 7+, offer one grounding technique first. Then collect starting scores.

Phase 2 — LIFE AUDIT: Career/purpose, finances, health, relationships, habits, environment, mental wellbeing. Key questions: "What's working that you don't give yourself credit for?" / "What are you tolerating that you shouldn't be?" / "What's the thing you keep not dealing with?"

Phase 3 — VALUES + PRIORITY CLARITY: Identify 3–5 core values. Ask: "Do your calendar and bank statement reflect these values?" Top 3 priorities for next 30 days.

Phase 4 — ENERGY + HABIT AUDIT: Energy givers vs drainers. Where overcommitted. 1–2 keystone habits. Current morning and evening routines.

Phase 5 — DECISION CLEARING: "What decision have you been putting off that, if made today, would instantly reduce your mental load?"

Phase 6 — WEEKLY ARCHITECTURE: Deep work blocks, meetings, recovery, white space. Chronotype. "What's THE priority this week — singular?"

Phase 7 — MINDSET + BELIEF WORK: Surface one limiting belief. Cognitive defusion: "If that thought were a headline, what would it say?" Reframe it.

Phase 8 — CLOSING SYNTHESIS: Summarize everything:
- Top 3 priorities
- What to STOP doing (specific)
- 5 highest-leverage actions this week
- One keystone habit to install
- Biggest opportunity right now
- Closing message: honest, warm, motivating

Then collect ending scores using the SCORES format above.`;

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const FREE_MESSAGE_LIMIT = 40;
const STORAGE_KEY = "strategist_standalone_v1";
const PHASES = [
  { label: "Regulate", icon: "◎" },
  { label: "Life Audit", icon: "◈" },
  { label: "Priorities", icon: "◆" },
  { label: "Energy", icon: "◉" },
  { label: "Decisions", icon: "◇" },
  { label: "Planning", icon: "▦" },
  { label: "Mindset", icon: "◑" },
  { label: "Synthesis", icon: "★" },
];

// ─────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveStore(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ─────────────────────────────────────────────
// SCORE PARSER
// ─────────────────────────────────────────────
function parseScores(text) {
  const match = text.match(/SCORES:\s*Clarity:(\d+),\s*Energy:(\d+),\s*Wellbeing:(\d+),\s*Focus:(\d+),\s*Momentum:(\d+),\s*Control:(\d+)/i);
  if (!match) return null;
  return {
    Clarity: parseInt(match[1]), Energy: parseInt(match[2]),
    Wellbeing: parseInt(match[3]), Focus: parseInt(match[4]),
    Momentum: parseInt(match[5]), Control: parseInt(match[6]),
  };
}
function extractScores(messages) {
  let start = null, end = null;
  for (const m of messages.filter(m => m.role === "assistant")) {
    const s = parseScores(m.content);
    if (s) { if (!start) start = s; else end = s; }
  }
  return { start, end };
}

// ─────────────────────────────────────────────
// RADAR CHART
// ─────────────────────────────────────────────
function RadarChart({ before, after }) {
  const dims = ["Clarity", "Energy", "Wellbeing", "Focus", "Momentum", "Control"];
  const cx = 130, cy = 130, r = 88;
  const toXY = (val, i, radius) => {
    const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
    return { x: cx + radius * (val / 10) * Math.cos(angle), y: cy + radius * (val / 10) * Math.sin(angle) };
  };
  const poly = (scores) => dims.map((d, i) => { const p = toXY(scores[d] || 0, i, r); return `${p.x},${p.y}`; }).join(" ");
  return (
    <svg viewBox="0 0 260 260" style={{ width: "100%", maxWidth: 260 }}>
      {[2,4,6,8,10].map(lv => (
        <polygon key={lv} points={dims.map((_, i) => { const p = toXY(lv, i, r); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="#252218" strokeWidth="1" />
      ))}
      {dims.map((_, i) => { const p = toXY(10, i, r); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#252218" strokeWidth="1" />; })}
      {before && <polygon points={poly(before)} fill="rgba(120,100,60,0.12)" stroke="#7a6030" strokeWidth="1.5" />}
      {after && <polygon points={poly(after)} fill="rgba(201,169,110,0.18)" stroke="#c9a96e" strokeWidth="2" />}
      {dims.map((d, i) => {
        const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
        const lx = cx + (r + 24) * Math.cos(angle), ly = cy + (r + 24) * Math.sin(angle);
        return <text key={d} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 8, fill: "#6a6458", fontFamily: "monospace", letterSpacing: "0.08em" }}>{d.toUpperCase()}</text>;
      })}
      {before && dims.map((d, i) => { const p = toXY(before[d] || 0, i, r); return <circle key={`b${d}`} cx={p.x} cy={p.y} r={2.5} fill="#7a6030" />; })}
      {after && dims.map((d, i) => { const p = toXY(after[d] || 0, i, r); return <circle key={`a${d}`} cx={p.x} cy={p.y} r={2.5} fill="#c9a96e" />; })}
    </svg>
  );
}

// ─────────────────────────────────────────────
// FORMAT MESSAGE
// ─────────────────────────────────────────────
function formatMsg(text) {
  if (!text) return "";
  text = text.replace(/SCORES:.*$/gm, "").trim();
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>").replace(/$/, "</p>");
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function TheStrategist() {
  // screen: apikey | welcome | gate | chat | upgrade | feedback
  const [screen, setScreen] = useState("loading");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyTesting, setApiKeyTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [emailError, setEmailError] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [phase, setPhase] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [scores, setScores] = useState({ start: null, end: null });
  const [isPro, setIsPro] = useState(false);
  const messagesEnd = useRef(null);
  const textareaRef = useRef(null);

  // Boot: load stored state
  useEffect(() => {
    const store = loadStore();
    if (store.apiKey) {
      setApiKey(store.apiKey);
      setEmail(store.email || "");
      setName(store.name || "");
      setIsPro(store.isPro || false);
      setSessions(store.sessions || []);
      setScreen(store.email ? "welcome" : "gate");
    } else {
      setScreen("apikey");
    }
  }, []);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  function persist(overrides = {}) {
    const store = loadStore();
    saveStore({ ...store, apiKey, email, name, isPro, sessions, ...overrides });
  }

  // ── API KEY SCREEN ──
  async function testAndSaveApiKey() {
    if (!apiKeyInput.trim().startsWith("sk-ant-")) {
      setApiKeyError("That doesn't look right — Anthropic keys start with sk-ant-");
      return;
    }
    setApiKeyTesting(true);
    setApiKeyError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKeyInput.trim(), "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
      });
      if (res.status === 401) { setApiKeyError("Invalid API key — double-check and try again."); setApiKeyTesting(false); return; }
      if (!res.ok) { setApiKeyError("Something went wrong. Try again in a moment."); setApiKeyTesting(false); return; }
      const key = apiKeyInput.trim();
      setApiKey(key);
      saveStore({ apiKey: key, sessions: [] });
      setScreen("gate");
    } catch {
      setApiKeyError("Could not connect. Check your internet and try again.");
    }
    setApiKeyTesting(false);
  }

  // ── EMAIL GATE ──
  function submitEmail() {
    if (!name.trim()) { setEmailError("Please enter your first name."); return; }
    if (!email.includes("@") || !email.includes(".")) { setEmailError("Please enter a valid email address."); return; }
    setEmailError("");
    persist({ email, name });
    setScreen("welcome");
  }

  // ── SESSIONS ──
  function startNewSession() {
    const id = Date.now().toString();
    const session = { id, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), messages: [], phase: 0, msgCount: 0 };
    const updated = [session, ...sessions];
    setSessions(updated);
    setActiveId(id);
    setMessages([]);
    setMsgCount(0);
    setPhase(0);
    setScores({ start: null, end: null });
    setScreen("chat");
    persist({ sessions: updated });
    setTimeout(() => kickoff([], id, updated), 80);
  }

  function loadSession(s) {
    setActiveId(s.id);
    setMessages(s.messages || []);
    setMsgCount(s.msgCount || 0);
    setPhase(s.phase || 0);
    setScores(extractScores(s.messages || []));
    setShowSidebar(false);
    setScreen("chat");
  }

  function persistSession(id, msgs, ph, count, currentSessions) {
    const updated = (currentSessions || sessions).map(s =>
      s.id === id ? { ...s, messages: msgs, phase: ph, msgCount: count } : s
    );
    setSessions(updated);
    saveStore({ ...loadStore(), sessions: updated });
  }

  // ── API CALL ──
  async function callAI(history) {
    const apiMessages = history.length > 40
      ? [
          { role: "user", content: `[CONTEXT SUMMARY: ${history.slice(0, -20).filter(m => m.role === "user").map(m => m.content).join(" | ").slice(0, 800)}]` },
          { role: "assistant", content: "Got it — I have full context. Continuing from where we left off." },
          ...history.slice(-20),
        ]
      : history;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: SYSTEM_PROMPT, messages: apiMessages }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.find(b => b.type === "text")?.text || "Something went wrong — please try again.";
  }

  async function kickoff(existingMsgs, sessionId, currentSessions) {
    setLoading(true);
    const starter = { role: "user", content: `My name is ${name}. I'm ready to begin my life strategy session. Please start with the regulation check.` };
    const history = [...existingMsgs, starter];
    try {
      const reply = await callAI(history);
      const finalMsgs = [...history, { role: "assistant", content: reply }];
      setMessages(finalMsgs);
      setMsgCount(2);
      persistSession(sessionId, finalMsgs, 0, 2, currentSessions);
    } catch (e) {
      setMessages([{ role: "assistant", content: `Connection error: ${e.message}` }]);
    }
    setLoading(false);
  }

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    if (!isPro && msgCount >= FREE_MESSAGE_LIMIT) { setScreen("upgrade"); return; }
    const userMsg = { role: "user", content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    const newCount = msgCount + 1;
    setMsgCount(newCount);
    if (!isPro && newCount >= FREE_MESSAGE_LIMIT) {
      setLoading(false);
      persistSession(activeId, newMsgs, phase, newCount);
      setScreen("upgrade");
      return;
    }
    try {
      const reply = await callAI(newMsgs);
      const finalMsgs = [...newMsgs, { role: "assistant", content: reply }];
      setMessages(finalMsgs);
      setScores(extractScores(finalMsgs));
      const newPhase = Math.min(7, Math.floor(newCount / 5));
      setPhase(newPhase);
      persistSession(activeId, finalMsgs, newPhase, newCount + 1);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `Connection error: ${e.message}. Please try again.` }]);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const trialExhausted = !isPro && msgCount >= FREE_MESSAGE_LIMIT;
  const messagesLeft = FREE_MESSAGE_LIMIT - msgCount;
  const trialPct = Math.min(100, (msgCount / FREE_MESSAGE_LIMIT) * 100);

  // ─────────────────────────────────────────────
  // SHARED STYLES
  // ─────────────────────────────────────────────
  const G = {
    page: { minHeight: "100vh", background: "#0c0b09", color: "#e2ddd5", fontFamily: "Georgia, serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" },
    mono: { fontFamily: "'Courier New', Courier, monospace" },
    serif: { fontFamily: "Georgia, 'Times New Roman', serif" },
    gold: "#c9a96e",
    dim: "#5a5650",
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@300;400&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .cg { font-family: 'Cormorant Garamond', Georgia, serif !important; }
    .dm { font-family: 'DM Mono', 'Courier New', monospace !important; }
    .btn-gold { background:none;border:1px solid #c9a96e;color:#c9a96e;padding:13px 40px;cursor:pointer;border-radius:2px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.22em;transition:all 0.25s; }
    .btn-gold:hover { background:#c9a96e;color:#0c0b09;transform:translateY(-1px); }
    .btn-gold:disabled { opacity:0.4;cursor:not-allowed;transform:none; }
    .btn-ghost { background:none;border:1px solid #2a2820;color:#6a6660;padding:10px 24px;cursor:pointer;border-radius:2px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.18em;transition:all 0.2s; }
    .btn-ghost:hover { border-color:#c9a96e;color:#c9a96e; }
    .field { background:#0f0e0b;border:1px solid #2a2820;color:#c5bfb3;padding:11px 14px;border-radius:3px;width:100%;font-family:'DM Mono',monospace;font-size:13px;transition:border-color 0.2s;outline:none; }
    .field:focus { border-color:#c9a96e; }
    .field::placeholder { color:#3a3830; }
    .msg-user { background:rgba(255,255,255,0.03);border-left:2px solid #c9a96e;padding:12px 16px;border-radius:0 6px 6px 0;margin-left:32px;font-family:'DM Mono',monospace;font-size:12.5px;color:#b5b0a8;line-height:1.7; }
    .msg-ai { font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:300;line-height:1.85;color:#e2ddd5; }
    .msg-ai strong { font-weight:600;color:#c9a96e; }
    .msg-ai em { font-style:italic;color:#a09890; }
    .msg-ai p { margin-bottom:12px; }
    .msg-ai p:last-child { margin-bottom:0; }
    .sitem { cursor:pointer;padding:10px 12px;border-radius:3px;transition:background 0.15s;border:1px solid #1a1a14; }
    .sitem:hover { background:rgba(201,169,110,0.06);border-color:#2a2820; }
    .sitem.active { background:rgba(201,169,110,0.08);border-color:#3a3020; }
    .tag { font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.14em;color:#5a5650;border:1px solid #2a2820;padding:3px 9px;border-radius:2px; }
    .tbar { height:2px;background:#1a1a14;border-radius:1px;overflow:hidden; }
    .tfill { height:100%;background:linear-gradient(90deg,#c9a96e,#e8c88a);border-radius:1px;transition:width 0.4s ease; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
    .appear { animation:fadeUp 0.3s ease forwards; }
    @keyframes blink { 0%,100%{opacity:0.3}50%{opacity:1} }
    .d1{animation:blink 1.2s ease infinite}
    .d2{animation:blink 1.2s ease 0.2s infinite}
    .d3{animation:blink 1.2s ease 0.4s infinite}
    @keyframes spin { to{transform:rotate(360deg)} }
    .spin { animation:spin 1s linear infinite;display:inline-block; }
  `;

  if (screen === "loading") return <div style={{ ...G.page }}><style>{css}</style><div style={{ color: G.dim, ...G.mono, fontSize: 11 }}>LOADING…</div></div>;

  // ══════════════════════════════════════════════
  // API KEY SCREEN
  // ══════════════════════════════════════════════
  if (screen === "apikey") return (
    <div style={{ ...G.page }}>
      <style>{css}</style>
      <div style={{ maxWidth: 500, width: "100%" }}>
        <div className="dm" style={{ fontSize: 10, letterSpacing: "0.35em", color: G.dim, marginBottom: 36, textAlign: "center" }}>◈ &nbsp; THE STRATEGIST &nbsp; ◈</div>
        <h1 className="cg" style={{ fontSize: 38, fontWeight: 300, textAlign: "center", marginBottom: 14, lineHeight: 1.2 }}>One key to unlock<br /><em>your coach.</em></h1>
        <p className="cg" style={{ fontSize: 16, color: "#7a7060", lineHeight: 1.8, textAlign: "center", marginBottom: 36 }}>
          This app uses the Anthropic API to power your coaching sessions. You'll need a free API key — it takes 2 minutes to get one.
        </p>

        {/* Step-by-step */}
        <div style={{ background: "#0f0e0b", border: "1px solid #1e1e18", borderRadius: 4, padding: 24, marginBottom: 28 }}>
          <div className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.2em", marginBottom: 16 }}>HOW TO GET YOUR FREE API KEY</div>
          {[
            ["1", "Go to", "console.anthropic.com", "https://console.anthropic.com"],
            ["2", "Create a free account (no credit card needed for $5 free credit)", null, null],
            ["3", "Click "API Keys" in the left menu → "Create Key"", null, null],
            ["4", "Copy the key (starts with sk-ant-) and paste it below", null, null],
          ].map(([n, text, link, href]) => (
            <div key={n} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "flex-start" }}>
              <div className="dm" style={{ fontSize: 10, color: G.gold, minWidth: 18 }}>{n}.</div>
              <div className="cg" style={{ fontSize: 15, color: "#9a9488", lineHeight: 1.6 }}>
                {text}{" "}
                {link && <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: G.gold, textDecoration: "none" }}>{link} ↗</a>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.18em", display: "block", marginBottom: 8 }}>YOUR API KEY</label>
          <div style={{ position: "relative" }}>
            <input className="field" type={showApiKey ? "text" : "password"}
              placeholder="sk-ant-api03-..."
              value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && testAndSaveApiKey()}
              style={{ paddingRight: 80 }} />
            <button onClick={() => setShowApiKey(!showApiKey)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: G.dim, cursor: "pointer", fontFamily: "DM Mono, monospace", fontSize: 9, letterSpacing: "0.1em" }}>
              {showApiKey ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        {apiKeyError && <div className="dm" style={{ fontSize: 10, color: "#c97060", marginBottom: 12 }}>{apiKeyError}</div>}

        <button className="btn-gold" onClick={testAndSaveApiKey} disabled={apiKeyTesting || !apiKeyInput.trim()}
          style={{ width: "100%", textAlign: "center", marginBottom: 12 }}>
          {apiKeyTesting ? <span><span className="spin">◌</span> &nbsp;VERIFYING…</span> : "CONNECT & CONTINUE →"}
        </button>

        <p className="dm" style={{ fontSize: 9, color: "#2e2e28", textAlign: "center", lineHeight: 1.8 }}>
          Your key is stored only in your browser. It never leaves your device or touches our servers.
          A full session costs roughly $0.05 — less than a sip of coffee.
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════
  // EMAIL GATE
  // ══════════════════════════════════════════════
  if (screen === "gate") return (
    <div style={{ ...G.page }}>
      <style>{css}</style>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <div className="dm" style={{ fontSize: 10, letterSpacing: "0.3em", color: G.dim, marginBottom: 32, textAlign: "center" }}>◈ &nbsp; THE STRATEGIST &nbsp; ◈</div>
        <h2 className="cg" style={{ fontSize: 38, fontWeight: 300, marginBottom: 12, textAlign: "center" }}>Start your free session</h2>
        <p className="cg" style={{ fontSize: 16, color: "#7a7060", lineHeight: 1.7, marginBottom: 32, textAlign: "center" }}>
          One complete coaching session — all 8 phases, 40 messages — completely free. No credit card.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.18em", display: "block", marginBottom: 8 }}>FIRST NAME</label>
            <input className="field" type="text" placeholder="e.g. Sarah" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submitEmail()} />
          </div>
          <div>
            <label className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.18em", display: "block", marginBottom: 8 }}>EMAIL ADDRESS</label>
            <input className="field" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submitEmail()} />
          </div>
          {emailError && <div className="dm" style={{ fontSize: 10, color: "#c97060" }}>{emailError}</div>}
          <button className="btn-gold" onClick={submitEmail} style={{ marginTop: 8, width: "100%", textAlign: "center" }}>BEGIN FREE SESSION →</button>
          <p className="dm" style={{ fontSize: 9, color: "#3a3830", textAlign: "center", lineHeight: 1.7 }}>No spam. No data selling. Just your session summary and occasional updates.</p>
        </div>
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button className="btn-ghost" onClick={() => setScreen("apikey")} style={{ fontSize: 9 }}>← CHANGE API KEY</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════
  // WELCOME
  // ══════════════════════════════════════════════
  if (screen === "welcome") return (
    <div style={{ ...G.page }}>
      <style>{css}</style>
      <div style={{ maxWidth: 540, width: "100%", textAlign: "center" }}>
        <div className="dm" style={{ fontSize: 10, letterSpacing: "0.35em", color: G.dim, marginBottom: 36 }}>◈ &nbsp; THE STRATEGIST &nbsp; ◈</div>
        <h1 className="cg" style={{ fontSize: 52, fontWeight: 300, lineHeight: 1.1, marginBottom: 20 }}>Clarity begins<br /><em>with honesty.</em></h1>
        <p className="cg" style={{ fontSize: 17, color: "#7a7060", lineHeight: 1.85, marginBottom: 36 }}>
          A guided session through regulation, life audit, priorities, energy, decisions, planning, and mindset — built on ACT, motivational interviewing, and behavioral science.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {["ACT Therapy", "Motivational Interviewing", "IFS", "Behavioral Activation", "Polyvagal-Informed"].map(t => <span key={t} className="tag">{t}</span>)}
        </div>
        <div className="dm" style={{ fontSize: 12, color: "#7a7060", marginBottom: 24, letterSpacing: "0.08em" }}>Welcome back, {name} ✦</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <button className="btn-gold" onClick={startNewSession}>BEGIN NEW SESSION</button>
          {sessions.length > 0 && <>
            <button className="btn-ghost" onClick={() => loadSession(sessions[0])}>CONTINUE LAST SESSION</button>
            <button className="btn-ghost" onClick={() => setShowSidebar(true)}>ALL SESSIONS ↑</button>
          </>}
        </div>
        <div style={{ marginTop: 48, paddingTop: 28, borderTop: "1px solid #1a1a14", display: "flex", justifyContent: "center", gap: 48 }}>
          {[["8", "Coaching Phases"], ["40", "Free Messages"], ["0", "Generic Advice"]].map(([n, l]) => (
            <div key={l}>
              <div className="cg" style={{ fontSize: 32, fontWeight: 300, color: G.gold }}>{n}</div>
              <div className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.15em", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex" }}>
          <div style={{ width: 300, background: "#0a0908", borderRight: "1px solid #1a1a14", padding: 22, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.2em" }}>YOUR SESSIONS</div>
              <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", color: G.dim, cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <button className="btn-ghost" onClick={() => { setShowSidebar(false); startNewSession(); }} style={{ textAlign: "center" }}>+ NEW SESSION</button>
            {sessions.map(s => (
              <div key={s.id} className={`sitem ${s.id === activeId ? "active" : ""}`} onClick={() => loadSession(s)}>
                <div className="dm" style={{ fontSize: 8, color: G.gold, marginBottom: 3 }}>{s.date}</div>
                <div className="cg" style={{ fontSize: 13, color: "#8a8478" }}>{s.messages?.find(m => m.role === "user")?.content?.slice(0, 42) || "New session"}…</div>
                <div className="dm" style={{ fontSize: 8, color: "#3a3830", marginTop: 4 }}>{PHASES[s.phase || 0]?.label} · {s.msgCount || 0} msgs</div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} onClick={() => setShowSidebar(false)} />
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════
  // UPGRADE
  // ══════════════════════════════════════════════
  if (screen === "upgrade") return (
    <div style={{ ...G.page }}>
      <style>{css}</style>
      <div style={{ maxWidth: 500, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>★</div>
        <h2 className="cg" style={{ fontSize: 38, fontWeight: 300, marginBottom: 16 }}>You've completed your<br /><em>free session.</em></h2>
        <p className="cg" style={{ fontSize: 17, color: "#7a7060", lineHeight: 1.8, marginBottom: 36 }}>That took courage and honesty. If this helped, keep going.</p>
        <div style={{ background: "#0f0e0b", border: "1px solid #2a2820", borderRadius: 4, padding: 32, marginBottom: 24 }}>
          <div className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.25em", marginBottom: 16 }}>STRATEGIST PRO</div>
          <div className="cg" style={{ fontSize: 48, fontWeight: 300, color: G.gold, marginBottom: 4 }}>$9<span style={{ fontSize: 18, color: "#7a7060" }}>/mo</span></div>
          <div className="dm" style={{ fontSize: 9, color: "#4a4840", marginBottom: 24 }}>CANCEL ANYTIME</div>
          {["Unlimited coaching sessions", "Full conversation history", "Before/after clarity radar map", "Monthly insight digest", "PDF session summaries (coming soon)"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, textAlign: "left" }}>
              <span style={{ color: G.gold }}>✦</span>
              <span className="cg" style={{ fontSize: 16, color: "#a09888" }}>{f}</span>
            </div>
          ))}
          <button className="btn-gold" style={{ marginTop: 20, width: "100%" }}
            onClick={() => { setIsPro(true); setMsgCount(0); persist({ isPro: true }); setScreen("chat"); }}>
            UPGRADE TO PRO →
          </button>
          <div className="dm" style={{ fontSize: 9, color: "#3a3830", marginTop: 12 }}>(Demo mode: click to simulate upgrade)</div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn-ghost" onClick={() => setScreen("feedback")}>LEAVE FEEDBACK</button>
          <button className="btn-ghost" onClick={() => setScreen("welcome")}>HOME</button>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════
  // FEEDBACK
  // ══════════════════════════════════════════════
  if (screen === "feedback") return (
    <div style={{ ...G.page }}>
      <style>{css}</style>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div className="dm" style={{ fontSize: 10, letterSpacing: "0.3em", color: G.dim, marginBottom: 32, textAlign: "center" }}>◈ &nbsp; SHAPE THE STRATEGIST &nbsp; ◈</div>
        <h2 className="cg" style={{ fontSize: 36, fontWeight: 300, marginBottom: 12, textAlign: "center" }}>What would make this<br /><em>10x better for you?</em></h2>
        {feedbackSent ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>✦</div>
            <div className="cg" style={{ fontSize: 22, color: G.gold, marginBottom: 12 }}>Thank you, {name}.</div>
            <div className="cg" style={{ fontSize: 16, color: "#7a7060", marginBottom: 32 }}>Your feedback genuinely shapes what gets built next.</div>
            <button className="btn-gold" onClick={() => setScreen("upgrade")}>SEE UPGRADE OPTIONS →</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="cg" style={{ fontSize: 16, color: "#7a7060", lineHeight: 1.7, textAlign: "center", marginBottom: 8 }}>Every suggestion is read. The best ones get built.</p>
            <textarea className="field" rows={6} placeholder="What felt off? What's missing? What would make you pay for this without hesitation?"
              value={feedbackText} onChange={e => setFeedbackText(e.target.value)} style={{ resize: "vertical", lineHeight: 1.7 }} />
            <button className="btn-gold" onClick={() => feedbackText.trim() && setFeedbackSent(true)} style={{ textAlign: "center" }}>SEND FEEDBACK →</button>
            <button className="btn-ghost" onClick={() => setScreen("upgrade")} style={{ textAlign: "center" }}>SKIP → UPGRADE OPTIONS</button>
          </div>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════
  // CHAT
  // ══════════════════════════════════════════════
  return (
    <div style={{ height: "100vh", background: "#0c0b09", color: "#e2ddd5", display: "flex", flexDirection: "column" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ padding: "13px 20px", borderBottom: "1px solid #1a1a14", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0c0b09" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setShowSidebar(true)} style={{ background: "none", border: "1px solid #2a2820", color: G.dim, padding: "5px 9px", cursor: "pointer", borderRadius: 3, fontSize: 13 }}>☰</button>
          <div>
            <div className="cg" style={{ fontSize: 18, fontWeight: 300, letterSpacing: "0.08em" }}>THE STRATEGIST</div>
            <div className="dm" style={{ fontSize: 8, color: "#4a4840", letterSpacing: "0.2em" }}>WITH {name.toUpperCase()}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PHASES.map((p, i) => (
            <div key={p.label} title={p.label} style={{ width: 6, height: 6, borderRadius: "50%", background: i < phase ? "#5a5040" : i === phase ? G.gold : "#2a2820", boxShadow: i === phase ? `0 0 8px ${G.gold}88` : "none", transition: "all 0.4s" }} />
          ))}
          <div className="dm" style={{ fontSize: 9, color: G.dim, marginLeft: 8 }}>{PHASES[phase]?.label}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={() => setScreen("feedback")} style={{ padding: "5px 12px", fontSize: 9 }}>SUGGEST</button>
          {!isPro && <button className="btn-ghost" onClick={() => setScreen("upgrade")} style={{ padding: "5px 12px", fontSize: 9, borderColor: "#3a3020", color: G.gold }}>PRO</button>}
          <button className="btn-ghost" onClick={() => setScreen("welcome")} style={{ padding: "5px 12px", fontSize: 9 }}>HOME</button>
        </div>
      </div>

      {/* Trial bar */}
      {!isPro && (
        <div style={{ padding: "6px 20px", background: "#0a0908", borderBottom: "1px solid #141410" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <div className="dm" style={{ fontSize: 8, color: "#3a3830", letterSpacing: "0.15em" }}>FREE SESSION</div>
            <div className="dm" style={{ fontSize: 8, color: messagesLeft <= 10 ? "#c97060" : G.dim }}>{messagesLeft} MESSAGES REMAINING</div>
          </div>
          <div className="tbar"><div className="tfill" style={{ width: `${trialPct}%` }} /></div>
        </div>
      )}

      {/* Radar (shows after Phase 1 scores captured) */}
      {scores.start && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #141410", background: "#0a0908", display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 120, flexShrink: 0 }}><RadarChart before={scores.start} after={scores.end} /></div>
          <div>
            <div className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.18em", marginBottom: 8 }}>YOUR CLARITY MAP</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 2, background: "#7a6030" }} />
                <span className="dm" style={{ fontSize: 8, color: G.dim }}>START</span>
              </div>
              {scores.end && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 2, background: G.gold }} />
                <span className="dm" style={{ fontSize: 8, color: G.gold }}>NOW</span>
              </div>}
            </div>
            {scores.end && (
              <div style={{ marginTop: 8 }}>
                {Object.keys(scores.start).map(k => {
                  const diff = (scores.end[k] || 0) - (scores.start[k] || 0);
                  return diff !== 0 ? (
                    <span key={k} className="dm" style={{ fontSize: 8, color: diff > 0 ? G.gold : "#c97060", marginRight: 10 }}>
                      {k} {diff > 0 ? "+" : ""}{diff}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            {!isPro && <div className="dm" style={{ fontSize: 8, color: "#2e2e28", marginTop: 6 }}>FULL HISTORY UNLOCKS WITH PRO</div>}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
        {messages.map((msg, i) => (
          <div key={i} className="appear">
            {msg.role === "assistant" && <div className="dm" style={{ fontSize: 8, color: "#3a3830", letterSpacing: "0.2em", marginBottom: 6 }}>{PHASES[phase]?.icon} &nbsp; STRATEGIST</div>}
            {msg.role === "user" && <div className="dm" style={{ fontSize: 8, color: "#4a4640", letterSpacing: "0.2em", marginBottom: 6, textAlign: "right" }}>{name.toUpperCase()}</div>}
            <div className={msg.role === "assistant" ? "msg-ai" : "msg-user"} dangerouslySetInnerHTML={{ __html: formatMsg(msg.content) }} />
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className="dm" style={{ fontSize: 8, color: "#3a3830", letterSpacing: "0.2em", marginRight: 8 }}>THINKING</span>
            {["d1","d2","d3"].map(c => <div key={c} className={c} style={{ width: 4, height: 4, borderRadius: "50%", background: G.gold }} />)}
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 20px 18px", borderTop: "1px solid #1a1a14", background: "#0c0b09" }}>
        {trialExhausted ? (
          <div style={{ textAlign: "center" }}>
            <button className="btn-gold" onClick={() => setScreen("upgrade")}>CONTINUE WITH PRO →</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 720, margin: "0 auto" }}>
            <textarea ref={textareaRef} className="field" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey} placeholder="Respond honestly. Shift+Enter for new line."
              disabled={loading} rows={1} style={{ flex: 1, resize: "none", minHeight: 44, lineHeight: 1.65 }} />
            <button className="btn-ghost" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
              style={{ padding: "11px 18px", opacity: loading || !input.trim() ? 0.35 : 1, whiteSpace: "nowrap" }}>
              SEND →
            </button>
          </div>
        )}
        <div className="dm" style={{ fontSize: 8, color: "#1e1e18", textAlign: "center", marginTop: 8, letterSpacing: "0.12em" }}>
          CONTEXT PRESERVED · {messages.length} MESSAGES · API KEY STORED LOCALLY ONLY
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex" }}>
          <div style={{ width: 290, background: "#0a0908", borderRight: "1px solid #1a1a14", padding: 22, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="dm" style={{ fontSize: 9, color: G.dim, letterSpacing: "0.2em" }}>SESSIONS</div>
              <button onClick={() => setShowSidebar(false)} style={{ background: "none", border: "none", color: G.dim, cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <button className="btn-ghost" onClick={() => { setShowSidebar(false); startNewSession(); }} style={{ textAlign: "center" }}>+ NEW SESSION</button>
            {sessions.map(s => (
              <div key={s.id} className={`sitem ${s.id === activeId ? "active" : ""}`} onClick={() => loadSession(s)}>
                <div className="dm" style={{ fontSize: 8, color: G.gold, marginBottom: 3 }}>{s.date}</div>
                <div className="cg" style={{ fontSize: 13, color: "#8a8478" }}>{s.messages?.find(m => m.role === "user")?.content?.slice(0, 42) || "New session"}…</div>
                <div className="dm" style={{ fontSize: 8, color: "#3a3830", marginTop: 4 }}>{PHASES[s.phase || 0]?.label} · {s.msgCount || 0} msgs</div>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid #1a1a14" }}>
              <button className="btn-ghost" onClick={() => { setShowSidebar(false); setScreen("apikey"); }} style={{ width: "100%", textAlign: "center", fontSize: 9 }}>CHANGE API KEY</button>
            </div>
          </div>
          <div style={{ flex: 1 }} onClick={() => setShowSidebar(false)} />
        </div>
      )}
    </div>
  );
}
