# Raw-wrapper attribution and review correction

This evidence-parser correction changes no production source, Native input, HAP, raw UI tree, log, cache or image. Root owns execution against actual runtime data.

The original parser read `tree.attributes.bounds` as the window frame. Root initially identified recursively printed Reader-root attributes as the top-level node and reported a current B false FAIL: the Reader node's visible `bounds` is `[0,137][1280,2832]`, while its `origBounds` remains `[0,0][1280,2832]`. Direct examination of the raw files showed that the current top-level node is instead an empty-type UITest wrapper with `bounds=[0,0][1280,2832]`. The original parser therefore did **not** have that reported false FAIL in this actual wrapper format. Root acknowledged the misidentification and withdrew the top-level-origBounds proposal.

The limited final guard explicitly admits only this independent frame source: top-level empty-type UITest wrapper, wrapper `bounds` beginning at `[0,0]` with positive dimensions, exactly one matching Reader root as its descendant, and Reader `origBounds` equal to that wrapper frame. Reader visible `bounds` is separately reported and never substituted as the full frame. A/D visible image-edge coverage is unchanged. If a future dump has Reader root as its top-level node, this script leaves independent-frame scope OPEN rather than treating its possibly clipped visible bounds as a screen frame.

The inspected raw `vm/a.json`, `aSettled.json`, `b.json`, `d.json` each have the empty-type top-level wrapper with `origBounds=''` and a child Reader root. Wrapper `origBounds` is not required because its known raw UITest `bounds` is the independent physical full-frame source. No tree is normalized or overwritten by this correction. The production, Native and raw evidence remain unchanged.

The file-only request binding now accepts A's fixed `aSettled` stem as well as `a`; B/D remain `b`/`d`. The earlier `a.json`, captured before the last visible tile finished loading, is preserved and must retain its earlier FAIL/OPEN boundary. No sample is relabeled or overwritten.

Before correction:

- `check-native-runtime.mjs`: `cf8fa91b451f1b653ebf3ffec1a030e992acd90986837f5db170e034b59b94f6`
- `README.md`: `cfe5783469d98074d1a3dee3e946cfaa9c5e2da255cc2855f8fc78eb8d85da2b`

These exact v1 bytes are retained in `revisions/v1/`; earlier frozen reports and materials are untouched.
