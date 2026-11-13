import { readerControlActor, readerControlUnit, type ReaderControlActorFrame } from './ReaderControlActorGeometry.ts';
import { sampleReaderControlReplaceHeader } from './ReaderControlReplaceGeometry.ts';

export type ReaderControlHeaderRole = 'plainUi' | 'plainInter' | 'ttsMake' | 'replace' | 'none';

export interface ReaderControlHeaderTextMetrics {
  titleWidthVp: number;
  titleHeightVp: number;
  actionLabelWidthVp: number;
  actionLabelHeightVp: number;
}

export interface ReaderControlHeaderPaintProfile extends ReaderControlHeaderTextMetrics {
  role: ReaderControlHeaderRole;
  actionPaintWidthVp: number;
  actionPaintHeightVp: number;
  heightVp: number;
}

export interface ReaderControlHeaderLayout {
  frame: ReaderControlActorFrame;
  icon: ReaderControlActorFrame;
  title: ReaderControlActorFrame;
  actionPaint: ReaderControlActorFrame;
  actionTarget: ReaderControlActorFrame;
  actionLabel: ReaderControlActorFrame;
  chevron: ReaderControlActorFrame;
}

export function readerControlHeaderRole(module: string | undefined): ReaderControlHeaderRole {
  if (module === 'home' || module === undefined) return 'none';
  if (module === 'search' || module === 'autoPage') return 'plainInter';
  if (module === 'tts') return 'ttsMake';
  return module === 'replace' ? 'replace' : 'plainUi';
}

export function readerControlHeaderTitle(module: string | undefined, directoryTab?: string): string {
  if (module === 'directory') return directoryTab === 'bookmarks' ? '书签' : '目录';
  if (module === 'appearance') return '界面';
  if (module === 'tts') return '朗读';
  if (module === 'settings') return '设置';
  if (module === 'search') return '内容搜索';
  if (module === 'autoPage') return '自动翻页';
  return module === 'replace' ? '替换规则管理' : '';
}

export function readerControlHeaderActionLabel(module: string | undefined): string {
  return module === 'replace' ? '完成' : '收起';
}

