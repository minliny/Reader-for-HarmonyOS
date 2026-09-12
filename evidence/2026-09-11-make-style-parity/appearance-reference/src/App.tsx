import { useState } from "react"
import svgPaths from "../imports/svg-a52rtn1jk6"
const imgPaperLayer = ""

function TypographyChevron() {
  return (
    <svg
      className="block shrink-0"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M4.5 3L7.5 6L4.5 9"
        stroke="#857C70"
        strokeWidth="0.875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TypographySelectRow({
  label,
  options,
  defaultValue,
}: {
  label: string
  options: string[]
  defaultValue: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="relative flex h-[42px] items-center justify-between pl-[13px] pr-[9px]">
      <p className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[normal] text-[#332c25] text-[12px] whitespace-nowrap">
        {label}
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-[6px] h-[30px] pl-[11px] pr-[9px] rounded-[999px] transition-colors ${
            open
              ? "bg-[rgba(47,99,115,0.11)]"
              : "bg-[rgba(180,166,151,0.12)] hover:bg-[rgba(180,166,151,0.2)]"
          }`}
        >
          <span className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[15px] text-[#332c25] text-[11px] whitespace-nowrap">
            {value}
          </span>
          <span
            className={`flex transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          >
            <TypographyChevron />
          </span>
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-[40] cursor-default"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div
              className="absolute right-0 top-[calc(100%+5px)] z-[50] min-w-[104px] overflow-hidden rounded-[9px] border border-[rgba(155,132,102,0.28)] bg-[#fffdf8] p-[3px] shadow-[0_8px_20px_-6px_rgba(75,58,38,0.28)]"
              data-name="Typography/Select/Menu"
            >
              {options.map((option) => {
                const selected = option === value
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setValue(option)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-[10px] rounded-[6px] px-[9px] py-[6px] text-left transition-colors ${
                      selected
                        ? "bg-[rgba(238,230,219,0.72)]"
                        : "hover:bg-[rgba(238,230,219,0.44)]"
                    }`}
                  >
                    <span
                      className={`leading-[normal] text-[11px] whitespace-nowrap ${
                        selected
                          ? "font-['Noto_Sans_SC:Bold',sans-serif] font-bold text-[#2f6373]"
                          : "font-['Noto_Sans_SC:Regular',sans-serif] font-normal text-[#41484c]"
                      }`}
                    >
                      {option}
                    </span>
                    {selected && (
                      <svg
                        className="block shrink-0"
                        width="11"
                        height="9"
                        viewBox="0 0 11 9"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M1.25 4.75L4 7.5L9.75 1.25"
                          stroke="#2f6373"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TypographyStepperRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex h-[42px] items-center justify-between pl-[13px] pr-[9px]">
      <p className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[normal] text-[#332c25] text-[12px] whitespace-nowrap">
        {label}
      </p>
      <div className="flex items-center h-[27px] rounded-[8px] bg-[#fffdf8] border border-[rgba(155,132,102,0.28)] overflow-hidden">
        <button
          type="button"
          className="flex items-center justify-center w-[26px] h-full text-[#5b5046] transition-colors hover:bg-[rgba(238,230,219,0.55)] hover:text-[#2f6373]"
          data-name="Decrease"
          aria-label={`减小${label}`}
        >
          <span className="font-['Noto_Sans_SC:Regular',sans-serif] text-[15px] leading-none select-none">
            −
          </span>
        </button>
        <span className="w-[44px] text-center font-['Noto_Sans_SC:Medium',sans-serif] font-medium text-[#332c25] text-[11px] leading-[25px] border-x border-[rgba(155,132,102,0.2)] whitespace-nowrap">
          {value}
        </span>
        <button
          type="button"
          className="flex items-center justify-center w-[26px] h-full text-[#5b5046] transition-colors hover:bg-[rgba(238,230,219,0.55)] hover:text-[#2f6373]"
          data-name="Increase"
          aria-label={`增大${label}`}
        >
          <span className="font-['Noto_Sans_SC:Regular',sans-serif] text-[15px] leading-none select-none">
            +
          </span>
        </button>
      </div>
    </div>
  )
}
type ReaderResponsiveTopBarProps = {
  className?: string
  bookTitle?: string
  sourceLabel?: string
  sourceLine?: string
  viewport?: "Phone"
}

function ReaderResponsiveTopBar({
  className,
  bookTitle = "长夜余火",
  sourceLabel = "换源",
  sourceLine = "第 32 章 雨夜 · 优书网",
  viewport = "Phone",
}: ReaderResponsiveTopBarProps) {
  return (
    <div
      className={
        className ||
        "bg-[rgba(255,250,244,0.98)] h-[53.993px] relative rounded-[24px] w-[360px]"
      }
    >
      <div
        aria-hidden
        className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]"
      />
      <div
        className="absolute h-[42px] left-[13px] top-[6px] w-[44px]"
        data-name="TopBar/BackHitArea"
      >
        <div
          className="absolute left-[10px] size-[23.993px] top-[9px]"
          data-name="Icon/Back"
        >
          <div
            className="absolute left-0 size-[23.993px] top-0"
            data-name="Tabler/arrow-left/outline"
          >
            <svg
              className="absolute block inset-0 size-full"
              fill="none"
              height="23.9931"
              preserveAspectRatio="none"
              viewBox="0 0 23.9931 23.9931"
              width="23.9931"
            >
              <g clipPath="url(#clip0_0_660)" id="Tabler/arrow-left/outline">
                <g id="Vector" />
                <path
                  d="M4.99856 11.9965H18.9945"
                  id="Vector_2"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7495"
                />
                <path
                  d={svgPaths.pc774e00}
                  id="Vector_3"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7495"
                />
                <path
                  d={svgPaths.pf712d00}
                  id="Vector_4"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7495"
                />
              </g>
              <defs>
                <clipPath id="clip0_0_660">
                  <rect fill="white" height="23.9931" width="23.9931" />
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>
      </div>
      <div
        className="[word-break:break-word] absolute h-[45px] leading-[normal] left-[65px] overflow-clip top-[4.5px] w-[170px] whitespace-nowrap"
        data-name="TopBar/Text"
      >
        <p className="absolute font-['Noto_Serif_SC:Bold',sans-serif] font-bold left-0 text-[#332c25] text-[16px] top-0">
          {bookTitle}
        </p>
        <p className="absolute font-['Noto_Serif_SC:Regular',sans-serif] font-normal left-0 text-[#5b5046] text-[12px] top-[28px]">
          {sourceLine}
        </p>
      </div>
      <div
        className="absolute h-[42px] left-[243px] top-[6px] w-[62px]"
        data-name="TopBar/SourceSwitchHitArea"
      >
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] left-[19px] text-[#332c25] text-[12px] top-[25px] w-[24px]">
          {sourceLabel}
        </p>
        <div
          className="absolute left-[21px] size-[20px] top-[1.25px]"
          data-name="Icon/SourceSwitch"
        >
          <div
            className="absolute left-0 size-[20px] top-0"
            data-name="Tabler/switch-horizontal/outline"
          >
            <svg
              className="absolute block inset-0 size-full"
              fill="none"
              height="20"
              preserveAspectRatio="none"
              viewBox="0 0 20 20"
              width="20"
            >
              <g
                clipPath="url(#clip0_0_676)"
                id="Tabler/switch-horizontal/outline"
              >
                <g id="Vector" />
                <path
                  d={svgPaths.p35177c00}
                  id="Vector_2"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.45833"
                />
                <path
                  d="M8.33333 5.83333H16.6667"
                  id="Vector_3"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.45833"
                />
                <path
                  d={svgPaths.pd8c5e80}
                  id="Vector_4"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.45833"
                />
                <path
                  d="M3.33333 14.1667H10.8333"
                  id="Vector_5"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.45833"
                />
              </g>
              <defs>
                <clipPath id="clip0_0_676">
                  <rect fill="white" height="20" width="20" />
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>
      </div>
      <div
        className="absolute h-[42px] left-[313px] top-[6px] w-[34px]"
        data-name="TopBar/MoreHitArea"
      >
        <div
          className="absolute left-[7px] size-[20px] top-[11px]"
          data-name="Icon/More"
        >
          <div
            className="absolute left-0 size-[20px] top-0"
            data-name="Tabler/dots/outline"
          >
            <svg
              className="absolute block inset-0 size-full"
              fill="none"
              height="20"
              preserveAspectRatio="none"
              viewBox="0 0 20 20"
              width="20"
            >
              <g clipPath="url(#clip0_0_655)" id="Tabler/dots/outline">
                <g id="Vector" />
                <path
                  d={svgPaths.p14290600}
                  id="Vector_2"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.45833"
                />
                <path
                  d={svgPaths.p3d191400}
                  id="Vector_3"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.45833"
                />
                <path
                  d={svgPaths.pb0d3180}
                  id="Vector_4"
                  stroke="#1F1B17"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.45833"
                />
              </g>
              <defs>
                <clipPath id="clip0_0_655">
                  <rect fill="white" height="20" width="20" />
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
type ReaderResponsiveReadingSurfaceProps = {
  className?: string
  viewport?: "Phone"
}

function ReaderResponsiveReadingSurface({
  className,
  viewport = "Phone",
}: ReaderResponsiveReadingSurfaceProps) {
  return (
    <div
      className={
        className || "h-[844px] overflow-clip relative rounded-[34px] w-[390px]"
      }
    >
      <div
        className="absolute bg-size-[200px_200px,auto_auto,auto_auto,auto_auto] bg-top-left inset-[0.56px] overflow-clip"
        style={{
          backgroundImage: `url("${imgPaperLayer}"), linear-gradient(180deg, rgb(251, 244, 233) 0%, rgb(239, 226, 208) 100%), url("data:image/svg+xml;utf8,<svg viewBox='0 0 388.89 842.88' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(0 -71.799 -71.799 0 194.44 151.72)'><stop stop-color='rgba(255,255,255,0.7)' offset='0'/><stop stop-color='rgba(191,191,191,0.525)' offset='0.105'/><stop stop-color='rgba(128,128,128,0.35)' offset='0.21'/><stop stop-color='rgba(64,64,64,0.175)' offset='0.315'/><stop stop-color='rgba(0,0,0,0)' offset='0.42'/></radialGradient></defs></svg>"), url("data:image/svg+xml;utf8,<svg viewBox='0 0 388.89 842.88' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(0 -59.601 -27.499 0 194.44 421.44)'><stop stop-color='rgba(0,0,0,0)' offset='0.56'/><stop stop-color='rgba(89,70,50,0.1)' offset='1'/></radialGradient></defs></svg>")`,
        }}
        data-name="PaperLayer"
      >
        <div
          className="absolute inset-[72px_32px_47.99px_32px] overflow-clip"
          data-name="ReadingContent"
        >
          <div
            className="absolute left-0 right-0 top-0"
            data-name="ChapterPage / Phone / Page 1"
          >
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[18px] items-start relative size-full text-[#2b241d]">
              <p className="font-['Noto_Serif_SC:Bold',sans-serif] font-bold leading-[28.75px] relative shrink-0 text-[23px] text-center w-full">
                雨夜
              </p>
              <div className="font-['Noto_Serif_SC:Regular',sans-serif] font-normal leading-[0] relative shrink-0 text-[18px] w-full">
                <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">
                  雨声在窗外连成一片，像无数细小的针，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。
                </p>
                <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">
                  他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个迟到许久的答案终于抵达。
                </p>
                <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">
                  这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下短暂而摇晃的光。
                </p>
                <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">
                  他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。
                </p>
                <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">
                  可真正看到信上那行字时，他才发现那些被压下去的情绪并没有消失，只是一直在暗处积蓄，等着这一刻重新涌上来。
                </p>
                <p className="indent-[36px] leading-[35.28px]">
                  远处的灯光像被雾气揉碎，
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Grabber() {
  return (
    <div
      className="-translate-x-1/2 absolute bg-[#b9ad9f] h-[4px] left-1/2 rounded-[999px] top-[9.55px] w-[42px]"
      data-name="Grabber"
    />
  )
}

function AddedActorThemeCardShellDay() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] blur-[0px] h-[58.8px] left-[2px] rounded-[8px] top-[32.39px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/Day"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[36.75px] text-[#5b5046] text-[9px] text-center top-[39px] w-[63.5px]">
        日间
      </p>
    </div>
  )
}

function AddedActorThemeCardShellWarm() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] blur-[0px] h-[58.8px] left-[81.5px] rounded-[8px] top-[32.39px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/Warm"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[36.75px] text-[#5b5046] text-[9px] text-center top-[39px] w-[63.5px]">
        暖白
      </p>
    </div>
  )
}

function AddedActorThemeCardShellNight() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] blur-[0px] h-[58.8px] left-[161px] rounded-[8px] top-[32.39px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/Night"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[36.75px] text-[#5b5046] text-[9px] text-center top-[39px] w-[63.5px]">
        夜间
      </p>
    </div>
  )
}

function AddedActorThemeCardShellWarmNight() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] blur-[0px] h-[58.8px] left-[240.5px] rounded-[8px] top-[32.39px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/WarmNight"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[36.75px] text-[#5b5046] text-[9px] text-center top-[39px] w-[63.5px]">
        暖夜
      </p>
    </div>
  )
}

function AddedActorThemeCardShellPaper() {
  return (
    <div
      className="absolute bg-[rgba(47,99,115,0.1)] blur-[0px] border border-[#2f6373] border-solid h-[58.8px] left-[2px] rounded-[8px] top-[97.19px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/Paper"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[35.75px] text-[#5b5046] text-[9px] text-center top-[38px] w-[63.5px]">
        纸纹
      </p>
    </div>
  )
}

function AddedActorThemeCardShellGreen() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] blur-[0px] h-[58.8px] left-[81.5px] rounded-[8px] top-[97.19px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/Green"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[36.75px] text-[#5b5046] text-[9px] text-center top-[39px] w-[63.5px]">
        青叶纹
      </p>
    </div>
  )
}

function AddedActorThemeCardShellPaperNight() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] blur-[0px] h-[58.8px] left-[161px] rounded-[8px] top-[97.19px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/PaperNight"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[36.75px] text-[#5b5046] text-[9px] text-center top-[39px] w-[63.5px]">
        靛夜
      </p>
    </div>
  )
}

function AddedActorThemeCardShellGreenNight() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] blur-[0px] h-[58.8px] left-[240.5px] rounded-[8px] top-[97.19px] w-[73.5px]"
      data-name="AddedActor/ThemeCardShell/GreenNight"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[36.75px] text-[#5b5046] text-[9px] text-center top-[39px] w-[63.5px]">
        林夜纹
      </p>
    </div>
  )
}

function ThemeAction() {
  return (
    <div
      className="absolute blur-[0px] border border-[rgba(155,132,102,0.18)] border-solid h-[28px] left-[160px] overflow-clip rounded-[6px] top-[172px] w-[74px]"
      data-name="ThemeAction"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[13px] left-[36px] text-[#332c25] text-[9px] text-center top-[7px] w-[66px]">
        设为日间主题
      </p>
    </div>
  )
}

function ThemeAction1() {
  return (
    <div
      className="absolute blur-[0px] border border-[rgba(155,132,102,0.18)] border-solid h-[28px] left-[240px] overflow-clip rounded-[6px] top-[172px] w-[74px]"
      data-name="ThemeAction"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[13px] left-[36px] text-[#332c25] text-[9px] text-center top-[7px] w-[66px]">
        设为夜间主题
      </p>
    </div>
  )
}

function SwatchDay() {
  return (
    <div
      className="absolute bg-[#fcf8f0] border-[0.5px] border-[rgba(180,166,151,0.3)] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/Day"
    />
  )
}

function SwatchWarm() {
  return (
    <div
      className="absolute bg-[#f4e3bf] border-[0.5px] border-[rgba(180,166,151,0.3)] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/Warm"
    />
  )
}

function SwatchNight() {
  return (
    <div
      className="absolute bg-[#2b2823] border-[0.5px] border-[rgba(180,166,151,0.3)] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/Night"
    />
  )
}

function SwatchWarmNight() {
  return (
    <div
      className="absolute bg-[#413020] border-[0.5px] border-[rgba(180,166,151,0.3)] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/WarmNight"
    />
  )
}

function SwatchPaper() {
  return (
    <div
      className="absolute bg-[#ebdabb] border-2 border-[#2f6373] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/Paper"
    />
  )
}

function SwatchGreen() {
  return (
    <div
      className="absolute bg-[#d7e8cf] border-[0.5px] border-[rgba(180,166,151,0.3)] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/Green"
    />
  )
}

function SwatchPaperNight() {
  return (
    <div
      className="absolute bg-[#26313f] border-[0.5px] border-[rgba(180,166,151,0.3)] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/PaperNight"
    />
  )
}

function SwatchGreenNight() {
  return (
    <div
      className="absolute bg-[#24382c] border-[0.5px] border-[rgba(180,166,151,0.3)] border-solid h-[18px] left-[8.25px] rounded-[6px] top-[2px] w-[46px]"
      data-name="Swatch/GreenNight"
    />
  )
}

function PersistentModuleAppearanceThemeLibrary() {
  return (
    <div
      className="absolute h-[210px] left-[11px] top-[11px] w-[316px]"
      data-name="PersistentModule/Appearance/ThemeLibrary"
    >
      <div
        className="[word-break:break-word] absolute blur-[0px] h-[20px] left-[2px] top-[10px] w-[312px]"
        data-name="Reader/Full/Appearance/SectionHeader"
      >
        <p className="absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-px w-[180px]">
          主题库
        </p>
        <p className="-translate-x-full absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[312px] text-[#5b5046] text-[9px] text-right top-[3px] w-[140px]">
          日间：纸纹 · 夜间：靛夜
        </p>
      </div>
      <AddedActorThemeCardShellDay />
      <AddedActorThemeCardShellWarm />
      <AddedActorThemeCardShellNight />
      <AddedActorThemeCardShellWarmNight />
      <AddedActorThemeCardShellPaper />
      <AddedActorThemeCardShellGreen />
      <AddedActorThemeCardShellPaperNight />
      <AddedActorThemeCardShellGreenNight />
      <ThemeAction />
      <ThemeAction1 />
      <div
        className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[209px] w-[316px]"
        data-name="Rectangle"
      />
      <div
        className="absolute blur-[0px] h-[24px] left-[7.5px] rounded-[8px] top-[42.39px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/Day"
      >
        <SwatchDay />
      </div>
      <div
        className="absolute blur-[0px] h-[24px] left-[87px] rounded-[8px] top-[42.39px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/Warm"
      >
        <SwatchWarm />
      </div>
      <div
        className="absolute blur-[0px] h-[24px] left-[166.5px] rounded-[8px] top-[42.39px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/Night"
      >
        <SwatchNight />
      </div>
      <div
        className="absolute blur-[0px] h-[24px] left-[246px] rounded-[8px] top-[42.39px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/WarmNight"
      >
        <SwatchWarmNight />
      </div>
      <div
        className="absolute blur-[0px] h-[24px] left-[7.5px] rounded-[8px] top-[107.19px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/Paper"
      >
        <SwatchPaper />
      </div>
      <div
        className="absolute blur-[0px] h-[24px] left-[87px] rounded-[8px] top-[107.19px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/Green"
      >
        <SwatchGreen />
      </div>
      <div
        className="absolute blur-[0px] h-[24px] left-[166.5px] rounded-[8px] top-[107.19px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/PaperNight"
      >
        <SwatchPaperNight />
      </div>
      <div
        className="absolute blur-[0px] h-[24px] left-[246px] rounded-[8px] top-[107.19px] w-[62.5px]"
        data-name="PersistentActor/ThemeSwatch/GreenNight"
      >
        <SwatchGreenNight />
      </div>
    </div>
  )
}

function SectionHeader() {
  return (
    <div
      className="[word-break:break-word] absolute content-stretch flex h-[16px] items-center leading-[normal] left-0 overflow-clip px-[2px] top-0 w-[316px]"
      data-name="SectionHeader"
    >
      <p className="blur-[0px] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium min-w-px relative text-[#332c25] text-[13px]">
        字体库
      </p>
      <p className="blur-[0px] font-['Noto_Sans_SC:Regular',sans-serif] font-normal relative shrink-0 text-[#807366] text-[10px] text-right whitespace-nowrap">
        可拖动调整位置
      </p>
    </div>
  )
}

function FontGrid() {
  return (
    <div
      className="absolute content-stretch flex flex-wrap gap-y-[8px] h-[106px] items-start left-0 overflow-clip top-[30px] w-[316px]"
      data-name="FontGrid"
    >
      <div
        className="absolute bg-[#fffcf8] blur-[0px] h-[30px] left-0 rounded-[12px] top-[76px] w-[73px]"
        data-name="Reader/Appearance/FontCell / Font=Import / Size=Full"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full">
            <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#332c25] text-[12px] text-center whitespace-nowrap">
              导入
            </p>
          </div>
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-dashed inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
    </div>
  )
}

function HarmonyOsSansSc() {
  return (
    <div
      className="absolute h-[14.064px] left-[24.5px] top-[7.97px] w-[24px]"
      data-name="系统 / HarmonyOS_Sans_SC / 实际字体轮廓"
    >
      <svg
        className="absolute block inset-0 size-full"
        fill="none"
        height="14.064"
        preserveAspectRatio="none"
        viewBox="0 0 24 14.064"
        width="24"
      >
        <g id="ç³»ç» / HarmonyOS_Sans_SC / å®éå­ä½è½®å»">
          <path d={svgPaths.p3d633900} fill="#332C25" id="Vector" />
          <path d={svgPaths.p159a4b00} fill="#332C25" id="Vector_2" />
        </g>
      </svg>
    </div>
  )
}

function MotionContentPersistentActorFontCellSystem() {
  return (
    <div
      className="absolute h-[30px] left-0 overflow-clip top-[30px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/System"
    >
      <HarmonyOsSansSc />
    </div>
  )
}

function MotionContentPersistentActorFontCellSerif() {
  return (
    <div
      className="absolute h-[30px] left-[81px] overflow-clip top-[30px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/Serif"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Serif_SC:Regular',sans-serif] font-normal leading-[normal] left-[36.5px] text-[#fffaf4] text-[12px] text-center top-[6.5px] whitespace-nowrap">
        宋体
      </p>
    </div>
  )
}

function MotionContentPersistentActorFontCellSans() {
  return (
    <div
      className="absolute h-[30px] left-[162px] overflow-clip top-[30px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/Sans"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[normal] left-[36.5px] text-[#332c25] text-[12px] text-center top-[8px] whitespace-nowrap">
        黑体
      </p>
    </div>
  )
}

function LxgwWenKaiGbLiteRegular() {
  return (
    <div
      className="absolute h-[14.208px] left-[24.5px] top-[7.9px] w-[24px]"
      data-name="楷体 / LXGWWenKaiGBLite-Regular / 实际字体轮廓"
    >
      <svg
        className="absolute block inset-0 size-full"
        fill="none"
        height="14.2079"
        preserveAspectRatio="none"
        viewBox="0 0 24 14.2079"
        width="24"
      >
        <g id="æ¥·ä½ / LXGWWenKaiGBLite-Regular / å®éå­ä½è½®å»">
          <path d={svgPaths.p35143300} fill="#332C25" id="Vector" />
          <path d={svgPaths.p4e6af00} fill="#332C25" id="Vector_2" />
        </g>
      </svg>
    </div>
  )
}

function MotionContentPersistentActorFontCellKai() {
  return (
    <div
      className="absolute h-[30px] left-[243px] overflow-clip top-[30px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/Kai"
    >
      <LxgwWenKaiGbLiteRegular />
    </div>
  )
}

function ZhuqueFangsongRegular() {
  return (
    <div
      className="absolute h-[14.4px] left-[24.5px] top-[7.8px] w-[24px]"
      data-name="仿宋 / ZhuqueFangsong-Regular / 实际字体轮廓"
    >
      <svg
        className="absolute block inset-0 size-full"
        fill="none"
        height="14.4"
        preserveAspectRatio="none"
        viewBox="0 0 24 14.4"
        width="24"
      >
        <g id="ä»¿å® / ZhuqueFangsong-Regular / å®éå­ä½è½®å»">
          <path d={svgPaths.p1740700} fill="#332C25" id="Vector" />
          <path d={svgPaths.p2abb1180} fill="#332C25" id="Vector_2" />
        </g>
      </svg>
    </div>
  )
}

function MotionContentPersistentActorFontCellFangSong() {
  return (
    <div
      className="absolute h-[30px] left-0 overflow-clip top-[68px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/FangSong"
    >
      <ZhuqueFangsongRegular />
    </div>
  )
}

function SarasaMonoScRegular() {
  return (
    <div
      className="absolute h-[14.16px] left-[24.5px] top-[7.92px] w-[24px]"
      data-name="等宽 / Sarasa-Mono-SC-Regular / 实际字体轮廓"
    >
      <svg
        className="absolute block inset-0 size-full"
        fill="none"
        height="14.1599"
        preserveAspectRatio="none"
        viewBox="0 0 24 14.1599"
        width="24"
      >
        <g id="ç­å®½ / Sarasa-Mono-SC-Regular / å®éå­ä½è½®å»">
          <path d={svgPaths.p2f3ccb80} fill="#332C25" id="Vector" />
          <path d={svgPaths.p1ff44f00} fill="#332C25" id="Vector_2" />
        </g>
      </svg>
    </div>
  )
}

function MotionContentPersistentActorFontCellMono() {
  return (
    <div
      className="absolute h-[30px] left-[81px] overflow-clip top-[68px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/Mono"
    >
      <SarasaMonoScRegular />
    </div>
  )
}

function MotionContentPersistentActorFontCellSourceHanSerif() {
  return (
    <div
      className="absolute h-[30px] left-[162px] overflow-clip top-[68px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/SourceHanSerif"
    >
      <p className="-translate-x-1/2 [word-break:break-word] absolute font-['Noto_Serif_SC:Regular',sans-serif] font-normal leading-[normal] left-[36.5px] text-[#332c25] text-[12px] text-center top-[6.5px] whitespace-nowrap">
        思源宋体
      </p>
    </div>
  )
}

function LxgwWenKaiLiteRegular() {
  return (
    <div
      className="absolute h-[14.208px] left-[12.5px] top-[7.9px] w-[48px]"
      data-name="霞鹜文楷 / LXGWWenKaiLite-Regular / 实际字体轮廓"
    >
      <svg
        className="absolute block inset-0 size-full"
        fill="none"
        height="14.2079"
        preserveAspectRatio="none"
        viewBox="0 0 48 14.2079"
        width="48"
      >
        <g id="éé¹ææ¥· / LXGWWenKaiLite-Regular / å®éå­ä½è½®å»">
          <path d={svgPaths.p24a97000} fill="#332C25" id="Vector" />
          <path d={svgPaths.p2812380} fill="#332C25" id="Vector_2" />
          <path d={svgPaths.p1c79c4f0} fill="#332C25" id="Vector_3" />
          <path d={svgPaths.p295ee880} fill="#332C25" id="Vector_4" />
        </g>
      </svg>
    </div>
  )
}

function MotionContentPersistentActorFontCellLxgwWenKai() {
  return (
    <div
      className="absolute h-[30px] left-[243px] overflow-clip top-[68px] w-[73px]"
      data-name="MotionContent/PersistentActor/FontCell/LXGWWenKai"
    >
      <LxgwWenKaiLiteRegular />
    </div>
  )
}

function PersistentModuleAppearanceFontLibrary() {
  return (
    <div
      className="absolute h-[136px] left-[11px] top-[221px] w-[316px]"
      data-name="PersistentModule/Appearance/FontLibrary"
    >
      <SectionHeader />
      <FontGrid />
      <div
        className="absolute bg-[#fffcf8] h-[30px] left-0 rounded-[12px] top-[30px] w-[73px]"
        data-name="PersistentActor/FontCell/System"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <MotionContentPersistentActorFontCellSystem />
      <div
        className="absolute bg-[#2f6373] h-[30px] left-[81px] rounded-[12px] top-[30px] w-[73px]"
        data-name="PersistentActor/FontCell/Serif"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
      </div>
      <MotionContentPersistentActorFontCellSerif />
      <div
        className="absolute bg-[#fffcf8] h-[30px] left-[162px] rounded-[12px] top-[30px] w-[73px]"
        data-name="PersistentActor/FontCell/Sans"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <MotionContentPersistentActorFontCellSans />
      <div
        className="absolute bg-[#fffcf8] h-[30px] left-[243px] rounded-[12px] top-[30px] w-[73px]"
        data-name="PersistentActor/FontCell/Kai"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <MotionContentPersistentActorFontCellKai />
      <div
        className="absolute bg-[#fffcf8] h-[30px] left-0 rounded-[12px] top-[68px] w-[73px]"
        data-name="PersistentActor/FontCell/FangSong"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <MotionContentPersistentActorFontCellFangSong />
      <div
        className="absolute bg-[#fffcf8] h-[30px] left-[81px] rounded-[12px] top-[68px] w-[73px]"
        data-name="PersistentActor/FontCell/Mono"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <MotionContentPersistentActorFontCellMono />
      <div
        className="absolute bg-[#fffcf8] h-[30px] left-[162px] rounded-[12px] top-[68px] w-[73px]"
        data-name="PersistentActor/FontCell/SourceHanSerif"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <MotionContentPersistentActorFontCellSourceHanSerif />
      <div
        className="absolute bg-[#fffcf8] h-[30px] left-[243px] rounded-[12px] top-[68px] w-[73px]"
        data-name="PersistentActor/FontCell/LXGWWenKai"
      >
        <div className="flex flex-col items-center justify-center overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col items-center justify-center p-[6px] relative size-full" />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <MotionContentPersistentActorFontCellLxgwWenKai />
    </div>
  )
}

function Header() {
  return (
    <div
      className="flex items-baseline justify-between px-[2px]"
      data-name="SectionHeader/排版库"
    >
      <p className="font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] text-[#332c25] text-[13px]">
        排版库
      </p>
      <p className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] text-[#807366] text-[10px]">
        即时应用
      </p>
    </div>
  )
}

function Component1() {
  const selects: { label: string; options: string[]; value: string }[] = [
    { label: "缩进", options: ["无", "1 字符", "2 字符"], value: "无" },
    { label: "简繁", options: ["原文", "繁转简", "简转繁"], value: "原文" },
    {
      label: "翻页动画",
      options: ["平移", "仿真", "淡入", "无"],
      value: "平移",
    },
    { label: "文字两端对齐", options: ["开启", "关闭"], value: "开启" },
  ]
  const steppers: [string, string][] = [
    ["字号", "18px"],
    ["行距", "1.96"],
    ["段距", "16px"],
    ["字距", "0px"],
  ]
  return (
    <div
      className="absolute flex flex-col gap-[10px] left-[11px] pb-[40px] pt-[10px] px-[2px] top-[367px] w-[316px]"
      data-name="排版库 / 当前实现"
    >
      <Header />
      <div className="rounded-[12px] bg-[rgba(255,249,242,0.88)] border border-[rgba(155,132,102,0.26)] divide-y divide-[rgba(155,132,102,0.18)]">
        {selects.map(({ label, options, value }) => (
          <TypographySelectRow
            key={label}
            label={label}
            options={options}
            defaultValue={value}
          />
        ))}
        {steppers.map(([label, value]) => (
          <TypographyStepperRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  )
}

function ContentViewportAppearance() {
  return (
    <div
      className="absolute h-[666px] left-[26px] overflow-x-clip overflow-y-auto top-[146px] w-[338px]"
      data-name="ContentViewport/Appearance"
    >
      <PersistentModuleAppearanceThemeLibrary />
      <PersistentModuleAppearanceFontLibrary />
      <Component1 />
    </div>
  )
}

function TablerPaletteOutline() {
  return (
    <div
      className="absolute left-0 size-[16px] top-0"
      data-name="Tabler/palette/outline"
    >
      <svg
        className="absolute block inset-0 size-full"
        fill="none"
        height="16"
        preserveAspectRatio="none"
        viewBox="0 0 16 16"
        width="16"
      >
        <g clipPath="url(#clip0_0_634)" id="Tabler/palette/outline">
          <g id="Vector" />
          <path
            d={svgPaths.p22234d00}
            id="Vector_2"
            stroke="#1F1B17"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.16667"
          />
          <path
            d={svgPaths.p3da45d00}
            id="Vector_3"
            stroke="#1F1B17"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.16667"
          />
          <path
            d={svgPaths.p4c51680}
            id="Vector_4"
            stroke="#1F1B17"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.16667"
          />
          <path
            d={svgPaths.p1726a700}
            id="Vector_5"
            stroke="#1F1B17"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.16667"
          />
        </g>
        <defs>
          <clipPath id="clip0_0_634">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  )
}

function Leading() {
  return (
    <div
      className="absolute h-[30px] left-0 top-0 w-[288px]"
      data-name="Leading"
    >
      <div
        className="absolute left-0 size-[16px] top-[7px]"
        data-name="HeaderIcon"
      >
        <TablerPaletteOutline />
      </div>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[20px] left-[24px] text-[#332c25] text-[14px] top-[5px] whitespace-nowrap">
        界面
      </p>
    </div>
  )
}

function CollapseButton() {
  return (
    <div
      className="absolute bg-[rgba(238,230,219,0.64)] h-[26px] left-[298px] overflow-clip rounded-[8px] top-[2px] w-[40px]"
      data-name="CollapseButton"
    >
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[14px] left-[10px] text-[#2f6373] text-[10px] top-[6px] whitespace-nowrap">
        收起
      </p>
    </div>
  )
}

function AddedActorFullHeader() {
  return (
    <div
      className="absolute h-[30px] left-[26px] top-[108px] w-[338px]"
      data-name="AddedActor/FullHeader"
    >
      <Leading />
      <CollapseButton />
    </div>
  )
}

function PersistentActorPanelMotionRootAppearance() {
  return (
    <div
      className="absolute h-[844px] left-0 top-0 w-[390px]"
      data-name="PersistentActor/PanelMotionRoot/Appearance"
    >
      <div
        className="absolute bg-[rgba(255,250,244,0.98)] h-[736px] left-[13px] rounded-[24px] top-[89px] w-[364px]"
        data-name="PersistentActor/UnifiedSheetSurface"
      >
        <div className="overflow-clip relative rounded-[inherit] size-full">
          <Grabber />
        </div>
        <div
          aria-hidden
          className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]"
        />
      </div>
      <div
        className="absolute bg-[rgba(255,252,248,0.62)] h-[666px] left-[26px] rounded-[12px] top-[146px] w-[338px]"
        data-name="AddedActor/FullContentSurface"
      >
        <div
          aria-hidden
          className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]"
        />
      </div>
      <ContentViewportAppearance />
      <AddedActorFullHeader />
    </div>
  )
}

export default function Component() {
  return (
    <div
      className="bg-white overflow-clip relative rounded-[34px] size-full"
      data-name="完整界面 / 简繁展开"
    >
      <ReaderResponsiveReadingSurface className="absolute h-[844px] left-0 overflow-clip rounded-[34px] top-0 w-[390px]" />
      <ReaderResponsiveTopBar className="absolute bg-[rgba(255,250,244,0.98)] h-[53.993px] left-[15px] rounded-[24px] top-[19px] w-[360px]" />
      <PersistentActorPanelMotionRootAppearance />
    </div>
  )
}
