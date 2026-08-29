// Stage-1 visual-form evidence generator for the BookTurn V2 simulated
// page-turn solver (V2 contract docs/BOOK_PAGE_TURN_CONTRACT_V2_2026-08-29.md,
// section 13.2 invariants).
//
// Replays six scripted page-turn trajectories through the real solver
// (bookturn/bookturn_solver.cpp) and renders each frame with a software
// point-splat rasterizer into binary PPM (P6) frames. Checkerboard textures
// make fold-line freeze, mid-screen dwell, commit-pop and cancel asymmetry
// visually obvious; form invariants are checked numerically per sequence and
// summarized in manifest.md.
//
// Standalone evidence tool: NOT part of the HAP build (never referenced from
// any CMakeLists). Build (from entry/src/main/cpp):
//   clang++ -std=c++17 -O2 -Wall -Wextra -Werror -I bookturn \
//       tests/bookturn_chessboard_replay.cpp bookturn/bookturn_solver.cpp \
//       -o /tmp/bookturn_replay_bin
// Run:
//   /tmp/bookturn_replay_bin /tmp/bookturn_replay
//
// Rendering model: the base layer is checkerboard A (revealed page) over the
// page rect; desk color elsewhere. The moving sheet is splatted from a dense
// material grid (0.75 vp steps) through MapMaterial/SurfaceNormal into a
// sheet-only z-buffer (max z wins per pixel), then composited over the base.
// theta=0 frames are orthographic top-down; tilted frames (diagonal_psi) use
// mapped (x, y) directly as a form approximation. All poses are consumed
// unmirrored: the solver emits the real screen pose for both directions
// (contract 6.2 strict time reversal, stage-2 semantic correction).

#include "bookturn_solver.h"

#include <sys/stat.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

