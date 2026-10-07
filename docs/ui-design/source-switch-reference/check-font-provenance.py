#!/usr/bin/env python3
"""Read-only outline/metric comparison using the existing FontTools runtime.

No font is instantiated, saved, renamed, subsetted or modified by this check.
RecordingPen and TTFont.getGlyphSet supply the upstream variation evaluator.
The output records an explicit numeric tolerance, not renderer pixel equality.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

import fontTools
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
HOST = HERE.parents[2]
RAW = HOST / 'entry/src/main/resources/rawfile'
SOURCE = RAW / 'NotoSansSC-VF.otf'
SOURCE_SHA = 'd13ed01ec8aa45d6178999b648e96fb92150683e9f8e2a581f2acf208dcbe44b'
OUTLINE_TOLERANCE = 1 / 64
ADVANCE_TOLERANCE = 0.5


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def difference(left, right):
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return abs(left - right)
    if isinstance(left, (list, tuple)) and isinstance(right, (list, tuple)):
        if len(left) != len(right):
            return float('inf')
        return max((difference(a, b) for a, b in zip(left, right)), default=0)
    return 0 if left == right else float('inf')


assert digest(SOURCE) == SOURCE_SHA
source = TTFont(SOURCE, recalcTimestamp=False)
result = {
    'schemaVersion': 1,
    'scope': 'Source-switch static UI 400/500 versus original demo variable font at the same axes',
    'tool': f'FontTools {fontTools.__version__}; TTFont.getGlyphSet(location), RecordingPen',
    'source': '../../../entry/src/main/resources/rawfile/NotoSansSC-VF.otf',
    'sourceSha256': SOURCE_SHA,
    'sourceVersion': source['name'].getDebugName(5),
    'sourceRevision': source['head'].fontRevision,
    'unitsPerEm': source['head'].unitsPerEm,
    'coordinateToleranceInFontUnits': OUTLINE_TOLERANCE,
    'advanceToleranceInFontUnits': ADVANCE_TOLERANCE,
    'advanceQuantizationNote': 'Static hmtx stores integer advances; variable HVAR can expose fractional advances. Initial 1/64 advance check failed on space400 with delta0.4898681640625; this recorded check allows the corresponding half-unit integer rounding, while retaining the separate stricter outline tolerance.',
    'assetsUnmodified': True,
    'browserRendered': False,
    'nativeRendered': False,
    'outputs': [],
}
for weight, name, expected in (
    (400, 'NotoSansSC-UIRegular.otf', '26903423458d18bb9be20b12f7982a604118e10f10c62c83b45d10f04dfb939e'),
    (500, 'NotoSansSC-UIMedium.otf', '319a7e09915410a00906741980b6afabe5fe23ae3b46052570b9cdd2b20c715d'),
):
    print(f'Checking all glyphs at wght={weight}', file=sys.stderr, flush=True)
    filename = RAW / name
    static = TTFont(filename, recalcTimestamp=False)
    assert digest(filename) == expected
    assert static['head'].fontRevision == source['head'].fontRevision
    assert static['name'].getDebugName(5) == source['name'].getDebugName(5)
    assert static['name'].getDebugName(0) == source['name'].getDebugName(0)
    assert static['name'].getDebugName(13) == source['name'].getDebugName(13)
    assert static.getGlyphOrder() == source.getGlyphOrder()
    assert static.getBestCmap() == source.getBestCmap()
    assert static['OS/2'].usWeightClass == weight and 'fvar' not in static
    expected_glyphs = source.getGlyphSet(location={'wght': weight})
    actual_glyphs = static.getGlyphSet()
    maximum_outline = 0
    maximum_metric = 0
    exact_outlines = 0
    unmatched = []
    for glyph_name in source.getGlyphOrder():
        a, b = RecordingPen(), RecordingPen()
        expected_glyphs[glyph_name].draw(a)
        actual_glyphs[glyph_name].draw(b)
        delta = difference(a.value, b.value)
        maximum_outline = max(maximum_outline, delta)
        maximum_metric = max(maximum_metric, abs(expected_glyphs[glyph_name].width - actual_glyphs[glyph_name].width))
        if delta == 0:
            exact_outlines += 1
        advance_delta = abs(expected_glyphs[glyph_name].width - actual_glyphs[glyph_name].width)
        if delta > OUTLINE_TOLERANCE or advance_delta > ADVANCE_TOLERANCE:
            unmatched.append({'glyph': glyph_name, 'outlineDelta': delta, 'advanceDelta': advance_delta})
    result['outputs'].append({
        'file': f'../../../entry/src/main/resources/rawfile/{name}',
        'sha256': expected,
        'axis': {'wght': weight},
        'fontVersion': static['name'].getDebugName(5),
        'fontRevision': static['head'].fontRevision,
        'glyphCount': len(static.getGlyphOrder()),
        'unicodeCount': len(static.getBestCmap()),
        'coverageAndGlyphOrderMatch': True,
        'licenseAndCopyrightMatch': True,
        'staticWeight': static['OS/2'].usWeightClass,
        'retainedPostScriptName': static['name'].getDebugName(6),
        'postScriptNameNote': 'The inherited Thin name is metadata; the shared reference uses the same explicitly registered static assets as native. Equivalence to original variable-font outlines is not claimed.',
        'exactOutlineCount': exact_outlines,
        'maximumOutlineDeltaInFontUnits': maximum_outline if math.isfinite(maximum_outline) else None,
        'maximumOutlineDeltaReason': None if math.isfinite(maximum_outline) else 'At least one RecordingPen command topology/length mismatch; a finite coordinate delta does not represent that comparison.',
        'maximumAdvanceDeltaInFontUnits': maximum_metric,
        'unmatchedGlyphCount': len(unmatched),
        'firstUnmatchedGlyphs': unmatched[:10],
        'status': 'PASS_WITH_RECORDED_TOLERANCE' if not unmatched else 'FAILED_OUTLINE_EQUIVALENCE',
    })
result['status'] = 'PASS_WITH_RECORDED_TOLERANCE' if all(item['unmatchedGlyphCount'] == 0 for item in result['outputs']) else 'FAILED_OUTLINE_EQUIVALENCE'
result['sameUpstreamVersionAndCoverage'] = True
result['originalVariableToStaticOutlineEquivalence'] = result['status'] == 'PASS_WITH_RECORDED_TOLERANCE'
def json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    return value
result = json_safe(result)
HERE.joinpath('font-provenance.json').write_text(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2))
