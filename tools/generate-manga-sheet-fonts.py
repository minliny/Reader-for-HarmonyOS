#!/usr/bin/env python3
"""Thin, pinned FontTools adapter for the approved manga demo's static faces.

Run with fonttools==4.60.2. No outline/variation algorithm is implemented here.
Keep every glyph for dynamic 550/600 chapter/group titles. The 900 face is only
used for four fixed panel headings, subset via the same upstream FontTools.
Only instantiate wght and name each face. Shelf startup does not load these.
"""
import hashlib
import json
from pathlib import Path

import fontTools
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont, setRibbiBits

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'entry/src/main/resources/rawfile'
SOURCE = RAW / 'NotoSansSC-VF.otf'
SOURCE_SHA = 'd13ed01ec8aa45d6178999b648e96fb92150683e9f8e2a581f2acf208dcbe44b'
TITLES = ['章节目录', '阅读方式', '漫画阅读设置', '更多']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def cmaps(font):
    return [(t.platformID, t.platEncID, t.format, t.language,
             getattr(t, 'cmap', None), getattr(t, 'uvsDict', None))
            for t in font['cmap'].tables]

assert fontTools.__version__ == '4.60.2', fontTools.__version__
assert digest(SOURCE) == SOURCE_SHA
reference = TTFont(SOURCE, recalcTimestamp=False)
assert [(a.axisTag, a.minValue, a.defaultValue, a.maxValue)
        for a in reference['fvar'].axes] == [('wght', 100.0, 100.0, 900.0)]
outputs = []
for weight in (550, 600, 900):
    font = instantiateVariableFont(TTFont(SOURCE, recalcTimestamp=False),
                                   {'wght': weight}, inplace=True,
                                   optimize=True, updateFontNames=False)
    family = f'ReaderMangaSans{weight}'
    # The source's STAT need not contain 550; update explicit names via TTFont
    # instead of requiring a nonexistent named instance. Preserve license IDs.
    replacements = {1: family, 2: 'Regular',
                    3: f'{family}; FontTools4.60.2; wght{weight}; {SOURCE_SHA}',
                    4: family, 6: family, 16: family, 17: 'Regular'}
    for name_id, value in replacements.items():
        locations = [(n.platformID, n.platEncID, n.langID)
                     for n in font['name'].names if n.nameID == name_id]
        for platform, encoding, language in locations or [(3, 1, 0x409)]:
            font['name'].setName(value, name_id, platform, encoding, language)
    setRibbiBits(font)
    assert 'fvar' not in font and 'HVAR' not in font and 'VVAR' not in font
    assert font['OS/2'].usWeightClass == weight
    assert font.getGlyphOrder() == reference.getGlyphOrder()
    assert font.getBestCmap() == reference.getBestCmap()
    assert cmaps(font) == cmaps(reference)
    assert font['name'].getDebugName(0) == reference['name'].getDebugName(0)
    assert font['name'].getDebugName(13) == reference['name'].getDebugName(13)
    if weight == 900:
        options = subset.Options()
        options.name_IDs = ['*']
        options.name_languages = ['*']
        options.layout_features = ['*']
        options.glyph_names = True
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=''.join(TITLES))
        subsetter.subset(font)
        assert set(map(ord, ''.join(TITLES))) <= set(font.getBestCmap())
    output = RAW / f'{family}.otf'
    font.save(output)
    saved = TTFont(output, recalcTimestamp=False)
    assert 'fvar' not in saved and saved['OS/2'].usWeightClass == weight
    assert saved['name'].getDebugName(6) == family
    outputs.append({'axis': {'wght': weight}, 'family': family,
                    'output': str(output.relative_to(ROOT)),
                    'sha256': digest(output), 'bytes': output.stat().st_size,
                    'glyphCount': len(saved.getGlyphOrder()),
                    'unicodeCount': len(saved.getBestCmap()),
                    'variable': False, 'outlineTable': 'CFF2',
                    'coverage': 'fixedPanelTitles' if weight == 900 else 'fullCJK',
                    'requiredTitles': TITLES if weight == 900 else []})
    print(f'{family}: {output.stat().st_size} bytes {digest(output)}', flush=True)

provenance = {'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': SOURCE_SHA,
              'license': 'entry/src/main/resources/rawfile/Noto-OFL.txt',
              'tool': 'fonttools 4.60.2 instantiateVariableFont',
              'generator': 'tools/generate-manga-sheet-fonts.py',
              'metadataAdjustment': 'Unique family/full/PostScript/unique-ID names; upstream setRibbiBits for single-face Regular style; preserved copyright and OFL; full 550/600 CJK; upstream title subset for 900',
              'reused400': {'family': 'ReaderNotoSansSCUIRegular',
                            'output': 'entry/src/main/resources/rawfile/NotoSansSC-UIRegular.otf',
                            'sha256': digest(RAW / 'NotoSansSC-UIRegular.otf')},
              'outputs': outputs}
(ROOT / 'docs/ui-design/MANGA_SHEET_FONTS_PROVENANCE.json').write_text(
    json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
