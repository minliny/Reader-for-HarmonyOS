import { deviceInfo } from '@kit.BasicServicesKit';
import { uiMaterial } from '@kit.ArkUI';

/** Explicit paper overrides for Reader controls styled with Reader design tokens. */
export class ReaderPaperMaterial implements AttributeModifier<CommonAttribute> {
  applyNormalAttribute(attribute: CommonAttribute): void {
    if (deviceInfo.distributionOSApiVersion >= 260000) {
      if (deviceInfo.apiAvailable('26.0.0')) {
        attribute.systemMaterial(uiMaterial.Material.empty);
      }
    }
  }
}
