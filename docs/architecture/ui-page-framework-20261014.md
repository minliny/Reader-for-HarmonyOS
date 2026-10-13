# UI page framework completion candidate

The isolated candidate is
`.reader-isolated/ui-framework-completion-20261014/Reader-for-HarmonyOS`, based on
`4764886e`. The problem is repeated private ownership of page masks, fixed-header
layers, scroll clearance and footer placement. Sharing colors or naming a local
Stack as a shell does not satisfy the page contract.

## Finite ownership

`ReaderPageShell.ts` owns the finite page/header policy, opaque surface choice and
local inset calculation. `ReaderPageScaffold` is the actual native frame and slot
host. `ReaderFixedHeaderHost` owns the real fixed-header paint, clip, stacking and
measured-height callback. `ReaderStandardPage` delegates the existing conventional
scroll/header pages through these common hosts; it owns no business state.

Main tab, settings, conventional management/form, search, selection, detail,
directory, downloads and reading remain explicit categories. Their controls and
content identities are preserved. The frame does not turn the manga directory
into the novel directory or the detail catalog into the reading directory.

The root `Index` retains the system/cutout safe-area ownership. Page frames consume
local measured header/footer clearance and the already supplied horizontal and
bottom window facts. They must not add the system top inset a second time.
Reader overlays and immersive reading remain named variants; their intentional
transparency does not permit a conventional page header to omit its mask.

## Coverage and regression gates

The page coverage contract inventories all twenty `ReaderRoute` members, including
product-disabled RSS/Discover/Sync routes. It traces every actual Index dispatcher
branch and the separate retained-reading/catalog mount branches through SDK AST,
ending at an imported common frame. A sibling manga branch cannot prove the text
branch. Novel detail uses ReaderFullDirectory; manga detail uses BookDirectoryPage.
The latter's standard component fallback has a separate fallback contract and is
not reported as the production novel detail route. Added bare/unknown branches,
missing common hosts, unknown variants and caller appearance overrides fail.

ReaderFullDirectory has explicit detail/reader context. Detail inherits the
parent-consumed system top and adds its original 18vp design gap; reader context
owns its window edge. Its finite readerDirectory frame keeps the window owner's
reading paper and native clip. A stable HeaderHost reports each native Area with
its captured measurement key, rejects stale events and preserves the same header,
panel and list actors. The independent detail catalog may browse without a saved
anchor; embedded reading continues to wait for the admitted anchor and does not
invent a reading position. Sync's initial configuration-loading branch uses the
same common frame as other ordinary page states.

SDK probes compile and replay the actual shared components and their actual
BuilderParam slots. Header and content checks record native attribute calls and
measured-height callbacks; they do not claim compositor pixels. Shared-policy
mutations must propagate through the actual consumers. Missing solid paint and
private caller overrides are tested as negative controls.

The original one hundred private budget witnesses remain immutable: ninety-three
unchanged retained rows plus seven existing reversible transfers. New common
hosts have exact producer/interface/consumer/implementation contracts, not a
wildcard exemption for the common directory. The single page-policy TypeScript
module has a separately bounded spec contract. No old private budget is raised.
All previous typography, popup, icon, recovery and source-switch negative controls
remain active.

Registration also corrects a pre-existing witness drift at baseline `4764886e`:
the two directory-rule `ReaderFormField` calls already supplied `isEditable`,
while their producer consumer records omitted that key. The two existing input
records now match the baseline source. Their spec, implementation and private
budgets are unchanged; this is separate from the page migration.

## Evidence boundary

This document records the isolated source contract and its intended validation.
Focused contract/SDK results are reported separately after execution. HAP build,
manifest, installation, VM/native scroll and user visual acceptance are independent
gates; this source registration alone closes none of them.
