// The demo uses the application's actual session, gesture policy and actor sampler.
// DOM measurement/pointer capture are the web adapter; no parallel gesture state machine.
import {
  createReaderControlSessionState, openReaderControlSession, enterReaderControlModule,
  expandReaderControlSession, advanceReaderControlSession, sampleReaderControlSession,
  readerControlTargetLocation,
} from '../../../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import {
  createReaderControlGestureState, beginReaderControlGesture, updateReaderControlGesture,
  endReaderControlGesture, cancelReaderControlGesture,
} from '../../../entry/src/main/ets/features/reading/ReaderControlGestureDriver.ts';
import {
  readerControlMotionBounds, readerControlMotionAxis, sampleReaderControlMotionComposition,
} from '../../../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
import {sampleReaderControlMorphProgress, READER_CONTROL_EXPAND_MS,
  READER_CONTROL_OPEN_MS, READER_CONTROL_DISMISS_MS} from '../../../entry/src/main/ets/features/reading/ReaderControlMotionPolicy.ts';

export function createDemoControlGesture(module, form, bounds, screenTop, reduceMotion=false) {
  let session=openReaderControlSession(createReaderControlSessionState(),0);
  if(module && module!=='home')session=enterReaderControlModule(session,module,0);
  if(form==='full')session=expandReaderControlSession(session,0);
  return {session,gesture:createReaderControlGestureState({
    axis:readerControlMotionAxis(bounds,screenTop),tapMaxDurationMs:500,directionSlopVp:8,
    settleDurationMs:reduceMotion?0:READER_CONTROL_EXPAND_MS,
    showDurationMs:reduceMotion?0:READER_CONTROL_OPEN_MS,
    dismissDurationMs:reduceMotion?0:READER_CONTROL_DISMISS_MS,coordinatedMotion:true,
  }),bounds};
}
export function updateDemoControlGesture(controller, type, pointerId, y, time) {
  const result=type==='down'?beginReaderControlGesture(controller.session,controller.gesture,pointerId,y,time):
    type==='move'?updateReaderControlGesture(controller.session,controller.gesture,pointerId,y,time):
    type==='cancel'?cancelReaderControlGesture(controller.session,controller.gesture,pointerId):
    endReaderControlGesture(controller.session,controller.gesture,pointerId,time);
  controller.session=result.session;controller.gesture=result.gesture;
  return result;
}

// MangaReadingSurface.begin/update/finishPanelDrag (1170–1185). This is the
// platform pointer adapter for its one-way panel, separate from novel morphing.
// The stable release endpoint is immediate here; ArkUI spring timing is in the spec.
export const mangaPanelDragDismiss=(offset,velocity,cancelled=false)=>!cancelled&&(Math.max(0,offset)>96||velocity>550);
export function installMangaPanelGestures({viewport,getScreen,onDismiss}) {
  let active;
  const reset=()=>{if(active)active.panel.style.transform='';active=undefined;};
  viewport.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-manga-panel-grabber]');if(!handle||event.button>0||handle.closest('.wide-panel'))return;
    const panel=handle.closest('.manga-sheet');if(!panel)return;
    active={id:getScreen(),panel,pointer:event.pointerId,start:event.clientY,last:event.clientY,time:event.timeStamp,offset:0,velocity:0};
    handle.setPointerCapture(event.pointerId);event.preventDefault();
  });
  viewport.addEventListener('pointermove',event=>{
    if(!active||active.pointer!==event.pointerId)return;
    const dt=event.timeStamp-active.time;active.velocity=dt>0?(event.clientY-active.last)*1000/dt:0;
    active.last=event.clientY;active.time=event.timeStamp;active.offset=event.clientY-active.start;
    active.panel.style.transform=`translateY(${Math.max(0,active.offset)}px)`;event.preventDefault();
  });
  for(const type of ['pointerup','pointercancel'])viewport.addEventListener(type,event=>{
    if(!active||active.pointer!==event.pointerId)return;
    const dismiss=mangaPanelDragDismiss(active.offset,active.velocity,type==='pointercancel'),id=active.id;
    reset();event.preventDefault();if(dismiss&&getScreen()===id)onDismiss();
  });
  viewport.addEventListener('click',event=>{if(event.detail>0&&event.target.closest('[data-manga-panel-grabber]')){event.preventDefault();event.stopPropagation();}},true);
  return {cancel:reset};
}

