import { useState, useRef, useEffect } from "react";
import svgPaths from "@/imports/ReferencePhoneBookshelf390844/svg-o1hnootjs1";

// ── Types ─────────────────────────────────────────────────────────────────────
type State = "initial" | "loading" | "results" | "empty" | "error";
type VP    = "phone" | "tablet";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     "#f8f4ec",
  card:   "rgba(255,252,248,0.9)",
  border: "#c1c7cd",
  text:   "#1f1b17",
  muted:  "#756f69",
  green:  "#2d4a3e",
  cream:  "#fffaf4",
} as const;

const GRADIENTS = [
  "linear-gradient(150deg,#3d5a4c,#1f3528)",
  "linear-gradient(150deg,#5a4a3d,#3a2a1d)",
  "linear-gradient(150deg,#4a3d5a,#2a1d3a)",
  "linear-gradient(150deg,#3d4a5a,#1d2a3a)",
  "linear-gradient(150deg,#5a3d3d,#3a1d1d)",
  "linear-gradient(150deg,#4a5a3d,#2a3a1d)",
  "linear-gradient(150deg,#5a503d,#3a301d)",
];

// ── Static data ───────────────────────────────────────────────────────────────
const BOOKS = [
  { title: "长夜余火",   author: "爱潜水的乌贼", latest: "第890章 薪火不灭",  desc: "末世之后，余烬之中，一个少年拾起微弱的火种，踏上漫漫征途，试图在黑暗中重燃文明之光。",       src: "笔趣阁",   srcCount: 3, sources: ["笔趣阁","起点中文网","番茄小说"] },
  { title: "长夜漫漫",   author: "寒烟散人",     latest: "第1200章 曙光初现", desc: "一个普通的年轻人，因缘际会卷入了一场跨越千年的秘密，命运与抉择交织，爱恨与牺牲并存。",   src: "起点中文网", srcCount: 2, sources: ["起点中文网","番茄小说"] },
  { title: "长夜将尽",   author: "风起云涌",     latest: "番外 往事如烟",      desc: "乱世飘零中，两个素不相识的人命运相交，在战火与硝烟中共同守护着那一缕微弱的希望。",       src: "笔趣阁",   srcCount: 1, sources: ["笔趣阁"] },
  { title: "漫漫长夜归", author: "归零",         latest: "第88章 归期未定",   desc: "他从远方而来，带着满身的疲惫与沧桑，只为寻找那一个在记忆深处始终明亮的面孔。",           src: "晋江文学城", srcCount: 2, sources: ["晋江文学城","番茄小说"] },
  { title: "长夜星河",   author: "星河入梦",     latest: "第560章 流星划过",  desc: "星空下的约定，跨越了时间与空间的羁绊，两颗灵魂在无垠宇宙中执着地寻找彼此。",           src: "笔趣阁",   srcCount: 2, sources: ["笔趣阁","晋江文学城"] },
  { title: "永夜长明",   author: "冬雪初晴",     latest: "第321章 烛光永存",  desc: "在那个没有阳光的世界里，文明依靠人类的智慧与意志存续，每一盏灯火都代表着生命的顽强。", src: "起点中文网", srcCount: 1, sources: ["起点中文网"] },
  { title: "长夜孤星",   author: "烛龙行",       latest: "第412章 繁星落尽",  desc: "在无边的夜色中，孤独的旅人寻找着属于自己的归宿，星辰见证了无数悲欢离合。",             src: "番茄小说", srcCount: 4, sources: ["笔趣阁","起点中文网","番茄小说","晋江文学城"] },
];
const SOURCES  = ["全部","笔趣阁","起点中文网","番茄小说","晋江文学城"];
const RECENTS  = ["诡秘之主","三体","斗破苍穹","明朝那些事儿","长夜余火","人间词话","银河帝国","百年孤独","解忧杂货店","追风筝的人"];

// ═══════════════════════════════════════════════════════════════════════════════
// Shared primitive components
// ═══════════════════════════════════════════════════════════════════════════════

