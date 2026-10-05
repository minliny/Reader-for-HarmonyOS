#!/usr/bin/env python3
"""Read saved native R7 samples. Never edits, resizes or interpolates an image.

Requires Pillow. Output is mechanical evidence, not a full-screen, animation,
package, device-configuration or user-acceptance verdict.
"""
import hashlib
import json
from math import sqrt
from pathlib import Path

from PIL import Image, ImageChops

BASE = Path(__file__).resolve().parent
VM = BASE / 'vm'
NAMES = ['immersive-a', 'controls-b', 'directory-c', 'immersive-d']


def attributes(node):
    if isinstance(node, dict):
        if 'attributes' in node:
            yield node['attributes']
        for value in node.values():
            yield from attributes(value)
    elif isinstance(node, list):
        for value in node:
            yield from attributes(value)


def tree_facts(name):
    nodes = list(attributes(json.loads((VM / (name + '.json')).read_text())))
    scroll = next(node for node in nodes if node.get('type') == 'Scroll')
    body = next(node for node in nodes if node.get('type') == 'List')
    images = [node for node in nodes if node.get('type') == 'Image' and
              node.get('hierarchy', '').startswith(body['hierarchy'] + ',')]
    fields = ['type', 'bounds', 'origBounds', 'hostWindowId', 'hierarchy']
    return {
        'scroll': {key: scroll.get(key) for key in fields},
        'list': {key: body.get(key) for key in fields},
        'bodyImages': [{key: node.get(key) for key in fields} for node in images],
        'statusWindows': [{key: node.get(key) for key in fields} for node in nodes
                          if node.get('type') == 'WindowScene'],
        'pageLabels': [{key: node.get(key) for key in ['text', 'bounds', 'origBounds']}
                       for node in nodes if node.get('type') == 'Text' and
                       node.get('text') in ['1 / 24', '02', '章节目录', '正在读']],
    }


def contrast_match(source, target, box):
    """Integer crop search permits only local intensity slope + intercept.

    These luminance comparisons account for an overlay's darkening, without
    creating an adjusted image or claiming exact native alpha/animation timing.
    """
    left, top, right, bottom = box
    original = list(source.crop(box).getdata())
    count = len(original)
    total = sum(original)
    variance = sum(value * value for value in original) - total * total / count
    candidates = []
    for dy in range(-8, 9):
        for dx in range(-8, 9):
            compared = list(target.crop((left + dx, top + dy, right + dx, bottom + dy)).getdata())
            target_sum = sum(compared)
            target_squared = sum(value * value for value in compared)
            covariance = sum(a * b for a, b in zip(original, compared)) - total * target_sum / count
            slope = covariance / variance
            intercept = (target_sum - slope * total) / count
            squared_error = max(0, target_squared - target_sum * target_sum / count -
                                covariance * covariance / variance) / count
            candidates.append({'dx': dx, 'dy': dy, 'rmse': sqrt(squared_error),
                               'slope': slope, 'intercept': intercept})
    candidates.sort(key=lambda result: result['rmse'])
    return {'sourceBox': box, 'integerSearchRange': [-8, 8],
            'best': candidates[0], 'nearestNonzeroCandidate': next(
                result for result in candidates if (result['dx'], result['dy']) != (0, 0)),
            'sourceVariance': variance / count}


images = {name: Image.open(VM / (name + '.jpeg')).convert('RGB') for name in NAMES}
facts = {name: tree_facts(name) for name in NAMES}
hashes = {name + '.' + ext: hashlib.sha256((VM / (name + '.' + ext)).read_bytes()).hexdigest()
          for name in NAMES for ext in ['jpeg', 'json']}
a, b, c, d = [images[name] for name in NAMES]
ab = []
for box in [(0, 440, 1280, 2180), (300, 600, 1000, 1900), (0, 500, 100, 2000)]:
    difference = ImageChops.difference(a.crop(box), b.crop(box))
    ab.append({'box': box, 'differenceBBox': difference.getbbox(),
               'channelExtrema': difference.getextrema()})
ad = ImageChops.difference(a, d)
base_color = a.getpixel((0, 0))
top_rows = []
for y in [0, 10, 20, 40, 60, 70, 72, 75, 79, 80, 81, 100, 136, 137]:
    pixels = list(a.crop((0, y, 1280, y + 1)).getdata())
    top_rows.append({'y': y, 'centerRGB': a.getpixel((640, y)),
                     'pixelsNearBaseWithin2': sum(all(abs(value - base_color[channel]) <= 2
                                                     for channel, value in enumerate(pixel))
                                                 for pixel in pixels)})
orig_bounds = {name: [node['origBounds'] for node in facts[name]['bodyImages']] for name in NAMES}
print(json.dumps({
    'method': 'Original saved native JPEG RGB and UI-tree reads; exact crop comparisons; no resizing/interpolation/HDC',
    'inputSHA256': hashes,
    'imageSizes': {name: list(image.size) for name, image in images.items()},
    'abSameCoordinateRegions': ab,
    'adFullImage': {'differenceBBox': ad.getbbox(), 'channelExtrema': ad.getextrema()},
    'acDarkenedPatchGeometry': [contrast_match(a.convert('L'), c.convert('L'), box) for box in
                               [(600, 450, 680, 530), (850, 570, 930, 650), (180, 480, 260, 560)]],
    'treeFacts': facts,
    'bodyImageOrigBoundsEqualAcrossABCD': all(value == orig_bounds['immersive-a']
                                             for value in orig_bounds.values()),
    'aTopUniformBandObservation': {'referenceRGB': base_color, 'rows': top_rows,
                                  'origin': 'No source-tile pixels inspected by this mechanical script; source margin vs rendered empty band remains separate evidence'},
    'limits': ['Static endpoints only, no compositor timing or transient-frame claim',
               'UI visible bounds are clipped rectangles; origBounds are recorded separately',
               'A/D equality and unchanged body geometry do not prove the origin of top uniform pixels',
               'No animation curve, HAP verification, physical-device or user acceptance result'],
}, indent=2))