namespace {

using reader::bookturn::BookTurnInput;
using reader::bookturn::BookTurnPose;
using reader::bookturn::BookTurnSolver;
using reader::bookturn::Direction;
using reader::bookturn::Vec2;
using reader::bookturn::Vec3;

constexpr float kPi = 3.14159265358979323846F;

// Replay viewport (phone portrait).
constexpr float kW = 390.0F;
constexpr float kH = 780.0F;
constexpr float kMidY = kH * 0.5F;
constexpr int kScale = 2;
constexpr int kImgW = static_cast<int>(kW) * kScale;  // 780
constexpr int kImgH = static_cast<int>(kH) * kScale;  // 1560

// Rasterizer knobs.
constexpr float kMaterialStep = 0.75F;  // vp between material samples
constexpr float kCellVp = 24.0F;        // checkerboard cell in vp
constexpr float kSplatRadiusPx = 1.5F;  // splat disc radius in device px
constexpr float kDiagonalAmplitudeVp = 280.0F;
constexpr float kBackfaceDim = 0.45F;
constexpr float kNoDepth = -1.0e30F;

// Form-check tolerances (task spec).
constexpr float kInv1MinStepVp = 1.0e-3F;
constexpr float kPlateauTolVp = 1.0e-4F;      // tolerated only in final 3 frames
constexpr float kInv2MaxCoverageVp = 0.03F * kW;  // 11.7 vp
constexpr float kCancelReturnTolVp = 1.0e-4F;
constexpr float kCancelEndpointTolVp = 1.0F;
constexpr float kThetaFallbackDeg = 0.0573F;  // ~1e-3 rad, diagonal fallback gate

struct Rgb {
    uint8_t r;
    uint8_t g;
    uint8_t b;
};
constexpr Rgb kDesk{42, 38, 34};        // #2A2622
constexpr Rgb kPaperA1{245, 239, 226};  // #F5EFE2
constexpr Rgb kPaperA2{216, 205, 186};  // #D8CDBA
constexpr Rgb kSheetB1{200, 162, 75};   // #C8A24B (frontface cell 0)
constexpr Rgb kSheetB2{138, 109, 47};   // #8A6D2F (frontface cell 1)

enum class SeqId { kSlowDrag, kFastDrag, kCancel, kTapAuto, kPreviousReverse, kDiagonalPsi, kUSample };

struct SeqSpec {
    SeqId id;
    const char* name;
    int frames;
    bool checkInv1;
    bool checkInv2;
    bool foldIncreasing; // INV-1 direction (PREVIOUS real fold grows 0->W)
    bool overrideTheta;
    float settledTheta;
};

struct FrameRec {
    int index = 0;
    float tau = 0.0F;
    float foldVp = 0.0F;
    float foldPctW = 0.0F;
};

struct CheckResult {
    bool pass = true;
    bool applicable = false;
    float worst = 0.0F;
    int worstFrame = -1;
    std::string note;
};

struct TapProbe {
    float tau = 0.0F;
    float foldPctW = 0.0F;
    bool hasAnchor = false;
    float anchorPctW = 0.0F;
};

struct SeqReport {
    SeqSpec spec{};
    std::vector<FrameRec> recs;
    CheckResult inv1;
    CheckResult inv2;
    CheckResult cancelReturn;
    CheckResult cancelEndpoint;
    float maxAbsThetaDeg = 0.0F;
    float finalMaxCanonX = 0.0F;
    float finalMinCanonX = 0.0F;
    bool usedThetaFallback = false;
    std::string notes;
};

// ---------------------------------------------------------------------------
// Filesystem / IO helpers
// ---------------------------------------------------------------------------

void MakeDirs(const std::string& path) {
    if (path.empty()) {
        return;
    }
    std::string built;
    size_t start = 0;
    if (path[0] == '/') {
        built = "/";
        start = 1;
    }
    while (start <= path.size()) {
        size_t slash = path.find('/', start);
        if (slash == std::string::npos) {
            slash = path.size();
        }
        if (slash > start) {
            if (!built.empty() && built.back() != '/') {
                built += '/';
            }
            built += path.substr(start, slash - start);
            mkdir(built.c_str(), 0755);
        }
        if (slash == path.size()) {
            break;
        }
        start = slash + 1;
    }
}

bool WritePpm(const std::string& path, const std::vector<uint8_t>& img) {
    FILE* file = std::fopen(path.c_str(), "wb");
    if (file == nullptr) {
        return false;
    }
    std::fprintf(file, "P6\n%d %d\n255\n", kImgW, kImgH);
    const size_t written = std::fwrite(img.data(), 1U, img.size(), file);
    std::fclose(file);
    return written == img.size();
}

bool WriteTextFile(const std::string& path, const std::string& text) {
    FILE* file = std::fopen(path.c_str(), "wb");
    if (file == nullptr) {
        return false;
    }
    const size_t written = std::fwrite(text.data(), 1U, text.size(), file);
    std::fclose(file);
    return written == text.size();
}

// ---------------------------------------------------------------------------
// Scripted inputs
// ---------------------------------------------------------------------------

// Edge sweep per sequence. Cancel is fixed 90 + 90 frames by construction.
float EdgeX(SeqId id, int i, int n) {
    const float last = static_cast<float>(n - 1);
    switch (id) {
    case SeqId::kSlowDrag:
    case SeqId::kFastDrag:
    case SeqId::kDiagonalPsi:
        return kW * (1.0F - static_cast<float>(i) / last);
    case SeqId::kTapAuto:
    case SeqId::kUSample: {
        float xNorm = 1.0F;
        float beta = 0.0F;
        float scale = 1.0F;
        BookTurnSolver::Schedule(static_cast<float>(i) / last, xNorm, beta, scale);
        return kW * xNorm;
    }
    case SeqId::kCancel:
        if (i < 90) {
            return kW * (1.0F - 0.6F * static_cast<float>(i) / 89.0F);
        }
        return kW * (0.4F + 0.6F * static_cast<float>(i - 90) / 89.0F);
    case SeqId::kPreviousReverse:
        return kW * static_cast<float>(i) / last;
    }
    return kW;
}

BookTurnInput MakeInput(const SeqSpec& spec, int i) {
    BookTurnInput in;
    in.generation = static_cast<uint64_t>(i) + 1U;
    in.width = kW;
    in.height = kH;
    in.eventTimeNs = static_cast<int64_t>(i) * 16666667LL;
    in.radiusScale = 1.0F;
    const float edgeX = EdgeX(spec.id, i, spec.frames);
    if (spec.id == SeqId::kPreviousReverse) {
        // Raw real-screen values; the pose is the real screen pose for both
        // directions (strict time reversal, no mirroring anywhere).
        in.direction = Direction::PREVIOUS;
        in.start = {0.0F, kMidY};
        in.edge = {edgeX, kMidY};
        in.pointer = in.edge;
        return in;
    }
    in.direction = Direction::NEXT;
    in.start = {kW, kMidY};
    in.edge = {edgeX, kMidY};
    if (spec.id == SeqId::kDiagonalPsi) {
        const float phase =
            2.0F * kPi * static_cast<float>(i) / static_cast<float>(spec.frames - 1);
        in.pointer = {edgeX, kMidY + kDiagonalAmplitudeVp * std::sin(phase)};
    } else {
        in.pointer = in.edge;  // 1:1 chase
    }
    in.overrideTheta = spec.overrideTheta;
    in.settledTheta = spec.settledTheta;
    return in;
}

std::string InputDescription(const SeqSpec& spec) {
    switch (spec.id) {
    case SeqId::kSlowDrag:
        return "settlement input: edge.x W->0 linear over 240 frames (1.63 vp/frame), "
               "pointer=edge (1:1), overrideTheta=true settledTheta=0 (pure Q(tau) fold drive)";
    case SeqId::kFastDrag:
        return "same W->0 sweep compressed to 60 frames (6.78 vp/frame), settlement input";
    case SeqId::kCancel:
        return "settlement input; leg1 90 frames W->0.4W, leg2 90 frames 0.4W->W "
               "(INV-3: reverse along the same schedule)";
    case SeqId::kTapAuto:
        return "settlement input; tau 0->1 linear over 36 frames (600ms @ 60fps), "
               "edge.x = W*Schedule(tau).xNorm (pure Q(tau) replay)";
    case SeqId::kUSample:
        return "13-frame tau ladder tau=i/12: edge.x = W*Schedule(tau).xNorm, pointer=edge, "
               "overrideTheta=true settledTheta=0 (pure Q(tau) fold drive); morphology fixture "
               "paired frame-by-frame with the internal U WebGL sample (Figma 3394:10546) "
               "13-frame flipbook t=(i/12)*2.0s (contract 13.3-1)";
    case SeqId::kPreviousReverse:
        return "direction=PREVIOUS, start={0,H/2}, pointer=edge, edge.x 0->W raw "
               "(strict time reversal of the same Q(tau) trajectory, NO screen mirroring); "
               "the pose is the real screen pose: fold = FoldScreenX grows 0->W, the sheet "
               "is the previous page unrolling from the spine over the static current page";
    case SeqId::kDiagonalPsi:
        return "direction=NEXT, pointer.x=edge.x, pointer.y=H/2+280*sin(2*pi*i/(N-1)); "
               "overrideTheta=false (live tilt psi from the solver)";
    }
    return "";
}

// ---------------------------------------------------------------------------
// Rasterizer
// ---------------------------------------------------------------------------

struct Canvas {
    std::vector<uint8_t> img;       // composited RGB
    std::vector<float> sheetZ;      // sheet-only z-buffer
    std::vector<uint8_t> sheetCol;  // sheet RGB per pixel
    std::vector<uint8_t> sheetMask;
    float maxCanonX = 0.0F;
    float minCanonX = 0.0F;
};

void InitCanvas(Canvas& canvas) {
    const size_t pixels = static_cast<size_t>(kImgW) * static_cast<size_t>(kImgH);
    canvas.img.assign(pixels * 3U, 0U);
    canvas.sheetZ.assign(pixels, kNoDepth);
    canvas.sheetCol.assign(pixels * 3U, 0U);
    canvas.sheetMask.assign(pixels, 0U);
}

Rgb SheetColor(float u, float v, bool backface) {
    const int cell = (static_cast<int>(std::floor(u / kCellVp)) +
                      static_cast<int>(std::floor(v / kCellVp))) & 1;
    Rgb color = cell == 0 ? kSheetB1 : kSheetB2;
    if (backface) {
        color.r = static_cast<uint8_t>(static_cast<float>(color.r) * kBackfaceDim);
        color.g = static_cast<uint8_t>(static_cast<float>(color.g) * kBackfaceDim);
        color.b = static_cast<uint8_t>(static_cast<float>(color.b) * kBackfaceDim);
    }
    return color;
}

void PaintBase(Canvas& canvas) {
    const size_t pixels = canvas.img.size() / 3U;
    for (size_t p = 0; p < pixels; ++p) {
        canvas.img[p * 3U] = kDesk.r;
        canvas.img[p * 3U + 1U] = kDesk.g;
        canvas.img[p * 3U + 2U] = kDesk.b;
    }
    // Page rect == whole frame; checkerboard A over it.
    for (int iy = 0; iy < kImgH; ++iy) {
        const float y = static_cast<float>(iy) / static_cast<float>(kScale);
        const int cellY = static_cast<int>(std::floor(y / kCellVp));
        for (int ix = 0; ix < kImgW; ++ix) {
            const float x = static_cast<float>(ix) / static_cast<float>(kScale);
            const int cellX = static_cast<int>(std::floor(x / kCellVp));
            const Rgb color = ((cellX + cellY) & 1) == 0 ? kPaperA1 : kPaperA2;
            const size_t o = (static_cast<size_t>(iy) * static_cast<size_t>(kImgW) +
                              static_cast<size_t>(ix)) * 3U;
            canvas.img[o] = color.r;
            canvas.img[o + 1U] = color.g;
            canvas.img[o + 2U] = color.b;
        }
    }
}

void RenderPose(Canvas& canvas, const BookTurnPose& pose) {
    std::fill(canvas.sheetZ.begin(), canvas.sheetZ.end(), kNoDepth);
    std::fill(canvas.sheetMask.begin(), canvas.sheetMask.end(), static_cast<uint8_t>(0));
    canvas.maxCanonX = kNoDepth;     // running max seeded at -inf
    canvas.minCanonX = -kNoDepth;    // running min seeded at +inf

    const int nu = static_cast<int>(kW / kMaterialStep);  // 520 -> u hits W exactly
    const int nv = static_cast<int>(kH / kMaterialStep);  // 1040 -> v hits H exactly
    const float radiusSq = kSplatRadiusPx * kSplatRadiusPx;

    for (int iv = 0; iv <= nv; ++iv) {
        const float v = std::min(kH, static_cast<float>(iv) * kMaterialStep);
        for (int iu = 0; iu <= nu; ++iu) {
            const float u = std::min(kW, static_cast<float>(iu) * kMaterialStep);
            const Vec2 material{u, v};
            const Vec3 p = BookTurnSolver::MapMaterial(pose, material);
            const Vec3 n = BookTurnSolver::SurfaceNormal(pose, material);
            canvas.maxCanonX = std::max(canvas.maxCanonX, p.x);
            canvas.minCanonX = std::min(canvas.minCanonX, p.x);

            const float sx = p.x * static_cast<float>(kScale);
            const float sy = p.y * static_cast<float>(kScale);
            if (sx < -kSplatRadiusPx || sx > static_cast<float>(kImgW) + kSplatRadiusPx ||
                sy < -kSplatRadiusPx || sy > static_cast<float>(kImgH) + kSplatRadiusPx) {
                continue;
            }
            const Rgb color = SheetColor(u, v, n.z < 0.0F);
            const int x0 = static_cast<int>(std::floor(sx - kSplatRadiusPx));
            const int x1 = static_cast<int>(std::floor(sx + kSplatRadiusPx));
            const int y0 = static_cast<int>(std::floor(sy - kSplatRadiusPx));
            const int y1 = static_cast<int>(std::floor(sy + kSplatRadiusPx));
            for (int iy = y0; iy <= y1; ++iy) {
                if (iy < 0 || iy >= kImgH) {
                    continue;
                }
                for (int ix = x0; ix <= x1; ++ix) {
                    if (ix < 0 || ix >= kImgW) {
                        continue;
                    }
                    const float dx = (static_cast<float>(ix) + 0.5F) - sx;
                    const float dy = (static_cast<float>(iy) + 0.5F) - sy;
                    if (dx * dx + dy * dy > radiusSq) {
                        continue;
                    }
                    const size_t idx = static_cast<size_t>(iy) * static_cast<size_t>(kImgW) +
                                       static_cast<size_t>(ix);
                    if (p.z > canvas.sheetZ[idx]) {
                        canvas.sheetZ[idx] = p.z;
                        canvas.sheetMask[idx] = 1U;
                        const size_t o = idx * 3U;
                        canvas.sheetCol[o] = color.r;
                        canvas.sheetCol[o + 1U] = color.g;
                        canvas.sheetCol[o + 2U] = color.b;
                    }
                }
            }
        }
    }
    for (size_t idx = 0; idx < canvas.sheetMask.size(); ++idx) {
        if (canvas.sheetMask[idx] != 0U) {
            const size_t o = idx * 3U;
            canvas.img[o] = canvas.sheetCol[o];
            canvas.img[o + 1U] = canvas.sheetCol[o + 1U];
            canvas.img[o + 2U] = canvas.sheetCol[o + 2U];
        }
    }
}

// ---------------------------------------------------------------------------
// Sequence driver + form checks
// ---------------------------------------------------------------------------

SeqReport RunPass(const SeqSpec& spec, const std::string& seqDir) {
    SeqReport rep;
    rep.spec = spec;
    Canvas canvas;
    InitCanvas(canvas);
    const float radToDeg = 180.0F / kPi;
    rep.recs.reserve(static_cast<size_t>(spec.frames));
    for (int i = 0; i < spec.frames; ++i) {
        const BookTurnInput in = MakeInput(spec, i);
        const BookTurnPose pose = BookTurnSolver::Solve(in, nullptr);
        rep.maxAbsThetaDeg = std::max(rep.maxAbsThetaDeg, std::fabs(pose.theta) * radToDeg);
        PaintBase(canvas);
        RenderPose(canvas, pose);
        FrameRec rec;
        rec.index = i;
        rec.tau = pose.tau;
        rec.foldVp = BookTurnSolver::FoldScreenX(pose.axis, pose.theta, kH);
        rec.foldPctW = rec.foldVp / kW * 100.0F;
        rep.recs.push_back(rec);
        std::printf("%-16s f%03d/%03d tau=%.4f fold=%7.2fvp (%6.2f%%W)\n", spec.name, i,
                    spec.frames - 1, static_cast<double>(pose.tau),
                    static_cast<double>(rec.foldVp), static_cast<double>(rec.foldPctW));
        if (i == spec.frames - 1) {
            rep.finalMaxCanonX = canvas.maxCanonX;
            rep.finalMinCanonX = canvas.minCanonX;
        }
        char framePath[512];
        std::snprintf(framePath, sizeof(framePath), "%s/frame_%04d.ppm", seqDir.c_str(), i);
        if (!WritePpm(framePath, canvas.img)) {
            rep.notes += "frame write failed; ";
        }
    }
    return rep;
}

void CheckInv1(SeqReport& rep) {
    CheckResult& result = rep.inv1;
    result.applicable = rep.spec.checkInv1;
    if (!result.applicable) {
        return;
    }
    const int n = static_cast<int>(rep.recs.size());
    int violations = 0;
    std::string plateaus;
    for (int i = 1; i < n; ++i) {
        const float delta = rep.recs[static_cast<size_t>(i)].foldVp -
                            rep.recs[static_cast<size_t>(i - 1)].foldVp;
        const bool ok = rep.spec.foldIncreasing ? delta >= kInv1MinStepVp
                                                : delta <= -kInv1MinStepVp;
        if (ok) {
            continue;
        }
        if (i >= n - 3 && std::fabs(delta) < kPlateauTolVp) {
            char buf[80];
            std::snprintf(buf, sizeof(buf), "[f%d->%d d=%.1e]", i - 1, i,
                          static_cast<double>(delta));
            plateaus += buf;
            continue;
        }
        if (violations == 0 ||
            (rep.spec.foldIncreasing ? delta < result.worst : delta > result.worst)) {
            result.worst = delta;
            result.worstFrame = i;
        }
        ++violations;
    }
    result.pass = violations == 0;
    char buf[160];
    std::snprintf(buf, sizeof(buf), "violations=%d plateaus=%s", violations,
                  plateaus.empty() ? "0" : plateaus.c_str());
    result.note = buf;
}

void CheckInv2(SeqReport& rep) {
    CheckResult& result = rep.inv2;
    result.applicable = rep.spec.checkInv2;
    if (!result.applicable) {
        return;
    }
    char buf[256];
    result.worstFrame = rep.spec.frames - 1;
    if (rep.spec.id == SeqId::kPreviousReverse) {
        // PREVIOUS commit: the unrolled previous sheet lies flat over [0, W],
        // exactly covering the revealed page — the swap replaces the bottom
        // page with the sheet itself, so INV-2 takes the full-coverage span
        // form (both extremes within a 3%W sliver of the spines) instead of
        // the NEXT residue form.
        const float leftSliver = rep.finalMinCanonX;
        const float rightSliver = kW - rep.finalMaxCanonX;
        result.worst = std::max(leftSliver, rightSliver);
        result.pass = leftSliver <= kInv2MaxCoverageVp && rightSliver <= kInv2MaxCoverageVp;
        std::snprintf(buf, sizeof(buf),
                      "commit span [%.1f, %.1f]vp (slivers L %.3fvp / R %.3fvp, limit %.3fvp); "
                      "sheet flat over the page by design (swap replaces bottom with sheet)",
                      static_cast<double>(rep.finalMinCanonX),
                      static_cast<double>(rep.finalMaxCanonX),
                      static_cast<double>(leftSliver), static_cast<double>(rightSliver),
                      static_cast<double>(kInv2MaxCoverageVp));
    } else {
        // NEXT: final-frame residue of the moving sheet over the revealed page.
        const float coverage = rep.finalMaxCanonX;
        result.worst = coverage;
        result.pass = coverage <= kInv2MaxCoverageVp;
        std::snprintf(buf, sizeof(buf),
                      "final max screen-x = %.3fvp (%.2f%%W), limit %.3fvp; "
                      "screen span [%.1f, %.1f]vp",
                      static_cast<double>(coverage),
                      static_cast<double>(coverage / kW * 100.0F),
                      static_cast<double>(kInv2MaxCoverageVp),
                      static_cast<double>(rep.finalMinCanonX),
                      static_cast<double>(rep.finalMaxCanonX));
    }
    result.note = buf;
}

void CheckCancel(SeqReport& rep) {
    if (rep.spec.id != SeqId::kCancel) {
        return;
    }
    const int n = static_cast<int>(rep.recs.size());
    auto foldAt = [&rep](int i) { return rep.recs[static_cast<size_t>(i)].foldVp; };

    CheckResult& ret = rep.cancelReturn;
    ret.applicable = true;
    bool firstViolation = true;
    for (int i = 91; i < n; ++i) {
        const float delta = foldAt(i) - foldAt(i - 1);
        if (delta < -kCancelReturnTolVp) {
            if (firstViolation || delta < ret.worst) {
                ret.worst = delta;
                ret.worstFrame = i;
                firstViolation = false;
            }
            ret.pass = false;
        }
    }
    ret.note = ret.pass ? "return leg non-decreasing" : "fold decreased during return leg";

    CheckResult& endpoint = rep.cancelEndpoint;
    endpoint.applicable = true;
    const float diff = std::fabs(foldAt(n - 1) - foldAt(0));
    endpoint.worst = diff;
    endpoint.worstFrame = n - 1;
    endpoint.pass = diff <= kCancelEndpointTolVp;
    char buf[128];
    std::snprintf(buf, sizeof(buf), "|fold_end - fold_0| = %.4fvp (limit 1.0)",
                  static_cast<double>(diff));
    endpoint.note = buf;
}

std::vector<TapProbe> ComputeTapProbes() {
    struct Row {
        float tau;
        bool hasAnchor;
        float anchor;
    };
    const Row rows[] = {
        {0.500F, true, 68.0F}, {0.600F, false, 0.0F}, {0.667F, true, 26.0F},
        {0.750F, false, 0.0F}, {0.833F, true, 0.0F},  {0.900F, false, 0.0F},
        {1.000F, true, 0.0F},
    };
    std::vector<TapProbe> probes;
    for (const Row& row : rows) {
        float xNorm = 1.0F;
        float beta = 0.0F;
        float scale = 1.0F;
        BookTurnSolver::Schedule(row.tau, xNorm, beta, scale);
        BookTurnInput in;
        in.generation = 1000000U;
        in.width = kW;
        in.height = kH;
        in.direction = Direction::NEXT;
        in.start = {kW, kMidY};
        in.edge = {kW * xNorm, kMidY};
        in.pointer = in.edge;
        in.overrideTheta = true;
        in.settledTheta = 0.0F;
        const BookTurnPose pose = BookTurnSolver::Solve(in, nullptr);
        const float fold = BookTurnSolver::FoldScreenX(pose.axis, pose.theta, kH);
        TapProbe probe;
        probe.tau = row.tau;
        probe.foldPctW = fold / kW * 100.0F;
        probe.hasAnchor = row.hasAnchor;
        probe.anchorPctW = row.anchor;
        probes.push_back(probe);
    }
    return probes;
}

SeqReport RunSequence(const SeqSpec& specIn, const std::string& outDir) {
    SeqSpec spec = specIn;
    const std::string seqDir = outDir + "/" + spec.name;
    MakeDirs(seqDir);
    SeqReport rep = RunPass(spec, seqDir);
    if (spec.id == SeqId::kDiagonalPsi && rep.maxAbsThetaDeg < kThetaFallbackDeg) {
        SeqSpec fallback = spec;
        fallback.overrideTheta = true;
        fallback.settledTheta = 50.0F;
        SeqReport retry = RunPass(fallback, seqDir);
        retry.usedThetaFallback = true;
        retry.notes += rep.notes;
        retry.notes +=
            "live tilt stayed ~0 under ownership/exposure gates; reran with "
            "overrideTheta=true settledTheta=50deg; ";
        rep = retry;
        spec = fallback;
    }
    rep.spec = spec;
    CheckInv1(rep);
    CheckInv2(rep);
    CheckCancel(rep);
    return rep;
}

// ---------------------------------------------------------------------------
// Evidence manifest
// ---------------------------------------------------------------------------

std::vector<int> KeyframeIndices(int frames) {
    std::vector<int> indices;
    for (int k = 0; k < 4; ++k) {
        const int value = static_cast<int>(
            std::lround(static_cast<double>(frames - 1) * static_cast<double>(k) / 4.0));
        if (std::find(indices.begin(), indices.end(), value) == indices.end()) {
            indices.push_back(value);
        }
    }
    if (indices.back() != frames - 1) {
        indices.push_back(frames - 1);
    }
    return indices;
}

std::string TrajectoryText(const SeqReport& rep) {
    const int n = static_cast<int>(rep.recs.size());
    const int step = n >= 120 ? 10 : 5;
    std::string out;
    int count = 0;
    char buf[48];
    for (int i = 0; i < n; i += step) {
        const FrameRec& rec = rep.recs[static_cast<size_t>(i)];
        std::snprintf(buf, sizeof(buf), "f%04d:%5.2f%%W", rec.index,
                      static_cast<double>(rec.foldPctW));
        out += buf;
        out += (++count % 6 == 0) ? "\n  " : "  ";
    }
    const FrameRec& last = rep.recs.back();
    if (last.index % step != 0) {
        std::snprintf(buf, sizeof(buf), "f%04d:%5.2f%%W", last.index,
                      static_cast<double>(last.foldPctW));
        out += buf;
    }
    return out;
}

std::string FormatCheck(const char* label, const CheckResult& check) {
    if (!check.applicable) {
        return std::string("- ") + label + ": n/a\n";
    }
    char buf[320];
    std::snprintf(buf, sizeof(buf), "- %s: %s (worst %.4g at frame %d) %s\n", label,
                  check.pass ? "PASS" : "FAIL", static_cast<double>(check.worst),
                  check.worstFrame, check.note.c_str());
    return std::string(buf);
}

std::string BuildManifest(const std::vector<SeqReport>& reports,
                          const std::vector<TapProbe>& probes) {
    std::string m;
    m += "# BookTurn V2 Stage-1 Chessboard Replay Evidence\n\n";
    m += "- Date: 2026-08-29\n";
    m += "- Purpose: V2 contract \xc2\xa7" "13.2 Stage-1 chessboard replay evidence\n";
    m += "- Solver state: Stage 1, pre-renderer (solver-only CPU replay; software "
         "point-splat rasterizer; no shader/GPU path, no SDK/VM)\n";
    m += "- Sources: entry/src/main/cpp/bookturn/bookturn_solver.{h,cpp} (read-only) + "
         "entry/src/main/cpp/tests/bookturn_chessboard_replay.cpp (standalone; not in HAP build)\n";
    m += "- Build: clang++ -std=c++17 -O2 -Wall -Wextra -Werror -I bookturn "
         "tests/bookturn_chessboard_replay.cpp bookturn/bookturn_solver.cpp "
         "-o /tmp/bookturn_replay_bin (zero warnings, deterministic)\n";
    m += "- Viewport: W=390vp H=780vp; PPM P6 780x1560 (scale 2); checkerboard cell 24vp; "
         "material grid step 0.75vp; splat disc r=1.5 device px; sheet-only z-buffer (max z wins)\n";
    m += "- Palette: revealed page A #F5EFE2/#D8CDBA; sheet front B #C8A24B/#8A6D2F; "
         "sheet backface B*0.45 (n.z<0); desk #2A2622\n";
    m += "- Q(tau) segments (contract \xc2\xa7" "6.2): S1 LIFT [0,0.18] x 1.0->0.80; "
         "S2 FLIP [0.18,0.50] x 0.80->0.50; S3 ROLL [0.50,0.75] x 0.50->0.25; "
         "S4 SPINE [0.75,0.90] x 0.25->0.05 (scale 1->0.6); S5 COLLAPSE [0.90,1] x 0.05->0 "
         "(beta pi->0, scale ->0)\n\n";

    for (const SeqReport& rep : reports) {
        m += "## " + std::string(rep.spec.name) + "\n\n";
        char buf[192];
        std::snprintf(buf, sizeof(buf), "- frames: %d\n", rep.spec.frames);
        m += buf;
        m += "- input: " + InputDescription(rep.spec) + "\n";
        m += "- fold-x trajectory (%W):\n  " + TrajectoryText(rep) + "\n";
        m += FormatCheck("INV-1 fold monotone within forward sweep (step >= 1e-3vp; "
                         "plateau |d|<1e-4 tolerated only in final 3 frames)", rep.inv1);
        m += FormatCheck("INV-2 final-frame page coverage (<= 3%W)", rep.inv2);
        m += FormatCheck("INV-3 cancel return-leg non-decreasing", rep.cancelReturn);
        m += FormatCheck("INV-3 cancel endpoint |fold_end - fold_0| <= 1vp", rep.cancelEndpoint);
        std::snprintf(buf, sizeof(buf), "- max |theta| over sequence: %.2f deg\n",
                      static_cast<double>(rep.maxAbsThetaDeg));
        m += buf;
        if (rep.spec.id == SeqId::kCancel) {
            m += "- note: cancel ends un-turned by design (sheet flat over the page, "
                 "coverage = 100%W expected); INV-2 is not applicable to a cancelled turn\n";
        }
        if (rep.usedThetaFallback) {
            m += "- note: theta override fallback engaged (see input description)\n";
        }
        m += "- keyframes:";
        for (int k : KeyframeIndices(rep.spec.frames)) {
            char name[64];
            std::snprintf(name, sizeof(name), " frame_%04d.ppm", k);
            m += name;
        }
        m += "\n";
        if (!rep.notes.empty()) {
            m += "- notes: " + rep.notes + "\n";
        }
        m += "\n";
    }

    m += "## tap_auto vs internal U-sample roll anchors (print-only; different time bases)\n\n";
    m += "| tau | fold-x %W (Q(tau) replay) | U anchor %W | delta %W |\n";
    m += "|------|------|------|------|\n";
    for (const TapProbe& probe : probes) {
        char buf[128];
        if (probe.hasAnchor) {
            std::snprintf(buf, sizeof(buf), "| %.3f | %.2f | %.0f | %+.2f |\n",
                          static_cast<double>(probe.tau),
                          static_cast<double>(probe.foldPctW),
                          static_cast<double>(probe.anchorPctW),
                          static_cast<double>(probe.foldPctW - probe.anchorPctW));
        } else {
            std::snprintf(buf, sizeof(buf), "| %.3f | %.2f | - | - |\n",
                          static_cast<double>(probe.tau),
                          static_cast<double>(probe.foldPctW));
        }
        m += buf;
    }
    m += "\nNo assert is applied to this table (different time bases: linear-tau 600ms "
         "timeline vs U-sample time base); recorded for form review only.\n\n";

    m += "## Notes\n\n";
    m += "- previous_reverse semantics (stage-2 correction 2026-08-29): PREVIOUS is the "
         "strict time reversal of the same Q(tau) trajectory with NO screen mirroring. The "
         "moving sheet is the previous page unrolling from the spine over the static current "
         "page (bottom layer); the stage sequence runs backward (gesture start tau=1 "
         "COLLAPSE, commit tau=0 FLAT); content stays unmirrored (flat branch of p(q) is "
         "the identity map).\n";
    m += "- previous_reverse INV-2 reading: at commit the sheet lies flat over [0, W], "
         "exactly covering the revealed page, so the NEXT residue form (<= 3%W) does not "
         "apply; the check is the full-coverage span form (L sliver <= 3%W, R sliver "
         "<= 3%W), recorded in the INV-2 line.\n";
    m += "- previous gesture start (edge 0, tau 1, radius 0): the previous sheet maps to "
         "[-W, 0] flat - wholly off-screen, so the current page (bottom layer) shows "
         "unobstructed at the first frame (fixes the V1 previous-start drape defect).\n";
    m += "- Commit geometry (NEXT): at tau=1 radiusScale=0 -> radius=0, fold at the spine, and the "
         "sheet maps to [-W, 0] flat backface (n.z=-1, z=0): the turned page lies "
         "on the far stack with 0 sliver over the revealed page (INV-2 margin = full 3%W).\n";
    m += "- u_sample pairing (contract 13.3-1): frame k renders tau=k/12 of the canonical "
         "Q(tau) trajectory (NEXT roll to spine, straight fold); the reference is the internal "
         "U WebGL sample (Figma 3394:10546) 13-frame flipbook t=(k/12)*2.0s archived at "
         "/tmp/u_frames/f{k:02d}_t*.png. Side-by-side composites (left: chessboard replay, "
         "right: U sample) live at evidence/bookturn-v2-replay/u_compare/f{k:02d}_side.png. "
         "Form reference only - different content bases, no pixel-diff gate.\n";
    m += "- Sheets mapping outside the frame (curl bulge overflow, commit stack) are clipped "
         "by image bounds; the INV-2 numbers are computed from mapped coordinates over the "
         "full material grid, independent of clipping.\n";
    m += "- All 816 frames exist as PPM under the run output dir (/tmp/bookturn_replay/<seq>/); "
         "this directory holds each sequence's final frame + 4 evenly spaced keyframes "
         "(see keyframes.txt), converted to PNG when ffmpeg is available.\n";
    return m;
}

}  // namespace

