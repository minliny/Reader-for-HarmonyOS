# BookTurn V2 Stage-1 Chessboard Replay Evidence

- Date: 2026-08-29
- Purpose: V2 contract §13.2 Stage-1 chessboard replay evidence
- Solver state: Stage 1, pre-renderer (solver-only CPU replay; software point-splat rasterizer; no shader/GPU path, no SDK/VM)
- Sources: entry/src/main/cpp/bookturn/bookturn_solver.{h,cpp} (read-only) + entry/src/main/cpp/tests/bookturn_chessboard_replay.cpp (standalone; not in HAP build)
- Build: clang++ -std=c++17 -O2 -Wall -Wextra -Werror -I bookturn tests/bookturn_chessboard_replay.cpp bookturn/bookturn_solver.cpp -o /tmp/bookturn_replay_bin (zero warnings, deterministic)
- Viewport: W=390vp H=780vp; PPM P6 780x1560 (scale 2); checkerboard cell 24vp; material grid step 0.75vp; splat disc r=1.5 device px; sheet-only z-buffer (max z wins)
- Palette: revealed page A #F5EFE2/#D8CDBA; sheet front B #C8A24B/#8A6D2F; sheet backface B*0.45 (n.z<0); desk #2A2622
- Q(tau) segments (contract §6.2): S1 LIFT [0,0.18] x 1.0->0.80; S2 FLIP [0.18,0.50] x 0.80->0.50; S3 ROLL [0.50,0.75] x 0.50->0.25; S4 SPINE [0.75,0.90] x 0.25->0.05 (scale 1->0.6); S5 COLLAPSE [0.90,1] x 0.05->0 (beta pi->0, scale ->0)

## slow_drag

- frames: 240
- input: settlement input: edge.x W->0 linear over 240 frames (1.63 vp/frame), pointer=edge (1:1), overrideTheta=true settledTheta=0 (pure Q(tau) fold drive)
- fold-x trajectory (%W):
  f0000:100.00%W  f0010:90.18%W  f0020:87.19%W  f0030:84.82%W  f0040:82.68%W  f0050:80.59%W
  f0060:78.49%W  f0070:76.40%W  f0080:74.31%W  f0090:72.22%W  f0100:70.13%W  f0110:68.03%W
  f0120:65.91%W  f0130:62.96%W  f0140:59.70%W  f0150:56.07%W  f0160:51.95%W  f0170:47.04%W
  f0180:38.11%W  f0190:31.99%W  f0200:26.65%W  f0210:21.19%W  f0220:15.27%W  f0230: 5.96%W
  f0239: 0.00%W
- INV-1 fold monotone within forward sweep (step >= 1e-3vp; plateau |d|<1e-4 tolerated only in final 3 frames): PASS (worst 0 at frame -1) violations=0 plateaus=0
- INV-2 final-frame page coverage (<= 3%W): PASS (worst 0 at frame 239) final max screen-x = 0.000vp (0.00%W), limit 11.700vp; screen span [-390.0, 0.0]vp
- INV-3 cancel return-leg non-decreasing: n/a
- INV-3 cancel endpoint |fold_end - fold_0| <= 1vp: n/a
- max |theta| over sequence: 0.00 deg
- keyframes: frame_0000.ppm frame_0060.ppm frame_0120.ppm frame_0179.ppm frame_0239.ppm

## fast_drag

- frames: 60
- input: same W->0 sweep compressed to 60 frames (6.78 vp/frame), settlement input
- fold-x trajectory (%W):
  f0000:100.00%W  f0005:87.12%W  f0010:82.57%W  f0015:78.33%W  f0020:74.10%W  f0025:69.86%W
  f0030:65.48%W  f0035:59.09%W  f0040:51.03%W  f0045:36.41%W  f0050:25.28%W  f0055:13.41%W
  f0059: 0.00%W
- INV-1 fold monotone within forward sweep (step >= 1e-3vp; plateau |d|<1e-4 tolerated only in final 3 frames): PASS (worst 0 at frame -1) violations=0 plateaus=0
- INV-2 final-frame page coverage (<= 3%W): PASS (worst 0 at frame 59) final max screen-x = 0.000vp (0.00%W), limit 11.700vp; screen span [-390.0, 0.0]vp
- INV-3 cancel return-leg non-decreasing: n/a
- INV-3 cancel endpoint |fold_end - fold_0| <= 1vp: n/a
- max |theta| over sequence: 0.00 deg
- keyframes: frame_0000.ppm frame_0015.ppm frame_0030.ppm frame_0044.ppm frame_0059.ppm

## cancel

