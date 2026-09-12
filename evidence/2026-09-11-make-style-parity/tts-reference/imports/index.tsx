import svgPaths from "./svg-8yrmzwthkp";
import { motion } from "motion/react";
import imgPaperLayer from "./99d77078d4edc59bf6fc0f8d5cf678d7361665e5.png";
type ReaderModuleButtonProps = {
  className?: string;
  interaction?: "Default" | "Hover" | "Pressed";
  module?: "Directory" | "TTS" | "Appearance" | "Settings";
  state?: "Default" | "Active";
};

function ReaderModuleButton({ className, interaction = "Default", module = "Directory", state = "Default" }: ReaderModuleButtonProps) {
  const isAppearanceAndDefault = module === "Appearance" && state === "Default";
  const isSettingsAndDefault = module === "Settings" && state === "Default";
  const isTtsAndActive = module === "TTS" && state === "Active";
  return (
    <div className={className || `h-[61.988px] relative rounded-[12px] ${isSettingsAndDefault || isTtsAndActive ? "w-[77.96px]" : "w-[77.951px]"}`}>
      <div className={`absolute bg-[#f48b13] h-[61.988px] left-0 rounded-[14px] top-0 ${interaction === "Pressed" && ((module === "Settings" && state === "Default") || (module === "TTS" && state === "Active")) ? "opacity-12 w-[77.96px]" : interaction === "Hover" && ((module === "Settings" && state === "Default") || (module === "TTS" && state === "Active")) ? "opacity-8 w-[77.96px]" : state === "Default" && interaction === "Pressed" && ["Directory", "Appearance"].includes(module) ? "opacity-12 w-[77.951px]" : state === "Default" && interaction === "Hover" && ["Directory", "Appearance"].includes(module) ? "opacity-8 w-[77.951px]" : interaction === "Default" && ((module === "Settings" && state === "Default") || (module === "TTS" && state === "Active")) ? "opacity-0 w-[77.96px]" : "opacity-0 w-[77.951px]"}`} data-name="InteractionStateLayer" />
      <div className={`absolute left-[17.98px] overflow-clip rounded-[999px] size-[41.997px] top-0 ${isTtsAndActive ? "bg-[#2f6373]" : "bg-[rgba(47,99,115,0.08)]"}`} data-name="IconCircle">
        {module === "Directory" && state === "Default" && (
          <div className="absolute left-[9px] size-[23.993px] top-[9px]" data-name="Icon/directory">
            <div className="absolute left-0 size-[23.993px] top-0" data-name="Tabler/list/outline">
              <svg className="absolute block inset-0 size-full" fill="none" height="23.9931" preserveAspectRatio="none" viewBox="0 0 23.9931 23.9931" width="23.9931">
                <g clipPath="url(#clip0_0_532)" id="Tabler/list/outline">
                  <g id="Vector" />
                  <path d="M8.99741 5.99827H19.9942" id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d="M8.99741 11.9965H19.9942" id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d="M8.99741 17.9948H19.9942" id="Vector_4" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d="M4.99856 5.99827V6.00827" id="Vector_5" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d="M4.99856 11.9965V12.0065" id="Vector_6" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d="M4.99856 17.9948V18.0048" id="Vector_7" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                </g>
                <defs>
                  <clipPath id="clip0_0_532">
                    <rect fill="white" height="23.9931" width="23.9931" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
        )}
        {isAppearanceAndDefault && (
          <div className="absolute left-[9px] size-[23.993px] top-[9px]" data-name="Icon/appearance">
            <div className="absolute left-0 size-[23.993px] top-0" data-name="Tabler/palette/outline">
              <svg className="absolute block inset-0 size-full" fill="none" height="23.9931" preserveAspectRatio="none" viewBox="0 0 23.9931 23.9931" width="23.9931">
                <g clipPath="url(#clip0_0_571)" id="Tabler/palette/outline">
                  <g id="Vector" />
                  <path d={svgPaths.p301e6600} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d={svgPaths.p3ab5d600} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d={svgPaths.p3f76fe00} id="Vector_4" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d={svgPaths.pa9b52c0} id="Vector_5" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                </g>
                <defs>
                  <clipPath id="clip0_0_571">
                    <rect fill="white" height="23.9931" width="23.9931" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
        )}
        {isSettingsAndDefault && (
          <div className="absolute left-[9px] size-[23.993px] top-[9px]" data-name="Icon/settings">
            <div className="absolute left-0 size-[23.993px] top-0" data-name="Tabler/settings/outline">
              <svg className="absolute block inset-0 size-full" fill="none" height="23.9931" preserveAspectRatio="none" viewBox="0 0 23.9931 23.9931" width="23.9931">
                <g clipPath="url(#clip0_0_606)" id="Tabler/settings/outline">
                  <g id="Vector" />
                  <path d={svgPaths.p23723380} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                  <path d={svgPaths.p11ac9c00} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
                </g>
                <defs>
                  <clipPath id="clip0_0_606">
                    <rect fill="white" height="23.9931" width="23.9931" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
        )}
        {isTtsAndActive && (
          <div className="absolute left-[9px] size-[23.993px] top-[9px]" data-name="Icon/tts">
            <div className="absolute left-0 size-[23.993px] top-0" data-name="Tabler/headphones/outline">
              <svg className="absolute block inset-0 size-full" fill="none" height="23.9931" preserveAspectRatio="none" viewBox="0 0 23.9931 23.9931" width="23.9931">
                <g clipPath="url(#clip0_0_504)" id="Tabler/headphones/outline">
                  <g id="Vector" />
                  <path d={svgPaths.p3096cf80} id="Vector_2" stroke="#FFFCF8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.98" strokeWidth="1.7495" />
                  <path d={svgPaths.p29e8ed00} id="Vector_3" stroke="#FFFCF8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.98" strokeWidth="1.7495" />
                  <path d={svgPaths.p22f56e00} id="Vector_4" stroke="#FFFCF8" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.98" strokeWidth="1.7495" />
                </g>
                <defs>
                  <clipPath id="clip0_0_504">
                    <rect fill="white" height="23.9931" width="23.9931" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
        )}
      </div>
      <p className={`-translate-x-1/2 [word-break:break-word] absolute font-["Noto_Sans_SC:Black",sans-serif] font-black leading-[13.889px] left-[38.98px] text-[10px] text-center top-[47.04px] w-[20px] ${isTtsAndActive ? "text-[#2f6373]" : "text-[#4d463f]"}`}>{isTtsAndActive ? "朗读" : isSettingsAndDefault ? "设置" : isAppearanceAndDefault ? "界面" : module === "Directory" && state === "Default" && ["Hover", "Pressed"].includes(interaction) ? "目录" : "目录"}</p>
    </div>
  );
}
type ReaderFullTtsModuleHeaderProps = {
  className?: string;
  meta?: string;
  title?: string;
};

