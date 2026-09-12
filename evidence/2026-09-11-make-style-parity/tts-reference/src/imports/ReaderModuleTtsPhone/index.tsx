import svgPaths from "./svg-q5vwwn6j37";

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
    <div className="relative shrink-0" data-name="Paragraph:margin">
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
    <div className="relative shrink-0" data-name="Paragraph:margin">
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
    <div className="relative shrink-0" data-name="Paragraph:margin">
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
    <div className="relative shrink-0" data-name="Paragraph:margin">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[16px] relative size-full">
        <p className="[word-break:break-word] font-['Noto_Serif_SC:Regular',sans-serif] font-normal indent-[36px] leading-[35.28px] relative shrink-0 text-[#2b241d] text-[18px] w-[324px]">他曾经以为自己已经习惯等待，习惯在没有回音的日子里把所有疑问折起来，塞进抽屉最深处。</p>
      </div>
    </div>
  );
}

function ParagraphMargin4() {
  return (
    <div className="relative shrink-0" data-name="Paragraph:margin">
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
      <svg className="absolute block inset-0 size-full" fill="none" height="13.44" preserveAspectRatio="none" viewBox="0 0 13.44 13.44" width="13.44">
        <g clipPath="url(#clip0_0_218)" id="Icon">
          <g id="Vector" />
          <path d="M2.8 6.72H10.64" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d="M2.8 6.72L6.16 10.08" id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d="M2.8 6.72L6.16 3.36" id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
        </g>
        <defs>
          <clipPath id="clip0_0_218">
            <rect fill="white" height="13.44" width="13.44" />
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
      <svg className="absolute block inset-0 size-full" fill="none" height="11.2" preserveAspectRatio="none" viewBox="0 0 11.2 11.2" width="11.2">
        <g clipPath="url(#clip0_0_280)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p573e200} id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d="M4.66667 3.26667H9.33333" id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d={svgPaths.p20ae2b00} id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d="M1.86667 7.93333H6.06667" id="Vector_5" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
        </g>
        <defs>
          <clipPath id="clip0_0_280">
            <rect fill="white" height="11.2" width="11.2" />
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
      <svg className="absolute block inset-0 size-full" fill="none" height="11.2" preserveAspectRatio="none" viewBox="0 0 11.2 11.2" width="11.2">
        <g clipPath="url(#clip0_0_256)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p335ec500} id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d={svgPaths.p34210bf0} id="Vector_3" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d={svgPaths.p93024f0} id="Vector_4" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
        </g>
        <defs>
          <clipPath id="clip0_0_256">
            <rect fill="white" height="11.2" width="11.2" />
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

function Button3() {
  return <div className="absolute bg-[#b9ad9f] h-[4px] left-[134px] rounded-[999px] top-[9px] w-[42px]" data-name="Button - 展开完整控制页" />;
}

function Icon3() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="11.2" preserveAspectRatio="none" viewBox="0 0 11.2 11.2" width="11.2">
        <g clipPath="url(#clip0_0_275)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p38256200} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d={svgPaths.p6c3c500} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d={svgPaths.p25e000} id="Vector_4" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
        </g>
        <defs>
          <clipPath id="clip0_0_275">
            <rect fill="white" height="11.2" width="11.2" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ItalicText() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Italic Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_20px] grid-rows-[_20px] relative size-full">
        <Icon3 />
      </div>
    </div>
  );
}

function BoldText1() {
  return (
    <div className="relative shrink-0" data-name="Bold Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[12px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">播放</p>
      </div>
    </div>
  );
}

function Text1() {
  return (
    <div className="col-1 justify-self-start relative row-1 self-center shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <ItalicText />
        <BoldText1 />
      </div>
    </div>
  );
}