- frames: 180
- input: settlement input; leg1 90 frames W->0.4W, leg2 90 frames 0.4W->W (INV-3: reverse along the same schedule)
- fold-x trajectory (%W):
  f0000:100.00%W  f0010:88.24%W  f0020:84.33%W  f0030:80.93%W  f0040:77.56%W  f0050:74.19%W
  f0060:70.82%W  f0070:67.45%W  f0080:63.30%W  f0090:58.51%W  f0100:63.79%W  f0110:67.79%W
  f0120:71.16%W  f0130:74.53%W  f0140:77.90%W  f0150:81.27%W  f0160:84.69%W  f0170:88.71%W
  f0179:100.00%W
- INV-1 fold monotone within forward sweep (step >= 1e-3vp; plateau |d|<1e-4 tolerated only in final 3 frames): n/a
- INV-2 final-frame page coverage (<= 3%W): n/a
- INV-3 cancel return-leg non-decreasing: PASS (worst 0 at frame -1) return leg non-decreasing
- INV-3 cancel endpoint |fold_end - fold_0| <= 1vp: PASS (worst 0 at frame 179) |fold_end - fold_0| = 0.0000vp (limit 1.0)
- max |theta| over sequence: 0.00 deg
- note: cancel ends un-turned by design (sheet flat over the page, coverage = 100%W expected); INV-2 is not applicable to a cancelled turn
- keyframes: frame_0000.ppm frame_0045.ppm frame_0090.ppm frame_0134.ppm frame_0179.ppm

## tap_auto

- frames: 36
- input: settlement input; tau 0->1 linear over 36 frames (600ms @ 60fps), edge.x = W*Schedule(tau).xNorm (pure Q(tau) replay)
- fold-x trajectory (%W):
  f0000:100.00%W  f0005:82.15%W  f0010:77.22%W  f0015:67.95%W  f0020:62.54%W  f0025:43.28%W
  f0030:16.78%W  f0035: 0.00%W  
- INV-1 fold monotone within forward sweep (step >= 1e-3vp; plateau |d|<1e-4 tolerated only in final 3 frames): PASS (worst 0 at frame -1) violations=0 plateaus=0
- INV-2 final-frame page coverage (<= 3%W): PASS (worst 0 at frame 35) final max screen-x = 0.000vp (0.00%W), limit 11.700vp; screen span [-390.0, 0.0]vp
- INV-3 cancel return-leg non-decreasing: n/a
- INV-3 cancel endpoint |fold_end - fold_0| <= 1vp: n/a
- max |theta| over sequence: 0.00 deg
- keyframes: frame_0000.ppm frame_0009.ppm frame_0018.ppm frame_0026.ppm frame_0035.ppm

## previous_reverse

- frames: 180
- input: direction=PREVIOUS, start={0,H/2}, pointer=edge, edge.x 0->W raw (strict time reversal of the same Q(tau) trajectory, NO screen mirroring); the pose is the real screen pose: fold = FoldScreenX grows 0->W, the sheet is the previous page unrolling from the spine over the static current page
- fold-x trajectory (%W):
  f0000: 0.00%W  f0010: 5.59%W  f0020:11.17%W  f0030:16.76%W  f0040:22.35%W  f0050:27.93%W
  f0060:33.52%W  f0070:39.11%W  f0080:44.69%W  f0090:50.28%W  f0100:55.87%W  f0110:61.45%W
  f0120:67.04%W  f0130:72.63%W  f0140:78.21%W  f0150:83.80%W  f0160:89.39%W  f0170:94.97%W
  f0179:100.00%W
- INV-1 fold monotone within forward sweep (step >= 1e-3vp; plateau |d|<1e-4 tolerated only in final 3 frames): PASS (worst 0 at frame -1) violations=0 plateaus=0
- INV-2 final-frame page coverage (<= 3%W): PASS (worst 0 at frame 179) commit span [0.0, 390.0]vp (slivers L 0.000vp / R 0.000vp, limit 11.700vp); sheet flat over the page by design (swap replaces bottom with sheet)
- INV-3 cancel return-leg non-decreasing: n/a
- INV-3 cancel endpoint |fold_end - fold_0| <= 1vp: n/a
- max |theta| over sequence: 0.00 deg
- keyframes: frame_0000.ppm frame_0045.ppm frame_0090.ppm frame_0134.ppm frame_0179.ppm

## diagonal_psi

- frames: 120
- input: direction=NEXT, pointer.x=edge.x, pointer.y=H/2+280*sin(2*pi*i/(N-1)); overrideTheta=false (live tilt psi from the solver)
- fold-x trajectory (%W):
  f0000:100.00%W  f0010: 0.00%W  f0020: 0.00%W  f0030: 0.00%W  f0040: 0.00%W  f0050: 0.00%W
  f0060:62.05%W  f0070:11.31%W  f0080: 0.00%W  f0090: 8.45%W  f0100:10.87%W  f0110: 9.38%W
  f0119: 0.00%W
