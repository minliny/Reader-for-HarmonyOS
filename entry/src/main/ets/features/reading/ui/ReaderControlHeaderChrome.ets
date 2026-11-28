import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { TYPE_READER_CONTROL_COLLAPSE_INTER, TYPE_READER_CONTROL_COLLAPSE_TTS, TYPE_READER_CONTROL_COLLAPSE_UI,
  TYPE_READER_CONTROL_HEADER_INTER, TYPE_READER_CONTROL_HEADER_UI, TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL,
  TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY, type ReaderTextStyle,
} from '../../../ui/foundation/ReaderTypography';
import type { ReaderControlActorFrame } from './ReaderControlActorGeometry';
import {
  readerControlHeaderActionLabel, readerControlHeaderGrabRegions, readerControlHeaderLayout, readerControlHeaderRole,
  readerControlHeaderTargetFrame, readerControlHeaderTitle, type ReaderControlHeaderLayout,
  type ReaderControlHeaderPaintProfile, type ReaderControlHeaderRole,
} from './ReaderControlHeaderGeometry';
import type { ReaderControlMotionFrame } from './ReaderControlMotionGeometry';
import type { ReaderControlLocation } from './ReaderControlSessionState';
import type { ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';

export interface ReaderControlHeaderRead {
  readonly layout: () => ReaderControlLayoutSnapshot;
  readonly frame: () => ReaderControlMotionFrame;
  readonly location: () => ReaderControlLocation;
  readonly headerPaint: () => ReaderControlHeaderPaintProfile | undefined;
  readonly scheme: () => string;
  readonly fixedIsland: () => boolean;
  readonly surfaceHeight: () => number;
  readonly directSheetVisible: () => boolean;
  readonly directSheetClosing: () => boolean;
  readonly actionInputEnabled: () => boolean;
}

export interface ReaderControlHeaderActions {
  readonly guard: (action: () => void) => () => void;
  readonly collapse: () => void;
  readonly grabTouch: () => (event: TouchEvent) => void;
}

/** The enclosing Panel still owns the gesture and presentation receipt.
 * Each header element reads the live facts it uses during its update. */
export class ReaderControlHeaderScene {
  private readonly facts: ReaderControlHeaderRead;
  private readonly actions: ReaderControlHeaderActions;
  private cachedModule: string = '';
  private cachedProgress: number = -1;
  private cachedWidth: number = -1;
  private cachedPaint: ReaderControlHeaderPaintProfile | undefined = undefined;
  private cachedLayout: ReaderControlHeaderLayout | undefined = undefined;

  constructor(facts: ReaderControlHeaderRead, actions: ReaderControlHeaderActions) {
    this.facts = facts;
    this.actions = actions;
  }

  read(): ReaderControlHeaderRead { return this.facts; }
  guard(action: () => void): () => void { return this.actions.guard(action); }
  collapse(): void { this.actions.collapse(); }
  grabTouch(): (event: TouchEvent) => void { return this.actions.grabTouch(); }

  paintLayout(): ReaderControlHeaderLayout {
    const read = this.facts;
    const module = read.location().module;
    const progress = read.fixedIsland() ? 1 : read.frame().progress;
    const width = read.frame().header.width;
    const paint = read.headerPaint();
    if (this.cachedLayout === undefined || this.cachedModule !== module ||
      this.cachedProgress !== progress || this.cachedWidth !== width || this.cachedPaint !== paint) {
      this.cachedModule = module;
      this.cachedProgress = progress;
      this.cachedWidth = width;
      this.cachedPaint = paint;
      this.cachedLayout = readerControlHeaderLayout(module, progress, width, paint);
    }
    return this.cachedLayout;
  }
}

export interface ReaderControlHeaderInput {
  readonly scene: ReaderControlHeaderScene;
}

class ReaderControlHeaderLineHeight implements AttributeModifier<TextAttribute> {
  private readonly height: number | undefined;
  constructor(height: number | undefined) { this.height = height; }
  applyNormalAttribute(instance: TextAttribute): void {
    if (this.height !== undefined) instance.lineHeight(this.height);
  }
}

function headerPaintLayout(scene: ReaderControlHeaderScene): ReaderControlHeaderLayout {
  return scene.paintLayout();
}

function headerRole(scene: ReaderControlHeaderScene): ReaderControlHeaderRole {
  return readerControlHeaderRole(scene.read().location().module);
}

function headerTitle(scene: ReaderControlHeaderScene): string {
  const location = scene.read().location();
  return readerControlHeaderTitle(location.module, location.directoryTab);
}

function headerTitleStyle(scene: ReaderControlHeaderScene): ReaderTextStyle {
  return headerRole(scene) === 'plainInter' ? TYPE_READER_CONTROL_HEADER_INTER : TYPE_READER_CONTROL_HEADER_UI;
}

function headerActionStyle(scene: ReaderControlHeaderScene): ReaderTextStyle {
  const role = headerRole(scene);
  if (role === 'replace') return TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL_SECONDARY;
  if (role === 'ttsMake') return TYPE_READER_CONTROL_COLLAPSE_TTS;
  return role === 'plainInter' ? TYPE_READER_CONTROL_COLLAPSE_INTER : TYPE_READER_CONTROL_COLLAPSE_UI;
}

function headerActionFrame(scene: ReaderControlHeaderScene): ReaderControlActorFrame {
  const read = scene.read();
  return readerControlHeaderTargetFrame(headerPaintLayout(scene).actionTarget, read.frame().header,
    read.layout().fullPanelWidth, read.surfaceHeight());
}

function headerActionInputEnabled(scene: ReaderControlHeaderScene): boolean {
  const read = scene.read();
  if (read.directSheetClosing()) return false;
  if (!read.actionInputEnabled() || read.location().level !== 'secondary') return false;
  const target = headerActionFrame(scene);
  if (target.width <= 0 || target.height <= 0) return false;
  return headerRole(scene) === 'replace' ? read.frame().progress === 1 : read.frame().header.opacity > 0;
}

function headerClick(scene: ReaderControlHeaderScene): () => void {
  return scene.guard((): void => { if (headerActionInputEnabled(scene)) scene.collapse(); });
}

function grabCapFrame(scene: ReaderControlHeaderScene): ReaderControlActorFrame {
  const read = scene.read();
  return { x: 0, y: read.frame().shell.y, width: read.layout().fullPanelWidth,
    height: Math.max(0, Math.min(19, read.frame().shell.height,
      read.frame().header.y - read.frame().shell.y, read.frame().content.y - read.frame().shell.y)), opacity: 1 };
}

function grabResponseRegions(scene: ReaderControlHeaderScene): Rectangle[] {
  const cap = grabCapFrame(scene);
  const regions = readerControlHeaderGrabRegions(cap, headerActionInputEnabled(scene) ? headerActionFrame(scene) : undefined);
  return regions.map((region: ReaderControlActorFrame): Rectangle => ({
    x: region.x - cap.x, y: region.y - cap.y, width: region.width, height: region.height,
  }));
}

function headerIcon(scene: ReaderControlHeaderScene): Resource {
  const read = scene.read();
  const location = read.location();
  const night = read.scheme() === 'night';
  if (location.module === 'directory') return location.directoryTab === 'bookmarks' ?
    $r(night ? 'app.media.reader_directory_marker_bookmark_theme_night' : 'app.media.reader_directory_marker_bookmark') :
    $r(night ? 'app.media.reader_directory_directory_theme_night' : 'app.media.reader_directory_directory');
  if (location.module === 'tts') return $r(night ? 'app.media.reader_tts_header_theme_night' : 'app.media.reader_tts_header');
  if (location.module === 'appearance') return $r(night ? 'app.media.reader_appearance_header_theme_night' : 'app.media.reader_appearance_header');
  if (location.module === 'settings') return $r(night ? 'app.media.reader_settings_header_theme_night' : 'app.media.reader_settings_header');
  if (location.module === 'autoPage') return $r(night ? 'app.media.rc_autopage_theme_night' : 'app.media.rc_autopage');
  return $r(night ? 'app.media.rc_search_theme_night' : 'app.media.rc_search');
}

@Builder
export function ReaderControlHeaderGrabCap($$: ReaderControlHeaderInput) {
  Stack({ alignContent: Alignment.Center }) {
    if (grabCapFrame($$.scene).height >= 8) {
      Row()
        .width(36).height(4).borderRadius(2)
        .backgroundColor(readerAppColor('TOK_READ_HANDLE', $$.scene.read().scheme()))
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
    }
  }
    .id('reader-control-motion-grab-cap')
    .width(grabCapFrame($$.scene).width).height(grabCapFrame($$.scene).height)
    .position({ x: grabCapFrame($$.scene).x, y: grabCapFrame($$.scene).y })
    .responseRegion(grabResponseRegions($$.scene))
    .zIndex(3).hitTestBehavior(HitTestMode.Block).accessibilityLevel('no')
    .onTouch($$.scene.grabTouch());
}

@Builder
export function ReaderControlHeaderChrome($$: ReaderControlHeaderInput) {
  if (headerRole($$.scene) === 'replace') {
    ReaderControlReplaceHeaderChrome({ scene: $$.scene });
  } else {
    Stack({ alignContent: Alignment.TopStart }) {
      Image(headerIcon($$.scene))
        .width(headerPaintLayout($$.scene).icon.width).height(headerPaintLayout($$.scene).icon.height)
        .position({ x: headerPaintLayout($$.scene).icon.x, y: headerPaintLayout($$.scene).icon.y })
        .hitTestBehavior(HitTestMode.None);
      Text(headerTitle($$.scene)).fontFamily(headerTitleStyle($$.scene).fontFamily)
        .fontWeight(headerTitleStyle($$.scene).fontWeight, { enableVariableFontWeight: true })
        .fontSize(headerTitleStyle($$.scene).fontSizeFp).lineHeight(headerTitleStyle($$.scene).lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_INK', $$.scene.read().scheme())).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width(headerPaintLayout($$.scene).title.width).height(headerPaintLayout($$.scene).title.height)
        .position({ x: headerPaintLayout($$.scene).title.x, y: headerPaintLayout($$.scene).title.y });
      ReaderControlHeaderActionPaint({ scene: $$.scene });
    }.width($$.scene.read().frame().header.width).height(headerPaintLayout($$.scene).frame.height);
  }
}

@Builder
function ReaderControlHeaderActionPaint($$: ReaderControlHeaderInput) {
  if ($$.scene.read().directSheetVisible()) {
    Stack({ alignContent: Alignment.Center }) {
      Image(readerPaperActionIcon('close', $$.scene.read().scheme())).width(16).height(16);
    }.width(32).height(32).borderRadius(16).backgroundColor(readerAppColor('TOK_SURFACE_FIELD', $$.scene.read().scheme()))
      .position({ x: headerPaintLayout($$.scene).actionPaint.x + Math.max(0, (headerPaintLayout($$.scene).actionPaint.width - 32) / 2),
        y: headerPaintLayout($$.scene).actionPaint.y }).hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
  } else if ($$.scene.read().fixedIsland()) {
    Stack({ alignContent: Alignment.Center }) {
      Text('返回').fontFamily(headerActionStyle($$.scene).fontFamily).fontWeight(headerActionStyle($$.scene).fontWeight)
        .fontSize(headerActionStyle($$.scene).fontSizeFp).maxLines(1)
        .fontColor(readerAppColor('app.readerIsland.controlInk', $$.scene.read().scheme()));
    }.width(headerPaintLayout($$.scene).actionPaint.width).height(headerPaintLayout($$.scene).actionPaint.height)
      .position({ x: headerPaintLayout($$.scene).actionPaint.x, y: headerPaintLayout($$.scene).actionPaint.y })
      .backgroundColor(readerAppColor('app.readerIsland.controlSurface', $$.scene.read().scheme()))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.readerIsland.controlBorder', $$.scene.read().scheme()) }).borderRadius(8)
      .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
  } else {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(readerControlHeaderActionLabel($$.scene.read().location().module))
        .width(headerPaintLayout($$.scene).actionLabel.width).height(headerPaintLayout($$.scene).actionLabel.height)
        .position({ x: headerPaintLayout($$.scene).actionLabel.x - headerPaintLayout($$.scene).actionPaint.x,
          y: headerPaintLayout($$.scene).actionLabel.y - headerPaintLayout($$.scene).actionPaint.y })
        .fontFamily(headerActionStyle($$.scene).fontFamily)
        .fontWeight(headerActionStyle($$.scene).fontWeight, { enableVariableFontWeight: headerRole($$.scene) !== 'replace' })
        .fontSize(headerActionStyle($$.scene).fontSizeFp)
        .attributeModifier(new ReaderControlHeaderLineHeight(headerActionStyle($$.scene).lineHeightFp))
        .fontColor(readerAppColor('TOK_READ_PRIMARY', $$.scene.read().scheme())).textAlign(TextAlign.Center);
      if (headerRole($$.scene) === 'ttsMake') {
        Image($r($$.scene.read().scheme() === 'night' ? 'app.media.reader_control_header_chevron_theme_night' : 'app.media.reader_control_header_chevron'))
          .width(headerPaintLayout($$.scene).chevron.width).height(headerPaintLayout($$.scene).chevron.height)
          .position({ x: headerPaintLayout($$.scene).chevron.x - headerPaintLayout($$.scene).actionPaint.x,
            y: headerPaintLayout($$.scene).chevron.y - headerPaintLayout($$.scene).actionPaint.y });
      }
    }.width(headerPaintLayout($$.scene).actionPaint.width).height(headerPaintLayout($$.scene).actionPaint.height)
      .position({ x: headerPaintLayout($$.scene).actionPaint.x, y: headerPaintLayout($$.scene).actionPaint.y })
      .opacity(headerPaintLayout($$.scene).actionPaint.opacity)
      .backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', $$.scene.read().scheme())).borderRadius(8)
      .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
  }
}

@Builder
export function ReaderControlHeaderAction($$: ReaderControlHeaderInput) {
  Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack().width('100%').height('100%').hitTestBehavior(HitTestMode.None);
  }.width(headerActionFrame($$.scene).width).height(headerActionFrame($$.scene).height).padding(0)
    .position({ x: headerActionFrame($$.scene).x, y: headerActionFrame($$.scene).y })
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.scene.read().scheme(), 8, 8, headerActionInputEnabled($$.scene))).zIndex(2)
    .id('reader-control-collapse')
    .enabled(headerActionInputEnabled($$.scene))
    .hitTestBehavior(headerActionInputEnabled($$.scene) ? HitTestMode.Block : HitTestMode.None)
    .accessibilityText($$.scene.read().directSheetVisible() ? `关闭${headerTitle($$.scene)}` :
      $$.scene.read().fixedIsland() ? '返回阅读主控' :
        headerRole($$.scene) === 'replace' ? '完成替换规则管理，收起到快捷态' : `收起${headerTitle($$.scene)}`)
    .accessibilityLevel(headerActionInputEnabled($$.scene) ? 'auto' : 'no-hide-descendants')
    .onClick(headerClick($$.scene));
}

