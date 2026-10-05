# R6 related manga gates

31/44 returned exit0; 13 returned nonzero.

No source/test edits, package build or device operation.

- tools/test-manga-admission.mjs: exit 0; 0.672s; test-manga-admission.log
- tools/test-manga-auth-recovery.mjs: exit 0; 0.509s; test-manga-auth-recovery.log
- tools/test-manga-book-presentation.mjs: exit 0; 0.114s; test-manga-book-presentation.log
- tools/test-manga-cancelled-banner.mjs: exit 1; 0.474s; test-manga-cancelled-banner.log
- tools/test-manga-cross-chapter-counter-sdk.mjs: exit 0; 0.811s; test-manga-cross-chapter-counter-sdk.log
- tools/test-manga-directory-demo-parity-sdk.mjs: exit 0; 2.795s; test-manga-directory-demo-parity-sdk.log
- tools/test-manga-directory-font-readiness-sdk.mjs: exit 1; 2.678s; test-manga-directory-font-readiness-sdk.log
- tools/test-manga-directory-route.mjs: exit 0; 1.227s; test-manga-directory-route.log
- tools/test-manga-display-policy.mjs: exit 0; 1.262s; test-manga-display-policy.log
- tools/test-manga-error-recovery.mjs: exit 1; 1.08s; test-manga-error-recovery.log
- tools/test-manga-far-page-tile-retirement.mjs: exit 0; 0.26s; test-manga-far-page-tile-retirement.log
- tools/test-manga-image-decode.mjs: exit 0; 0.975s; test-manga-image-decode.log
- tools/test-manga-image-graphics.mjs: exit 0; 0.875s; test-manga-image-graphics.log
- tools/test-manga-image-metadata-transfer.mjs: exit 0; 0.206s; test-manga-image-metadata-transfer.log
- tools/test-manga-metadata-ui.mjs: exit 0; 1.389s; test-manga-metadata-ui.log
- tools/test-manga-motion-progress.mjs: exit 1; 0.906s; test-manga-motion-progress.log
- tools/test-manga-navigation.mjs: exit 1; 0.906s; test-manga-navigation.log
- tools/test-manga-offline-network-probe.mjs: exit 1; 0.905s; test-manga-offline-network-probe.log
- tools/test-manga-offline.mjs: exit 0; 0.813s; test-manga-offline.log
- tools/test-manga-orientation.mjs: exit 0; 0.294s; test-manga-orientation.log
- tools/test-manga-platform-probe-sdk.mjs: exit 0; 12.573s; test-manga-platform-probe-sdk.log
- tools/test-manga-platform-probe.mjs: exit 0; 2.288s; test-manga-platform-probe.log
- tools/test-manga-reading-directory-fallback.mjs: exit 0; 2.546s; test-manga-reading-directory-fallback.log
- tools/test-manga-region-decode.mjs: exit 0; 0.224s; test-manga-region-decode.log
- tools/test-manga-resource-gateway.mjs: exit 0; 0.201s; test-manga-resource-gateway.log
- tools/test-manga-runtime-image-lane.mjs: exit 0; 1.865s; test-manga-runtime-image-lane.log
- tools/test-manga-scroll-stability-sdk.mjs: exit 0; 1.84s; test-manga-scroll-stability-sdk.log
- tools/test-manga-session.mjs: exit 1; 1.415s; test-manga-session.log
- tools/test-manga-sheet-motion-sdk.mjs: exit 1; 1.509s; test-manga-sheet-motion-sdk.log
- tools/test-manga-sheet-selection-sdk.mjs: exit 1; 1.701s; test-manga-sheet-selection-sdk.log
- tools/test-manga-source-switch.mjs: exit 0; 1.966s; test-manga-source-switch.log
- tools/test-manga-strip.mjs: exit 1; 1.609s; test-manga-strip.log
- tools/test-manga-surface-render-key-sdk.mjs: exit 0; 2.235s; test-manga-surface-render-key-sdk.log
- tools/test-manga-surface-sdk.mjs: exit 1; 4.398s; test-manga-surface-sdk.log
- tools/test-manga-tile-window.mjs: exit 1; 1.43s; test-manga-tile-window.log
- tools/test-manga-ui-assembly-sdk.mjs: exit 0; 2.939s; test-manga-ui-assembly-sdk.log
- tools/test-manga-ui-floating-bars.mjs: exit 0; 1.544s; test-manga-ui-floating-bars.log
- tools/test-manga-ui-position-hydration.mjs: exit 0; 1.182s; test-manga-ui-position-hydration.log
- tools/test-manga-ui-source-switch-discovery.mjs: exit 0; 0.27s; test-manga-ui-source-switch-discovery.log
- tools/test-manga-ui-source-switch-window.mjs: exit 0; 0.805s; test-manga-ui-source-switch-window.log
- tools/test-manga-ui-state.mjs: exit 1; 0.843s; test-manga-ui-state.log
- tools/test-manga-viewport-restore-sdk.mjs: exit 0; 2.79s; test-manga-viewport-restore-sdk.log
- tools/test-manga-visible-tile-retention.mjs: exit 0; 0.228s; test-manga-visible-tile-retention.log
- tools/test-manga-window-publication.mjs: exit 0; 0.225s; test-manga-window-publication.log

These gates prove their stated local/SDK layer only. New signed artifact and target system-bar pixel/layout acceptance remain separate.
