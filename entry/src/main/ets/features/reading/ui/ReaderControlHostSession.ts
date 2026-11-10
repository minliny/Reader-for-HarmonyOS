import type { ReaderControlPage } from './ReaderControlRouting.ts';
import {
  backReaderControlSession, enterReaderControlModule, expandReaderControlSession,
  collapseReaderControlSession, readerControlContentLocation, readerControlTargetLocation,
  resumeReaderControlSessionTarget, sampleReaderControlSession,
  type ReaderControlBackResult, type ReaderControlModule, type ReaderControlSessionState,
} from './ReaderControlSessionState.ts';

/** Host-only policy; business state and the only motion clock live elsewhere. */
export interface ReaderControlHostTiming {
  showDurationMs: number;
  dismissDurationMs: number;
  morphDurationMs: number;
  navigateDurationMs: number;
}

export interface ReaderControlHostInputContext {
  mounted: boolean;
  exitRequested: boolean;
  appForeground: boolean;
  windowChromeActive: boolean;
  interactionBlocked: boolean;
  controlObscured: boolean;
}

export function readerControlHostInputEnabled(context: ReaderControlHostInputContext): boolean {
  return context.mounted && !context.exitRequested && context.appForeground &&
    context.windowChromeActive && !context.interactionBlocked && !context.controlObscured;
}

/** v=0 while held still owns input and retains its content. */
export function readerControlHostVisible(session: ReaderControlSessionState): boolean {
  return readerControlContentLocation(session).level !== 'hidden';
}

export function readerControlHostClosing(session: ReaderControlSessionState): boolean {
  return readerControlHostVisible(session) && readerControlTargetLocation(session).level === 'hidden';
}

/** Compatibility projection only, never a second mutable route owner. */
export function readerControlHostPage(session: ReaderControlSessionState): ReaderControlPage {
  const location = readerControlContentLocation(session);
  if (location.level !== 'secondary') return 'home';
  const full = location.form === 'full';
  if (location.module === 'directory') return 'moduleDirectory';
  if (location.module === 'tts') return full ? 'fullTts' : 'moduleTts';
  if (location.module === 'appearance') return full ? 'fullAppearance' : 'moduleAppearance';
  if (location.module === 'settings') return full ? 'fullSettings' : 'moduleSettings';
  if (location.module === 'search') return full ? 'fullSearch' : 'quickSearch';
  if (location.module === 'autoPage') return full ? 'fullAutoPage' : 'quickAutoPage';
  // The legacy business facade has no Full Replace page name. The real form
  // remains in session; it must not route to the external rules manager.
  return 'quickReplace';
}

function moduleForPage(page: ReaderControlPage): ReaderControlModule {
  if (page === 'moduleTts' || page === 'fullTts') return 'tts';
  if (page === 'moduleAppearance' || page === 'fullAppearance') return 'appearance';
  if (page === 'moduleSettings' || page === 'fullSettings') return 'settings';
  if (page === 'quickSearch' || page === 'fullSearch') return 'search';
  if (page === 'quickAutoPage' || page === 'fullAutoPage') return 'autoPage';
  if (page === 'quickReplace') return 'replace';
  return 'directory';
}

export function setReaderControlHostPage(session: ReaderControlSessionState,
  page: ReaderControlPage, timing: ReaderControlHostTiming): ReaderControlSessionState {
  if (!readerControlHostVisible(session)) return session;
  const location = readerControlContentLocation(session);
  if (page === 'home') {
    if (location.level === 'home') return session;
    return resumeReaderControlSessionTarget(session,
      { level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick' },
      sampleReaderControlSession(session).expansionProgress > 0 ?
        timing.morphDurationMs : timing.navigateDurationMs);
  }
  const module = moduleForPage(page);
  const sameModule = location.level === 'secondary' && location.module === module;
  const next = sameModule ? session : enterReaderControlModule(session, module,
    timing.navigateDurationMs);
  const full = page === 'fullTts' || page === 'fullAppearance' || page === 'fullSettings' ||
    page === 'fullSearch' || page === 'fullAutoPage';
  if (full) return expandReaderControlSession(next, timing.morphDurationMs);
  if (sameModule && location.form === 'full') {
    return collapseReaderControlSession(next, timing.morphDurationMs);
  }
  return next;
}

/** Determine the logical Back destination before selecting its playback time. */
export function backReaderControlHostSession(session: ReaderControlSessionState,
  timing: ReaderControlHostTiming): ReaderControlBackResult {
  const candidate = backReaderControlSession(session, timing.morphDurationMs);
  if (!candidate.consumed) return candidate;
  const target = readerControlTargetLocation(candidate.state);
  const duration = target.level === 'hidden' ? timing.dismissDurationMs :
    target.level === 'home' && sampleReaderControlSession(session).expansionProgress === 0 ?
      timing.navigateDurationMs : timing.morphDurationMs;
  return backReaderControlSession(session, duration);
}

/** A held invisible frame and an obsolete notification never trigger reset. */
export function readerControlHostCloseCommitted(session: ReaderControlSessionState,
  observedCloseRevision: number): boolean {
  return session.closeRevision > observedCloseRevision && session.location.level === 'hidden' &&
    session.transition === undefined && session.heldPointerId < 0;
}