@Builder
function ReaderControlReplaceHeaderChrome($$: ReaderControlHeaderInput) {
  Stack({ alignContent: Alignment.TopStart }) {
    Text('替换规则管理').fontFamily(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.fontFamily)
      .fontWeight(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.fontWeight)
      .fontSize(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.fontSizeFp)
      .lineHeight(TYPE_READER_CONTROLS_RETAINED_REPLACE_HEADER_LABEL.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_READ_INK', $$.scene.read().scheme())).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      .width(headerPaintLayout($$.scene).title.width).height(headerPaintLayout($$.scene).title.height)
      .position({ x: headerPaintLayout($$.scene).title.x, y: headerPaintLayout($$.scene).title.y })
      .opacity(headerPaintLayout($$.scene).title.opacity).hitTestBehavior(HitTestMode.None);
    Image($r($$.scene.read().scheme() === 'night' ? 'app.media.reader_control_replace_header_theme_night' : 'app.media.reader_control_replace_header'))
      .width(headerPaintLayout($$.scene).icon.width).height(headerPaintLayout($$.scene).icon.height)
      .position({ x: headerPaintLayout($$.scene).icon.x, y: headerPaintLayout($$.scene).icon.y })
      .opacity(headerPaintLayout($$.scene).icon.opacity).hitTestBehavior(HitTestMode.None);
    ReaderControlHeaderActionPaint({ scene: $$.scene });
  }.width($$.scene.read().frame().header.width).height(headerPaintLayout($$.scene).frame.height).hitTestBehavior(HitTestMode.Transparent);
}