function ReaderFullTtsModuleHeader({ className, meta = "未开始", title = "播放控制区" }: ReaderFullTtsModuleHeaderProps) {
  return (
    <div className={className || "[word-break:break-word] h-[24px] relative w-[312px]"} data-name="Reader/Full/TTS/ModuleHeader">
      <p className="absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-[3px] whitespace-nowrap">{title}</p>
      <p className="-translate-x-full absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] left-[312px] text-[#5b5046] text-[10px] text-right top-[5px] w-[80px]">{meta}</p>
    </div>
  );
}

function ReadingContent() {
  return (
    <div className="absolute inset-[72px_32px_47.99px_32px] overflow-clip" data-name="ReadingContent">
      <div className="absolute left-0 right-0 top-0" data-name="ChapterPage / Phone / Page 1">
        <div className="[word-break:break-word] content-stretch flex flex-col gap-[18px] items-start relative size-full text-[#2b241d]">
          <p className="font-['Noto_Serif_SC:Bold',sans-serif] font-bold leading-[28.75px] relative shrink-0 text-[23px] text-center w-full">雨夜</p>
          <div className="font-['Noto_Serif_SC:Regular',sans-serif] font-normal leading-[0] relative shrink-0 text-[18px] w-full">
            <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">雨声在窗外连成一片，像无数细小的针，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个迟到许久的答案终于抵达。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下短暂而摇晃的光。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。</p>
            <p className="indent-[36px] leading-[35.28px] mb-[15.800000190734863px]">可真正看到信上那行字时，他才发现那些被压下去的情绪并没有消失，只是一直在暗处积蓄，等着这一刻重新涌上来。</p>
            <p className="indent-[36px] leading-[35.28px]">远处的灯光像被雾气揉碎，</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperLayer() {
  return (
    <div className="absolute bg-size-[200px_200px,auto_auto,auto_auto,auto_auto] bg-top-left inset-[0.56px] overflow-clip" style={{ backgroundImage: `url("${imgPaperLayer}"), linear-gradient(180deg, rgb(251, 244, 233) 0%, rgb(239, 226, 208) 100%), url("data:image/svg+xml;utf8,<svg viewBox='0 0 388.89 842.88' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(0 -71.799 -71.799 0 194.44 151.72)'><stop stop-color='rgba(255,255,255,0.7)' offset='0'/><stop stop-color='rgba(191,191,191,0.525)' offset='0.105'/><stop stop-color='rgba(128,128,128,0.35)' offset='0.21'/><stop stop-color='rgba(64,64,64,0.175)' offset='0.315'/><stop stop-color='rgba(0,0,0,0)' offset='0.42'/></radialGradient></defs></svg>"), url("data:image/svg+xml;utf8,<svg viewBox='0 0 388.89 842.88' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(0 -59.601 -27.499 0 194.44 421.44)'><stop stop-color='rgba(0,0,0,0)' offset='0.56'/><stop stop-color='rgba(89,70,50,0.1)' offset='1'/></radialGradient></defs></svg>")` }} data-name="PaperLayer">
      <ReadingContent />
    </div>
  );
}

function TablerArrowLeftOutline() {
  return (
    <div className="absolute left-0 size-[23.993px] top-0" data-name="Tabler/arrow-left/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="23.9931" preserveAspectRatio="none" viewBox="0 0 23.9931 23.9931" width="23.9931">
        <g clipPath="url(#clip0_0_524)" id="Tabler/arrow-left/outline">
          <g id="Vector" />
          <path d="M4.99856 11.9965H18.9945" id="Vector_2" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
          <path d={svgPaths.pc774e00} id="Vector_3" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
          <path d={svgPaths.pf712d00} id="Vector_4" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7495" />
        </g>
        <defs>
          <clipPath id="clip0_0_524">
            <rect fill="white" height="23.9931" width="23.9931" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function TopBarBackHitArea() {
  return (
    <div className="absolute h-[42px] left-[13px] top-[6px] w-[44px]" data-name="TopBar/BackHitArea">
      <div className="absolute left-[10px] size-[23.993px] top-[9px]" data-name="Icon/Back">
        <TablerArrowLeftOutline />
      </div>
    </div>
  );
}

function TopBarText() {
  return (
    <div className="[word-break:break-word] absolute h-[45px] leading-[normal] left-[65px] overflow-clip top-[4.5px] w-[170px] whitespace-nowrap" data-name="TopBar/Text">
      <p className="absolute font-['Noto_Serif_SC:Bold',sans-serif] font-bold left-0 text-[#332c25] text-[16px] top-0">长夜余火</p>
      <p className="absolute font-['Noto_Serif_SC:Regular',sans-serif] font-normal left-0 text-[#5b5046] text-[12px] top-[28px]">第 32 章 雨夜 · 优书网</p>
    </div>
  );
}

function TablerSwitchHorizontalOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/switch-horizontal/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_624)" id="Tabler/switch-horizontal/outline">
          <g id="Vector" />
          <path d={svgPaths.p35177c00} id="Vector_2" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M8.33333 5.83333H16.6667" id="Vector_3" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.pd8c5e80} id="Vector_4" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M3.33333 14.1667H10.8333" id="Vector_5" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_624">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function TopBarSourceSwitchHitArea() {
  return (
    <div className="absolute h-[42px] left-[243px] top-[6px] w-[62px]" data-name="TopBar/SourceSwitchHitArea">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] left-[19px] text-[#332c25] text-[12px] top-[25px] w-[24px]">换源</p>
      <div className="absolute left-[21px] size-[20px] top-[1.25px]" data-name="Icon/SourceSwitch">
        <TablerSwitchHorizontalOutline />
      </div>
    </div>
  );
}

function TablerDotsOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/dots/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_577)" id="Tabler/dots/outline">
          <g id="Vector" />
          <path d={svgPaths.p14290600} id="Vector_2" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.p3d191400} id="Vector_3" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.pb0d3180} id="Vector_4" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_577">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function TopBarMoreHitArea() {
  return (
    <div className="absolute h-[42px] left-[313px] top-[6px] w-[34px]" data-name="TopBar/MoreHitArea">
      <div className="absolute left-[7px] size-[20px] top-[11px]" data-name="Icon/More">
        <TablerDotsOutline />
      </div>
    </div>
  );
}

