# Historical native baseline reproduction

This reference is conditional on private native evidence. A clean public checkout
does not contain the captures, device metadata or review registry and must not
invent replacements. `private-inputs.json` declares the two historical sessions,
the registry, 443 required files by SHA-256, and the existing 85-capture/64-state
snapshot. It contains hashes only; raw evidence remains excluded from Git.

From the Host root:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix docs/ui-design
node docs/ui-design/app-baseline/build.mjs --check-inputs
node docs/ui-design/app-baseline/generate-logic.mjs --check
```

For evidence restored under another private Host root, add
`--evidence-host-root /private/path/Reader-for-HarmonyOS` to either command. Keep
the declared `evidence/<session>/...` layout. The checker validates the exact file
set and bytes before importing the private registry. Missing, added or changed
inputs fail explicitly. Updating a snapshot requires a reviewed provenance change
to the manifest; it does not automatically admit new images or close acceptance.

The existing private registry is code and is imported only after its reviewed
hash matches. The declared manifest and registry must be reviewed together when
changing the historical snapshot. The recorded index date is retained; refreshing
documentation does not capture a new UI or prove current HAP/source binding.

After deliberately changing the current reference specification, run
`node docs/ui-design/app-baseline/generate-logic.mjs` to refresh only
`CLASSIFICATION.md` and `LOGIC.md`. A separately requested HTML bundle refresh uses
`node docs/ui-design/app-baseline/build.mjs`; its esbuild 0.28.2 dependency is pinned
in the shared `docs/ui-design/package-lock.json`. There is no fallback to an old
private `node_modules` directory. This maintenance refreshed the two documents,
not the historical baseline bundle or native screenshots.

Control maintenance follows message categories and finite variants: restoration
confirmation remains native Alert, book removal remains custom Dialog, and action
menus use bottom Sheet. The original demo instruction is retained as a historical
quote with its scope; it does not require every production system window to be
drawn manually. Screenshot dates and their observed UI remain historical evidence.
