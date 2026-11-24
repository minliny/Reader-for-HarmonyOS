import deviceInfo from '@ohos.deviceInfo';
import lazy { hdsMaterial } from '@kit.UIDesignKit';
import {
  harmonyDistributionSupportsApi24, probeHarmonyCapabilities, readHarmonyDistributionVersion,
  type ReaderHarmonyCapabilities, type ReaderNativeNavigationMaterial,
} from './HarmonyCapabilityPolicy';

let capabilities: ReaderHarmonyCapabilities | undefined;

export function readerHarmonyApi24(): boolean {
  return harmonyDistributionSupportsApi24(
    readHarmonyDistributionVersion((): number => deviceInfo.distributionOSApiVersion));
}

function nativeNavigationMaterial(api26: boolean): ReaderNativeNavigationMaterial {
  const supported = hdsMaterial.getSystemMaterialTypes();
  if (api26 && supported.includes(hdsMaterial.MaterialType.IMMERSIVE)) return 'immersive';
  return supported.some(type => type !== hdsMaterial.MaterialType.NONE) ? 'adaptive' : 'unavailable';
}

/** The optional HDS module and API 26 method are reached only through their
 * distribution and system-capability checks. These facts never enter backup. */
export function readerHarmonyCapabilities(): ReaderHarmonyCapabilities {
  if (capabilities === undefined) {
    capabilities = probeHarmonyCapabilities({
      distributionVersion: (): number => deviceInfo.distributionOSApiVersion,
      api26: (): boolean => deviceInfo.apiAvailable('26.0.0'),
      navigation: (): boolean => deviceInfo.deviceType !== 'tv' &&
        canIUse('SystemCapability.UIDesign.HDSComponent.Core'),
      material: nativeNavigationMaterial,
      grip: (): boolean => canIUse('SystemCapability.MultimodalAwareness.Motion'),
    });
  }
  return capabilities;
}
