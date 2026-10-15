// External review instrument. This is not an application screen or business step.
// Geometry mirrors ReaderControlMotionGeometry.ts:103 and ReaderControlPanel.ets:669/834.
const unit = value => Math.max(0,Math.min(1,Number.isFinite(value) ? value : 0));
const smooth = value => { const t=unit(value); return t*t*(3-2*t); };

function bounds(w,h) {
  const wide=w>=600, topbarTop=19, budgetTop=Math.max(88,topbarTop+62);
  const width=Math.min(wide ? 720 : 364,w-(wide ? 26+14 : 26));
  const fullHeight=Math.min(wide ? 852 : 736,Math.max(0,h-budgetTop-20));
  const bottom=wide ? 33 : 19;
  return {w,h,width,fullHeight,quickHeight:Math.min(wide ? 252 : 330,fullHeight),
    x:wide ? w-14-width : (w-width)/2,y:h-bottom-fullHeight,
    topbarTop,topbarWidth:Math.min(wide ? 702 : 360,w-2*(wide ? 29 : 15))};
}

// No easing is applied inside this spatial sampler. One production p owns every actor.
function sample(p,b) {
  p=unit(p);
  const height=b.quickHeight+(b.fullHeight-b.quickHeight)*p;
  const shellY=b.fullHeight-height, inset=Math.min(13,b.width/4);
  const fullW=Math.max(0,b.width-2*inset), quickW=Math.max(0,fullW-52);
  const quickH=Math.min(190,Math.max(0,b.quickHeight-140));
  const fullH=Math.max(0,b.fullHeight-70);
  return {shellY,height,inset,fullW,fullH,
    contentY:shellY+29+28*p,contentW:quickW+(fullW-quickW)*p,contentH:quickH+(fullH-quickH)*p,
    brightnessX:b.width-13.56-38+(38+13.56)*p,
    navY:shellY+height-93+20*p,clarity:smooth(Math.abs(2*p-1))};
}

