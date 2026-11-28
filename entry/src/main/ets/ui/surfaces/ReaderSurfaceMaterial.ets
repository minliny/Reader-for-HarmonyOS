import deviceInfo from '@ohos.deviceInfo';
import lazy { uiMaterial } from '@kit.ArkUI';
import { readerHarmonyCapabilities } from '../../app/HarmonyCapabilityProbe';
import { READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_NATIVE_MATERIAL } from '../foundation/ReaderLayoutInvariantSignals';
import { readerAppColor, type ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';
import { readerSurfaceOutlinePaint } from './ReaderReadingPanelPaint';
import {
  isReaderNativeChromeStyle,
  isReaderRealtimeBlurEnabled,
  normalizeReaderNavigationPreferences,
  resolveReaderSurfaceMaterial,
  type ReaderImmersiveStyleName,
  type ReaderNavigationPreferences,
  type ReaderSurfaceMaterialDecision,
  type ReaderSurfaceMaterialRole,
} from '../../app/HarmonyCapabilityPolicy';

export function defaultNavigationPreferences(): ReaderNavigationPreferences {
  return normalizeReaderNavigationPreferences(undefined);
}

export class ReaderModalScrimModifier implements AttributeModifier<CommonAttribute> {
  private readonly preferences: ReaderNavigationPreferences;
  private readonly scheme: string;
  private readonly standardScrim: string | Color;
  private readonly overlayUsesNativeMaterial: boolean;
  private readonly allowBlur: boolean;

  constructor(preferences: ReaderNavigationPreferences, scheme: string, standardScrim: string | Color,
    overlayUsesNativeMaterial: boolean = false, allowBlur: boolean = true) {
    this.preferences = preferences;
    this.scheme = scheme;
    this.standardScrim = standardScrim;
    this.overlayUsesNativeMaterial = overlayUsesNativeMaterial;
    this.allowBlur = allowBlur;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    instance.backgroundEffect(undefined).backgroundColor(this.standardScrim);
  }
}

export const READER_NO_SHADOW: ShadowOptions = {
  radius: 0,
  color: Color.Transparent,
  offsetX: 0,
  offsetY: 0,
};

const materialCache: Map<string, uiMaterial.ImmersiveMaterial> = new Map<string, uiMaterial.ImmersiveMaterial>();
const materialFallbackPaint: WeakMap<ReaderSurfaceMaterialDecision, string> =
  new WeakMap<ReaderSurfaceMaterialDecision, string>();

function materialFallbackRole(role: ReaderSurfaceMaterialRole): ReaderAppColorRole {
  switch (role) {
    case 'navigationBar': return 'app.navigation.floatingSurface';
    case 'chromeBar': return 'app.navigation.floatingSurface';
    case 'floatingDock': return 'app.surface.dock';
    case 'sessionCapsule': return 'app.sessionCapsule.surface';
    case 'controlPanel': return 'TOK_READ_SURFACE';
    case 'popoverMenu': return 'app.surface.menuSolid';
    case 'modalSheet': return 'app.bookshelf.sheetSurface';
  }
}

function mapImmersiveStyle(style: ReaderImmersiveStyleName): uiMaterial.ImmersiveStyle {
  switch (style) {
    case 'ultraThin':
      return uiMaterial.ImmersiveStyle.ULTRA_THIN;
    case 'thin':
      return uiMaterial.ImmersiveStyle.THIN;
    case 'regular':
      return uiMaterial.ImmersiveStyle.REGULAR;
    case 'thick':
      return uiMaterial.ImmersiveStyle.THICK;
    case 'ultraThick':
      return uiMaterial.ImmersiveStyle.ULTRA_THICK;
  }
}

export function readerSurfaceMaterialDecision(
  role: ReaderSurfaceMaterialRole,
  preferences: ReaderNavigationPreferences,
  appScheme: string,
  systemScheme: string,
): ReaderSurfaceMaterialDecision {
  const decision = resolveReaderSurfaceMaterial(role, preferences, readerHarmonyCapabilities(), appScheme, systemScheme);
  if (decision.native) {
    let admitted = false;
    if (deviceInfo.distributionOSApiVersion >= 260000) {
      try {
        admitted = deviceInfo.apiAvailable('26.0.0') && readerImmersiveMaterial(decision) !== undefined;
      } catch (_) {
        admitted = false;
      }
    }
    if (admitted) {
      materialFallbackPaint.set(decision, readerAppColor(materialFallbackRole(role), appScheme));
      return decision;
    }
    return {
      native: false,
      frosted: isReaderNativeChromeStyle(preferences) && isReaderRealtimeBlurEnabled(preferences),
      style: decision.style,
      interactive: decision.interactive,
      performanceMode: decision.performanceMode,
    };
  }
  return decision;
}

function readerImmersiveMaterial(
  decision: ReaderSurfaceMaterialDecision | undefined,
  applyShadow: boolean = true,
): uiMaterial.ImmersiveMaterial | undefined {
  if (decision === undefined || !decision.native) {
    return undefined;
  }
  const key = `${decision.style}:${applyShadow ? '1' : '0'}:${decision.interactive ? '1' : '0'}`;
  let cached = materialCache.get(key);
  if (cached === undefined) {
    cached = new uiMaterial.ImmersiveMaterial({
      style: mapImmersiveStyle(decision.style),
      applyShadow,
      interactive: decision.interactive,
    });
    materialCache.set(key, cached);
  }
  return cached;
}

/** A fallback may clear material on API 26. Older SDKs have no dispatch entry. */
export function applyReaderImmersiveMaterial(instance: CommonAttribute,
  decision: ReaderSurfaceMaterialDecision | undefined, applyShadow: boolean = true, inspectPanel: boolean = false): boolean {
  let applied = false;
  if (deviceInfo.distributionOSApiVersion >= 260000) {
    try {
      if (deviceInfo.apiAvailable('26.0.0')) {
        const material = readerImmersiveMaterial(decision, applyShadow);
        instance.systemMaterial(material);
        applied = material !== undefined;
      }
    } catch (_) { /* Restore normal surface paint below. */ }
  }
  if (!applied && decision?.native === true) {
    // The node may have selected a transparent fill for native material.
    const fallback = materialFallbackPaint.get(decision);
    if (fallback !== undefined) instance.backgroundColor(fallback);
  }
  if (READER_LAYOUT_DEBUG_BUILD && (inspectPanel || decision?.style === 'thick' || decision?.style === 'ultraThick')) {
    // This classifies a native actor. The audit reads its actual SDK render
    // properties independently; the marker carries no expected paint values.
    instance.customProperty(READER_LAYOUT_NATIVE_MATERIAL, applied);
  }
  return applied;
}

/** Independent outline stays on the node when system material owns border and shadow. */
export function readerNativeSurfaceOutline(scheme: string, radius: OutlineRadiuses | number,
  edge: 'all' | 'top' | 'left' = 'all'): OutlineOptions {
  const paint = readerSurfaceOutlinePaint(scheme);
  return { width: edge === 'top' ? { top: paint.width } : edge === 'left' ? { left: paint.width } : paint.width,
    color: paint.color, radius };
}

export class ReaderImmersiveMaterialModifier implements AttributeModifier<CommonAttribute> {
  private readonly material: ReaderSurfaceMaterialDecision | undefined;
  private readonly outline: OutlineOptions | undefined;

  constructor(material: ReaderSurfaceMaterialDecision | undefined, outline?: OutlineOptions) {
    this.material = material;
    this.outline = outline;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    const applied = applyReaderImmersiveMaterial(instance, this.material);
    if (this.outline !== undefined) instance.outline(applied ? this.outline : undefined);
  }
}

export function applyReaderPopupMaterial(options: CustomPopupOptions, decision: ReaderSurfaceMaterialDecision): boolean {
  if (!decision.native) return false;
  if (deviceInfo.distributionOSApiVersion >= 260000) {
    try {
      if (deviceInfo.apiAvailable('26.0.0')) {
        const material = readerImmersiveMaterial(decision);
        if (material === undefined) return false;
        options.systemMaterial = material;
        return true;
      }
    } catch (_) { /* Use the popup's regular background. */ }
  }
  return false;
}

export function readerSheetBackdropBlur(
  _preferences: ReaderNavigationPreferences,
  _overlayUsesNativeMaterial: boolean = false,
): number {
  return 0;
}