// ── StatusBar ─────────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div className="flex items-end justify-between shrink-0 px-[23px] pb-[9px]" style={{ height: 48 }}>
      <span className="font-bold text-[14px] leading-none" style={{ color: C.text, fontFamily: "Inter, sans-serif" }}>10:30</span>
      <div className="flex items-center gap-[5px]">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d={svgPaths.p177483e0} fill={C.text} /></svg>
        <svg width="15" height="12" viewBox="0 0 15 12" fill="none">
          <path d={svgPaths.p3c3842e0} stroke={C.text} strokeWidth="0.25" />
          <path d={svgPaths.p254a1780} stroke={C.text} strokeWidth="0.25" />
          <path d={svgPaths.p342f1a80} stroke={C.text} strokeWidth="0.25" />
          <path d={svgPaths.pe696940}  fill={C.text} />
        </svg>
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
          <path d={svgPaths.p19c8aff0} stroke={C.text} strokeWidth="0.25" />
          <path d="M5 2H7"             stroke={C.text} strokeWidth="0.25" />
          <path d={svgPaths.p29b9a280} stroke={C.text} strokeWidth="0.25" />
        </svg>
        <span className="font-bold text-[14px] leading-none" style={{ color: C.text, fontFamily: "Inter, sans-serif" }}>82%</span>
      </div>
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ size = 24, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg
      className="animate-spin"
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10"
        stroke={light ? "rgba(255,250,244,0.3)" : "rgba(45,74,62,0.15)"}
        strokeWidth="2.5"
      />
      <path
        d="M12 2 A10 10 0 0 1 22 12"
        stroke={light ? C.cream : C.green}
        strokeWidth="2.5" strokeLinecap="round"
      />
    </svg>
  );
}

// ── SourceChip ────────────────────────────────────────────────────────────────
function SourceChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 text-[12px] font-bold leading-none"
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        fontFamily: "Inter, sans-serif",
        background: active ? C.green : C.card,
        color: active ? C.cream : C.muted,
        border: `0.556px solid ${active ? C.green : C.border}`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────