function Grabber() {
  return <div className="-translate-x-1/2 absolute bg-[#b9ad9f] h-[4px] left-1/2 rounded-[999px] top-[9.55px] w-[42px]" data-name="Grabber" />;
}

function TablerChevronLeftOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/chevron-left/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_616)" id="Tabler/chevron-left/outline">
          <g id="Vector" />
          <path d="M12.5 5L7.5 10L12.5 15" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_616">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function PersistentActorTransportPreviousRigidShellIntactIcon() {
  return (
    <motion.div className="absolute bg-[rgba(255,252,248,0.98)] left-[58px] rounded-[999px] size-[44px] top-[60px]" data-name="PersistentActor/Transport/Previous · RigidShell+IntactIcon">
      <div className="content-stretch flex items-center justify-center overflow-clip relative rounded-[inherit] size-full">
        <div className="relative shrink-0 size-[20px]" data-name="Icon/ChevronLeft">
          <TablerChevronLeftOutline />
        </div>
      </div>
      <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[999px]" />
    </motion.div>
  );
}

function TablerPlayerPlayOutline() {
  return (
    <div className="absolute left-0 size-[24px] top-0" data-name="Tabler/player-play/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="24" preserveAspectRatio="none" viewBox="0 0 24 24" width="24">
        <g clipPath="url(#clip0_0_582)" id="Tabler/player-play/outline">
          <g id="Vector" />
          <path d="M7 4V20L20 12L7 4Z" id="Vector_2" stroke="#FFFAF4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
        </g>
        <defs>
          <clipPath id="clip0_0_582">
            <rect fill="white" height="24" width="24" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function PersistentActorTransportPlayRigidShellIntactIcon() {
  return (
    <motion.div className="absolute bg-[#1f3528] left-[106px] rounded-[999px] size-[52px] top-[56px]" data-name="PersistentActor/Transport/Play · RigidShell+IntactIcon">
      <div className="content-stretch flex items-center justify-center overflow-clip relative rounded-[inherit] size-full">
        <div className="relative shrink-0 size-[24px]" data-name="Icon/Play">
          <TablerPlayerPlayOutline />
        </div>
      </div>
      <div aria-hidden className="absolute border border-[#2d4a3e] border-solid inset-0 pointer-events-none rounded-[999px]" />
    </motion.div>
  );
}

function TablerPlayerStopOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/player-stop/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_588)" id="Tabler/player-stop/outline">
          <g id="Vector" />
          <path d={svgPaths.p17902c80} id="Vector_2" stroke="#D62222" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_588">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function PersistentActorTransportStopRigidShellIntactIcon() {
  return (
    <motion.div className="absolute left-[162px] rounded-[999px] size-[44px] top-[60px]" data-name="PersistentActor/Transport/Stop · RigidShell+IntactIcon">
      <div className="content-stretch flex items-center justify-center overflow-clip relative rounded-[inherit] size-full">
        <div className="relative shrink-0 size-[20px]" data-name="Icon/Stop">
          <TablerPlayerStopOutline />
        </div>
      </div>
      <div aria-hidden className="absolute border border-[#d62222] border-solid inset-0 pointer-events-none rounded-[999px]" />
    </motion.div>
  );
}

function TablerChevronRightOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/chevron-right/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_565)" id="Tabler/chevron-right/outline">
          <g id="Vector" />
          <path d="M7.5 5L12.5 10L7.5 15" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_565">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function PersistentActorTransportNextRigidShellIntactIcon() {
  return (
    <motion.div className="absolute bg-[rgba(255,252,248,0.98)] left-[210px] rounded-[999px] size-[44px] top-[60px]" data-name="PersistentActor/Transport/Next · RigidShell+IntactIcon">
      <div className="content-stretch flex items-center justify-center overflow-clip relative rounded-[inherit] size-full">
        <div className="relative shrink-0 size-[20px]" data-name="Icon/ChevronRight">
          <TablerChevronRightOutline />
        </div>
      </div>
      <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[999px]" />
    </motion.div>
  );
}

function TablerHeadphonesOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/headphones/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_560)" id="Tabler/headphones/outline">
          <g id="Vector" />
          <path d={svgPaths.p32be5600} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.p24b58d00} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.p1521b098} id="Vector_4" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_560">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function IconBoxHeadphones() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="IconBox/headphones">
      <div className="absolute left-0 size-[20px] top-0" data-name="Icon/headphones">
        <TablerHeadphonesOutline />
      </div>
    </div>
  );
}