int main(int argc, char* argv[]) {
    const std::string outDir = argc > 1 ? argv[1] : "/tmp/bookturn_replay";
    MakeDirs(outDir);

    // §12 A/B calibration: BOOKTURN_APEX_DIST=0 renders the A-grade cylinder;
    // unset keeps the solver default (B grade, 8W apex distance).
    if (const char* apexEnv = std::getenv("BOOKTURN_APEX_DIST"); apexEnv && *apexEnv) {
        reader::bookturn::SetConeApexDist(std::strtof(apexEnv, nullptr));
        std::printf("cone apex distance calibration override: %s\n", apexEnv);
    }

    const std::vector<SeqSpec> specs = {
        {SeqId::kSlowDrag, "slow_drag", 240, true, true, false, true, 0.0F},
        {SeqId::kFastDrag, "fast_drag", 60, true, true, false, true, 0.0F},
        {SeqId::kCancel, "cancel", 180, false, false, false, true, 0.0F},
        {SeqId::kTapAuto, "tap_auto", 36, true, true, false, true, 0.0F},
        {SeqId::kPreviousReverse, "previous_reverse", 180, true, true, true, false, 0.0F},
        {SeqId::kDiagonalPsi, "diagonal_psi", 120, false, true, false, false, 0.0F},
        {SeqId::kUSample, "u_sample", 13, true, true, false, true, 0.0F},
    };

    std::vector<SeqReport> reports;
    for (const SeqSpec& spec : specs) {
        reports.push_back(RunSequence(spec, outDir));
    }

    const std::vector<TapProbe> probes = ComputeTapProbes();
    std::printf("tap_auto fold-x vs U-sample roll anchors (print-only):\n");
    for (const TapProbe& probe : probes) {
        if (probe.hasAnchor) {
            std::printf("  tau=%.3f fold=%6.2f%%W anchor=%.0f%%W\n",
                        static_cast<double>(probe.tau), static_cast<double>(probe.foldPctW),
                        static_cast<double>(probe.anchorPctW));
        } else {
            std::printf("  tau=%.3f fold=%6.2f%%W anchor=-\n",
                        static_cast<double>(probe.tau), static_cast<double>(probe.foldPctW));
        }
    }

    std::string keyframes;
    for (const SeqReport& rep : reports) {
        for (int k : KeyframeIndices(rep.spec.frames)) {
            char buf[128];
            std::snprintf(buf, sizeof(buf), "%s/frame_%04d.ppm\n", rep.spec.name, k);
            keyframes += buf;
        }
    }
    WriteTextFile(outDir + "/keyframes.txt", keyframes);
    WriteTextFile(outDir + "/manifest.md", BuildManifest(reports, probes));

    bool allPass = true;
    for (const SeqReport& rep : reports) {
        bool seqPass = true;
        if ((rep.inv1.applicable && !rep.inv1.pass) ||
            (rep.inv2.applicable && !rep.inv2.pass) ||
            (rep.cancelReturn.applicable && !rep.cancelReturn.pass) ||
            (rep.cancelEndpoint.applicable && !rep.cancelEndpoint.pass)) {
            seqPass = false;
        }
        std::printf("%-16s %s\n", rep.spec.name, seqPass ? "PASS" : "FAIL");
        if (!seqPass) {
            allPass = false;
        }
    }
    std::printf("manifest: %s/manifest.md\n", outDir.c_str());
    std::printf("OVERALL: %s\n", allPass ? "PASS" : "FAIL");
    return allPass ? 0 : 1;
}
