import svgPaths from "./svg-4to9k6ykzj";

function ReaderMakeTtsSwitchOff({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[rgba(180,166,151,0.3)] h-[22px] relative rounded-[999px] w-[38px]"} data-name="Reader/MakeTTS/switchOff">
      <div className="absolute left-[2px] size-[18px] top-[2px]" data-name="Thumb">
        <svg className="absolute block inset-0 size-full" fill="none" height="18" preserveAspectRatio="none" viewBox="0 0 18 18" width="18">
          <circle cx="9" cy="9" fill="white" id="Thumb" r="9" />
        </svg>
      </div>
    </div>
  );
}

function ReaderMakeTtsSwitchOn({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[#2f6373] h-[22px] relative rounded-[999px] w-[38px]"} data-name="Reader/MakeTTS/switchOn">
      <div className="absolute left-[18px] size-[18px] top-[2px]" data-name="Thumb">
        <svg className="absolute block inset-0 size-full" fill="none" height="18" preserveAspectRatio="none" viewBox="0 0 18 18" width="18">
          <circle cx="9" cy="9" fill="white" id="Thumb" r="9" />
        </svg>
      </div>
    </div>
  );
}

function ReaderMakeTtsConfig({ className }: { className?: string }) {
  return (
    <div className={className || "h-[270px] relative w-[312px]"} data-name="Reader/MakeTTS/config">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-0 whitespace-nowrap">播放配置</p>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] right-[40px] text-[#857c70] text-[10px] top-px translate-x-full whitespace-nowrap">即时生效</p>
      <div className="absolute bg-[rgba(255,252,248,0.92)] border-[0.5px] border-[rgba(180,166,151,0.22)] border-solid h-[244px] left-0 right-0 rounded-[14px] top-[26px]" data-name="Card">
        <div className="absolute content-stretch flex gap-[10px] h-[52px] items-center left-[13.5px] right-[13.5px] top-[-0.5px]" data-name="音色">
          <p className="[word-break:break-word] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] min-w-px relative text-[#332c25] text-[12px]">音色</p>
          <div className="bg-[rgba(180,166,151,0.12)] content-stretch flex gap-[6px] h-[30px] items-center pl-[4px] pr-[8px] relative rounded-[999px] shrink-0 w-[122px]" data-name="Voice selector">
            <div className="bg-[rgba(47,99,115,0.11)] relative rounded-[999px] shrink-0 size-[22px]" data-name="Voice avatar">
              <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[14px] left-[6px] text-[#2f6373] text-[10px] top-[4px] whitespace-nowrap">女</p>
            </div>
            <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#332c25] text-[11px] whitespace-nowrap">清晰女声</p>
            <div className="relative shrink-0 size-[12px]" data-name="Icon/chevron">
              <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
                <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
                  <g clipPath="url(#clip0_0_659)" id="Tabler/chevron-right/outline">
                    <g id="Vector" />
                    <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#857C70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
                  </g>
                  <defs>
                    <clipPath id="clip0_0_659">
                      <rect fill="white" height="12" width="12" />
                    </clipPath>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(180,166,151,0.26)] h-[0.5px] left-[-0.5px] right-[-0.5px] top-[51.5px]" data-name="Divider" />
        <div className="absolute content-stretch flex gap-[10px] h-[48px] items-center left-[13.5px] right-[13.5px] top-[51.5px]" data-name="跟随高亮">
          <p className="[word-break:break-word] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] min-w-px relative text-[#332c25] text-[12px]">跟随高亮</p>
          <ReaderMakeTtsSwitchOn className="bg-[#2f6373] h-[22px] relative rounded-[999px] shrink-0 w-[38px]" />
        </div>
        <div className="absolute bg-[rgba(180,166,151,0.26)] h-[0.5px] left-[-0.5px] right-[-0.5px] top-[99.5px]" data-name="Divider" />
        <div className="absolute content-stretch flex gap-[10px] h-[48px] items-center left-[13.5px] right-[13.5px] top-[99.5px]" data-name="来电自动暂停">
          <p className="[word-break:break-word] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] min-w-px relative text-[#332c25] text-[12px]">来电自动暂停</p>
          <ReaderMakeTtsSwitchOn className="bg-[#2f6373] h-[22px] relative rounded-[999px] shrink-0 w-[38px]" />
        </div>
        <div className="absolute bg-[rgba(180,166,151,0.26)] h-[0.5px] left-[-0.5px] right-[-0.5px] top-[147.5px]" data-name="Divider" />
        <div className="absolute content-stretch flex gap-[10px] h-[48px] items-center left-[13.5px] right-[13.5px] top-[147.5px]" data-name="后台播放">
          <p className="[word-break:break-word] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] min-w-px relative text-[#332c25] text-[12px]">后台播放</p>
          <ReaderMakeTtsSwitchOn className="bg-[#2f6373] h-[22px] relative rounded-[999px] shrink-0 w-[38px]" />
        </div>
        <div className="absolute bg-[rgba(180,166,151,0.26)] h-[0.5px] left-[-0.5px] right-[-0.5px] top-[195.5px]" data-name="Divider" />
        <div className="absolute content-stretch flex gap-[10px] h-[48px] items-center left-[13.5px] right-[13.5px] top-[195.5px]" data-name="朗读时屏幕常亮">
          <p className="[word-break:break-word] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] min-w-px relative text-[#332c25] text-[12px]">朗读时屏幕常亮</p>
          <ReaderMakeTtsSwitchOff className="bg-[rgba(180,166,151,0.3)] h-[22px] relative rounded-[999px] shrink-0 w-[38px]" />
        </div>
      </div>
    </div>
  );
}

function ReaderMakeTtsEngine({ className }: { className?: string }) {
  return (
    <div className={className || "h-[238px] relative w-[312px]"} data-name="Reader/MakeTTS/engine">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-0 whitespace-nowrap">朗读引擎</p>
      <div className="absolute bg-[rgba(255,252,248,0.92)] border-[0.5px] border-[rgba(180,166,151,0.22)] border-solid h-[212px] left-0 right-0 rounded-[14px] top-[26px]" data-name="Card">
        <div className="absolute content-stretch flex gap-[10px] h-[87px] items-center left-[13.5px] right-[13.5px] top-[13.5px]" data-name="Engine options">
          <div className="bg-[rgba(47,99,115,0.11)] flex-[1_0_0] h-[87px] min-w-px relative rounded-[10px]" data-name="系统 TTS">
            <div aria-hidden className="absolute border-[#2f6373] border-[1.2px] border-solid inset-0 pointer-events-none rounded-[10px]" />
            <div className="absolute left-[12px] size-[18px] top-[13px]" data-name="Icon/phone">
              <div className="absolute left-0 size-[18px] top-0" data-name="Tabler/phone/outline">
                <svg className="absolute block inset-0 size-full" fill="none" height="18" preserveAspectRatio="none" viewBox="0 0 18 18" width="18">
                  <g clipPath="url(#clip0_0_647)" id="Tabler/phone/outline">
                    <g id="Vector" />
                    <path d={svgPaths.p162ded00} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3125" />
                  </g>
                  <defs>
                    <clipPath id="clip0_0_647">
                      <rect fill="white" height="18" width="18" />
                    </clipPath>
                  </defs>
                </svg>
              </div>
            </div>
            <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-[12px] text-[#332c25] text-[12px] top-[42px] whitespace-nowrap">系统 TTS</p>
            <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] left-[12px] text-[#857c70] text-[10px] top-[63px] whitespace-nowrap">设备内置语音</p>
            <div className="absolute right-[12px] size-[16px] top-[14px]" data-name="Selected">
              <svg className="absolute block inset-0 size-full" fill="none" height="16" preserveAspectRatio="none" viewBox="0 0 16 16" width="16">
                <circle cx="8" cy="8" fill="#2F6373" id="Selected" r="8" />
              </svg>
            </div>
            <p className="[word-break:break-word] absolute font-['Inter:Bold',sans-serif] font-bold leading-[14px] not-italic right-[24px] text-[10px] text-white top-[14px] translate-x-full whitespace-nowrap">✓</p>
          </div>
          <div className="bg-[rgba(255,252,248,0.72)] flex-[1_0_0] h-[87px] min-w-px relative rounded-[10px]" data-name="在线 TTS">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[10px]" />
            <div className="absolute left-[12px] size-[18px] top-[13px]" data-name="Icon/cloud">
              <div className="absolute left-0 size-[18px] top-0" data-name="Tabler/cloud/outline">
                <svg className="absolute block inset-0 size-full" fill="none" height="18" preserveAspectRatio="none" viewBox="0 0 18 18" width="18">
                  <g clipPath="url(#clip0_0_686)" id="Tabler/cloud/outline">
                    <g id="Vector" />
                    <path d={svgPaths.p345b5490} id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3125" />
                  </g>
                  <defs>
                    <clipPath id="clip0_0_686">
                      <rect fill="white" height="18" width="18" />
                    </clipPath>
                  </defs>
                </svg>
              </div>
            </div>
            <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-[12px] text-[#332c25] text-[12px] top-[42px] whitespace-nowrap">在线 TTS</p>
            <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] left-[12px] text-[#857c70] text-[10px] top-[63px] whitespace-nowrap">第三方语音服务</p>
          </div>
        </div>
        <div className="absolute bg-[rgba(180,166,151,0.26)] h-[0.5px] left-[-0.5px] right-[-0.5px] top-[115.5px]" data-name="Divider" />
        <div className="absolute content-stretch flex gap-[10px] h-[48px] items-center left-[13.5px] right-[13.5px] top-[115.5px]" data-name="语音引擎">
          <p className="[word-break:break-word] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] min-w-px relative text-[#332c25] text-[12px]">语音引擎</p>
          <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#332c25] text-[11px] whitespace-nowrap">系统默认</p>
          <div className="relative shrink-0 size-[12px]" data-name="Icon/chevron">
            <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
              <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
                <g clipPath="url(#clip0_0_659)" id="Tabler/chevron-right/outline">
                  <g id="Vector" />
                  <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#857C70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
                </g>
                <defs>
                  <clipPath id="clip0_0_659">
                    <rect fill="white" height="12" width="12" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(180,166,151,0.26)] h-[0.5px] left-[-0.5px] right-[-0.5px] top-[163.5px]" data-name="Divider" />
        <div className="absolute content-stretch flex gap-[10px] h-[48px] items-center left-[13.5px] right-[13.5px] top-[163.5px]" data-name="朗读语言">
          <p className="[word-break:break-word] flex-[1_0_0] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] min-w-px relative text-[#332c25] text-[12px]">朗读语言</p>
          <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[15px] relative shrink-0 text-[#332c25] text-[11px] whitespace-nowrap">中文（简体）</p>
          <div className="relative shrink-0 size-[12px]" data-name="Icon/chevron">
            <div className="absolute left-0 size-[12px] top-0" data-name="Tabler/chevron-right/outline">
              <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
                <g clipPath="url(#clip0_0_659)" id="Tabler/chevron-right/outline">
                  <g id="Vector" />
                  <path d="M4.5 3L7.5 6L4.5 9" id="Vector_2" stroke="#857C70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.875" />
                </g>
                <defs>
                  <clipPath id="clip0_0_659">
                    <rect fill="white" height="12" width="12" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReaderMakeTtsSelected({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[#2f6373] drop-shadow-[0px_3px_4px_rgba(47,99,115,0.2)] h-[36px] relative rounded-[9px] w-[89.33px]"} data-name="Reader/MakeTTS/selected">
      <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center relative size-full">
          <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[17px] relative shrink-0 text-[12px] text-white whitespace-nowrap">不开启</p>
        </div>
      </div>
    </div>
  );
}

function ReaderMakeTtsTimer({ className }: { className?: string }) {
  return (
    <div className={className || "h-[194px] relative w-[312px]"} data-name="Reader/MakeTTS/timer">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-0 whitespace-nowrap">定时停止</p>
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] right-[30px] text-[#857c70] text-[10px] top-px translate-x-full whitespace-nowrap">未设置</p>
      <div className="absolute bg-[rgba(255,252,248,0.92)] border-[0.5px] border-[rgba(180,166,151,0.22)] border-solid h-[168px] left-0 right-0 rounded-[14px] top-[26px]" data-name="Card">
        <div className="absolute content-stretch flex gap-[8px] h-[36px] items-center left-[13.5px] right-[13.5px] top-[13.5px]" data-name="Timer presets 0">
          <ReaderMakeTtsSelected className="bg-[#2f6373] drop-shadow-[0px_3px_4px_rgba(47,99,115,0.2)] flex-[1_0_0] h-[36px] min-w-px relative rounded-[9px]" />
          <div className="bg-[rgba(180,166,151,0.12)] flex-[1_0_0] h-[36px] min-w-px relative rounded-[9px]" data-name="15 分钟">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[17px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">15 分钟</p>
              </div>
            </div>
          </div>
          <div className="bg-[rgba(180,166,151,0.12)] flex-[1_0_0] h-[36px] min-w-px relative rounded-[9px]" data-name="30 分钟">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[17px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">30 分钟</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute content-stretch flex gap-[8px] h-[36px] items-center left-[13.5px] right-[13.5px] top-[57.5px]" data-name="Timer presets 1">
          <div className="bg-[rgba(180,166,151,0.12)] flex-[1_0_0] h-[36px] min-w-px relative rounded-[9px]" data-name="45 分钟">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[17px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">45 分钟</p>
              </div>
            </div>
          </div>
          <div className="bg-[rgba(180,166,151,0.12)] flex-[1_0_0] h-[36px] min-w-px relative rounded-[9px]" data-name="60 分钟">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[17px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">60 分钟</p>
              </div>
            </div>
          </div>
          <div className="bg-[rgba(180,166,151,0.12)] flex-[1_0_0] h-[36px] min-w-px relative rounded-[9px]" data-name="本章结束">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[17px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">本章结束</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute content-stretch flex gap-[8px] h-[48px] items-center left-[13.5px] pl-[12px] pr-[8px] right-[13.5px] rounded-[9px] top-[105.5px]" data-name="自定义时长">
          <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
          <div className="[word-break:break-word] flex-[1_0_0] h-[34px] min-w-px relative whitespace-nowrap" data-name="Label">
            <p className="absolute font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[17px] left-0 text-[#332c25] text-[12px] top-0">自定义时长</p>
            <p className="absolute font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[13px] left-0 text-[#857c70] text-[9px] top-[20px]">1 – 180 分钟</p>
          </div>
          <div className="bg-[rgba(47,99,115,0.11)] relative rounded-[999px] shrink-0 size-[30px]" data-name="减少时长">
            <div className="absolute left-[8px] size-[14px] top-[8px]" data-name="Icon/minus">
              <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
                <g id="Icon/minus">
                  <g id="Vector">
                    <path d="M3 7H11Z" fill="#2F6373" />
                    <path d="M3 7H11" stroke="#2F6373" strokeLinecap="round" strokeWidth="1.6" />
                  </g>
                </g>
              </svg>
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex gap-[2px] h-[30px] items-center justify-center relative shrink-0 w-[48px] whitespace-nowrap" data-name="Minutes">
            <p className="font-['Inter:Bold',sans-serif] font-bold leading-[22px] not-italic relative shrink-0 text-[#332c25] text-[16px]">25</p>
            <p className="font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] relative shrink-0 text-[#857c70] text-[10px]">分</p>
          </div>
          <div className="bg-[rgba(47,99,115,0.11)] relative rounded-[999px] shrink-0 size-[30px]" data-name="增加时长">
            <div className="absolute left-[8px] size-[14px] top-[8px]" data-name="Icon/plus">
              <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
                <g id="Icon/plus">
                  <g id="Vector">
                    <path d="M3 7H11Z" fill="#2F6373" />
                    <path d="M3 7H11" stroke="#2F6373" strokeLinecap="round" strokeWidth="1.6" />
                  </g>
                  <g id="Vector_2">
                    <path d="M7 3V11Z" fill="#2F6373" />
                    <path d="M7 3V11" stroke="#2F6373" strokeLinecap="round" strokeWidth="1.6" />
                  </g>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-[33px] size-[11px] top-[2px]" data-name="Icon/clock">
        <div className="absolute left-0 size-[11px] top-0" data-name="Tabler/clock/outline">
          <svg className="absolute block inset-0 size-full" fill="none" height="11" preserveAspectRatio="none" viewBox="0 0 11 11" width="11">
            <g clipPath="url(#clip0_0_651)" id="Tabler/clock/outline">
              <g id="Vector" />
              <path d={svgPaths.p24b90800} id="Vector_2" stroke="#857C70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.802083" />
              <path d="M5.5 3.20833V5.5L6.875 6.875" id="Vector_3" stroke="#857C70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.802083" />
            </g>
            <defs>
              <clipPath id="clip0_0_651">
                <rect fill="white" height="11" width="11" />
              </clipPath>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}

function ReaderMakeTtsSpeed({ className }: { className?: string }) {
  return (
    <div className={className || "h-[147.5px] relative w-[312px]"} data-name="Reader/MakeTTS/speed">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-0 whitespace-nowrap">语速</p>
      <p className="[word-break:break-word] absolute font-['Inter:Bold',sans-serif] font-bold leading-[17px] not-italic right-[42px] text-[#2f6373] text-[12px] top-0 translate-x-full whitespace-nowrap">1.0 x</p>
      <div className="absolute bg-[rgba(255,252,248,0.92)] border-[0.5px] border-[rgba(180,166,151,0.22)] border-solid h-[121.5px] left-0 right-0 rounded-[14px] top-[26px]" data-name="Card">
        <p className="[word-break:break-word] absolute font-['Inter:Regular',sans-serif] font-normal leading-[13px] left-[15.5px] not-italic text-[#857c70] text-[9px] top-[45.5px] whitespace-nowrap">0.5x</p>
        <p className="[word-break:break-word] absolute font-['Inter:Regular',sans-serif] font-normal leading-[13px] not-italic right-[38.5px] text-[#857c70] text-[9px] top-[45.5px] translate-x-full whitespace-nowrap">2.0x</p>
        <div className="absolute content-stretch flex gap-[8px] h-[32px] items-center left-[15.5px] right-[15.5px] top-[73px]" data-name="Speed presets">
          <div className="bg-[rgba(180,166,151,0.12)] h-[32px] relative rounded-[9px] shrink-0 w-[49px]" data-name="0.75x">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Inter:Regular',sans-serif] font-normal leading-[17px] not-italic relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">0.75x</p>
              </div>
            </div>
          </div>
          <div className="bg-[#2f6373] drop-shadow-[0px_3px_4px_rgba(47,99,115,0.2)] h-[32px] relative rounded-[9px] shrink-0 w-[49px]" data-name="1.0x">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Inter:Regular',sans-serif] font-normal leading-[17px] not-italic relative shrink-0 text-[12px] text-white whitespace-nowrap">1.0x</p>
              </div>
            </div>
          </div>
          <div className="bg-[rgba(180,166,151,0.12)] h-[32px] relative rounded-[9px] shrink-0 w-[54px]" data-name="1.25x">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Inter:Regular',sans-serif] font-normal leading-[17px] not-italic relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">1.25x</p>
              </div>
            </div>
          </div>
          <div className="bg-[rgba(180,166,151,0.12)] h-[32px] relative rounded-[9px] shrink-0 w-[49px]" data-name="1.5x">
            <div aria-hidden className="absolute border-[0.5px] border-[rgba(180,166,151,0.28)] border-solid inset-0 pointer-events-none rounded-[9px]" />
            <div className="flex flex-row items-center justify-center size-full">
              <div className="content-stretch flex items-center justify-center relative size-full">
                <p className="[word-break:break-word] font-['Inter:Regular',sans-serif] font-normal leading-[17px] not-italic relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">1.5x</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bg-[rgba(180,166,151,0.28)] content-stretch flex h-[6px] items-center left-[15.5px] right-[15.5px] rounded-[999px] top-[23.5px]" data-name="SpeedSlider">
          <div className="bg-[#2f6373] flex-[1_0_0] h-[6px] min-w-px relative rounded-[999px]" data-name="Range third 0">
            <div className="-translate-y-1/2 absolute right-[-10px] size-[20px] top-1/2" data-name="SpeedThumb">
              <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
                <circle cx="10" cy="10" fill="#FFFCF8" id="SpeedThumb" r="9.25" stroke="#2F6373" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
          <div className="flex-[1_0_0] h-[6px] min-w-px relative rounded-[999px]" data-name="Range third 1" />
          <div className="flex-[1_0_0] h-[6px] min-w-px relative rounded-[999px]" data-name="Range third 2" />
        </div>
      </div>
    </div>
  );
}

function ReaderMakeTtsPlayback({ className }: { className?: string }) {
  return (
    <div className={className || "h-[198px] relative w-[312px]"} data-name="Reader/MakeTTS/playback">
      <p className="[word-break:break-word] absolute font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[17px] left-0 text-[#332c25] text-[12px] top-0 whitespace-nowrap">朗读控制</p>
      <div className="absolute bg-[rgba(47,99,115,0.11)] content-stretch flex gap-[4px] h-[18px] items-center justify-center right-0 rounded-[999px] top-0 w-[62px]" data-name="Playing status">
        <div className="relative shrink-0 size-[4px]" data-name="Status">
          <svg className="absolute block inset-0 size-full" fill="none" height="4" preserveAspectRatio="none" viewBox="0 0 4 4" width="4">
            <circle cx="2" cy="2" fill="#2F6373" id="Status" r="2" />
          </svg>
        </div>
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Regular',sans-serif] font-normal leading-[14px] relative shrink-0 text-[#2f6373] text-[10px] whitespace-nowrap">朗读中</p>
      </div>
      <div className="absolute bg-[rgba(255,252,248,0.92)] border-[0.5px] border-[rgba(180,166,151,0.22)] border-solid h-[171px] left-0 right-0 rounded-[14px] top-[27px]" data-name="Card">
        <div className="absolute content-stretch flex gap-[9.55px] h-[28px] items-center justify-center left-[15.5px] right-[15.5px] top-[15.5px]" data-name="Waveform">
          <div className="bg-[rgba(47,99,115,0.65)] h-[3.14px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 1" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[6.02px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 2" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[3.6px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 3" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[17.03px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 4" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[8.72px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 5" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[8.89px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 6" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[9.74px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 7" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[4.36px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 8" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[15.13px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 9" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[12.62px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 10" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[4.2px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 11" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[15.27px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 12" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[6.24px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 13" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[12.03px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 14" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[13.56px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 15" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[7.14px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 16" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[17.37px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 17" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[9.28px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 18" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[8.53px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 19" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[11.27px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 20" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[14.69px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 21" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[9.2px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 22" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[14.72px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 23" />
          <div className="bg-[rgba(47,99,115,0.65)] h-[4.41px] relative rounded-[1.25px] shrink-0 w-[2.5px]" data-name="Wave 24" />
        </div>
        <div className="-translate-x-1/2 absolute left-[calc(50%-74px)] rounded-[999px] size-[42px] top-[65.5px]" data-name="previous">
          <div className="absolute left-[8px] size-[26px] top-[8px]" data-name="Icon/previous">
            <svg className="absolute block inset-0 size-full" fill="none" height="26" preserveAspectRatio="none" viewBox="0 0 26 26" width="26">
              <g id="Icon/previous">
                <path d="M16 7L10 13L16 19" id="Vector" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
                <path d="M9 7V19" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeWidth="1.9" />
              </g>
            </svg>
          </div>
        </div>
        <div className="-translate-x-1/2 absolute drop-shadow-[0px_5px_8px_rgba(47,99,115,0.42)] left-1/2 rounded-[999px] size-[58px] top-[57.5px]" style={{ backgroundImage: "linear-gradient(155.00075988654982deg, rgb(47, 99, 115) 12.379%, rgb(36, 79, 92) 87.629%)" }} data-name="pause">
          <div className="absolute bg-[#fffcf8] h-[16px] left-[22px] rounded-[1px] top-[21px] w-[4px]" data-name="Pause left" />
          <div className="absolute bg-[#fffcf8] h-[16px] left-[32px] rounded-[1px] top-[21px] w-[4px]" data-name="Pause right" />
        </div>
        <div className="-translate-x-1/2 absolute left-[calc(50%+74px)] rounded-[999px] size-[42px] top-[65.5px]" data-name="next">
          <div className="absolute left-[8px] size-[26px] top-[8px]" data-name="Icon/next">
            <svg className="absolute block inset-0 size-full" fill="none" height="26" preserveAspectRatio="none" viewBox="0 0 26 26" width="26">
              <g id="Icon/next">
                <path d="M10 7L16 13L10 19" id="Vector" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
                <path d="M17 7V19" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeWidth="1.9" />
              </g>
            </svg>
          </div>
        </div>
        <div className="absolute content-stretch flex gap-[7px] h-[21px] items-center left-[15.5px] top-[133.5px] w-[204px]" data-name="Current voice">
          <div className="relative shrink-0 size-[14px]" data-name="Icon/headphones">
            <div className="absolute left-0 size-[14px] top-0" data-name="Tabler/headphones/outline">
              <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
                <g clipPath="url(#clip0_0_672)" id="Tabler/headphones/outline">
                  <g id="Vector" />
                  <path d={svgPaths.p34e42280} id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02083" />
                  <path d={svgPaths.p26383880} id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02083" />
                  <path d={svgPaths.p1bc60280} id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02083" />
                </g>
                <defs>
                  <clipPath id="clip0_0_672">
                    <rect fill="white" height="14" width="14" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
          <p className="[word-break:break-word] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[14px] relative shrink-0 text-[#332c25] text-[10px] whitespace-nowrap">当前音色 · 清晰女声</p>
        </div>
        <div className="absolute bg-[rgba(168,84,58,0.11)] content-stretch flex gap-[5px] h-[21px] items-center justify-center right-[15.5px] rounded-[999px] top-[133.5px] w-[57px]" data-name="停止">
          <div aria-hidden className="absolute border-[0.5px] border-[rgba(168,84,58,0.36)] border-solid inset-0 pointer-events-none rounded-[999px]" />
          <div className="relative shrink-0 size-[8px]" data-name="Icon/stop">
            <svg className="absolute block inset-0 size-full" fill="none" height="8" preserveAspectRatio="none" viewBox="0 0 8 8" width="8">
              <g clipPath="url(#clip0_0_670)" id="Icon/stop">
                <path d={svgPaths.p1117bc00} fill="#A8543A" id="Vector" />
              </g>
              <defs>
                <clipPath id="clip0_0_670">
                  <rect fill="white" height="8" width="8" />
                </clipPath>
              </defs>
            </svg>
          </div>
          <p className="[word-break:break-word] font-['Noto_Sans_SC:Medium',sans-serif] font-medium leading-[14px] relative shrink-0 text-[#a8543a] text-[10px] whitespace-nowrap">停止</p>
        </div>
      </div>
    </div>
  );
}

function ReaderFullTtsContent({ className }: { className?: string }) {
  return (
    <div className={className || "h-[1159.5px] relative w-[338px]"} data-name="Reader/Full/TTSContent">
      <div className="content-stretch flex flex-col gap-[20px] items-start px-[13px] py-[16px] relative size-full">
        <ReaderMakeTtsPlayback className="h-[198px] relative shrink-0 w-full" />
        <ReaderMakeTtsSpeed className="h-[147.5px] relative shrink-0 w-full" />
        <ReaderMakeTtsTimer className="h-[194px] relative shrink-0 w-full" />
        <ReaderMakeTtsEngine className="h-[238px] relative shrink-0 w-full" />
        <ReaderMakeTtsConfig className="h-[270px] relative shrink-0 w-full" />
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="relative shrink-0 w-full" data-name="Heading 1">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Bold',sans-serif] font-bold leading-[28.75px] relative shrink-0 text-[#2b241d] text-[23px] text-center whitespace-nowrap">雨夜</p>
      </div>
    </div>
  );
}

function ParagraphMargin() {
  return (
    <div className="relative shrink-0 w-full" data-name="Paragraph:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[24px] relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal indent-[36px] leading-[0] relative shrink-0 text-[#2b241d] text-[18px] w-[324px]">
          <span className="leading-[35.28px]">雨声在窗外连成一片，像</span>
          <span className="[text-decoration-skip-ink:none] [text-underline-position:from-font] decoration-from-font decoration-solid leading-[35.28px] underline">无数细小的针</span>
          <span className="leading-[35.28px]">，密密地刺在玻璃上，汇成一层朦胧的水幕，将城市的灯光晕成模糊的光团。</span>
        </p>
      </div>
    </div>
  );
}

function ParagraphMargin1() {
  return (
    <div className="relative shrink-0 w-full" data-name="Paragraph:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal indent-[36px] leading-[0] relative shrink-0 text-[#2b241d] text-[18px] w-[324px]">
          <span className="leading-[35.28px]">他站在窗前，手里握着那封被雨水润湿的信。纸页边角微微卷起，字迹却依旧清晰，像某个</span>
          <span className="[text-decoration-skip-ink:none] [text-underline-position:from-font] decoration-from-font decoration-solid leading-[35.28px] underline">迟到许久的答案</span>
          <span className="leading-[35.28px]">终于抵达。</span>
        </p>
      </div>
    </div>
  );
}

function ParagraphMargin2() {
  return (
    <div className="relative shrink-0 w-full" data-name="Paragraph:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal indent-[36px] leading-[0] relative shrink-0 text-[#2b241d] text-[18px] w-[324px]">
          <span className="leading-[35.28px]">这座城市在夜里显得格外安静，街道尽头偶尔有车灯掠过，又很快被雨幕吞没，只留下</span>
          <span className="[text-decoration-skip-ink:none] [text-underline-position:from-font] decoration-from-font decoration-solid leading-[35.28px] underline">短暂而摇晃的光</span>
          <span className="leading-[35.28px]">。</span>
        </p>
      </div>
    </div>
  );
}

function ParagraphMargin3() {
  return (
    <div className="relative shrink-0 w-full" data-name="Paragraph:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal indent-[36px] leading-[35.28px] relative shrink-0 text-[#2b241d] text-[18px] w-[324px]">他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。</p>
      </div>
    </div>
  );
}

function ParagraphMargin4() {
  return (
    <div className="relative shrink-0 w-full" data-name="Paragraph:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal indent-[36px] leading-[35.28px] relative shrink-0 text-[#2b241d] text-[18px] w-[324px]">可真正看到信上那行字时，他才发现那些被压下去的情绪并没有消失，只是一直在暗处积蓄，等着这一刻重新涌上来。</p>
      </div>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[68px] relative shrink-0 w-[324px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start py-[16px] relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal indent-[36px] leading-[35.28px] relative shrink-0 text-[#2b241d] text-[18px] whitespace-nowrap">远处的灯光像被雾气揉碎，</p>
      </div>
    </div>
  );
}

function Article1() {
  return (
    <div className="absolute content-stretch flex flex-col h-[722px] items-start left-[32px] overflow-clip top-[72px] w-[324px]" data-name="Article - 正文排版层">
      <Heading />
      <ParagraphMargin />
      <ParagraphMargin1 />
      <ParagraphMargin2 />
      <ParagraphMargin3 />
      <ParagraphMargin4 />
      <Paragraph />
    </div>
  );
}

function Article() {
  return (
    <div className="absolute bg-gradient-to-b from-[#fbf4e9] h-[842px] left-0 overflow-clip to-[#efe2d0] top-0 w-[388px]" data-name="Article - 阅读正文">
      <Article1 />
    </div>
  );
}

function Icon() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[24px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="24" preserveAspectRatio="none" viewBox="0 0 24 24" width="24">
        <g clipPath="url(#clip0_0_708)" id="Icon">
          <g id="Vector" />
          <path d="M5 12H19" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
          <path d="M5 12L11 18" id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
          <path d="M5 12L11 6" id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
        </g>
        <defs>
          <clipPath id="clip0_0_708">
            <rect fill="white" height="24" width="24" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="col-1 justify-self-stretch min-h-[42px] relative row-1 self-center shrink-0" data-name="Button - 返回">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_44px] grid-rows-[_42px] min-h-[inherit] relative size-full">
        <Icon />
      </div>
    </div>
  );
}

function BoldText() {
  return (
    <div className="col-1 justify-self-stretch relative row-1 self-stretch shrink-0" data-name="Bold Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#332c25] text-[16px] whitespace-nowrap">长夜余火</p>
      </div>
    </div>
  );
}

function Small() {
  return (
    <div className="col-1 justify-self-stretch relative row-2 self-stretch shrink-0" data-name="Small">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#5b5046] text-[12px] whitespace-nowrap">第 32 章 雨夜 · 优书网</p>
      </div>
    </div>
  );
}

function Text() {
  return (
    <div className="col-2 h-[45px] justify-self-stretch relative row-1 self-center shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[6px] gap-y-[6px] grid grid-cols-[_170px] grid-rows-[__22px_17px] overflow-clip relative rounded-[inherit] size-full">
        <BoldText />
        <Small />
      </div>
    </div>
  );
}

function Icon1() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_689)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p35177c00} id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M8.33333 5.83333H16.6667" id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.pd8c5e80} id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d="M3.33333 14.1667H10.8333" id="Vector_5" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_689">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="col-3 justify-self-stretch min-h-[42px] relative row-1 self-center shrink-0" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_62px] grid-rows-[__22.50px_19.50px] min-h-[inherit] relative size-full">
        <Icon1 />
        <p className="[word-break:break-word] col-1 font-['Noto_Sans_SC:Bold',sans-serif] font-bold justify-self-center leading-[normal] relative row-2 self-center shrink-0 text-[#332c25] text-[12px] text-center whitespace-nowrap">换源</p>
      </div>
    </div>
  );
}

function Icon2() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_700)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p22400} id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.pcf5d040} id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.pf50e500} id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_700">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button2() {
  return (
    <div className="col-4 justify-self-stretch min-h-[42px] relative row-1 self-center shrink-0" data-name="Button - 更多">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_34px] grid-rows-[_42px] min-h-[inherit] relative size-full">
        <Icon2 />
      </div>
    </div>
  );
}

function Section() {
  return (
    <div className="absolute bg-[rgba(255,250,244,0.98)] gap-x-[8px] gap-y-[8px] grid-cols-[____44px_170px_62px_34px] grid-rows-[_52px] inline-grid left-[14px] min-h-[54px] px-[13px] py-px rounded-[24px] top-[18px]" data-name="Section">
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]" />
      <Button />
      <Text />
      <Button1 />
      <Button2 />
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="20" preserveAspectRatio="none" viewBox="0 0 20 20" width="20">
        <g clipPath="url(#clip0_0_695)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.pa574f00} id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.p1bd03600} id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
          <path d={svgPaths.p1521b098} id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.45833" />
        </g>
        <defs>
          <clipPath id="clip0_0_695">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function BoldText1() {
  return (
    <div className="h-[17px] relative shrink-0 w-[28px]" data-name="Bold Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[16.8px] relative shrink-0 text-[#332c25] text-[14px] whitespace-nowrap">朗读</p>
      </div>
    </div>
  );
}

function Text1() {
  return (
    <div className="col-1 justify-self-stretch relative row-1 self-center shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Icon3 />
        <BoldText1 />
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[rgba(238,230,219,0.64)] col-2 h-[26px] justify-self-stretch min-h-[26px] relative rounded-[8px] row-1 self-center shrink-0" data-name="Button">
      <div className="flex flex-col items-center justify-center min-h-[inherit] size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center justify-center min-h-[inherit] px-[10px] relative size-full">
          <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#2f6373] text-[10px] text-center whitespace-nowrap">收起</p>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="col-1 justify-self-stretch relative row-1 self-stretch shrink-0" data-name="Header">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[10px] gap-y-[10px] grid grid-cols-[__288px_40px] grid-rows-[_30px] relative size-full">
        <Text1 />
        <Button3 />
      </div>
    </div>
  );
}

function Section2() {
  return (
    <div className="h-[666px] relative shrink-0 w-[338px]" data-name="Section - 完整朗读控制">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-x-clip overflow-y-auto relative rounded-[inherit] size-full">
        <ReaderFullTtsContent className="absolute h-[1159.5px] left-0 right-0 top-0" />
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="bg-[rgba(255,252,248,0.62)] col-1 justify-self-stretch relative rounded-[12px] row-2 self-stretch shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip p-px relative rounded-[inherit] size-full">
        <Section2 />
      </div>
      <div aria-hidden className="absolute border border-[rgba(155,132,102,0.18)] border-solid inset-0 pointer-events-none rounded-[12px]" />
    </div>
  );
}

function Button4() {
  return <div className="absolute bg-[#b9ad9f] h-[4px] left-[135px] rounded-[999px] top-[10px] w-[42px]" data-name="Button - 收起到阅读控制层" />;
}

function Section1() {
  return (
    <div className="absolute bg-[rgba(255,250,244,0.98)] gap-x-[8px] gap-y-[8px] grid grid-cols-[_338px] grid-rows-[__30px_666px] left-[12px] pb-[13px] pt-[19px] px-[13px] rounded-[24px] top-[88px] w-[364px]" data-name="Section - 朗读大半屏控制窗">
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[24px]" />
      <Header />
      <Container />
      <Button4 />
    </div>
  );
}

function MainContentExpandedTtsPanel() {
  return (
    <div className="absolute bg-gradient-to-b border border-[#c1c7cd] border-solid from-[#fff9f2] h-[844px] left-0 overflow-clip rounded-[34px] to-[#f6ebdf] top-0 via-[#fbf1e7] via-[72%] w-[390px]" data-name="Main Content - 朗读大半屏控制窗（Expanded TTS Panel）">
      <Article />
      <Section />
      <Section1 />
    </div>
  );
}

export default function PageReaderFullTts() {
  return (
    <div className="relative size-full" data-name="Page/Reader Full TTS">
      <MainContentExpandedTtsPanel />
    </div>
  );
}