export function mountMotionPreview(container,{reduceMotion=false}={}) {
  container.innerHTML=`<section class="reading-motion-review" style="font:12px/1.6 system-ui;color:#263d33">
    <p style="margin:8px 0">外部动效评审：目录模块 Quick ↔ Full。线框使用生产几何；WAAPI 提供浏览器时间采样，自动形态曲线使用源码 smoothstep t²(3−2t)。不模拟业务成功。</p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0">
      <button type="button" data-motion="full">播放到 Full</button><button type="button" data-motion="quick">反向到 Quick</button>
      <label>窗口 <select aria-label="动效评审窗口"><option value="phone">390 × 844</option><option value="wide">760 × 960</option></select></label>
      <label style="display:flex;align-items:center;gap:6px">空间 p <input type="range" min="0" max="1" step="0.001" value="0" aria-label="控制层空间进度"></label>
    </div>
    <output style="display:block;white-space:pre-wrap;margin-bottom:10px"></output>
    <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="控制层 Quick 与 Full 几何评审线框" style="display:block;width:min(100%,390px);height:auto;max-height:680px;overflow:visible"></svg>
    <span data-clock style="position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none" aria-hidden="true"></span>
    <p style="color:#68776f">展开名义 320ms，收起 260ms；中途新目标从当前 p 以剩余距离压缩时间。p=0 或1时业务区域可交互，中间帧关闭模块输入。滑条是空间采样探针，不是实际触摸仲裁；抓手阈值8vp、tap&lt;500ms、速度接续与 CANCEL 恢复见动效规范。此处保持 visibility=1，未重演 opening / dismiss。</p>
    <p style="color:#68776f">来源：ReaderLayoutGeometry.ts:309；ReaderControlPanel.ets:669、834；ReaderControlMotionGeometry.ts:103；ReaderControlMotionPolicy.ts:10、55；ProductMotionTiming.ts:2。</p>
  </section>`;
  const root=container.firstElementChild, svg=root.querySelector('svg'), slider=root.querySelector('input'),
    output=root.querySelector('output'), select=root.querySelector('select'), clock=root.querySelector('[data-clock]');
  let p=0,b= bounds(390,844),animation,raf=0,generation=0,destroyed=false;
  const rect=(x,y,w,h,fill,stroke='#a1ada5',radius=8,opacity=1)=>`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" rx="${radius}" fill="${fill}" stroke="${stroke}" opacity="${opacity}"/>`;
  const label=(x,y,text,size=10,opacity=1)=>`<text x="${x}" y="${y}" font-size="${size}" fill="#355449" opacity="${opacity}">${text}</text>`;
  function draw(value) {
    p=unit(value);slider.value=String(p);
    const f=sample(p,b), gy=b.y+f.shellY, headerY=gy+19, contentY=b.y+f.contentY;
    svg.setAttribute('viewBox',`0 0 ${b.w} ${b.h}`);
    svg.style.width=`min(100%,${b.w>=600 ? 560 : 390}px)`;
    const rows=Array.from({length:Math.min(9,Math.floor(Math.max(0,f.contentH-48)/40))},(_,index)=>
      rect(f.inset+10,48+index*40,f.contentW-20,32+8*p,index===2 ? '#dcece0' : '#fffef9','#e1e4dd',6)+label(f.inset+18,67+index*40,`章节 ${index+1} · 同一列表身份`,11)).join('');
    svg.innerHTML=rect(0,0,b.w,b.h,'#f8f4ec','#ccd3cb',0)+label(24,120,'保留阅读正文与位置',16)+
      rect((b.w-b.topbarWidth)/2,b.topbarTop,b.topbarWidth,54,'#faf7ef','#8da194',24)+label((b.w-b.topbarWidth)/2+18,b.topbarTop+33,'Topbar 54 · visibility=1',12)+
      `<g transform="translate(${b.x},${b.y})">`+
      rect(0,f.shellY,b.width,f.height,'#faf7ef','#778d80',24)+
      rect(f.inset,f.shellY+57,f.fullW,f.fullH,'#fffef9','#a1ada5',12,p)+
      rect((b.width-42)/2,f.shellY+9,42,4,'#839289','#839289',2)+
      label(f.inset+24,f.shellY+39,'目录',14,p)+rect(b.width-f.inset-40,f.shellY+21,40,26,'#dcece0','#c4d7c6',8,p)+label(b.width-f.inset-30,f.shellY+38,'收起',10,p)+
      `<svg x="0" y="${f.contentY}" width="${b.width}" height="${f.contentH}" overflow="hidden"><g opacity="${.35+.65*f.clarity}" style="filter:blur(${2*(1-f.clarity)}px)">`+
      rect(f.inset,0,f.contentW,f.contentH,'#fffef9','#a1ada5',8+4*p)+label(f.inset+18,25,'章节      书签',11)+rows+`</g></svg>`+
      rect(f.brightnessX,f.shellY+29,38,190,'#edf2e7','#a1ada5',19,1-p)+label(f.brightnessX+10,f.shellY+55,'☀',14,1-p)+rect(f.brightnessX+15,f.shellY+72,8,104,'#b7cbbb','#b7cbbb',4,1-p)+
      rect(12,f.navY,b.width-24,80,'#edf2e7','#a1ada5',12,1-p)+label(25,f.navY+44,'目录          朗读          界面          设置',11,1-p)+`</g>`;
    output.textContent=`p=${p.toFixed(3)} · ${p===0 ? 'Quick：业务输入启用' : p===1 ? 'Full：业务输入启用；导航/亮度禁用' : 'morph：业务输入禁用'}${reduceMotion ? ' · 减少动态效果：自动直达终态' : ''}\nStage ${b.width}×${b.fullHeight}，x=${b.x}；shell y=${gy.toFixed(2)}，h=${f.height.toFixed(2)}；content ${f.contentW.toFixed(2)}×${f.contentH.toFixed(2)}，screen y=${contentY.toFixed(2)}；header y=${headerY.toFixed(2)}。`;
  }
  function stop() { generation+=1; if(raf) cancelAnimationFrame(raf);raf=0;if(animation) animation.cancel();animation=undefined; }
  function play(target) {
    stop();const from=p,duration=reduceMotion ? 0 : (target>from ? 320 : 260)*Math.abs(target-from);
    if(duration<=0){draw(target);return;}
    const ticket=generation;
    // WAAPI supplies the monotonic playback clock. Source smoothstep is sampled
    // exactly; no custom cubic-bezier solver or independent actor clocks.
    animation=clock.animate([{transform:'translateX(0px)'},{transform:'translateX(1px)'}],{duration,easing:'linear',fill:'both'});
    const tick=()=>{
      if(destroyed||ticket!==generation||!animation)return;
      const t=animation.effect.getComputedTiming().progress??0;
      draw(from+(target-from)*smooth(t));
      if(animation.playState==='finished'){draw(target);animation.cancel();animation=undefined;raf=0;return;}
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
  }
  root.querySelector('[data-motion="full"]').onclick=()=>play(1);
  root.querySelector('[data-motion="quick"]').onclick=()=>play(0);
  slider.oninput=()=>{stop();draw(Number(slider.value));};
  select.onchange=()=>{stop();b=select.value==='wide' ? bounds(760,960) : bounds(390,844);draw(p);};
  draw(0);
  return ()=>{destroyed=true;stop();root.remove();};
}
