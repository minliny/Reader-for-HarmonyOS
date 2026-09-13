# U10 import refresh source audit — 2026-09-14

Installed capture: `implementation-vm-final-20260914/reader-control-r9509-1789315814956-picker-file-selected.png/json`. One duplicate import, summary success icon is correct; right image is a C-shaped arc. No HDC/Git actions were performed in this audit.

## Source verdict

Figma file `klhs2jMM4MncaJFqZMfqEK`, exact provenance target `2657:819` (Icon), parent `2657:818` (Icon:transform), result summary `2657:807` (Page2ImportResult). Fresh `get_design_context` on icon and summary plus read-only Plugin API traversal confirm:

- Target frame is 18×18, rotation 113.927724°, contains exactly one Vector `2657:820` and exactly one open circular arc path. The vector is 13.5×13.5, strokeWeight 1.5, round caps.
- Parent `2657:818` is 18×18, clipsContent=false, and contains only that icon. No hidden/dropped arrow sibling exists.
- Fresh Figma screenshots are C-shaped too. The archived SVG and current production SVG each contain the same single path; current adaptation only removed export-time clip. Therefore a missing arrow is NOT a confirmed implementation defect and no arrow should be invented.
- The archived Make App covers search states, not LocalImport/ImportResult. It is not an alternative source for this glyph.

## Confirmed size defect

Figma summary context places the rotated icon with a 23.754×23.754 bounding box at left/top -2.88 inside the 18×18 allocation. The archived export normalized that rotated box to 24×24 (`stroke-width=1.51556`, original export clip rect `scale(1.01038) rotate(-113.928)`).

LocalImportDialog.resultSummary currently renders that 24×24 export at 18×18. This applies a second 0.75 scale to the stroke and path: effective stroke 1.13667vp instead of authored 1.5vp. With an Image paint size of 23.754 in the existing 18×18 centered slot, effective stroke becomes 1.5000vp and restores the authored bounds; no second rotation or path edits are needed.

Independent existing-pixel comparison supports the source calculation: live summary PNG is 318×52; right-arc green pixels span `[285,19][299,33]`, 14×14px at design scale. Installed native Image bounds `[1029,1326][1092,1389]`=63×63px/18vp, but arc spans `[1041,1338][1080,1377]`=39×39px=11.14vp at density3.5. This confirms shrinkage, not incomplete path export.

## Evidence

- `/private/tmp/reader-import-refresh-figma-live-20260914.json`: raw icon and summary design context + full actual target/parent/ancestors/vector properties/export.
- `/private/tmp/reader-import-refresh-figma-parent-live-20260914.json`: independent parent SVG export.
- `/private/tmp/reader-import-refresh-figma-summary.png`: exact tool-returned summary screenshot bytes, extracted without modification.
- `/private/tmp/reader-import-refresh-scale-evidence.json`: source and existing VM pixel measurements.

A source-sized centered overflow paint correction is proposed to root; production not yet changed at this recording point. New HAP/VM pixels remain separate gates.