function PersistentModuleTtsPlayback() {
  return (
    <motion.div className="absolute h-[128px] left-[13px] top-[11px] w-[312px]" data-name="PersistentModule/TTS/Playback">
      <div className="[word-break:break-word] absolute h-[24px] left-0 top-[12px] w-[312px]" data-name="AddedActor/PlaybackHeader">
        <p className="absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-[3px] whitespace-nowrap">播放控制区</p>
        <p className="-translate-x-full absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] left-[312px] text-[#5b5046] text-[10px] text-right top-[5px] w-[80px]">未开始</p>
      </div>
      <PersistentActorTransportPreviousRigidShellIntactIcon />
      <PersistentActorTransportPlayRigidShellIntactIcon />
      <PersistentActorTransportStopRigidShellIntactIcon />
      <PersistentActorTransportNextRigidShellIntactIcon />
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[127px] w-[312px]" data-name="Divider" />
      <div className="absolute h-[20px] left-[12px] opacity-0 top-[23px] w-[106px]" data-name="OutgoingActor/QuickLabel/Playback">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex gap-[8px] items-center relative size-full">
            <IconBoxHeadphones />
            <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold h-[12px] leading-[12px] relative shrink-0 text-[#332c25] text-[12px] w-[78px]">播放</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TablerWaveSineOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/wave-sine/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_568)" id="Tabler/wave-sine/outline">
          <g id="Vector" />
          <path d={svgPaths.p1eeb9f00} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_568">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function IconBoxSpeed() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="IconBox/speed">
      <div className="absolute left-0 size-[20px] top-0" data-name="Icon/speed">
        <TablerWaveSineOutline />
      </div>
    </div>
  );
}

function PersistentModuleTtsSpeed() {
  return (
    <motion.div className="absolute h-[105px] left-[13px] top-[459px] w-[312px]" data-name="PersistentModule/TTS/Speed">
      <div className="[word-break:break-word] absolute h-[24px] left-0 top-[12px] w-[312px]" data-name="AddedActor/SpeedHeader">
        <p className="absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-[3px] whitespace-nowrap">语速</p>
        <p className="-translate-x-full absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] left-[312px] text-[#5b5046] text-[10px] text-right top-[5px] w-[80px]">1.0x</p>
      </div>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-0 text-[#5b5046] text-[9px] top-[65px] w-[21px]">0.5x</p>
      <p className="-translate-x-full [word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[312px] text-[#5b5046] text-[9px] text-right top-[65px] w-[21px]">2.0x</p>
      <motion.div className="absolute bg-[#c1c7cd] h-[4px] left-[28.5px] rounded-[999px] top-[70px] w-[255px]" data-name="PersistentActor/SpeedTrack" />
      <motion.div className="absolute bg-[#1f3528] h-[4px] left-[28.5px] rounded-[999px] top-[70px] w-[85px]" data-name="PersistentActor/SpeedProgress" />
      <motion.div className="absolute left-[104.5px] size-[18px] top-[63px]" data-name="PersistentActor/SpeedThumb">
        <svg className="absolute block inset-0 size-full" fill="none" height="18" preserveAspectRatio="none" viewBox="0 0 18 18" width="18">
          <circle cx="9" cy="9" fill="#FFFCF8" fillOpacity="0.98" id="PersistentActor/SpeedThumb" r="8" stroke="#1F3528" strokeWidth="2" />
        </svg>
      </motion.div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[104px] w-[312px]" data-name="Rectangle" />
      <div className="absolute h-[20px] left-[11px] opacity-0 top-[11px] w-[72px]" data-name="OutgoingActor/QuickLabel/Speed">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex gap-[8px] items-center relative size-full">
            <IconBoxSpeed />
            <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold h-[12px] leading-[12px] relative shrink-0 text-[#332c25] text-[12px] w-[44px]">语速</p>
          </div>
        </div>
      </div>
      <p className="-translate-x-full [word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold h-[12px] leading-[12px] left-[253px] opacity-0 text-[#2f6373] text-[12px] text-right top-[15px] w-[38px]">1.0x</p>
    </motion.div>
  );
}

function TablerChevronRightOutline1() {
  return (
    <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
        <g clipPath="url(#clip0_0_529)" id="Tabler/chevron-right/outline">
          <g id="Vector" />
          <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
        </g>
        <defs>
          <clipPath id="clip0_0_529">
            <rect fill="white" height="12" width="12" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function DetailFields() {
  return (
    <div className="absolute bg-[rgba(255,252,248,0.62)] border border-[#c1c7cd] border-solid h-[181px] left-0 overflow-clip rounded-[6px] top-[49px] w-[312px]" data-name="DetailFields">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[16px] left-[11px] text-[#332c25] text-[11px] top-[15px] whitespace-nowrap">音色选项</p>
      <div className="absolute h-[36px] left-[230px] rounded-[6px] top-[5px] w-[70px]" data-name="Reader/Full/Select">
        <div aria-hidden className="absolute bg-[rgba(255,248,239,0.78)] inset-0 pointer-events-none rounded-[6px]" />
        <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[6px]" />
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] left-[7px] text-[#332c25] text-[12px] top-[9px] whitespace-nowrap">清晰女声</p>
        <div className="absolute flex items-center justify-center left-[62px] size-[12px] top-[-1px]">
          <div className="-rotate-90 flex-none">
            <div className="relative size-[12px]" data-name="Icon/Chevron">
              <TablerChevronRightOutline1 />
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(255,255,255,0)] h-[44px] left-0 top-[-4px] w-[70px]" data-name="HitTarget/Select" />
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_1px_0px_rgba(255,255,255,0.54)]" />
      </div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-[11px] top-[47px] w-[288px]" data-name="Rectangle" />
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[16px] left-[11px] text-[#332c25] text-[11px] top-[61px] whitespace-nowrap">跟随高亮</p>
      <div className="absolute bg-[#2f6373] cursor-pointer h-[24px] left-[255px] rounded-[999px] top-[57px] w-[44px]" data-name="Reader/Full/Switch">
        <div className="-translate-x-1/2 -translate-y-1/2 absolute bg-[rgba(255,255,255,0)] left-1/2 size-[44px] top-1/2" data-name="HitTarget/44" />
        <div className="absolute bg-[#f48b13] h-[24px] left-0 opacity-0 rounded-[12px] top-0 w-[44px]" data-name="InteractionStateLayer" />
        <div className="absolute left-[22px] size-[20px] top-[2px]" data-name="Thumb">
          <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
            <circle cx="10" cy="10" fill="#FFFCF8" fillOpacity="0.74" id="Thumb" r="10" />
          </svg>
        </div>
      </div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-[11px] top-[91px] w-[288px]" data-name="Rectangle" />
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[16px] left-[11px] text-[#332c25] text-[11px] top-[105px] whitespace-nowrap">来电暂停</p>
      <div className="absolute bg-[#2f6373] cursor-pointer h-[24px] left-[255px] rounded-[999px] top-[101px] w-[44px]" data-name="Reader/Full/Switch">
        <div className="-translate-x-1/2 -translate-y-1/2 absolute bg-[rgba(255,255,255,0)] left-1/2 size-[44px] top-1/2" data-name="HitTarget/44" />
        <div className="absolute bg-[#f48b13] h-[24px] left-0 opacity-0 rounded-[12px] top-0 w-[44px]" data-name="InteractionStateLayer" />
        <div className="absolute left-[22px] size-[20px] top-[2px]" data-name="Thumb">
          <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
            <circle cx="10" cy="10" fill="#FFFCF8" fillOpacity="0.74" id="Thumb" r="10" />
          </svg>
        </div>
      </div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-[11px] top-[135px] w-[288px]" data-name="Rectangle" />
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[16px] left-[11px] text-[#332c25] text-[11px] top-[149px] whitespace-nowrap">允许与其他应用同时播放</p>
      <div className="absolute bg-[#aaa39a] cursor-pointer h-[24px] left-[255px] rounded-[999px] top-[145px] w-[44px]" data-name="Reader/Full/Switch">
        <div className="-translate-x-1/2 -translate-y-1/2 absolute bg-[rgba(255,255,255,0)] left-1/2 size-[44px] top-1/2" data-name="HitTarget/44" />
        <div className="absolute bg-[#f48b13] h-[24px] left-0 opacity-0 rounded-[12px] top-0 w-[44px]" data-name="InteractionStateLayer" />
        <div className="absolute left-[2px] size-[20px] top-[2px]" data-name="Thumb">
          <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
            <circle cx="10" cy="10" fill="#FFFCF8" fillOpacity="0.74" id="Thumb" r="10" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function TablerPhoneOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/phone/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_516)" id="Tabler/phone/outline">
          <g id="Vector" />
          <path d={svgPaths.p2af55a80} id="Vector_2" stroke="#1F3528" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_516">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Frame() {
  return (
    <div className="absolute bg-[rgba(47,99,115,0.1)] border border-[#2d4a3e] border-solid h-[68px] left-0 overflow-clip rounded-[6px] top-[49px] w-[155px]" data-name="Frame">
      <div className="absolute left-[11px] size-[20px] top-[11px]" data-name="Icon/Phone">
        <TablerPhoneOutline />
      </div>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[16px] left-[39px] text-[#332c25] text-[11px] top-[9px] whitespace-nowrap">系统 TTS</p>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[11px] text-[#5b5046] text-[9px] top-[37px] w-[131px]">使用设备内置语音</p>
    </div>
  );
}

function TablerCloudOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/cloud/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_513)" id="Tabler/cloud/outline">
          <g id="Vector" />
          <path d={svgPaths.p33960600} id="Vector_2" stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_513">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Frame1() {
  return (
    <div className="absolute bg-[rgba(255,252,248,0.62)] border border-[#c1c7cd] border-solid h-[68px] left-[157px] overflow-clip rounded-[6px] top-[49px] w-[155px]" data-name="Frame">
      <div className="absolute left-[11px] size-[20px] top-[11px]" data-name="Icon/Cloud">
        <TablerCloudOutline />
      </div>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[16px] left-[39px] text-[#332c25] text-[11px] top-[9px] whitespace-nowrap">在线 TTS</p>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-[11px] text-[#5b5046] text-[9px] top-[37px] w-[131px]">第三方或自定义服务</p>
    </div>
  );
}

function TablerChevronRightOutline2() {
  return (
    <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
        <g clipPath="url(#clip0_0_529)" id="Tabler/chevron-right/outline">
          <g id="Vector" />
          <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
        </g>
        <defs>
          <clipPath id="clip0_0_529">
            <rect fill="white" height="12" width="12" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Frame2() {
  return (
    <div className="absolute h-[48px] left-0 overflow-clip top-[129px] w-[312px]" data-name="Frame">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[16px] left-0 text-[#332c25] text-[11px] top-[16px] whitespace-nowrap">系统引擎</p>
      <div className="absolute h-[36px] left-[206px] rounded-[6px] top-[6px] w-[106px]" data-name="Reader/Full/Select">
        <div aria-hidden className="absolute bg-[rgba(255,248,239,0.78)] inset-0 pointer-events-none rounded-[6px]" />
        <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[6px]" />
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] left-[7px] text-[#332c25] text-[12px] top-[9px] whitespace-nowrap">系统默认</p>
        <div className="absolute flex items-center justify-center left-[98px] size-[12px] top-[-1px]">
          <div className="-rotate-90 flex-none">
            <div className="relative size-[12px]" data-name="Icon/Chevron">
              <TablerChevronRightOutline2 />
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(255,255,255,0)] h-[44px] left-0 top-[-4px] w-[106px]" data-name="HitTarget/Select" />
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_1px_0px_rgba(255,255,255,0.54)]" />
      </div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[47px] w-[312px]" data-name="Rectangle" />
    </div>
  );
}

function TablerChevronRightOutline3() {
  return (
    <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
        <g clipPath="url(#clip0_0_529)" id="Tabler/chevron-right/outline">
          <g id="Vector" />
          <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
        </g>
        <defs>
          <clipPath id="clip0_0_529">
            <rect fill="white" height="12" width="12" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Frame3() {
  return (
    <div className="absolute h-[48px] left-0 overflow-clip top-[177px] w-[312px]" data-name="Frame">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[16px] left-0 text-[#332c25] text-[11px] top-[16px] whitespace-nowrap">语言</p>
      <div className="absolute h-[36px] left-[242px] rounded-[6px] top-[6px] w-[70px]" data-name="Reader/Full/Select">
        <div aria-hidden className="absolute bg-[rgba(255,248,239,0.78)] inset-0 pointer-events-none rounded-[6px]" />
        <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[6px]" />
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] left-[7px] text-[#332c25] text-[12px] top-[9px] whitespace-nowrap">zh-CN</p>
        <div className="absolute flex items-center justify-center left-[62px] size-[12px] top-[-1px]">
          <div className="-rotate-90 flex-none">
            <div className="relative size-[12px]" data-name="Icon/Chevron">
              <TablerChevronRightOutline3 />
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(255,255,255,0)] h-[44px] left-0 top-[-4px] w-[70px]" data-name="HitTarget/Select" />
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_1px_0px_rgba(255,255,255,0.54)]" />
      </div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[47px] w-[312px]" data-name="Rectangle" />
    </div>
  );
}

function TablerChevronRightOutline4() {
  return (
    <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
        <g clipPath="url(#clip0_0_529)" id="Tabler/chevron-right/outline">
          <g id="Vector" />
          <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
        </g>
        <defs>
          <clipPath id="clip0_0_529">
            <rect fill="white" height="12" width="12" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Frame4() {
  return (
    <div className="absolute h-[48px] left-0 overflow-clip top-[225px] w-[312px]" data-name="Frame">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[16px] left-0 text-[#332c25] text-[11px] top-[16px] whitespace-nowrap">音频会话</p>
      <div className="absolute h-[36px] left-[206px] rounded-[6px] top-[6px] w-[106px]" data-name="Reader/Full/Select">
        <div aria-hidden className="absolute bg-[rgba(255,248,239,0.78)] inset-0 pointer-events-none rounded-[6px]" />
        <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[6px]" />
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] left-[7px] text-[#332c25] text-[12px] top-[9px] whitespace-nowrap">语音播放</p>
        <div className="absolute flex items-center justify-center left-[98px] size-[12px] top-[-1px]">
          <div className="-rotate-90 flex-none">
            <div className="relative size-[12px]" data-name="Icon/Chevron">
              <TablerChevronRightOutline4 />
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(255,255,255,0)] h-[44px] left-0 top-[-4px] w-[106px]" data-name="HitTarget/Select" />
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_1px_0px_rgba(255,255,255,0.54)]" />
      </div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[47px] w-[312px]" data-name="Rectangle" />
    </div>
  );
}

function TablerChevronRightOutline5() {
  return (
    <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
        <g clipPath="url(#clip0_0_529)" id="Tabler/chevron-right/outline">
          <g id="Vector" />
          <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#5B5046" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
        </g>
        <defs>
          <clipPath id="clip0_0_529">
            <rect fill="white" height="12" width="12" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Frame5() {
  return (
    <div className="absolute h-[48px] left-0 overflow-clip top-[273px] w-[312px]" data-name="Frame">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[16px] left-0 text-[#332c25] text-[11px] top-[16px] whitespace-nowrap">不可用处理</p>
      <div className="absolute h-[36px] left-[206px] rounded-[6px] top-[6px] w-[106px]" data-name="Reader/Full/Select">
        <div aria-hidden className="absolute bg-[rgba(255,248,239,0.78)] inset-0 pointer-events-none rounded-[6px]" />
        <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[6px]" />
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] left-[7px] text-[#332c25] text-[12px] top-[9px] whitespace-nowrap">提示安装或启用</p>
        <div className="absolute flex items-center justify-center left-[98px] size-[12px] top-[-1px]">
          <div className="-rotate-90 flex-none">
            <div className="relative size-[12px]" data-name="Icon/Chevron">
              <TablerChevronRightOutline5 />
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(255,255,255,0)] h-[44px] left-0 top-[-4px] w-[106px]" data-name="HitTarget/Select" />
        <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_1px_0px_rgba(255,255,255,0.54)]" />
      </div>
      <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[47px] w-[312px]" data-name="Rectangle" />
    </div>
  );
}

function TablerClockOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/clock/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_540)" id="Tabler/clock/outline">
          <g id="Vector" />
          <path d={svgPaths.p2643e980} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M10 5.83333V10L12.5 12.5" id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_540">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function IconBox() {
  return (
    <div className="bg-[rgba(255,252,248,0.98)] content-stretch flex items-center justify-center relative rounded-[6px] shrink-0 size-[44px]" data-name="icon-box">
      <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <div className="relative shrink-0 size-[20px]" data-name="Icon/Clock">
        <TablerClockOutline />
      </div>
    </div>
  );
}

function TextStack() {
  return (
    <div className="[word-break:break-word] content-stretch flex flex-col gap-[2px] items-start leading-[normal] not-italic relative shrink-0 whitespace-nowrap" data-name="text-stack">
      <p className="font-['Inter:Regular','Noto_Sans_JP:Regular','Noto_Sans_SC:Regular',sans-serif] font-normal relative shrink-0 text-[#5b5046] text-[10px]">朗读后停止</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold relative shrink-0 text-[#332c25] text-[20px]">15:00</p>
    </div>
  );
}

function SummaryRow() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0 w-full" data-name="summary-row">
      <IconBox />
      <TextStack />
    </div>
  );
}

function Wheel() {
  return (
    <div className="[word-break:break-word] content-stretch flex flex-col gap-[8px] h-[140px] items-center justify-center leading-[normal] not-italic overflow-clip relative shrink-0 w-[120px]" data-name="分-wheel">
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-20 relative shrink-0 text-[#332c25] text-[11px] text-center w-[min-content]">13</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-60 relative shrink-0 text-[#332c25] text-[13px] text-center w-[min-content]">14</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold min-w-full relative shrink-0 text-[#332c25] text-[15px] text-center w-[min-content]">15</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-60 relative shrink-0 text-[#332c25] text-[13px] text-center w-[min-content]">16</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-20 relative shrink-0 text-[#332c25] text-[11px] text-center w-[min-content]">17</p>
      <p className="absolute bottom-[15px] font-['Inter:Bold','Noto_Sans_JP:Bold',sans-serif] font-bold left-[calc(50%-4.5px)] text-[#5b5046] text-[9px] translate-y-full whitespace-nowrap">分</p>
    </div>
  );
}

function Frame6() {
  return (
    <div className="h-[10px] relative shrink-0 w-[3px]" data-name="Frame">
      <svg className="absolute block inset-0 size-full" fill="none" height="10" preserveAspectRatio="none" viewBox="0 0 3 10" width="3">
        <g id="Frame">
          <circle cx="1.5" cy="1.5" fill="#B4A697" fillOpacity="0.34" id="Ellipse" r="1.5" />
          <circle cx="1.5" cy="8.5" fill="#B4A697" fillOpacity="0.34" id="Ellipse_2" r="1.5" />
        </g>
      </svg>
    </div>
  );
}

function Wheel1() {
  return (
    <div className="[word-break:break-word] content-stretch flex flex-col gap-[8px] h-[140px] items-center justify-center leading-[normal] not-italic overflow-clip relative shrink-0 w-[120px]" data-name="秒-wheel">
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-20 relative shrink-0 text-[#332c25] text-[11px] text-center w-[min-content]">58</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-60 relative shrink-0 text-[#332c25] text-[13px] text-center w-[min-content]">59</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold min-w-full relative shrink-0 text-[#332c25] text-[15px] text-center w-[min-content]">00</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-60 relative shrink-0 text-[#332c25] text-[13px] text-center w-[min-content]">01</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal min-w-full opacity-20 relative shrink-0 text-[#332c25] text-[11px] text-center w-[min-content]">02</p>
      <p className="absolute bottom-[15px] font-['Inter:Bold','Noto_Sans_JP:Bold',sans-serif] font-bold left-[calc(50%-4.5px)] text-[#5b5046] text-[9px] translate-y-full whitespace-nowrap">秒</p>
    </div>
  );
}

function WheelsContainer() {
  return (
    <div className="flex-[1_0_0] min-h-px relative w-full" data-name="wheels-container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between px-[10px] py-[8px] relative size-full">
          <Wheel />
          <Frame6 />
          <Wheel1 />
        </div>
      </div>
    </div>
  );
}

function PickerRecess() {
  return (
    <div className="flex-[1_0_0] min-h-px relative rounded-[6px] w-full" data-name="picker-recess">
      <div aria-hidden className="absolute bg-[rgba(255,248,239,0.78)] inset-0 pointer-events-none rounded-[6px]" />
      <div className="content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <WheelsContainer />
        <div className="-translate-y-1/2 absolute bg-[rgba(180,166,151,0.34)] h-[0.5px] left-0 right-0 top-[calc(50%-16px)]" data-name="selection-line-top" />
        <div className="-translate-y-1/2 absolute bg-[rgba(180,166,151,0.34)] h-[0.5px] left-0 right-0 top-[calc(50%+16px)]" data-name="selection-line-bottom" />
        <div className="absolute bg-gradient-to-b from-[rgba(255,248,239,0.78)] h-[30px] left-0 right-0 to-[rgba(255,253,248,0)] top-0" data-name="top-drum-fade" />
        <div className="absolute bg-gradient-to-b bottom-0 from-[rgba(255,253,248,0)] h-[30px] left-0 right-0 to-[rgba(255,248,239,0.78)]" data-name="bottom-drum-fade" />
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.68)]" />
      <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[6px]" />
    </div>
  );
}

function TablerClockOutline1() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/clock/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_509)" id="Tabler/clock/outline">
          <g id="Vector" />
          <path d={svgPaths.p2643e980} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M10 5.83333V10L12.5 12.5" id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_509">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function IconBoxClock() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="IconBox/clock">
      <div className="absolute left-0 size-[20px] top-0" data-name="Icon/clock">
        <TablerClockOutline1 />
      </div>
    </div>
  );
}

function PersistentModuleTtsTimer() {
  return (
    <motion.div className="absolute bg-[rgba(247,244,239,0)] content-stretch flex flex-col gap-[12px] h-[320px] items-start left-[13px] overflow-clip py-[12px] top-[139px] w-[312px]" data-name="PersistentModule/TTS/Timer">
      <div className="[word-break:break-word] h-[24px] relative shrink-0 w-full" data-name="AddedActor/TimerHeader">
        <p className="absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-[3px] whitespace-nowrap">定时</p>
        <p className="-translate-x-full absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] left-[312px] text-[#5b5046] text-[10px] text-right top-[5px] w-[80px]">15:00</p>
      </div>
      <div className="bg-[rgba(255,252,248,0.62)] h-[260px] relative rounded-[6px] shrink-0 w-[312px]" data-name="AddedActor/TimerCard">
        <div className="overflow-clip rounded-[inherit] size-full">
          <div className="content-stretch flex flex-col gap-[20px] items-start p-[16px] relative size-full">
            <SummaryRow />
            <PickerRecess />
          </div>
        </div>
        <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      </div>
      <div className="absolute h-[20px] left-[11px] opacity-0 top-[11px] w-[148px]" data-name="OutgoingActor/QuickLabel/Timer">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex gap-[8px] items-center relative size-full">
            <IconBoxClock />
            <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold h-[12px] leading-[12px] relative shrink-0 text-[#332c25] text-[12px] w-[120px]">定时</p>
          </div>
        </div>
      </div>
      <div className="absolute bg-[rgba(255,248,239,0.78)] h-[30px] left-[167px] opacity-0 rounded-[6px] top-[6px] w-[86px]" data-name="OutgoingActor/QuickTimerSelect/5min">
        <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[6px]" />
        <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium h-[15px] leading-[15px] left-[10px] text-[#332c25] text-[12px] top-[7.5px] w-[50px]">5min</p>
        <div className="absolute flex h-[4px] items-center justify-center left-[72px] top-[13px] w-[7px]">
          <div className="flex-none rotate-180">
            <div className="h-[4px] relative w-[7px]" data-name="Native select indicator · CSS gradient equivalent">
              <div className="absolute bottom-1/4 left-[6.7%] right-[6.7%] top-0">
                <svg className="block size-full" fill="none" height="3" preserveAspectRatio="none" viewBox="0 0 6.06218 3" width="6.06218">
                  <path d={svgPaths.p32fb7a00} fill="#332C25" id="Native select indicator Â· CSS gradient equivalent" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(255,255,255,0)] h-[44px] left-0 top-[-7px] w-[86px]" data-name="HitTarget/SelectSmall" />
      </div>
    </motion.div>
  );
}

function ContentViewportTts() {
  return (
    <motion.div className="absolute h-[666px] left-[26px] overflow-x-clip overflow-y-auto top-[146px] w-[338px]" data-name="ContentViewport/TTS">
      <PersistentModuleTtsPlayback />
      <PersistentModuleTtsSpeed />
      <div className="absolute h-[242px] left-[13px] top-[564px] w-[312px]" data-name="AddedModule/TTS/Detail">
        <ReaderFullTtsModuleHeader className="[word-break:break-word] absolute h-[24px] left-0 top-[12px] w-[312px]" meta="即时生效" title="详细配置" />
        <DetailFields />
        <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[241px] w-[312px]" data-name="Rectangle" />
      </div>
      <div className="absolute h-[371px] left-[13px] top-[806px] w-[312px]" data-name="AddedModule/TTS/Config">
        <ReaderFullTtsModuleHeader className="[word-break:break-word] absolute h-[24px] left-0 top-[12px] w-[312px]" meta="设备引擎" title="TTS 配置" />
        <Frame />
        <Frame1 />
        <Frame2 />
        <Frame3 />
        <Frame4 />
        <Frame5 />
        <div className="absolute bg-[rgba(155,132,102,0.18)] h-px left-0 top-[370px] w-[312px]" data-name="Rectangle" />
      </div>
      <PersistentModuleTtsTimer />
    </motion.div>
  );
}

function TablerHeadphonesOutline1() {
  return (
    <div className="absolute left-0 size-[16px] top-0" data-name="Tabler/headphones/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="16" preserveAspectRatio="none" viewBox="0 0 16 16" width="16">
        <g clipPath="url(#clip0_0_591)" id="Tabler/headphones/outline">
          <g id="Vector" />
          <path d={svgPaths.pfe9ec80} id="Vector_2" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p3686100} id="Vector_3" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <path d={svgPaths.p99b6600} id="Vector_4" stroke="#1F1B17" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
        <defs>
          <clipPath id="clip0_0_591">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Leading() {
  return (
    <div className="absolute h-[30px] left-0 top-0 w-[288px]" data-name="Leading">
      <div className="absolute left-0 size-[16px] top-[7px]" data-name="HeaderIcon">
        <TablerHeadphonesOutline1 />
      </div>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[20px] left-[24px] text-[#332c25] text-[14px] top-[5px] whitespace-nowrap">朗读</p>
    </div>
  );
}

function CollapseButton() {
  return (
    <div className="absolute bg-[rgba(238,230,219,0.64)] h-[26px] left-[298px] overflow-clip rounded-[8px] top-[2px] w-[40px]" data-name="CollapseButton">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[14px] left-[10px] text-[#2f6373] text-[10px] top-[6px] whitespace-nowrap">收起</p>
    </div>
  );
}

function AddedActorFullHeader() {
  return (
    <motion.div className="absolute h-[30px] left-[26px] top-[108px] w-[338px]" data-name="AddedActor/FullHeader">
      <Leading />
      <CollapseButton />
    </motion.div>
  );
}

function PersistentActorPanelMotionRootTts() {
  return (
    <motion.div className="absolute h-[844px] left-0 top-0 w-[390px]" data-name="PersistentActor/PanelMotionRoot/TTS">
      <div className="absolute bg-[rgba(255,250,244,0.98)] h-[736px] left-[13px] rounded-[24px] top-[89px] w-[364px]" data-name="PersistentActor/SheetSurface">
        <div className="overflow-clip relative rounded-[inherit] size-full">
          <Grabber />
        </div>
        <div aria-hidden className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]" />
      </div>
      <div className="absolute bg-[rgba(255,252,248,0.62)] h-[666px] left-[26px] rounded-[12px] top-[146px] w-[338px]" data-name="AddedActor/FullContentSurface">
        <div aria-hidden className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      </div>
      <ContentViewportTts />
      <AddedActorFullHeader />
    </motion.div>
  );
}

function TablerSunOutline() {
  return (
    <div className="absolute left-0 size-[20px] top-0" data-name="Tabler/sun/outline">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_596)" id="Tabler/sun/outline">
          <g id="Vector" />
          <path d={svgPaths.p1e918d00} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.p25cf6f00} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_596">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function BrightnessFill() {
  return <div className="absolute bg-[#2f6373] h-[92px] left-0 rounded-[999px] top-0 w-[8px]" data-name="BrightnessFill" />;
}

function BrightnessTrack() {
  return (
    <div className="absolute bg-[#c1c7cd] h-[92px] left-[15px] rounded-[999px] top-[47px] w-[8px]" data-name="BrightnessTrack">
      <BrightnessFill />
    </div>
  );
}

function AutoPill() {
  return <div className="absolute bg-[rgba(255,252,248,0.74)] border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid left-[2px] rounded-[999px] size-[20px] top-0" data-name="AutoPill" />;
}

function AutoBrightnessHitArea() {
  return (
    <div className="absolute h-[20px] left-[7px] top-[153px] w-[24px]" data-name="AutoBrightnessHitArea">
      <AutoPill />
      <div className="-translate-x-1/2 -translate-y-1/2 [word-break:break-word] absolute flex flex-col font-['Inter:Medium',sans-serif] font-medium justify-center leading-[0] left-[12px] not-italic size-[20px] text-[#332c25] text-[13px] text-center top-[10px]">
        <p className="leading-[13px]">A</p>
      </div>
    </div>
  );
}

export default function ScreenAnimatedPhone() {
  return (
    <div className="overflow-clip relative rounded-[24px] size-full" data-name="Screen · Animated · Phone 390×844">
      <div className="absolute h-[844px] left-0 overflow-clip rounded-[34px] top-0 w-[390px]" data-name="StaticActor/ReadingSurface">
        <PaperLayer />
      </div>
      <div className="absolute bg-[rgba(255,250,244,0.98)] h-[53.993px] left-[15px] rounded-[24px] top-[19px] w-[360px]" data-name="StaticActor/TopBar">
        <div aria-hidden className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]" />
        <TopBarBackHitArea />
        <TopBarText />
        <TopBarSourceSwitchHitArea />
        <TopBarMoreHitArea />
      </div>
      <PersistentActorPanelMotionRootTts />
      <div className="absolute bg-[rgba(255,252,248,0.62)] h-[190.894px] left-[327px] opacity-0 rounded-[999px] top-[524px] w-[37.995px]" data-name="OutgoingActor/BrightnessRail">
        <div className="overflow-clip relative rounded-[inherit] size-full">
          <div className="absolute left-[9px] size-[20px] top-[13px]" data-name="Icon/Sun">
            <TablerSunOutline />
          </div>
          <BrightnessTrack />
          <AutoBrightnessHitArea />
        </div>
        <div aria-hidden className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[999px]" />
      </div>
      <div className="absolute bg-[rgba(255,252,248,0.98)] h-[79.03px] left-[25px] opacity-0 rounded-[12px] top-[732px] w-[340.951px]" data-name="OutgoingActor/ModuleNav">
        <div className="cursor-pointer overflow-x-auto overflow-y-clip relative rounded-[inherit] size-full">
          <ReaderModuleButton className="absolute h-[61.988px] left-[8.55px] rounded-[12px] top-[8.55px] w-[77.951px]" />
          <ReaderModuleButton className="absolute h-[61.988px] left-[90.49px] rounded-[12px] top-[8.55px] w-[77.96px]" module="TTS" state="Active" />
          <ReaderModuleButton className="absolute h-[61.988px] left-[172.45px] rounded-[12px] top-[8.55px] w-[77.951px]" module="Appearance" />
          <ReaderModuleButton className="absolute h-[61.988px] left-[254.39px] rounded-[12px] top-[8.55px] w-[77.96px]" module="Settings" />
        </div>
        <div aria-hidden className="absolute border-[0.556px] border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      </div>
    </div>
  );
}