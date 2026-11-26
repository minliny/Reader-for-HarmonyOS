import { deviceInfo } from '@kit.BasicServicesKit';
import lazy { uiMaterial } from '@kit.ArkUI';

/** Explicit paper overrides for Reader controls styled with Reader design tokens. */
export class ReaderPaperMaterial implements AttributeModifier<CommonAttribute> {
  applyNormalAttribute(attribute: CommonAttribute): void {
    if (deviceInfo.distributionOSApiVersion >= 260000) {
      try {
        if (deviceInfo.apiAvailable('26.0.0')) {
          attribute.systemMaterial(uiMaterial.Material.empty);
        }
      } catch (_) { /* Keep the control usable when the optional material is unavailable. */ }
    }
  }
}
