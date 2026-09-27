# ImageKit regional readback channel contract

The same-HAP VM diagnostic run `1790481289643-2` from HAP
`20260927T034921Z-48787998-35d4553e` failed both strip checks. Its pre-encode
SHA was `d0583d69986f82b11b09b7b0e1b2db0c3f6340417ec6f928f306dfa8bc61d0cf`.
That exactly equals Pillow's **BGRA** representation of the independent,
correctly reordered RGBA golden. Interpreting it as RGBA also reproduces the
recorded maximum difference 208 and mean 40.23300970873787. The strip geometry
was correct; the next `createPixelMap` call mislabeled its input channels.

Fixed OpenHarmony ImageKit reference, commit
`20a749b2bba0f78616ed7d6a0db12f3cbef64606`:

- [pixel_map_napi.cpp, ReadPixels](https://github.com/openharmony/multimedia_image_framework/blob/20a749b2bba0f78616ed7d6a0db12f3cbef64606/frameworks/kits/js/common/pixel_map_napi.cpp#L2187)
  forwards the buffer, offset, stride and region to the five-argument method.
- [pixel_map.cpp, ReadPixels](https://github.com/openharmony/multimedia_image_framework/blob/20a749b2bba0f78616ed7d6a0db12f3cbef64606/frameworks/innerkitsimpl/common/src/pixel_map.cpp#L1996)
  fixes that overload's output to BGRA_8888; the region conversion uses UNPREMUL.
  The input PixelMap's reported RGBA_8888 format does not describe this output buffer.
- [pixel_map.cpp, Create](https://github.com/openharmony/multimedia_image_framework/blob/20a749b2bba0f78616ed7d6a0db12f3cbef64606/frameworks/innerkitsimpl/common/src/pixel_map.cpp#L564)
  honors `srcPixelFormat` and uses the platform conversion implementation.

The fix supplies `BGRA_8888` to platform output creation, with no Reader channel
conversion loop or new codec. Budget, ownership and strip coordinates are unchanged.
`generate-manga-platform-fixtures.py` uses Pillow's raw BGRA encoder for the input
mock and pre-encode oracle. The original RGBA golden remains the JPEG readback
oracle, with the original maximum 100 / mean 20 tolerances.

The production-method test now models ImageKit's regional BGRA output. It failed
against the previous source (`srcPixelFormat` 3 instead of 4) and passes after the
change. Diagnostic revision `manga-platform-probe-v3-bgra` declares its pre-encode
pixel format. Older v2 failure receipts retain their original interpretation.
Local mock/SDK checks do not prove repaired Native JPEG pixels; that remains the
next candidate's separate platform acceptance.