- INV-1 fold monotone within forward sweep (step >= 1e-3vp; plateau |d|<1e-4 tolerated only in final 3 frames): n/a
- INV-2 final-frame page coverage (<= 3%W): PASS (worst 3.809e-12 at frame 119) final max screen-x = 0.000vp (0.00%W), limit 11.700vp; screen span [-390.0, 0.0]vp
- INV-3 cancel return-leg non-decreasing: n/a
- INV-3 cancel endpoint |fold_end - fold_0| <= 1vp: n/a
- max |theta| over sequence: 56.47 deg
- keyframes: frame_0000.ppm frame_0030.ppm frame_0060.ppm frame_0089.ppm frame_0119.ppm

## u_sample

- frames: 13
- input: 13-frame tau ladder tau=i/12: edge.x = W*Schedule(tau).xNorm, pointer=edge, overrideTheta=true settledTheta=0 (pure Q(tau) fold drive); morphology fixture paired frame-by-frame with the internal U WebGL sample (Figma 3394:10546) 13-frame flipbook t=(i/12)*2.0s (contract 13.3-1)
- fold-x trajectory (%W):
  f0000:100.00%W  f0005:68.57%W  f0010:22.79%W  f0012: 0.00%W
- INV-1 fold monotone within forward sweep (step >= 1e-3vp; plateau |d|<1e-4 tolerated only in final 3 frames): PASS (worst 0 at frame -1) violations=0 plateaus=0
- INV-2 final-frame page coverage (<= 3%W): PASS (worst 0 at frame 12) final max screen-x = 0.000vp (0.00%W), limit 11.700vp; screen span [-390.0, 0.0]vp
- INV-3 cancel return-leg non-decreasing: n/a
- INV-3 cancel endpoint |fold_end - fold_0| <= 1vp: n/a
- max |theta| over sequence: 0.00 deg
- keyframes: frame_0000.ppm frame_0003.ppm frame_0006.ppm frame_0009.ppm frame_0012.ppm

## tap_auto vs internal U-sample roll anchors (print-only; different time bases)

| tau | fold-x %W (Q(tau) replay) | U anchor %W | delta %W |
|------|------|------|------|
| 0.500 | 66.05 | 68 | -1.95 |
| 0.600 | 59.52 | - | - |
| 0.667 | 50.18 | 26 | +24.18 |
| 0.750 | 39.27 | - | - |
| 0.833 | 22.88 | 0 | +22.88 |
| 0.900 | 9.38 | - | - |
| 1.000 | 0.00 | 0 | +0.00 |

No assert is applied to this table (different time bases: linear-tau 600ms timeline vs U-sample time base); recorded for form review only.

## Notes

- previous_reverse semantics (stage-2 correction 2026-08-29): PREVIOUS is the strict time reversal of the same Q(tau) trajectory with NO screen mirroring. The moving sheet is the previous page unrolling from the spine over the static current page (bottom layer); the stage sequence runs backward (gesture start tau=1 COLLAPSE, commit tau=0 FLAT); content stays unmirrored (flat branch of p(q) is the identity map).
- previous_reverse INV-2 reading: at commit the sheet lies flat over [0, W], exactly covering the revealed page, so the NEXT residue form (<= 3%W) does not apply; the check is the full-coverage span form (L sliver <= 3%W, R sliver <= 3%W), recorded in the INV-2 line.
- previous gesture start (edge 0, tau 1, radius 0): the previous sheet maps to [-W, 0] flat - wholly off-screen, so the current page (bottom layer) shows unobstructed at the first frame (fixes the V1 previous-start drape defect).
- Commit geometry (NEXT): at tau=1 radiusScale=0 -> radius=0, fold at the spine, and the sheet maps to [-W, 0] flat backface (n.z=-1, z=0): the turned page lies on the far stack with 0 sliver over the revealed page (INV-2 margin = full 3%W).
- u_sample pairing (contract 13.3-1): frame k renders tau=k/12 of the canonical Q(tau) trajectory (NEXT roll to spine, straight fold); the reference is the internal U WebGL sample (Figma 3394:10546) 13-frame flipbook t=(k/12)*2.0s archived at /tmp/u_frames/f{k:02d}_t*.png. Side-by-side composites (left: chessboard replay, right: U sample) live at evidence/bookturn-v2-replay/u_compare/f{k:02d}_side.png. Form reference only - different content bases, no pixel-diff gate.
- Sheets mapping outside the frame (curl bulge overflow, commit stack) are clipped by image bounds; the INV-2 numbers are computed from mapped coordinates over the full material grid, independent of clipping.
- All 816 frames exist as PPM under the run output dir (/tmp/bookturn_replay/<seq>/); this directory holds each sequence's final frame + 4 evenly spaced keyframes (see keyframes.txt), converted to PNG when ffmpeg is available.
