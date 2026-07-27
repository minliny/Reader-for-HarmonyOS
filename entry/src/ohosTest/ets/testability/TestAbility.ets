import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';

// The official ohosTest package requires a main element. The test runner owns
// execution; this ability only provides the package entry required by the
// Stage test target. The runner does not need a window, so it never creates a
// product-facing screen or a synthetic test page.
export default class TestAbility extends UIAbility {
  onCreate(_want: Want, _launchParam: AbilityConstant.LaunchParam): void {}
}
