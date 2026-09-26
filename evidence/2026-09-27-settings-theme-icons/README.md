# Settings SVG live-theme binding

Observed on the d93be35d VM package: App theme, automatic update and reduced-motion row icons retained Day gold after switching Night, while cache/reset icons updated. Evidence owned by root: reader-control-real-d93b-general-dark-live.png and original-restored.png; original values were recorded/restored by root. No device operation was performed for this code repair.

SettingsPage selected the Resource before passing it through @Builder parameters. Retained Image observers and CategoryRow child updates therefore captured the old resource. CategoryRow.icon is already a Prop; generated Night SVGs are correct. The cache row works because its conditional resource is evaluated directly inside the concrete component observer.

The same SettingsPage row helpers now accept a Resource getter and resolve it inside Image/CategoryRow observer execution. This fixes the shared nav/select/segment/switch/permission icon path without changing components, assets, palette, size, click behavior or settings values.

The new test reads the actual three call-site expressions through SDK AST, runs actual SDK-generated iconBox and switchRow observers, and replays retained Day→Night→Day. The red log demonstrates all three old resources remaining Day. Green verifies actual Image resources plus CategoryRow Prop update payloads. The existing dynamic icon gate covered computed $r expressions in reading/navigation controls; literal conditional resources were validated by generation, but their lifetime across these Builder arguments was not tested. Existing dynamic-theme icons (101 cases) and search/settings feedback (7 groups) also pass. All tests remain in the existing test-*.mjs full gate.

This is local SDK observer evidence, not native dependency-scheduler or pixel acceptance. Full ArkTS/package and new-package VM verification remain separate.