// Shared by Phone and Tablet. On tablet: slightly larger cover, 3-line description.
function ResultCard({
  title, author, latest, desc, src, srcCount, gradIdx, vp = "phone",
}: {
  title: string; author: string; latest: string; desc: string;
  src: string; srcCount: number; gradIdx: number; vp?: VP;
}) {
  const cW = vp === "phone" ? 60 : 68;
  const cH = vp === "phone" ? 82 : 92;
  const px = vp === "phone" ? 18 : 20;
  return (
    <div
      className="flex gap-[12px]"
      style={{ padding: `14px ${px}px`, borderBottom: `0.556px solid ${C.border}` }}
    >
      {/* Cover */}
      <div
        className="shrink-0 rounded-[6px] overflow-hidden flex items-end justify-center"
        style={{ width: cW, height: cH, background: GRADIENTS[gradIdx % GRADIENTS.length] }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1.3, paddingBottom: 6, paddingLeft: 4, paddingRight: 4, textAlign: "center", width: "100%", color: "rgba(255,250,244,0.6)", fontFamily: "'Noto Serif SC', serif" }}>
          {title.slice(0, 4)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
        <span className="line-clamp-1 text-[15px] font-bold leading-[1.3]" style={{ color: C.text, fontFamily: "'Noto Serif SC', serif" }}>
          {title}
        </span>
        <span className="text-[12px] leading-none" style={{ color: C.muted, fontFamily: "Inter, sans-serif" }}>{author}</span>
        <span className="text-[11px] leading-none truncate" style={{ color: C.muted, fontFamily: "Inter, sans-serif", opacity: 0.8 }}>
          最新：{latest}
        </span>
        <p
          className={vp === "tablet" ? "line-clamp-3" : "line-clamp-2"}
          style={{ fontSize: 12, color: "#9a948e", fontFamily: "Inter, sans-serif", lineHeight: 1.5, margin: 0 }}
        >
          {desc}
        </p>
        <div className="flex items-center gap-[6px] mt-[1px]">
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, color: C.green, background: "rgba(45,74,62,0.09)", fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
            {src}
          </span>
          {srcCount > 1 && (
            <span className="text-[11px]" style={{ color: C.muted, fontFamily: "Inter, sans-serif" }}>
              共 {srcCount} 个书源
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// State content areas
// ═══════════════════════════════════════════════════════════════════════════════

// ── Initial ───────────────────────────────────────────────────────────────────
// Collapsed view shows the first COLLAPSED_COUNT chips.
// When the list overflows we show an "展开" toggle; clicking it reveals all.
const COLLAPSED_COUNT = 5;

function InitialContent({
  recents, onSelect, onClear, vp,
}: {
  recents: string[]; onSelect: (s: string) => void; onClear: () => void; vp: VP;
}) {
  const [expanded, setExpanded] = useState(false);
  const px       = vp === "phone" ? 18 : 20;
  const hasMore  = recents.length > COLLAPSED_COUNT;
  const visible  = expanded ? recents : recents.slice(0, COLLAPSED_COUNT);

  if (recents.length === 0) {
    return (
      <div className="flex flex-col items-center" style={{ paddingTop: 88 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="21" cy="21" r="13" stroke={C.border} strokeWidth="2" />
          <path d="M30 30L42 42" stroke={C.border} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <p className="text-[13px] text-center mt-[14px]" style={{ color: C.muted, fontFamily: "Inter, sans-serif" }}>
          输入书名或作者开始搜索
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: `28px ${px}px 20px` }}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-[14px]">
        <span className="text-[13px] font-bold" style={{ color: C.text, fontFamily: "Inter, sans-serif" }}>
          最近搜索
        </span>
        <button
          onClick={onClear}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: C.muted, fontFamily: "Inter, sans-serif", padding: "4px 0" }}
        >
          清空记录
        </button>
      </div>

      {/* Chip list */}
      <div className="flex flex-wrap gap-[8px]">
        {visible.map(r => (
          <button
            key={r} onClick={() => onSelect(r)}
            className="text-[13px] rounded-[999px]"
            style={{ padding: "7px 14px", background: C.card, color: C.text, border: `0.556px solid ${C.border}`, fontFamily: "Inter, sans-serif", cursor: "pointer", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {r}
          </button>
        ))}

        {/* Expand / collapse chip — sits inline with the other chips */}
        {hasMore && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-[4px] text-[12px] font-bold rounded-[999px]"
            style={{ padding: "7px 12px", background: "transparent", color: C.green, border: `0.556px solid ${C.green}`, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0 }}
          >
            {expanded ? (
              <>
                收起
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 8L6 4L10 8" stroke={C.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            ) : (
              <>
                {recents.length - COLLAPSED_COUNT} 条更多
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 4L6 8L10 4" stroke={C.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────────
function LoadingContent({ vp }: { vp: VP }) {
  return (
    <div className="flex flex-col items-center" style={{ paddingTop: vp === "phone" ? 120 : 160 }}>
      <Spinner size={36} />
      <p className="text-[13px] mt-[18px]" style={{ color: C.muted, fontFamily: "Inter, sans-serif" }}>
        正在搜索所有书源…
      </p>
    </div>
  );
}

// ── Empty ─────────────────────────────────────────────────────────────────────
// Visual identical to the previously confirmed empty state.
function EmptyContent({ query, onRetry, vp }: { query: string; onRetry: () => void; vp: VP }) {
  const pt = vp === "phone" ? 50 : 80;
  return (
    <div className="flex flex-col items-center" style={{ paddingTop: pt, paddingBottom: 40 }}>
      <svg width="128" height="120" viewBox="0 0 128 120" fill="none" style={{ marginBottom: 28 }}>
        <rect x="16" y="82" width="88" height="14" rx="3" fill="#d8d1c4" />
        <rect x="16" y="82" width="6"  height="14" rx="2" fill="#c4bdb0" />
        <rect x="20" y="64" width="80" height="15" rx="3" fill="#e0d9cc" />
        <rect x="20" y="64" width="6"  height="15" rx="2" fill="#ccc5b8" />
        <rect x="26" y="47" width="68" height="14" rx="3" fill="#eae4d8" />
        <rect x="26" y="47" width="6"  height="14" rx="2" fill="#d4cec2" />
        <circle cx="84" cy="30" r="18" stroke={C.muted} strokeWidth="2.5" fill="rgba(248,244,236,0.95)" />
        <path d="M97 43L110 56" stroke={C.muted} strokeWidth="3.5" strokeLinecap="round" />
        <text x="84" y="37" textAnchor="middle" fontSize="18" fontWeight="700" fill={C.muted} fontFamily="Inter, sans-serif">?</text>
      </svg>

      <p className="text-[17px] font-bold text-center" style={{ marginBottom: 10, color: C.text, fontFamily: "'Noto Serif SC', serif" }}>
        没有找到相关书籍
      </p>
      <p className="text-[13px] text-center leading-relaxed" style={{ color: C.muted, fontFamily: "Inter, sans-serif", paddingLeft: 40, paddingRight: 40 }}>
        所有书源均未搜索到<br />
        <span className="font-bold" style={{ color: C.text }}>「{query || "该书名"}」</span><br />
        的相关结果
      </p>

      <div
        className="rounded-[12px]"
        style={{ marginTop: 22, padding: "14px 18px", marginLeft: 32, marginRight: 32, background: C.card, border: `0.556px solid ${C.border}` }}
      >
        <p className="text-[12px] font-bold" style={{ marginBottom: 8, color: C.text, fontFamily: "Inter, sans-serif" }}>搜索建议</p>
        {["检查书名拼写是否正确", "尝试更短的关键词或作者名", "前往发现页手动添加书源"].map(tip => (
          <div key={tip} className="flex items-start gap-[6px]" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 11, marginTop: 2, color: C.green }}>·</span>
            <span className="text-[12px] leading-relaxed" style={{ color: C.muted, fontFamily: "Inter, sans-serif" }}>{tip}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-[10px]" style={{ marginTop: 20 }}>
        <button
          className="font-extrabold leading-none rounded-[999px]"
          style={{ padding: "0 18px", height: 36, background: C.green, color: C.cream, fontFamily: "Inter, sans-serif", fontSize: 13, border: "none", cursor: "pointer" }}
        >
          添加书源
        </button>
        <button
          onClick={onRetry}
          className="font-bold leading-none rounded-[999px]"
          style={{ padding: "0 18px", height: 36, background: C.card, color: C.muted, border: `0.556px solid ${C.border}`, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer" }}
        >
          重新搜索
        </button>
      </div>
    </div>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────────
function ErrorContent({ onRetry, vp }: { onRetry: () => void; vp: VP }) {
  const pt = vp === "phone" ? 96 : 140;
  return (
    <div className="flex flex-col items-center" style={{ paddingTop: pt, paddingBottom: 40 }}>
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="32" fill="rgba(240,235,225,0.9)" stroke={C.border} strokeWidth="1.5" />
        <path d="M40 22V42" stroke={C.muted} strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="54" r="3.5" fill={C.muted} />
      </svg>
      <p className="text-[17px] font-bold" style={{ marginTop: 20, color: C.text, fontFamily: "'Noto Serif SC', serif" }}>
        搜索失败
      </p>
      <p className="text-[13px]" style={{ marginTop: 8, color: C.muted, fontFamily: "Inter, sans-serif" }}>
        请检查网络后重试
      </p>
      <button
        onClick={onRetry}
        className="font-extrabold leading-none rounded-[999px]"
        style={{ marginTop: 24, padding: "0 28px", height: 40, background: C.green, color: C.cream, fontFamily: "Inter, sans-serif", fontSize: 14, border: "none", cursor: "pointer" }}
      >
        重新搜索
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Canonical SearchPage  —  single component, all states × all viewports
// ═══════════════════════════════════════════════════════════════════════════════

interface SearchPageProps {
  /** Starting state for this demo instance */
  init:          State;
  vp:            VP;
  /** Pre-filled query (for non-initial states) */
  initQuery?:    string;
  /** What state to settle into after loading completes */
  outcome?:      State;
  /** Whether the loading state auto-advances (false = freeze for reference) */
  autoProgress?: boolean;
}

function SearchPage({
  init, vp, initQuery = "", outcome = "results", autoProgress = true,
}: SearchPageProps) {
  const [state,   setState]   = useState<State>(init);
  const [query,   setQuery]   = useState(initQuery);
  const [source,  setSource]  = useState("全部");
  const [recents, setRecents] = useState(RECENTS);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer    = useRef<ReturnType<typeof setTimeout>>();

  // Auto-focus input when entering initial state
  useEffect(() => {
    if (state === "initial") inputRef.current?.focus();
  }, [state]);

  // Auto-advance from loading → outcome
  useEffect(() => {
    if (state === "loading" && autoProgress) {
      timer.current = setTimeout(() => setState(outcome), 1800);
      return () => clearTimeout(timer.current);
    }
  }, [state, outcome, autoProgress]);

  function search() {
    if (!query.trim()) return;
    setState("loading");
  }
  function retry() { setState("loading"); }

  const disabled    = !query.trim();
  const isLoading   = state === "loading";
  const showChips   = state !== "initial";
  const showSummary = state === "results";
  const books       = source === "全部" ? BOOKS : BOOKS.filter(b => b.sources.includes(source));

  // ── Viewport dimensions ──────────────────────────────────────────────────
  const W = vp === "phone" ? 390 : 760;
  const H = vp === "phone" ? 844 : 960;
  const R = vp === "phone" ? 34  : 24;

  // For tablet: center content in a 620px column; borders remain full-width.
  const colMax  = vp === "tablet" ? 620 : undefined;
  const barPx   = vp === "phone"  ? "16px" : "20px";
  const btnH    = vp === "phone"  ? 36 : 40;
  const btnFz   = vp === "phone"  ? 13 : 14;
  const btnPx   = vp === "phone"  ? 14 : 18;

  // Convenience: centered column wrapper style
  const col = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    maxWidth: colMax, margin: "0 auto", width: "100%", ...extra,
  });

  return (
    <div style={{
      width: W, height: H, background: C.bg, borderRadius: R,
      overflow: "hidden", position: "relative", flexShrink: 0,
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <StatusBar />

      {/* ── Search bar row ──────────────────────────────────────────────── */}
      <div style={{ borderBottom: `0.556px solid ${C.border}`, flexShrink: 0 }}>
        <div style={col({ display: "flex", alignItems: "center", gap: 10, padding: `8px ${barPx}` })}>
          {/* Back */}
          <button style={{ flexShrink: 0, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "none", background: "none", cursor: "pointer" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 4L7 10L12.5 16" stroke={C.text} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Input pill */}
          <div
            className="flex-1 flex items-center gap-[8px] rounded-[999px] px-[12px]"
            style={{ height: btnH, background: "rgba(31,27,23,0.07)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke={C.muted} strokeWidth="1.2" />
              <path d="M9.5 9.5L12.5 12.5" stroke={C.muted} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              className="flex-1 bg-transparent outline-none border-none text-[14px]"
              style={{ color: C.text, fontFamily: "Inter, sans-serif" }}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !disabled && !isLoading && search()}
              placeholder="搜索书名、作者..."
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 0, flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" fill={C.muted} opacity="0.5" />
                  <path d="M5 5L9 9M9 5L5 9" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Search button — disabled when empty, spinner when loading */}
          <button
            onClick={!disabled && !isLoading ? search : undefined}
            className="shrink-0 flex items-center gap-[6px] rounded-[999px] font-extrabold leading-none"
            style={{
              height: btnH, padding: `0 ${btnPx}px`,
              background: disabled ? "rgba(45,74,62,0.22)" : C.green,
              color: C.cream,
              fontFamily: "Inter, sans-serif", fontSize: btnFz,
              border: "none",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.75 : 1,
              transition: "background 0.15s, opacity 0.15s",
            }}
          >
            {isLoading && <Spinner size={13} light />}
            搜索
          </button>
        </div>
      </div>

      {/* ── Source filter chips (not shown in initial state) ─────────────── */}
      {showChips && (
        <div style={{ borderBottom: `0.556px solid ${C.border}`, flexShrink: 0 }}>
          <div
            style={col({
              display: "flex", gap: 8,
              padding: `9px ${barPx}`,
              overflowX: "auto",
              scrollbarWidth: "none",
            } as React.CSSProperties)}
          >
            {SOURCES.map(s => (
              <SourceChip key={s} label={s} active={source === s} onClick={() => setSource(s)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Result summary bar (results state only) ──────────────────────── */}
      {showSummary && (
        <div style={{ borderBottom: `0.556px solid ${C.border}`, flexShrink: 0 }}>
          <div style={col({ padding: `6px ${vp === "phone" ? "18px" : "20px"}` })}>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: "Inter, sans-serif" }}>
              找到{" "}
              <span style={{ color: C.green, fontWeight: 700 }}>{books.length}</span>
              {" "}本相关书籍
            </span>
          </div>
        </div>
      )}

      {/* ── Scrollable content area ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={col()}>

          {state === "initial" && (
            <InitialContent
              recents={recents}
              onSelect={s => setQuery(s)}
              onClear={() => setRecents([])}
              vp={vp}
            />
          )}

          {state === "loading" && <LoadingContent vp={vp} />}

          {state === "results" && (
            <>
              {books.map((b, i) => (
                <ResultCard key={b.title} {...b} gradIdx={i} vp={vp} />
              ))}
              <div style={{ height: 16 }} />
            </>
          )}

          {state === "empty" && (
            <EmptyContent query={query} onRetry={retry} vp={vp} />
          )}

          {state === "error" && (
            <ErrorContent onRetry={retry} vp={vp} />
          )}

        </div>
      </div>

      {/* Border overlay */}
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, border: `0.556px solid ${C.border}`, borderRadius: R, pointerEvents: "none" }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// App — all 10 frames (5 states × 2 viewports)
// ═══════════════════════════════════════════════════════════════════════════════

const FRAMES: { init: State; label: string; query: string; outcome: State; autoProgress: boolean }[] = [
  { init: "initial", label: "初始状态", query: "",                 outcome: "results", autoProgress: true  },
  { init: "loading", label: "搜索中",   query: "长夜",             outcome: "results", autoProgress: false },
  { init: "results", label: "搜索结果", query: "长夜",             outcome: "results", autoProgress: true  },
  { init: "empty",   label: "无结果",   query: "龙马精神传奇2049", outcome: "results", autoProgress: true  },
  { init: "error",   label: "搜索失败", query: "长夜",             outcome: "results", autoProgress: true  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a948e", fontFamily: "Inter, sans-serif", marginBottom: 20 }}>
      {children}
    </p>
  );
}

export default function App() {
  return (
    <div style={{ background: "#ede8df", minHeight: "100vh", padding: "48px 24px 80px" }}>

      {/* ── Phone · 390 × 844 ───────────────────────────────────────────── */}
      <SectionLabel>手机端 · 390 × 844</SectionLabel>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 72 }}>
        {FRAMES.map(f => (
          <div key={f.init} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9a948e", fontFamily: "Inter, sans-serif" }}>
              {f.label}
            </span>
            <SearchPage
              init={f.init} vp="phone"
              initQuery={f.query} outcome={f.outcome} autoProgress={f.autoProgress}
            />
          </div>
        ))}
      </div>

      {/* ── Tablet · 760 × 960 · Landscape reuses this layout ──────────── */}
      <SectionLabel>平板端 · 760 × 960 · 横屏复用此布局</SectionLabel>
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
        {FRAMES.map(f => (
          <div key={f.init + "-tab"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#9a948e", fontFamily: "Inter, sans-serif" }}>
              {f.label}
            </span>
            <SearchPage
              init={f.init} vp="tablet"
              initQuery={f.query} outcome={f.outcome} autoProgress={f.autoProgress}
            />
          </div>
        ))}
      </div>

    </div>
  );
}
