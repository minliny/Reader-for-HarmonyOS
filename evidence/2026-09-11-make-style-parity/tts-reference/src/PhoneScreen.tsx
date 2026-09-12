import { useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import svgPaths from "../imports/svg-8yrmzwthkp";
import imgPaperLayer from "../imports/99d77078d4edc59bf6fc0f8d5cf678d7361665e5.png";
import ReaderModuleTtsPhone from "./imports/ReaderModuleTtsPhone";

/* ─────────────────────────────────────────────
   ICONS
───────────────────────────────────────────── */

function TablerArrowLeftOutline() {
  return (
    <div className="absolute left-0 size-[23.993px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 23.9931 23.9931">
        <g clipPath="url(#al)">
          <path d="M4.99856 11.9965H18.9945" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
          <path d={svgPaths.pc774e00} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
          <path d={svgPaths.pf712d00} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
        </g>
        <defs><clipPath id="al"><rect fill="white" height="23.9931" width="23.9931" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerSwitchHorizontalOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 20 20">
        <g clipPath="url(#sh)">
          <path d={svgPaths.p35177c00} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M8.33333 5.83333H16.6667" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.pd8c5e80} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M3.33333 14.1667H10.8333" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs><clipPath id="sh"><rect fill="white" height="20" width="20" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerDotsOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 20 20">
        <g clipPath="url(#dots)">
          <path d={svgPaths.p14290600} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.p3d191400} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.pb0d3180} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs><clipPath id="dots"><rect fill="white" height="20" width="20" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerChevronRightSm() {
  return (
    <div className="absolute left-0 size-[12px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 12 12">
        <g clipPath="url(#chrsm)">
          <path d="M4.5 3L7.5 6L4.5 9" stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
        </g>
        <defs><clipPath id="chrsm"><rect fill="white" height="12" width="12" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerHeadphonesLg() {
  return (
    <div className="absolute left-0 size-[16px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 16 16">
        <g clipPath="url(#hplg)">
          <path d={svgPaths.pfe9ec80} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p3686100} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p99b6600} stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
        <defs><clipPath id="hplg"><rect fill="white" height="16" width="16" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerHeadphonesFilled() {
  return (
    <div className="absolute left-0 size-[23.993px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 23.9931 23.9931">
        <g clipPath="url(#hpf)">
          <path d={svgPaths.p3096cf80} stroke="#FFFCF8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.98" strokeWidth="1.7495" />
          <path d={svgPaths.p29e8ed00} stroke="#FFFCF8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.98" strokeWidth="1.7495" />
          <path d={svgPaths.p22f56e00} stroke="#FFFCF8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.98" strokeWidth="1.7495" />
        </g>
        <defs><clipPath id="hpf"><rect fill="white" height="23.9931" width="23.9931" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerClockOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 20 20">
        <g clipPath="url(#clk)">
          <path d={svgPaths.p2643e980} stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M10 5.83333V10L12.5 12.5" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs><clipPath id="clk"><rect fill="white" height="20" width="20" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerPhoneOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 20 20">
        <g clipPath="url(#pho)">
          <path d={svgPaths.p2af55a80} stroke="#1F3528" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs><clipPath id="pho"><rect fill="white" height="20" width="20" /></clipPath></defs>
      </svg>
    </div>
  );
}

function TablerCloudOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0">
      <svg className="absolute block inset-0 size-full" fill="none" viewBox="0 0 20 20">
        <g clipPath="url(#cld)">
          <path d={svgPaths.p33960600} stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs><clipPath id="cld"><rect fill="white" height="20" width="20" /></clipPath></defs>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────
   READING SURFACE
───────────────────────────────────────────── */

function ReadingContent() {
  return (
    <div className="absolute inset-[72px_32px_47.99px_32px] overflow-clip">
      <div className="absolute left-0 right-0 top-0">
        <div className="[word-break:break-word] content-stretch flex flex-col gap-[18px] items-start relative size-full text-[#2b241d]">
          <p className="font-['Noto_Serif_SC:Bold',sans-serif] font-bold leading-[28.75px] relative shrink-0 text-[23px] text-center w-full">雨夜</p>
          <div className="font-['Noto_Serif_SC:Regular',sans-serif] font-normal leading-[0] relative shrink-0 text-[18px] w-full">
            <p className="indent-[36px] leading-[35.28px] mb-[15.8px]">雨声在窗外连成一片，像无数细小的针，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.8px]">他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个迟到许久的答案终于抵达。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.8px]">这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下短暂而摇晃的光。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.8px]">他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.8px]">可真正看到信上那行字时，他才发现那些被压下去的情绪并没有消失，只是一直在暗处积蓄，等着这一刻重新涌上来。</p>
            <p className="indent-[36px] leading-[35.28px]">远处的灯光像被雾气揉碎，</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperLayer() {
  return (
    <div
      className="absolute bg-size-[200px_200px,auto_auto,auto_auto,auto_auto] bg-top-left inset-[0.56px] overflow-clip"
      style={{
        backgroundImage: `url("${imgPaperLayer}"), linear-gradient(180deg, rgb(251, 244, 233) 0%, rgb(239, 226, 208) 100%)`,
      }}
    >
      <ReadingContent />
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOP BAR
───────────────────────────────────────────── */

function TopBar() {
  return (
    <div className="absolute bg-[rgba(255,250,244,0.98)] h-[53.993px] left-[15px] rounded-[24px] top-[19px] w-[360px]">
      <div aria-hidden className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]" />
      {/* Back */}
      <div className="absolute h-[42px] left-[13px] top-[6px] w-[44px]">
        <div className="absolute left-[10px] size-[23.993px] top-[9px]">
          <TablerArrowLeftOutline />
        </div>
      </div>
      {/* Title */}
      <div className="[word-break:break-word] absolute h-[45px] leading-[normal] left-[65px] overflow-clip top-[4.5px] w-[170px] whitespace-nowrap">
        <p className="absolute font-['Noto_Serif_SC:Bold',sans-serif] font-bold left-0 text-[#332c25] text-[16px] top-0">长夜余火</p>
        <p className="absolute font-['Noto_Serif_SC:Regular',sans-serif] font-normal left-0 text-[#5b5046] text-[12px] top-[28px]">第 32 章 雨夜 · 优书网</p>
      </div>
      {/* Source switch */}
      <div className="absolute h-[42px] left-[243px] top-[6px] w-[62px]">
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] left-[19px] text-[#332c25] text-[12px] top-[25px] w-[24px]">换源</p>
        <div className="absolute left-[21px] size-[20px] top-[1.25px]">
          <TablerSwitchHorizontalOutline />
        </div>
      </div>
      {/* More */}
      <div className="absolute h-[42px] left-[313px] top-[6px] w-[34px]">
        <div className="absolute left-[7px] size-[20px] top-[11px]">
          <TablerDotsOutline />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SHEET GRABBER
───────────────────────────────────────────── */

function Grabber() {
  return <div className="-translate-x-1/2 absolute bg-[#b9ad9f] h-[4px] left-1/2 rounded-[999px] top-[9.55px] w-[42px]" />;
}

/* ─────────────────────────────────────────────
   SHARED PRIMITIVES  (warm parchment / teal system)
───────────────────────────────────────────── */

const TEAL = "#2f6373";
const CLAY = "#a8543a";

function SectionLabel({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-[3px] mb-[9px]">
      <p className="font-['Noto_Sans_SC:Bold',sans-serif] font-bold text-[12px] leading-[17px] text-[#332c25] whitespace-nowrap">
        {title}
      </p>
      {meta != null && <div className="flex items-center">{meta}</div>}
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[14px] bg-[rgba(255,252,248,0.92)] ${className}`}>
      <div aria-hidden className="absolute inset-0 rounded-[14px] pointer-events-none border-[0.5px] border-[rgba(180,166,151,0.34)]" />
      <div aria-hidden className="absolute inset-0 rounded-[14px] pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="relative h-[24px] w-[42px] rounded-full transition-colors duration-200 cursor-pointer shrink-0"
      style={{ background: value ? TEAL : "#c6bfb2" }}
    >
      <span
        className="absolute top-[2px] size-[20px] rounded-full bg-[#FFFCF8] shadow-[0_1px_2px_rgba(47,35,20,0.22)] transition-all duration-200"
        style={{ left: value ? 20 : 2 }}
      />
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[32px] px-[14px] rounded-[10px] text-[12px] leading-none whitespace-nowrap cursor-pointer transition-all duration-150 active:scale-95"
      style={{
        fontFamily: "'Noto Sans SC:Medium', sans-serif",
        background: active ? TEAL : "rgba(180,166,151,0.14)",
        color: active ? "#FFFCF8" : "#5b5046",
        boxShadow: active
          ? "0 2px 7px rgba(47,99,115,0.28)"
          : "inset 0 0 0 0.5px rgba(180,166,151,0.34)",
      }}
    >
      {children}
    </button>
  );
}

function Row({ label, right, last }: { label: string; right: ReactNode; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between h-[48px] px-[14px]"
      style={last ? undefined : { boxShadow: "inset 0 -0.5px 0 rgba(155,132,102,0.18)" }}
    >
      <span className="font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[12px] text-[#332c25] whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-[6px] min-w-0">{right}</div>
    </div>
  );
}

function SelectRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <Row
      label={label}
      last={last}
      right={
        <button type="button" className="flex items-center gap-[6px] cursor-pointer group">
          <span className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[12px] text-[#5b5046] whitespace-nowrap group-active:text-[#332c25]">
            {value}
          </span>
          <div className="relative size-[12px] mt-[1px]"><TablerChevronRightSm /></div>
        </button>
      }
    />
  );
}

function ToggleRow({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return <Row label={label} last={last} right={<Toggle value={value} onChange={onChange} />} />;
}

/* ─────────────────────────────────────────────
   PLAYBACK CONTROL  (no progress — TTS transport)
───────────────────────────────────────────── */

type PlayState = "idle" | "playing" | "paused";

function EqualiserBar({ playing }: { playing: boolean }) {
  const bars = [7, 13, 9, 18, 12, 22, 15, 10, 20, 14, 8, 17, 11, 21, 13, 9, 16, 12, 19, 10, 14, 8, 15, 11];
  return (
    <div className="flex items-center justify-between h-[26px] w-full">
      {bars.map((h, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 2.5,
            height: playing ? h : 4,
            background: playing ? TEAL : "rgba(180,166,151,0.42)",
            opacity: playing ? 0.75 + (i % 3) * 0.12 : 1,
            transformOrigin: "center",
            animation: playing ? `wb ${0.65 + (i % 5) * 0.11}s ease-in-out ${i * 0.03}s infinite alternate` : "none",
            transition: "height 0.3s ease, background 0.35s ease",
          }}
        />
      ))}
    </div>
  );
}

function GhostBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center size-[42px] rounded-full cursor-pointer transition-all duration-150 active:scale-90 hover:bg-[rgba(47,99,115,0.06)]"
    >
      {children}
    </button>
  );
}

function PlaybackModule() {
  const [playState, setPlayState] = useState<PlayState>("playing");
  const playing = playState === "playing";
  const label = playing ? "朗读中" : playState === "paused" ? "已暂停" : "未开始";

  return (
    <div>
      <SectionLabel
        title="朗读控制"
        meta={
          <span
            className="flex items-center gap-[5px] rounded-full px-[8px] py-[2px] transition-colors duration-300"
            style={{ background: playing ? "rgba(47,99,115,0.1)" : "rgba(180,166,151,0.14)" }}
          >
            <span className="size-[5px] rounded-full transition-colors duration-300" style={{ background: playing ? TEAL : "#b4a697" }} />
            <span
              className="text-[10px] leading-[14px] whitespace-nowrap transition-colors duration-300"
              style={{ fontFamily: "'Noto Sans SC:Medium', sans-serif", color: playing ? TEAL : "#5b5046" }}
            >
              {label}
            </span>
          </span>
        }
      />
      <Card className="p-[16px]">
        <div className="flex flex-col items-center gap-[16px]">
          <EqualiserBar playing={playing} />

          <div className="flex items-center justify-center gap-[24px]">
            <GhostBtn label="上一章" onClick={() => {}}>
              <svg width="26" height="26" fill="none" viewBox="0 0 26 26">
                <path d="M16 7 10 13l6 6" stroke="#332c25" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 7v12" stroke="#332c25" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </GhostBtn>

            <button
              type="button"
              onClick={() => setPlayState((s) => (s === "playing" ? "paused" : "playing"))}
              aria-label={playing ? "暂停" : "播放"}
              className="flex items-center justify-center size-[58px] rounded-full cursor-pointer transition-all duration-200 active:scale-95"
              style={{
                background: "linear-gradient(155deg, #2f6373 0%, #244f5c 100%)",
                boxShadow: playing
                  ? "0 5px 16px rgba(47,99,115,0.42), inset 0 1px 1px rgba(255,255,255,0.16)"
                  : "0 3px 10px rgba(47,99,115,0.26), inset 0 1px 1px rgba(255,255,255,0.1)",
              }}
            >
              {playing ? (
                <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                  <rect x="5.6" y="4" width="2.6" height="12" rx="1.3" fill="#FFFAF4" />
                  <rect x="11.8" y="4" width="2.6" height="12" rx="1.3" fill="#FFFAF4" />
                </svg>
              ) : (
                <svg width="22" height="22" fill="none" viewBox="0 0 22 22">
                  <path d="M7.5 5 16.5 11l-9 6V5Z" fill="#FFFAF4" stroke="#FFFAF4" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            <GhostBtn label="下一章" onClick={() => {}}>
              <svg width="26" height="26" fill="none" viewBox="0 0 26 26">
                <path d="M10 7l6 6-6 6" stroke="#332c25" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 7v12" stroke="#332c25" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </GhostBtn>
          </div>

          <div className="flex items-center justify-between w-full pt-[2px]">
            <span className="flex items-center gap-[6px]">
              <span className="relative size-[16px]"><TablerHeadphonesLg /></span>
              <span className="font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[11px] text-[#5b5046]">当前音色 · 清晰女声</span>
            </span>

            <button
              type="button"
              onClick={() => setPlayState("idle")}
              aria-label="停止"
              className="flex items-center gap-[5px] rounded-full pl-[9px] pr-[11px] py-[5px] cursor-pointer transition-all duration-150 active:scale-95"
              style={{ background: "rgba(168,84,58,0.08)", boxShadow: "inset 0 0 0 0.5px rgba(168,84,58,0.3)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1" y="1" width="8" height="8" rx="2" fill={CLAY} />
              </svg>
              <span className="text-[11px] leading-none" style={{ fontFamily: "'Noto Sans SC:Medium', sans-serif", color: CLAY }}>
                停止
              </span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SPEED
───────────────────────────────────────────── */

const SPEED_MIN = 0.5;
const SPEED_MAX = 2.0;

function SpeedSlider({ value, onChange, hideLabels }: { value: number; onChange: (v: number) => void; hideLabels?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (value - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);

  const setFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let p = (clientX - r.left) / r.width;
    p = Math.min(1, Math.max(0, p));
    const raw = SPEED_MIN + p * (SPEED_MAX - SPEED_MIN);
    onChange(Number((Math.round(raw / 0.05) * 0.05).toFixed(2)));
  };

  return (
    <div>
      <div
        ref={trackRef}
        className="relative h-[24px] flex items-center cursor-pointer touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) setFromClientX(e.clientX);
        }}
      >
        <div className="relative h-[6px] w-full rounded-full bg-[rgba(180,166,151,0.28)]">
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct * 100}%`, background: TEAL }} />
          <div
            className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFFCF8]"
            style={{ left: `${pct * 100}%`, boxShadow: "0 1px 4px rgba(47,35,20,0.22), 0 0 0 1.5px #2f6373" }}
          />
        </div>
      </div>
      {!hideLabels && (
        <div className="flex items-center justify-between mt-[6px] px-[1px]">
          <span className="font-['Inter:Regular',sans-serif] text-[9px] text-[#8a7d6f]">0.5x</span>
          <span className="font-['Inter:Regular',sans-serif] text-[9px] text-[#8a7d6f]">2.0x</span>
        </div>
      )}
    </div>
  );
}

function SpeedModule() {
  const [speed, setSpeed] = useState(1.0);
  const presets = [0.75, 1.0, 1.25, 1.5];
  return (
    <div>
      <SectionLabel
        title="语速"
        meta={
          <span className="font-['Inter:Medium',sans-serif] font-medium text-[11px] tabular-nums" style={{ color: TEAL }}>
            {speed.toFixed(2).replace(/0$/, "")}x
          </span>
        }
      />
      <Card className="p-[16px]">
        <SpeedSlider value={speed} onChange={setSpeed} />
        <div className="flex gap-[8px] mt-[14px]">
          {presets.map((v) => (
            <Pill key={v} active={Math.abs(speed - v) < 0.001} onClick={() => setSpeed(v)}>
              {v.toFixed(2).replace(/0$/, "")}x
            </Pill>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TIMER
───────────────────────────────────────────── */

function StepButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center size-[30px] rounded-full transition-all duration-150 active:scale-90 disabled:opacity-35 disabled:active:scale-100"
      style={{ background: "rgba(47,99,115,0.09)", boxShadow: "inset 0 0 0 0.5px rgba(47,99,115,0.22)" }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M3 7h8" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" />
        {label === "+" && <path d="M7 3v8" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

function TimerModule() {
  const presets = [
    { k: "off", label: "不开启" },
    { k: "15", label: "15 分钟" },
    { k: "30", label: "30 分钟" },
    { k: "45", label: "45 分钟" },
    { k: "60", label: "60 分钟" },
    { k: "chapter", label: "本章结束" },
  ];
  const [sel, setSel] = useState("off");
  const [customMin, setCustomMin] = useState(25);

  const metaText =
    sel === "off" ? "未设置" : sel === "chapter" ? "本章结束" : sel === "custom" ? `${customMin} 分钟` : `${sel} 分钟`;
  const customActive = sel === "custom";

  const bump = (d: number) => {
    setCustomMin((m) => Math.min(180, Math.max(1, m + d)));
    setSel("custom");
  };

  return (
    <div>
      <SectionLabel
        title="定时停止"
        meta={
          <span className="flex items-center gap-[5px]">
            <span className="relative size-[13px]"><span className="absolute inset-0 scale-[0.65] origin-top-left"><TablerClockOutline /></span></span>
            <span className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[10px]" style={{ color: sel === "off" ? "#8a7d6f" : TEAL }}>
              {metaText}
            </span>
          </span>
        }
      />
      <Card className="p-[14px]">
        <div className="grid grid-cols-3 gap-[8px]">
          {presets.map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setSel(o.k)}
              className="h-[36px] rounded-[10px] text-[12px] leading-none whitespace-nowrap cursor-pointer transition-all duration-150 active:scale-95"
              style={{
                fontFamily: "'Noto Sans SC:Medium', sans-serif",
                background: sel === o.k ? TEAL : "rgba(180,166,151,0.14)",
                color: sel === o.k ? "#FFFCF8" : "#5b5046",
                boxShadow: sel === o.k ? "0 2px 7px rgba(47,99,115,0.28)" : "inset 0 0 0 0.5px rgba(180,166,151,0.34)",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div
          className="flex items-center justify-between mt-[12px] rounded-[10px] px-[12px] h-[48px] transition-colors duration-200"
          style={{
            background: customActive ? "rgba(47,99,115,0.08)" : "rgba(255,248,239,0.6)",
            boxShadow: customActive ? `inset 0 0 0 1.5px ${TEAL}` : "inset 0 0 0 0.5px rgba(180,166,151,0.34)",
          }}
        >
          <span className="flex flex-col">
            <span className="font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[12px] text-[#332c25]">自定义时长</span>
            <span className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[9px] text-[#8a7d6f]">1 – 180 分钟</span>
          </span>
          <div className="flex items-center gap-[10px]">
            <StepButton label="-" onClick={() => bump(-5)} disabled={customMin <= 1} />
            <span className="w-[52px] text-center">
              <span className="font-['Inter:Bold',sans-serif] font-bold text-[16px] tabular-nums" style={{ color: customActive ? TEAL : "#332c25" }}>
                {customMin}
              </span>
              <span className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[10px] text-[#8a7d6f]"> 分</span>
            </span>
            <StepButton label="+" onClick={() => bump(5)} disabled={customMin >= 180} />
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ENGINE
───────────────────────────────────────────── */

function EngineOption({
  icon,
  title,
  desc,
  active,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative text-left rounded-[10px] p-[12px] cursor-pointer transition-all duration-150 active:scale-[0.98]"
      style={{
        background: active ? "rgba(47,99,115,0.09)" : "rgba(255,248,239,0.6)",
        boxShadow: active ? `inset 0 0 0 1.5px ${TEAL}` : "inset 0 0 0 0.5px rgba(180,166,151,0.4)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="relative size-[20px]">{icon}</span>
        {active && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="8" fill={TEAL} />
            <path d="M4.8 8.2 7 10.3l4-4.6" stroke="#FFFCF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <p className="font-['Noto_Sans_SC:Bold',sans-serif] font-bold text-[12px] text-[#332c25] mt-[8px]">{title}</p>
      <p className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[10px] text-[#8a7d6f] mt-[2px]">{desc}</p>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[11px] text-[#5b5046]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-[6px] w-full h-[42px] rounded-[10px] px-[12px] bg-[rgba(255,248,239,0.8)] text-[13px] text-[#332c25] placeholder:text-[#b4a697] outline-none transition-shadow duration-150 shadow-[inset_0_0_0_0.5px_rgba(180,166,151,0.4)] focus:shadow-[inset_0_0_0_1.5px_#2f6373]"
        style={{ fontFamily: "'Noto Sans SC:Regular', sans-serif" }}
      />
    </label>
  );
}

type OnlineTts = {
  name: string;
  url: string;
  apiKey: string;
  voice: string;
  format: string;
};

function OnlineTtsModal({
  initial,
  onClose,
  onSave,
}: {
  initial: OnlineTts;
  onClose: () => void;
  onSave: (v: OnlineTts) => void;
}) {
  const [draft, setDraft] = useState<OnlineTts>(initial);
  const formats = ["mp3", "wav", "pcm"];
  const set = (k: keyof OnlineTts, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-[rgba(31,27,23,0.4)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-[364px] mx-[13px] mb-[16px] rounded-[22px] bg-[#fffaf4] overflow-hidden"
        style={{ boxShadow: "0 18px 48px rgba(31,27,23,0.28)" }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      >
        <div aria-hidden className="absolute inset-0 rounded-[22px] pointer-events-none border-[0.5px] border-[rgba(180,166,151,0.4)]" />

        {/* header */}
        <div className="flex items-center justify-between px-[18px] pt-[18px] pb-[6px]">
          <div className="flex items-center gap-[8px]">
            <span className="relative size-[20px]"><TablerCloudOutline /></span>
            <span className="font-['Noto_Sans_SC:Bold',sans-serif] font-bold text-[15px] text-[#332c25]">第三方 TTS 配置</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex items-center justify-center size-[28px] rounded-full cursor-pointer active:scale-90 transition-transform hover:bg-[rgba(180,166,151,0.16)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="#5b5046" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="px-[18px] pb-[8px] pt-[8px] flex flex-col gap-[14px] max-h-[440px] overflow-y-auto">
          <Field label="服务名称" value={draft.name} onChange={(v) => set("name", v)} placeholder="例如 Azure 语音" />
          <Field label="接口地址" value={draft.url} onChange={(v) => set("url", v)} placeholder="https://api.example.com/tts" />
          <Field label="API 密钥" value={draft.apiKey} onChange={(v) => set("apiKey", v)} placeholder="填入访问密钥" type="password" />
          <Field label="发音人 / 音色" value={draft.voice} onChange={(v) => set("voice", v)} placeholder="例如 xiaoxiao" />
          <div>
            <span className="font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[11px] text-[#5b5046]">音频格式</span>
            <div className="flex gap-[8px] mt-[8px]">
              {formats.map((f) => (
                <Pill key={f} active={draft.format === f} onClick={() => set("format", f)}>
                  {f.toUpperCase()}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex gap-[10px] px-[18px] py-[16px]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[44px] rounded-[12px] cursor-pointer active:scale-[0.98] transition-transform font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[13px] text-[#5b5046]"
            style={{ background: "rgba(180,166,151,0.16)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 h-[44px] rounded-[12px] cursor-pointer active:scale-[0.98] transition-transform font-['Noto_Sans_SC:Bold',sans-serif] font-bold text-[13px] text-[#FFFAF4]"
            style={{ background: "linear-gradient(155deg, #2f6373 0%, #244f5c 100%)", boxShadow: "0 4px 12px rgba(47,99,115,0.3)" }}
          >
            保存
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EngineModule() {
  const [engine, setEngine] = useState<"system" | "online">("system");
  const [showConfig, setShowConfig] = useState(false);
  const [online, setOnline] = useState<OnlineTts>({ name: "", url: "", apiKey: "", voice: "", format: "mp3" });
  const configured = online.name.trim() !== "" && online.url.trim() !== "";

  return (
    <div>
      <SectionLabel title="朗读引擎" />
      <Card>
        <div className="p-[14px] grid grid-cols-2 gap-[10px]">
          <EngineOption
            icon={<TablerPhoneOutline />}
            title="系统 TTS"
            desc="设备内置语音"
            active={engine === "system"}
            onClick={() => setEngine("system")}
          />
          <EngineOption
            icon={<TablerCloudOutline />}
            title="在线 TTS"
            desc={configured ? online.name : "第三方语音服务"}
            active={engine === "online"}
            onClick={() => setEngine("online")}
          />
        </div>

        {engine === "system" ? (
          <>
            <div className="h-px bg-[rgba(155,132,102,0.16)]" />
            <SelectRow label="语音引擎" value="系统默认" />
            <SelectRow label="朗读语言" value="中文（简体）" last />
          </>
        ) : (
          <>
            <div className="h-px bg-[rgba(155,132,102,0.16)]" />
            <Row
              label="服务信息"
              last
              right={
                <button
                  type="button"
                  onClick={() => setShowConfig(true)}
                  className="flex items-center gap-[6px] rounded-full pl-[11px] pr-[9px] py-[6px] cursor-pointer active:scale-95 transition-transform"
                  style={{
                    background: configured ? "rgba(47,99,115,0.1)" : TEAL,
                    boxShadow: configured ? "inset 0 0 0 0.5px rgba(47,99,115,0.3)" : "0 2px 7px rgba(47,99,115,0.28)",
                  }}
                >
                  <span
                    className="text-[11px] leading-none whitespace-nowrap"
                    style={{ fontFamily: "'Noto Sans SC:Medium', sans-serif", color: configured ? TEAL : "#FFFAF4" }}
                  >
                    {configured ? "已配置 · 编辑" : "立即配置"}
                  </span>
                  <div className="relative size-[12px] mt-[1px]"><TablerChevronRightSm /></div>
                </button>
              }
            />
          </>
        )}
      </Card>

      <AnimatePresence>
        {showConfig && (
          <OnlineTtsModal
            initial={online}
            onClose={() => setShowConfig(false)}
            onSave={(v) => {
              setOnline(v);
              setShowConfig(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PLAYBACK CONFIG
───────────────────────────────────────────── */

const VOICES = [
  { id: "clear-f", name: "清晰女声", desc: "标准 · 温润干净", tag: "女", bg: "rgba(47,99,115,0.13)", fg: "#2f6373" },
  { id: "gentle-f", name: "温柔女声", desc: "柔和 · 舒缓治愈", tag: "女", bg: "rgba(168,90,104,0.16)", fg: "#a85a68" },
  { id: "magnetic-m", name: "磁性男声", desc: "低沉 · 富有磁性", tag: "男", bg: "rgba(31,53,40,0.14)", fg: "#1f3528" },
  { id: "standard-m", name: "标准男声", desc: "沉稳 · 端正大气", tag: "男", bg: "rgba(63,96,112,0.15)", fg: "#3f6070" },
  { id: "lively-child", name: "活泼童声", desc: "明亮 · 天真俏皮", tag: "童", bg: "rgba(168,118,58,0.16)", fg: "#a8763a" },
  { id: "news", name: "新闻播报", desc: "专业 · 字正腔圆", tag: "播", bg: "rgba(107,95,82,0.16)", fg: "#6b5f52" },
];

type Voice = (typeof VOICES)[number];

function VoiceAvatar({ voice, size }: { voice: Voice; size: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, background: voice.bg }}
    >
      <span
        className="leading-none"
        style={{ fontFamily: "'Noto Sans SC:Bold', sans-serif", fontWeight: 700, fontSize: size * 0.42, color: voice.fg }}
      >
        {voice.tag}
      </span>
    </span>
  );
}

function PreviewWave({ color }: { color: string }) {
  return (
    <span className="flex items-end gap-[1.5px] h-[10px]">
      {[6, 10, 4, 8].map((h, i) => (
        <span
          key={i}
          className="w-[1.5px] rounded-full"
          style={{ height: h, background: color, transformOrigin: "bottom", animation: `wb ${0.5 + i * 0.1}s ease-in-out ${i * 0.05}s infinite alternate` }}
        />
      ))}
    </span>
  );
}

function VoiceSelect() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(VOICES[0].id);
  const [preview, setPreview] = useState<string | null>(null);
  const current = VOICES.find((v) => v.id === sel) ?? VOICES[0];

  return (
    <div className="relative z-10">
      {/* trigger row — value is a tappable voice chip */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full h-[52px] px-[14px]"
        style={{ boxShadow: open ? undefined : "inset 0 -0.5px 0 rgba(155,132,102,0.18)" }}
      >
        <span className="font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[12px] text-[#332c25]">音色</span>
        <span
          className="flex items-center gap-[7px] rounded-full pl-[4px] pr-[8px] py-[3px] transition-colors duration-200"
          style={{
            background: open ? "rgba(47,99,115,0.1)" : "rgba(180,166,151,0.14)",
            boxShadow: open ? "inset 0 0 0 0.5px rgba(47,99,115,0.3)" : "inset 0 0 0 0.5px rgba(180,166,151,0.34)",
          }}
        >
          <VoiceAvatar voice={current} size={24} />
          <span
            className="text-[12px] whitespace-nowrap"
            style={{ fontFamily: "'Noto Sans SC:Medium', sans-serif", color: open ? TEAL : "#332c25" }}
          >
            {current.name}
          </span>
          <div className="relative size-[12px] mt-[1px] transition-transform duration-200" style={{ transform: open ? "rotate(90deg)" : "none" }}>
            <TablerChevronRightSm />
          </div>
        </span>
      </button>

      <AnimatePresence onExitComplete={() => setPreview(null)}>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              className="absolute left-[8px] right-[8px] top-[54px] z-20 rounded-[14px] bg-[#fffaf4] overflow-hidden"
              style={{ boxShadow: "0 14px 36px rgba(31,27,23,0.22)" }}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <div aria-hidden className="absolute inset-0 rounded-[14px] pointer-events-none border-[0.5px] border-[rgba(180,166,151,0.4)]" />
              {VOICES.map((v, i) => {
                const active = v.id === sel;
                const playing = preview === v.id;
                return (
                  <div
                    key={v.id}
                    className="relative flex items-center gap-[10px] pl-[12px] pr-[10px] h-[54px]"
                    style={{
                      background: active ? "rgba(47,99,115,0.07)" : "transparent",
                      boxShadow: i === VOICES.length - 1 ? undefined : "inset 0 -0.5px 0 rgba(155,132,102,0.16)",
                    }}
                  >
                    {/* select area */}
                    <button
                      type="button"
                      onClick={() => {
                        setSel(v.id);
                        setOpen(false);
                      }}
                      className="flex items-center gap-[10px] flex-1 min-w-0 h-full text-left active:scale-[0.99] transition-transform"
                    >
                      <VoiceAvatar voice={v} size={34} />
                      <span className="flex flex-col min-w-0">
                        <span
                          className="text-[13px] leading-[17px] truncate"
                          style={{ fontFamily: active ? "'Noto Sans SC:Bold', sans-serif" : "'Noto Sans SC:Medium', sans-serif", fontWeight: active ? 700 : 500, color: active ? TEAL : "#332c25" }}
                        >
                          {v.name}
                        </span>
                        <span className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[10px] text-[#8a7d6f] leading-[14px] truncate">{v.desc}</span>
                      </span>
                    </button>

                    {/* 试听 */}
                    <button
                      type="button"
                      onClick={() => setPreview((p) => (p === v.id ? null : v.id))}
                      aria-label={playing ? "停止试听" : "试听"}
                      className="flex items-center gap-[5px] rounded-full pl-[8px] pr-[9px] h-[26px] shrink-0 cursor-pointer active:scale-95 transition-transform"
                      style={{ background: playing ? v.fg : v.bg }}
                    >
                      {playing ? (
                        <PreviewWave color="#fffaf4" />
                      ) : (
                        <svg width="9" height="9" viewBox="0 0 9 9">
                          <path d="M2 1.2 7.2 4.5 2 7.8V1.2Z" fill={v.fg} />
                        </svg>
                      )}
                      <span className="text-[10px] leading-none" style={{ fontFamily: "'Noto Sans SC:Medium', sans-serif", color: playing ? "#fffaf4" : v.fg }}>
                        {playing ? "试听中" : "试听"}
                      </span>
                    </button>

                    {/* selected check */}
                    <span className="w-[16px] shrink-0 flex justify-center">
                      {active && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3.5 8.3 6.5 11l6-7" stroke={TEAL} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfigModule() {
  const [follow, setFollow] = useState(true);
  const [callPause, setCallPause] = useState(true);
  const [background, setBackground] = useState(true);
  const [keepAwake, setKeepAwake] = useState(false);
  return (
    <div>
      <SectionLabel
        title="播放配置"
        meta={<span className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[10px] text-[#8a7d6f]">即时生效</span>}
      />
      <Card>
        <VoiceSelect />
        <ToggleRow label="跟随高亮" value={follow} onChange={setFollow} />
        <ToggleRow label="来电自动暂停" value={callPause} onChange={setCallPause} />
        <ToggleRow label="后台播放" value={background} onChange={setBackground} />
        <ToggleRow label="朗读时屏幕常亮" value={keepAwake} onChange={setKeepAwake} last />
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TTS CONTENT VIEWPORT  (scroll region — outline preserved)
───────────────────────────────────────────── */

function ContentViewportTts() {
  return (
    <motion.div className="absolute h-[666px] left-[26px] overflow-x-clip overflow-y-auto top-[146px] w-[338px]">
      <div className="flex flex-col gap-[20px] px-[13px] py-[16px]">
        <PlaybackModule />
        <SpeedModule />
        <TimerModule />
        <EngineModule />
        <ConfigModule />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   COLLAPSED QUICK CONTROL BAR
   The imported ReaderModuleTtsPhone design is rendered
   faithfully and left untouched. ONLY the top-left
   "Section - 播放控制" (播放 + transport) is redrawn —
   overlaid in place at its exact footprint (264×66 at
   35,535). Everything else (定时 / 语速 / 亮度 / 导航)
   stays exactly as designed.
───────────────────────────────────────────── */

function HeadphonesTeal() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d={svgPaths.pfe9ec80} stroke={TEAL} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
      <path d={svgPaths.p3686100} stroke={TEAL} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
      <path d={svgPaths.p99b6600} stroke={TEAL} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
    </svg>
  );
}

/* 定时 / 语速 label chip: teal-tint icon tile + bold label */
function ReadRowLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-[8px] shrink-0">
      <span
        className="flex items-center justify-center size-[26px] rounded-[8px]"
        style={{ background: "rgba(47,99,115,0.1)", boxShadow: "inset 0 0 0 0.5px rgba(47,99,115,0.2)" }}
      >
        {icon}
      </span>
      <span className="font-['Noto_Sans_SC:Bold',sans-serif] font-bold text-[12px] text-[#332c25]">{label}</span>
    </span>
  );
}

/* The redraw target: the whole 朗读 card = 播放 + 定时 + 语速.
   Overlaid in place over the imported "Section - 朗读"
   (286×190 at 24,522). The imported 亮度 rail / 导航 /
   outer container are left untouched. */
function ReadControlCardRestyled() {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1.0);
  const timerOpts = ["不开启", "15 分钟", "30 分钟", "60 分钟", "本章结束"];
  const [timerIdx, setTimerIdx] = useState(1);

  return (
    <div
      className="absolute left-[24px] top-[522px] w-[286px] h-[190px] rounded-[8px] overflow-hidden"
      style={{ background: "linear-gradient(155deg, #fffaf4 0%, #f6ecdd 100%)" }}
    >
      <div aria-hidden className="absolute inset-0 rounded-[8px] pointer-events-none border-[0.5px] border-[rgba(180,166,151,0.4)]" />
      <div aria-hidden className="absolute inset-0 rounded-[8px] pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" />

      <div className="relative h-full px-[11px] py-[13px] flex flex-col gap-[8px]">
        {/* 播放 */}
        <div
          className="relative h-[66px] rounded-[9px] overflow-hidden shrink-0"
          style={{ background: "rgba(255,252,248,0.72)", boxShadow: "inset 0 0 0 0.5px rgba(180,166,151,0.34)" }}
        >
          <div aria-hidden className="absolute left-0 top-[12px] bottom-[12px] w-[3px] rounded-full" style={{ background: playing ? TEAL : "#c6bfb2" }} />
          <div className="relative flex items-center justify-between h-full pl-[13px] pr-[10px]">
            <span className="flex items-center gap-[9px] min-w-0">
              <span
                className="flex items-center justify-center size-[34px] rounded-[10px] shrink-0"
                style={{ background: "rgba(47,99,115,0.11)", boxShadow: "inset 0 0 0 0.5px rgba(47,99,115,0.22)" }}
              >
                <HeadphonesTeal />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-['Noto_Sans_SC:Bold',sans-serif] font-bold text-[13px] leading-[16px] text-[#332c25]">播放</span>
                <span className="flex items-center gap-[4px]">
                  <span className="size-[5px] rounded-full transition-colors duration-300" style={{ background: playing ? TEAL : "#b4a697" }} />
                  <span className="text-[10px] leading-[13px] whitespace-nowrap transition-colors duration-300" style={{ fontFamily: "'Noto Sans SC:Regular', sans-serif", color: playing ? TEAL : "#8a7d6f" }}>
                    {playing ? "朗读中" : "已暂停"}
                  </span>
                </span>
              </span>
            </span>

            <div className="flex items-center gap-[3px] shrink-0">
              <button type="button" aria-label="上一句" className="flex items-center justify-center size-[28px] rounded-full cursor-pointer active:scale-90 transition-transform hover:bg-[rgba(47,99,115,0.07)]">
                <svg width="17" height="17" viewBox="0 0 26 26" fill="none">
                  <path d="M15.5 7 9.5 13l6 6" stroke="#4d463f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 8v10" stroke="#4d463f" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "暂停" : "播放"}
                className="flex items-center justify-center size-[36px] rounded-full cursor-pointer active:scale-95 transition-transform"
                style={{ background: "linear-gradient(155deg, #357487 0%, #244f5c 100%)", boxShadow: "0 4px 11px rgba(47,99,115,0.36), inset 0 1px 1px rgba(255,255,255,0.2)" }}
              >
                {playing ? (
                  <svg width="13" height="13" fill="none" viewBox="0 0 20 20">
                    <rect x="5.6" y="4" width="2.6" height="12" rx="1.3" fill="#FFFAF4" />
                    <rect x="11.8" y="4" width="2.6" height="12" rx="1.3" fill="#FFFAF4" />
                  </svg>
                ) : (
                  <svg width="14" height="14" fill="none" viewBox="0 0 22 22">
                    <path d="M7.5 5 16.5 11l-9 6V5Z" fill="#FFFAF4" stroke="#FFFAF4" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPlaying(false)}
                aria-label="停止"
                className="flex items-center justify-center size-[28px] rounded-full cursor-pointer active:scale-90 transition-transform"
                style={{ background: "rgba(168,84,58,0.11)", boxShadow: "inset 0 0 0 0.5px rgba(168,84,58,0.36)" }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="2.2" fill={CLAY} /></svg>
              </button>
              <button type="button" aria-label="下一句" className="flex items-center justify-center size-[28px] rounded-full cursor-pointer active:scale-90 transition-transform hover:bg-[rgba(47,99,115,0.07)]">
                <svg width="17" height="17" viewBox="0 0 26 26" fill="none">
                  <path d="M10.5 7l6 6-6 6" stroke="#4d463f" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 8v10" stroke="#4d463f" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 定时 */}
        <div
          className="flex items-center justify-between h-[42px] rounded-[9px] px-[11px] shrink-0"
          style={{ background: "rgba(255,252,248,0.72)", boxShadow: "inset 0 0 0 0.5px rgba(180,166,151,0.34)" }}
        >
          <ReadRowLabel
            label="定时"
            icon={
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d={svgPaths.p2643e980} stroke={TEAL} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
                <path d="M10 5.83333V10L12.5 12.5" stroke={TEAL} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
              </svg>
            }
          />
          <button
            type="button"
            onClick={() => setTimerIdx((i) => (i + 1) % timerOpts.length)}
            className="flex items-center gap-[6px] rounded-full pl-[12px] pr-[8px] h-[30px] cursor-pointer active:scale-95 transition-transform"
            style={{
              background: timerIdx === 0 ? "rgba(180,166,151,0.14)" : "rgba(47,99,115,0.1)",
              boxShadow: timerIdx === 0 ? "inset 0 0 0 0.5px rgba(180,166,151,0.34)" : "inset 0 0 0 0.5px rgba(47,99,115,0.3)",
            }}
          >
            <span className="text-[12px] leading-none whitespace-nowrap" style={{ fontFamily: "'Noto Sans SC:Medium', sans-serif", color: timerIdx === 0 ? "#5b5046" : TEAL }}>
              {timerOpts[timerIdx]}
            </span>
            <div className="relative size-[12px] rotate-90 mt-[1px]"><TablerChevronRightSm /></div>
          </button>
        </div>

        {/* 语速 */}
        <div
          className="flex items-center justify-between gap-[10px] h-[42px] rounded-[9px] px-[11px] shrink-0"
          style={{ background: "rgba(255,252,248,0.72)", boxShadow: "inset 0 0 0 0.5px rgba(180,166,151,0.34)" }}
        >
          <ReadRowLabel
            label="语速"
            icon={
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d={svgPaths.p1eeb9f00} stroke={TEAL} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
              </svg>
            }
          />
          <div className="flex items-center gap-[10px] flex-1 min-w-0">
            <div className="flex-1 min-w-0"><SpeedSlider value={speed} onChange={setSpeed} hideLabels /></div>
            <span className="w-[34px] text-right font-['Inter:Medium',sans-serif] font-medium text-[12px] tabular-nums shrink-0" style={{ color: TEAL }}>
              {speed.toFixed(2).replace(/0$/, "")}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollapsedQuickBar({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="absolute inset-0">
      {/* imported quick bar — rendered faithfully; only the 朗读 card is redrawn */}
      <ReaderModuleTtsPhone />
      {/* redraw: the whole 播放 / 定时 / 语速 card, overlaid in place */}
      <ReadControlCardRestyled />
      {/* tap the grabber strip to expand the full control page */}
      <button type="button" aria-label="展开完整控制页" onClick={onExpand} className="absolute left-[12px] top-[494px] w-[364px] h-[24px] cursor-pointer" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   TTS SHEET
───────────────────────────────────────────── */

function TtsSheet({ onCollapse }: { onCollapse: () => void }) {
  return (
    <motion.div className="absolute h-[844px] left-0 top-0 w-[390px]">
      <div className="absolute bg-[rgba(255,250,244,0.98)] h-[736px] left-[13px] rounded-[24px] top-[89px] w-[364px]">
        <div className="overflow-clip relative rounded-[inherit] size-full">
          <Grabber />
        </div>
        <div aria-hidden className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]" />
      </div>
      <div className="absolute bg-[rgba(255,252,248,0.62)] h-[666px] left-[26px] rounded-[12px] top-[146px] w-[338px]">
        <div aria-hidden className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      </div>
      <ContentViewportTts />
      {/* Full header */}
      <motion.div className="absolute h-[30px] left-[26px] top-[108px] w-[338px]">
        {/* Leading */}
        <div className="absolute h-[30px] left-0 top-0 w-[288px]">
          <div className="absolute left-0 size-[16px] top-[7px]"><TablerHeadphonesLg /></div>
          <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[20px] left-[24px] text-[#332c25] text-[14px] top-[5px] whitespace-nowrap">朗读</p>
        </div>
        {/* Collapse button */}
        <button
          type="button"
          onClick={onCollapse}
          className="absolute flex items-center gap-[4px] bg-[rgba(238,230,219,0.7)] h-[26px] left-[290px] rounded-[8px] top-[2px] px-[9px] cursor-pointer active:scale-95 transition-transform"
        >
          <span className="font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-none text-[#2f6373] text-[10px] whitespace-nowrap">收起</span>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 4.5 6 7.5l3-3" stroke={TEAL} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   MODULE NAV (bottom bar, opacity-0 = hidden)
───────────────────────────────────────────── */

function ReaderModuleButton({ left, module = "Directory", active = false }: { left: number; module?: string; active?: boolean }) {
  const labels: Record<string, string> = { Directory: "目录", TTS: "朗读", Appearance: "界面", Settings: "设置" };
  return (
    <div className="absolute h-[61.988px] rounded-[12px] top-[8.55px] w-[77.951px]" style={{ left }}>
      <div className={`absolute left-[17.98px] overflow-clip rounded-[999px] size-[41.997px] top-0 ${active ? "bg-[#2f6373]" : "bg-[rgba(47,99,115,0.08)]"}`}>
        {module === "TTS" && active && (
          <div className="absolute left-[9px] size-[23.993px] top-[9px]"><TablerHeadphonesFilled /></div>
        )}
      </div>
      <p className={`-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Black',sans-serif] font-black leading-[13.889px] left-[38.98px] text-[10px] text-center top-[47.04px] w-[20px] ${active ? "text-[#2f6373]" : "text-[#4d463f]"}`}>
        {labels[module] ?? "目录"}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FULL SCREEN
───────────────────────────────────────────── */

export default function PhoneScreen() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <style>{`
        @keyframes wb {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.15); }
        }
      `}</style>
      <div className="overflow-clip relative rounded-[24px] size-full">
        {/* Reading surface */}
        <div className="absolute h-[844px] left-0 overflow-clip rounded-[34px] top-0 w-[390px]">
          <PaperLayer />
        </div>
        {/* Top bar */}
        <TopBar />
        {/* TTS sheet — full panel or collapsed quick control bar */}
        {collapsed ? (
          <CollapsedQuickBar onExpand={() => setCollapsed(false)} />
        ) : (
          <TtsSheet onCollapse={() => setCollapsed(true)} />
        )}
        {/* Module nav (hidden) */}
        <div className="absolute bg-[rgba(255,252,248,0.98)] h-[79.03px] left-[25px] opacity-0 rounded-[12px] top-[732px] w-[340.951px]">
          <div className="cursor-pointer overflow-x-auto overflow-y-clip relative rounded-[inherit] size-full">
            <ReaderModuleButton left={8.55} module="Directory" />
            <ReaderModuleButton left={90.49} module="TTS" active />
            <ReaderModuleButton left={172.45} module="Appearance" />
            <ReaderModuleButton left={254.39} module="Settings" />
          </div>
          <div aria-hidden className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[12px]" />
        </div>
      </div>
    </>
  );
}
