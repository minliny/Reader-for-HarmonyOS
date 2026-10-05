# Manga metadata boundary corpus

Reader-generated 16x12 constant RGB fixtures; provenance.json fixes Pillow version and every SHA-256. Identical copies are tested by Core's fixed kamadak-exif parser. Host tests consume these actual bytes and the corresponding Core proof outcome, while replacing native ImageSource with a platform boundary mock. This proves Host admission, digest ownership and failure handling; it does not prove HarmonyOS codec behavior or pixels.

`no-exif` is valid image data without an EXIF section; `orientation-6` carries rotation; `bad-exif` contains malformed metadata. A proof of absent metadata never substitutes for successful native image decoding.
