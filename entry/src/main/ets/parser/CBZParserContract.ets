// CBZParserContract — clean-room CBZ (comic book ZIP) parse contract.
// CBZ is a ZIP archive of images; parsing yields an ordered image manifest.
// Reader rendering remains UNSUPPORTED (see HarmonyOSCorePlatformManifest);
// this contract only covers archive + image manifest extraction.

export interface CBZImageEntry {
  path: string;
  mediaType: string;
  order: number;
}

export interface CBZParseResult {
  imageCount: number;
  images: CBZImageEntry[];
  coverPath?: string;
}

export interface CBZParserContract {
  parse(data: Uint8Array): Promise<CBZParseResult>;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp'
};

export function cbzImageMediaType(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot < 0) { return null; }
  const ext = path.substring(dot + 1).toLowerCase();
  return IMAGE_EXTENSIONS[ext] ?? null;
}

// Natural-order comparator for filenames (so page1, page2, page10 sort
// numerically rather than lexically). Bounded and content-agnostic.
export function naturalCompare(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(j);
    const aIsDigit = ca >= 48 && ca <= 57;
    const bIsDigit = cb >= 48 && cb <= 57;
    if (aIsDigit && bIsDigit) {
      let na = i;
      let nb = j;
      while (na < a.length && a.charCodeAt(na) >= 48 && a.charCodeAt(na) <= 57) { na++; }
      while (nb < b.length && b.charCodeAt(nb) >= 48 && b.charCodeAt(nb) <= 57) { nb++; }
      const aNum = parseInt(a.substring(i, na), 10);
      const bNum = parseInt(b.substring(j, nb), 10);
      if (aNum !== bNum) { return aNum - bNum; }
      i = na; j = nb;
    } else {
      if (ca !== cb) { return ca - cb; }
      i++; j++;
    }
  }
  return a.length - b.length;
}
