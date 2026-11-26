import deviceInfo from '@ohos.deviceInfo';
import lazy { uiMaterial } from '@kit.ArkUI';
import { readerHarmonyCapabilities } from '../../app/HarmonyCapabilityProbe';
import {
  READER_MODAL_BLUR_RADIUS_VP,
  normalizeReaderNavigationPreferences,
  resolveReaderModalScrimSpec,
  resolveReaderSurfaceMaterial,
  shouldBlurBackdrop,
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
    if (!this.allowBlur || typeof this.standardScrim !== 'string') {
      instance.backgroundEffect(undefined).backgroundColor(this.standardScrim);
      return;
    }
    const spec = resolveReaderModalScrimSpec(this.preferences, this.scheme, this.standardScrim,
      this.overlayUsesNativeMaterial);
    instance.backgroundEffect(spec.blurred ? { radius: spec.radiusVp, color: spec.scrimColor } : undefined)
      .backgroundColor(spec.blurred ? Color.Transparent : spec.scrimColor);
  }
}

export const READER_NO_SHADOW: ShadowOptions = {
  radius: 0,
  color: Color.Transparent,
  offsetX: 0,
  offsetY: 0,
};

const materialCache: Map<string, uiMaterial.ImmersiveMaterial> = new Map<string, uiMaterial.ImmersiveMaterial>();

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
  return resolveReaderSurfaceMaterial(role, preferences, readerHarmonyCapabilities(), appScheme, systemScheme);
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
  decision: ReaderSurfaceMaterialDecision | undefined, applyShadow: boolean = true): void {
  if (deviceInfo.distributionOSApiVersion >= 260000) {
    if (deviceInfo.apiAvailable('26.0.0')) instance.systemMaterial(readerImmersiveMaterial(decision, applyShadow));
  }
}

export class ReaderImmersiveMaterialModifier implements AttributeModifier<CommonAttribute> {
  private readonly material: ReaderSurfaceMaterialDecision | undefined;

  constructor(material: ReaderSurfaceMaterialDecision | undefined) {
    this.material = material;
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    applyReaderImmersiveMaterial(instance, this.material);
  }
}

export function applyReaderPopupMaterial(options: CustomPopupOptions, decision: ReaderSurfaceMaterialDecision): void {
  if (deviceInfo.distributionOSApiVersion >= 260000) {
    if (deviceInfo.apiAvailable('26.0.0')) options.systemMaterial = readerImmersiveMaterial(decision);
  }
}

export function readerSheetBackdropBlur(
  preferences: ReaderNavigationPreferences,
  overlayUsesNativeMaterial: boolean = false,
): number {
  return shouldBlurBackdrop(preferences, overlayUsesNativeMaterial) ? READER_MODAL_BLUR_RADIUS_VP : 0;
}