function extent(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Paint recipes come from the frozen30-high headers and the MakeV17 TTS
 * successor. Touch height is deliberately absent from this paint budget. */
export function readerControlHeaderPaintProfile(module: string | undefined,
  text?: ReaderControlHeaderTextMetrics): ReaderControlHeaderPaintProfile {
  const role = readerControlHeaderRole(module);
  const inter = role === 'plainInter';
  const replacement = role === 'replace';
  const titleHeight = inter || replacement ? 17 : 20;
  const labelHeight = role === 'ttsMake' ? 10 : inter || replacement ? 12 : 14;
  const titleWidth = replacement ? 84 : inter ? 56 : 28;
  const measuredTitleHeight = Math.max(titleHeight, extent(text?.titleHeightVp ?? titleHeight, titleHeight));
  const actionLabelHeight = Math.max(labelHeight, extent(text?.actionLabelHeightVp ?? labelHeight, labelHeight));
  const actionLabelWidth = Math.max(20, extent(text?.actionLabelWidthVp ?? 20, 20));
  const actionHeight = Math.max(26, actionLabelHeight);
  return {
    role: role,
    titleWidthVp: extent(text?.titleWidthVp ?? titleWidth, titleWidth),
    titleHeightVp: measuredTitleHeight,
    actionLabelWidthVp: actionLabelWidth,
    actionLabelHeightVp: actionLabelHeight,
    actionPaintWidthVp: role === 'ttsMake' ? actionLabelWidth + 18 + 4 + 12 : Math.max(40, actionLabelWidth + 20),
    actionPaintHeightVp: actionHeight,
    heightVp: Math.max(30, measuredTitleHeight + (inter || replacement ? 13 : 10), actionHeight + 4),
  };
}

/** Header-local coordinate adapter, not another motion owner.
 * Search 1938:5075 and AutoPage 1938:7519 are under their fractional
 * UnifiedSheetSurface (14,20), unlike the other root-level FullHeaders.
 * Their source TY18→0 is independent of the common shell translation. The
 * Stage already owns opacity=p, so the child must not multiply p again.
 */
export function readerControlHeaderFrame(module: string | undefined, p: number,
  availableWidth: number, measuredHeight: number = 30): ReaderControlActorFrame {
  const width = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 338;
  const height = Number.isFinite(measuredHeight) ? Math.max(30, measuredHeight) : 30;
  if (module !== 'search' && module !== 'autoPage') return readerControlActor(0, 0, width, height);
  const remaining = 1 - readerControlUnit(p);
  return readerControlActor(1 - .448 * remaining, 1 + 18.443 * remaining,
    Math.max(0, width - 2), height);
}

/** Header-stage-local paint and independently paid action target. The TTS
 * original auto action ends six beyond its338-wide header, within the dock. */
export function readerControlHeaderLayout(module: string | undefined, p: number,
  width: number, measured?: ReaderControlHeaderPaintProfile): ReaderControlHeaderLayout {
  const availableWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const profile = readerControlHeaderPaintProfile(module,
    measured?.role === readerControlHeaderRole(module) ? measured : undefined);
  const frame = readerControlHeaderFrame(module, p, availableWidth, profile.heightVp);
  if (availableWidth === 0 || profile.role === 'none') {
    const empty = readerControlActor(0, 0, 0, 0, 0);
    return { frame: frame, icon: empty, title: empty, actionPaint: empty,
      actionTarget: empty, actionLabel: empty, chevron: empty };
  }
  const replacement = profile.role === 'replace';
  const replaced = sampleReaderControlReplaceHeader(p, availableWidth);
  const growth = Math.max(0, profile.heightVp - 30);
  const action = replacement ? readerControlActor(Math.max(0, availableWidth - 1 - profile.actionPaintWidthVp),
    replaced.action.y + growth * readerControlUnit(p) / 2,
    profile.actionPaintWidthVp, profile.actionPaintHeightVp, replaced.action.opacity) :
    readerControlActor(frame.x + frame.width + (profile.role === 'ttsMake' ? 6 : 0) - profile.actionPaintWidthVp,
      frame.y + (profile.heightVp - profile.actionPaintHeightVp) / 2,
      profile.actionPaintWidthVp, profile.actionPaintHeightVp);
  const titleX = replacement ? replaced.title.x : frame.x + 24;
  const titleWidth = replacement ? replaced.title.width +
    Math.max(0, profile.titleWidthVp - 84) * readerControlUnit(p) : profile.titleWidthVp;
  const title = readerControlActor(titleX,
    replacement ? replaced.title.y + growth * readerControlUnit(p) / 2 : frame.y + (profile.heightVp - profile.titleHeightVp) / 2,
    Math.min(titleWidth, Math.max(0, action.x - 10 - titleX)),
    replacement ? replaced.title.height + Math.max(0, profile.titleHeightVp - 17) : profile.titleHeightVp);
  const icon = replacement ? readerControlActor(replaced.icon.x,
    replaced.icon.y + growth * readerControlUnit(p) / 2, 16, 16, replaced.icon.opacity) :
    readerControlActor(frame.x, frame.y + (profile.heightVp - 16) / 2, 16, 16);
  const targetWidth = Math.max(44, action.width);
  const targetHeight = Math.max(44, action.height);
  const target = readerControlActor(action.x + (action.width - targetWidth) / 2,
    action.y + (action.height - targetHeight) / 2, targetWidth, targetHeight, action.opacity);
  const label = readerControlActor(action.x + (profile.role === 'ttsMake' ? 9 : (action.width - profile.actionLabelWidthVp) / 2),
    action.y + (action.height - profile.actionLabelHeightVp) / 2,
    profile.actionLabelWidthVp, profile.actionLabelHeightVp, action.opacity);
  const chevron = readerControlActor(label.x + label.width + 4, action.y + (action.height - 12) / 2,
    profile.role === 'ttsMake' ? 12 : 0, profile.role === 'ttsMake' ? 12 : 0, action.opacity);
  return { frame: frame, icon: icon, title: title, actionPaint: action,
    actionTarget: target, actionLabel: label, chevron: chevron };
}

/** Convert the sampled header-local target into its actual dock owner. Small
 * or invalid hosts expose their paid rectangle, never a ghost44 outside it. */
export function readerControlHeaderTargetFrame(target: ReaderControlActorFrame,
  header: ReaderControlActorFrame, dockWidth: number, dockHeight: number): ReaderControlActorFrame {
  if (![target.x, target.y, target.width, target.height, header.x, header.y, dockWidth, dockHeight]
    .every((value: number): boolean => Number.isFinite(value)) || dockWidth <= 0 || dockHeight <= 0) {
    return readerControlActor(0, 0, 0, 0, 0);
  }
  const left = Math.max(0, target.x + header.x);
  const top = Math.max(0, target.y + header.y);
  const right = Math.min(dockWidth, target.x + header.x + target.width);
  const bottom = Math.min(dockHeight, target.y + header.y + target.height);
  return readerControlActor(left, top, Math.max(0, right - left), Math.max(0, bottom - top), target.opacity);
}

/** Exact cap-minus-action difference. Every rectangle is dock-local, so the
 * actual cap owner cannot steal the upper band of the44-high action owner. */
export function readerControlHeaderGrabRegions(cap: ReaderControlActorFrame,
  action: ReaderControlActorFrame | undefined): ReaderControlActorFrame[] {
  if (![cap.x, cap.y, cap.width, cap.height].every((value: number): boolean => Number.isFinite(value)) ||
    cap.width <= 0 || cap.height <= 0) return [];
  if (action === undefined) return [cap];
  if (![action.x, action.y, action.width, action.height].every((value: number): boolean => Number.isFinite(value)) ||
    action.width <= 0 || action.height <= 0) return [cap];
  const left = Math.max(cap.x, action.x);
  const right = Math.min(cap.x + cap.width, action.x + action.width);
  const top = Math.max(cap.y, action.y);
  const bottom = Math.min(cap.y + cap.height, action.y + action.height);
  if (right <= left || bottom <= top) return [cap];
  return [readerControlActor(cap.x, cap.y, cap.width, top - cap.y),
    readerControlActor(cap.x, top, left - cap.x, bottom - top),
    readerControlActor(right, top, cap.x + cap.width - right, bottom - top),
    readerControlActor(cap.x, bottom, cap.width, cap.y + cap.height - bottom)]
    .filter((region: ReaderControlActorFrame): boolean => region.width > 0 && region.height > 0);
}
