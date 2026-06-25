// CBZParserAdapter — clean-room CBZ (comic book ZIP) parser.
// Extracts an ordered image manifest from a CBZ archive using ZipArchiveAdapter.
// Images are filtered by media type and ordered by natural filename sort.
// No reader rendering is performed; reader.cbz remains UNSUPPORTED.

import { ZipArchiveAdapter, ZipEntry } from './ZipArchiveAdapter';
import {
  CBZImageEntry,
  CBZParseResult,
  CBZParserContract,
  cbzImageMediaType,
  naturalCompare
} from '../parser/CBZParserContract';

export class CBZParserAdapter implements CBZParserContract {
  private zip = new ZipArchiveAdapter();

  async parse(data: Uint8Array): Promise<CBZParseResult> {
    return this.parseSync(data);
  }

  parseSync(data: Uint8Array): CBZParseResult {
    const entries = this.zip.entries(data);
    const images: CBZImageEntry[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry: ZipEntry = entries[i];
      const mediaType = cbzImageMediaType(entry.path);
      if (mediaType === null) { continue; }
      if (entry.uncompressedSize === 0) { continue; }
      images.push({ path: entry.path, mediaType, order: 0 });
    }
    images.sort((a: CBZImageEntry, b: CBZImageEntry) => naturalCompare(a.path, b.path));
    for (let i = 0; i < images.length; i++) { images[i].order = i; }
    return {
      imageCount: images.length,
      images,
      coverPath: images.length > 0 ? images[0].path : undefined
    };
  }
}