function Icon4() {
  return (
    <div className="absolute h-[16px] left-[6.19px] top-[8px] w-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="8.96" preserveAspectRatio="none" viewBox="0 0 11.2 8.96" width="11.2">
        <g clipPath="url(#clip0_0_272)" id="Icon">
          <g id="Vector" />
          <path d="M7 2.24L4.2 4.48L7 6.72" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.730449" />
        </g>
        <defs>
          <clipPath id="clip0_0_272">
            <rect fill="white" height="8.96" width="11.2" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button4() {
  return (
    <div className="absolute left-0 rounded-[16px] size-[32px] top-0" data-name="Button - 上一句">
      <Icon4 />
    </div>
  );
}

function Text3() {
  return <div className="absolute bg-[#2f6373] left-[36px] rounded-[12px] size-[24px] top-[4px]" data-name="Text" />;
}

function Icon5() {
  return (
    <div className="absolute left-[35.75px] size-[21px] top-[5.5px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="11.76" preserveAspectRatio="none" viewBox="0 0 11.76 11.76" width="11.76">
        <g clipPath="url(#clip0_0_246)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p10ddb200} id="Vector_2" stroke="#FFFAF4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.8575" />
        </g>
        <defs>
          <clipPath id="clip0_0_246">
            <rect fill="white" height="11.76" width="11.76" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text4() {
  return <div className="absolute bg-[#d7473e] left-[69px] rounded-[11px] size-[22px] top-[5px]" data-name="Text" />;
}

function Icon6() {
  return (
    <div className="absolute left-[67px] size-[26px] top-[3px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="14.56" preserveAspectRatio="none" viewBox="0 0 14.56 14.56" width="14.56">
        <g clipPath="url(#clip0_0_223)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p1d7b1a00} id="Vector_2" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.88" strokeWidth="1.06167" />
        </g>
        <defs>
          <clipPath id="clip0_0_223">
            <rect fill="white" height="14.56" width="14.56" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Icon7() {
  return (
    <div className="absolute h-[16px] left-[5.8px] top-[8px] w-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="8.96" preserveAspectRatio="none" viewBox="0 0 11.2 8.96" width="11.2">
        <g clipPath="url(#clip0_0_195)" id="Icon">
          <g id="Vector" />
          <path d="M4.2 2.24L7 4.48L4.2 6.72" id="Vector_2" stroke="#332C25" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.730449" />
        </g>
        <defs>
          <clipPath id="clip0_0_195">
            <rect fill="white" height="8.96" width="11.2" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button5() {
  return (
    <div className="absolute left-[96px] rounded-[16px] size-[32px] top-0" data-name="Button - 下一句">
      <Icon7 />
    </div>
  );
}

function Text2() {
  return (
    <div className="col-2 h-[32px] justify-self-center relative row-1 self-center shrink-0 w-[128px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Button4 />
        <Text3 />
        <Icon5 />
        <Text4 />
        <Icon6 />
        <Button5 />
      </div>
    </div>
  );
}

function Section2() {
  return (
    <div className="h-[66px] min-h-[66px] relative rounded-[6px] shrink-0 w-[264px]" data-name="Section - 播放控制">
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[8px] gap-y-[8px] grid grid-cols-[__106px_128px] grid-rows-[_64px] min-h-[inherit] px-[11px] py-px relative size-full">
        <Text1 />
        <Text2 />
      </div>
    </div>
  );
}

function Icon8() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="11.2" preserveAspectRatio="none" viewBox="0 0 11.2 11.2" width="11.2">
        <g clipPath="url(#clip0_0_209)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.pa5c3540} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d="M5.6 3.26667V5.6L7 7" id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
        </g>
        <defs>
          <clipPath id="clip0_0_209">
            <rect fill="white" height="11.2" width="11.2" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ItalicText1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Italic Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_20px] grid-rows-[_20px] relative size-full">
        <Icon8 />
      </div>
    </div>
  );
}

function BoldText2() {
  return (
    <div className="relative shrink-0" data-name="Bold Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[12px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">定时</p>
      </div>
    </div>
  );
}

function Text5() {
  return (
    <div className="col-1 justify-self-stretch relative row-1 self-center shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <ItalicText1 />
        <BoldText2 />
      </div>
    </div>
  );
}

function Dropdown() {
  return (
    <div className="absolute bg-[rgba(255,248,239,0.78)] h-[30px] left-[167px] min-h-[30px] rounded-[6px] top-[6px] w-[86px]" data-name="Dropdown - 朗读定时">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] absolute font-['Inter:Bold',sans-serif] font-bold leading-[normal] left-[10px] not-italic text-[#41484c] text-[12px] top-[7.5px] whitespace-nowrap">15min</p>
        <div className="absolute h-[6px] left-[66px] top-[12px] w-[12px]" style={{ backgroundImage: "linear-gradient(26.56505117707799deg, rgba(0, 0, 0, 0) 50%, rgb(65, 72, 76) 50%), linear-gradient(153.43494882292202deg, rgb(65, 72, 76) 50%, rgba(0, 0, 0, 0) 50%)" }} data-name="TTS Timer Chevron" />
      </div>
      <div aria-hidden className="absolute border border-[#c1c7cd] border-solid inset-0 pointer-events-none rounded-[6px]" />
    </div>
  );
}

function Label() {
  return (
    <div className="h-[42px] min-h-[42px] relative rounded-[6px] shrink-0 w-[264px]" data-name="Label">
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[8px] gap-y-[8px] grid grid-cols-[__148px_86px] grid-rows-[_40px] min-h-[inherit] px-[11px] py-px relative size-full">
        <Text5 />
        <Dropdown />
      </div>
    </div>
  );
}

function Icon9() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="11.2" preserveAspectRatio="none" viewBox="0 0 11.2 11.2" width="11.2">
        <g clipPath="url(#clip0_0_253)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p1769d380} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
        </g>
        <defs>
          <clipPath id="clip0_0_253">
            <rect fill="white" height="11.2" width="11.2" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function ItalicText2() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Italic Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_20px] grid-rows-[_20px] relative size-full">
        <Icon9 />
      </div>
    </div>
  );
}

function BoldText3() {
  return (
    <div className="relative shrink-0" data-name="Bold Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[12px] relative shrink-0 text-[#332c25] text-[12px] whitespace-nowrap">语速</p>
      </div>
    </div>
  );
}

function Text6() {
  return (
    <div className="col-1 justify-self-stretch relative row-1 self-center shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <ItalicText2 />
        <BoldText3 />
      </div>
    </div>
  );
}

function RangeSlider() {
  return <div className="col-2 h-[32px] justify-self-start min-h-[32px] relative row-1 self-center shrink-0 w-[116px]" data-name="Range Slider - 调整朗读语速" />;
}

function Output() {
  return (
    <div className="col-3 h-[12px] justify-self-stretch min-w-[38px] relative row-1 self-center shrink-0" data-name="Output">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-end min-w-[inherit] relative size-full">
        <p className="[word-break:break-word] font-['Inter:Bold',sans-serif] font-bold leading-[12px] not-italic relative shrink-0 text-[#2f6373] text-[12px] text-right whitespace-nowrap">1.0x</p>
      </div>
    </div>
  );
}

function Label1() {
  return (
    <div className="h-[42px] min-h-[42px] relative rounded-[6px] shrink-0 w-[264px]" data-name="Label">
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[6px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[8px] gap-y-[8px] grid grid-cols-[___72px_116px_38px] grid-rows-[_40px] min-h-[inherit] px-[11px] py-px relative size-full">
        <Text6 />
        <RangeSlider />
        <Output />
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="h-[90px] relative shrink-0 w-full" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[6px] items-start relative size-full">
        <Label />
        <Label1 />
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="col-1 h-[164px] justify-self-stretch relative row-1 self-start shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[8px] items-start overflow-clip relative rounded-[inherit] size-full">
        <Section2 />
        <Container2 />
      </div>
    </div>
  );
}

function Section1() {
  return (
    <div className="absolute h-[190px] left-[12px] rounded-[8px] top-[28px] w-[286px]" data-name="Section - 朗读">
      <div aria-hidden className="absolute bg-[rgba(255,252,248,0.62)] inset-0 pointer-events-none rounded-[8px]" />
      <div className="grid grid-cols-[_264px] grid-rows-[_164px] overflow-clip px-[11px] py-[13px] relative rounded-[inherit] size-full">
        <Container1 />
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.68)]" />
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Icon10() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-start shrink-0 size-[20px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="11.2" preserveAspectRatio="none" viewBox="0 0 11.2 11.2" width="11.2">
        <g clipPath="url(#clip0_0_191)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p12a6ea00} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
          <path d={svgPaths.p39ff9040} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.816667" />
        </g>
        <defs>
          <clipPath id="clip0_0_191">
            <rect fill="white" height="11.2" width="11.2" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function BoldText4() {
  return <div className="absolute bg-[#2f6373] h-[92px] left-0 rounded-[999px] top-0 w-[8px]" data-name="Bold Text" />;
}

function Slider() {
  return (
    <div className="bg-[#c1c7cd] col-1 h-[92px] justify-self-center relative rounded-[999px] row-2 self-start shrink-0 w-[8px]" data-name="Slider - 调整亮度">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <BoldText4 />
      </div>
    </div>
  );
}

function Text7() {
  return (
    <div className="absolute left-[2px] pointer-events-none rounded-[10px] size-[20px] top-0" data-name="Text">
      <div aria-hidden className="absolute bg-[rgba(255,252,248,0.74)] bg-clip-padding border-0 border-[transparent] border-solid inset-0 rounded-[10px]" />
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 rounded-[10px]" />
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.76)]" />
    </div>
  );
}

function Button6() {
  return (
    <div className="col-1 h-[20px] justify-self-center relative rounded-[999px] row-3 self-start shrink-0 w-[24px]" data-name="Button - 自动亮度">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_24px] grid-rows-[_20px] relative size-full">
        <p className="[word-break:break-word] col-1 font-['Inter:Medium',sans-serif] font-medium justify-self-center leading-[13px] not-italic relative row-1 self-center shrink-0 text-[#332c25] text-[13px] text-center whitespace-nowrap">A</p>
        <Text7 />
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <div className="absolute bg-[rgba(255,252,248,0.62)] gap-x-[10px] gap-y-[10px] grid grid-cols-[_36px] grid-rows-[___24px_96px_24px] left-[312px] px-px py-[13px] rounded-[999px] top-[28px] w-[38px]" data-name="Sidebar - 亮度控制">
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[999px]" />
      <Icon10 />
      <Slider />
      <Button6 />
    </div>
  );
}

function Container() {
  return (
    <div className="absolute bg-[rgba(255,250,244,0.98)] border border-[rgba(180,166,151,0.34)] border-solid h-[330px] left-[12px] overflow-clip rounded-[24px] top-[494px] w-[364px]" data-name="Container">
      <Button3 />
      <Section1 />
      <Sidebar />
    </div>
  );
}

function Icon11() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[24px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="13.44" preserveAspectRatio="none" viewBox="0 0 13.44 13.44" width="13.44">
        <g clipPath="url(#clip0_0_172)" id="Icon">
          <g id="Vector" />
          <path d="M5.04 3.36H11.2" id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d="M5.04 6.72H11.2" id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d="M5.04 10.08H11.2" id="Vector_4" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d="M2.8 3.36V3.3656" id="Vector_5" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d="M2.8 6.72V6.7256" id="Vector_6" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d="M2.8 10.08V10.0856" id="Vector_7" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
        </g>
        <defs>
          <clipPath id="clip0_0_172">
            <rect fill="white" height="13.44" width="13.44" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text8() {
  return (
    <div className="bg-[rgba(47,99,115,0.08)] col-1 justify-self-center relative rounded-[21px] row-1 self-center shrink-0 size-[42px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_42px] grid-rows-[_42px] relative size-full">
        <Icon11 />
      </div>
    </div>
  );
}

function Small1() {
  return (
    <div className="col-1 h-[14px] justify-self-center relative row-2 self-center shrink-0 w-[20px]" data-name="Small">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#4d463f] text-[10px] text-center whitespace-nowrap">目录</p>
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="col-1 justify-self-stretch relative rounded-[12px] row-1 self-stretch shrink-0" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[4px] gap-y-[4px] grid grid-cols-[_77.50px] grid-rows-[__42px_16px] overflow-clip relative rounded-[inherit] size-full">
        <Text8 />
        <Small1 />
      </div>
    </div>
  );
}

function Icon12() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[24px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="13.44" preserveAspectRatio="none" viewBox="0 0 13.44 13.44" width="13.44">
        <g clipPath="url(#clip0_0_241)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.pa1fa200} id="Vector_2" stroke="#FFFAF4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d={svgPaths.p12c37400} id="Vector_3" stroke="#FFFAF4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d={svgPaths.p50e4000} id="Vector_4" stroke="#FFFAF4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
        </g>
        <defs>
          <clipPath id="clip0_0_241">
            <rect fill="white" height="13.44" width="13.44" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text9() {
  return (
    <div className="bg-[#2f6373] col-1 justify-self-center relative rounded-[21px] row-1 self-center shrink-0 size-[42px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_42px] grid-rows-[_42px] relative size-full">
        <Icon12 />
      </div>
    </div>
  );
}

function Small2() {
  return (
    <div className="col-1 h-[14px] justify-self-center relative row-2 self-center shrink-0 w-[20px]" data-name="Small">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#2f6373] text-[10px] text-center whitespace-nowrap">朗读</p>
      </div>
    </div>
  );
}

function Button8() {
  return (
    <div className="col-2 justify-self-stretch relative rounded-[12px] row-1 self-stretch shrink-0" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[4px] gap-y-[4px] grid grid-cols-[_77.50px] grid-rows-[__42px_16px] overflow-clip relative rounded-[inherit] size-full">
        <Text9 />
        <Small2 />
      </div>
    </div>
  );
}

function Icon13() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[24px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="13.44" preserveAspectRatio="none" viewBox="0 0 13.44 13.44" width="13.44">
        <g clipPath="url(#clip0_0_231)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p1cafd0f0} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d={svgPaths.p31505900} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d={svgPaths.p11c4bd80} id="Vector_4" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d={svgPaths.p2395c200} id="Vector_5" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
        </g>
        <defs>
          <clipPath id="clip0_0_231">
            <rect fill="white" height="13.44" width="13.44" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text10() {
  return (
    <div className="bg-[rgba(47,99,115,0.08)] col-1 justify-self-center relative rounded-[21px] row-1 self-center shrink-0 size-[42px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_42px] grid-rows-[_42px] relative size-full">
        <Icon13 />
      </div>
    </div>
  );
}

function Small3() {
  return (
    <div className="col-1 h-[14px] justify-self-center relative row-2 self-center shrink-0 w-[20px]" data-name="Small">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#4d463f] text-[10px] text-center whitespace-nowrap">界面</p>
      </div>
    </div>
  );
}

function Button9() {
  return (
    <div className="col-3 justify-self-stretch relative rounded-[12px] row-1 self-stretch shrink-0" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[4px] gap-y-[4px] grid grid-cols-[_77.50px] grid-rows-[__42px_16px] overflow-clip relative rounded-[inherit] size-full">
        <Text10 />
        <Small3 />
      </div>
    </div>
  );
}

function Icon14() {
  return (
    <div className="col-1 justify-self-center relative row-1 self-center shrink-0 size-[24px]" data-name="Icon">
      <svg className="absolute block inset-0 size-full" fill="none" height="13.44" preserveAspectRatio="none" viewBox="0 0 13.44 13.44" width="13.44">
        <g clipPath="url(#clip0_0_265)" id="Icon">
          <g id="Vector" />
          <path d={svgPaths.p2ca5d430} id="Vector_2" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
          <path d={svgPaths.p24dbd4c0} id="Vector_3" stroke="#2F6373" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.98" />
        </g>
        <defs>
          <clipPath id="clip0_0_265">
            <rect fill="white" height="13.44" width="13.44" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text11() {
  return (
    <div className="bg-[rgba(47,99,115,0.08)] col-1 justify-self-center relative rounded-[21px] row-1 self-center shrink-0 size-[42px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid grid grid-cols-[_42px] grid-rows-[_42px] relative size-full">
        <Icon14 />
      </div>
    </div>
  );
}

function Small4() {
  return (
    <div className="col-1 h-[14px] justify-self-center relative row-2 self-center shrink-0 w-[20px]" data-name="Small">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center overflow-clip relative rounded-[inherit] size-full">
        <p className="[word-break:break-word] font-['Noto_Sans_SC:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#4d463f] text-[10px] text-center whitespace-nowrap">设置</p>
      </div>
    </div>
  );
}

function Button10() {
  return (
    <div className="col-4 justify-self-stretch relative rounded-[12px] row-1 self-stretch shrink-0" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid gap-x-[4px] gap-y-[4px] grid grid-cols-[_77.50px] grid-rows-[__42px_16px] overflow-clip relative rounded-[inherit] size-full">
        <Text11 />
        <Small4 />
      </div>
    </div>
  );
}

function Navigation() {
  return (
    <div className="absolute bg-[rgba(255,252,248,0.98)] gap-x-[4px] gap-y-[4px] grid-cols-[____77.50px_77.50px_77.50px_77.50px] grid-rows-[_62px] inline-grid left-[24px] min-h-[78px] p-[9px] rounded-[12px] top-[730px]" data-name="Navigation - 阅读模块导航">
      <div aria-hidden className="absolute border border-[rgba(180,166,151,0.34)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Button7 />
      <Button8 />
      <Button9 />
      <Button10 />
    </div>
  );
}

function MainContentReadAloud() {
  return (
    <div className="absolute bg-gradient-to-b border border-[#c1c7cd] border-solid from-[#fff9f2] h-[844px] left-0 overflow-clip rounded-[34px] to-[#f6ebdf] top-0 via-[#fbf1e7] via-[72%] w-[390px]" data-name="Main Content - 朗读（Read Aloud）">
      <Article />
      <Section />
      <Container />
      <Navigation />
    </div>
  );
}

export default function ReaderModuleTtsPhone() {
  return (
    <div className="relative size-full" data-name="Reader Module TTS / Phone">
      <MainContentReadAloud />
    </div>
  );
}