export function installControlGestures({viewport,getScreen,onEndpoint,getReducedMotion}) {
  let active,raf=0;
  function paint() {
    if(!active)return;
    const frame=sampleReaderControlMotionComposition(sampleReaderControlSession(active.controller.session),active.controller.bounds);
    const {root,dock,topbar,stageTop,ownerTop}=active;
    dock.style.top=`${stageTop-ownerTop+frame.shell.y}px`;dock.style.bottom='auto';dock.style.height=`${frame.shell.height}px`;
    dock.style.opacity=String(frame.dock.opacity);dock.style.translate=`0 ${frame.dock.translateY}px`;
    if(topbar){topbar.style.opacity=String(frame.topBar.opacity);topbar.style.translate=`0 ${frame.topBar.translateY}px`;}
    for(const [selector,actor] of [['.reading-control-content',frame.content],['.reading-module-header',frame.header],['.reading-brightness',frame.brightness],['.reading-module-nav',frame.navigation]]){
      const node=root.querySelector(selector);if(!node)continue;
      node.style.top=`${actor.y-frame.shell.y}px`;node.style.left=`${actor.x}px`;node.style.right='auto';node.style.bottom='auto';
      node.style.width=`${actor.width}px`;node.style.height=`${actor.height}px`;node.style.opacity=String(actor.opacity);
      node.style.display=actor.opacity===0?'none':selector==='.reading-control-content'?'block':'flex';
    }
    root.dataset.gestureHeld='true';
  }
  function finish() {
    if(!active)return;
    const location=readerControlTargetLocation(active.controller.session),screen=active.screen;
    active=undefined;if(raf)cancelAnimationFrame(raf);raf=0;
    onEndpoint(screen,location);
  }
  function settle() {
    let last=performance.now();
    const tick=now=>{
      if(!active)return;
      active.controller.session=advanceReaderControlSession(active.controller.session,now-last,active.controller.session.epoch,sampleReaderControlMorphProgress);
      last=now;paint();
      if(!active.controller.session.transition){finish();return;}
      raf=requestAnimationFrame(tick);
    };
    tick(last);
  }
  viewport.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-control-grabber]');if(!handle||active||event.button>0)return;
    const root=handle.closest('.reading-overlay'),dock=root?.querySelector('.reading-dock');if(!dock)return;
    const screen=getScreen(),expanded=root.classList.contains('full');
    // Measure both existing CSS endpoints in the same coordinate system.
    root.classList.remove('quick');root.classList.add('full');const fullBox=dock.getBoundingClientRect();
    root.classList.remove('full');root.classList.add('quick');const quickBox=dock.getBoundingClientRect();
    root.classList.toggle('full',expanded);root.classList.toggle('quick',!expanded);
    const ownerTop=root.getBoundingClientRect().top;
    const module=[...root.classList].find(c=>c.startsWith('module-'))?.slice(7)||'home';
    const controller=createDemoControlGesture(module,expanded?'full':'quick',readerControlMotionBounds(fullBox.width,fullBox.height,0,quickBox.height),fullBox.top,getReducedMotion());
    active={root,dock,topbar:root.querySelector('.reading-topbar'),stageTop:fullBox.top,ownerTop,controller,screen};
    updateDemoControlGesture(controller,'down',event.pointerId,event.clientY,event.timeStamp);
    handle.setPointerCapture(event.pointerId);event.preventDefault();paint();
  });
  viewport.addEventListener('pointermove',event=>{
    if(!active||active.controller.gesture.pointerId!==event.pointerId)return;
    updateDemoControlGesture(active.controller,'move',event.pointerId,event.clientY,event.timeStamp);event.preventDefault();paint();
  });
  for(const type of ['pointerup','pointercancel'])viewport.addEventListener(type,event=>{
    if(!active||active.controller.gesture.pointerId!==event.pointerId)return;
    updateDemoControlGesture(active.controller,type==='pointercancel'?'cancel':'up',event.pointerId,event.clientY,event.timeStamp);
    event.preventDefault();settle();
  });
  viewport.addEventListener('click',event=>{if(event.target.closest('[data-control-grabber]')&&event.detail>0){event.preventDefault();event.stopPropagation();}},true);
  return {cancel(){if(!active)return;const g=active.controller.gesture;if(g.pointerId>=0)updateDemoControlGesture(active.controller,'cancel',g.pointerId,0,0);finish();},get active(){return Boolean(active);}};
}
