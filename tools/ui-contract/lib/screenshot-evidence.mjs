import pngjs from 'pngjs';
import { EvidenceError } from '../../lib/native-ui-evidence.mjs';

export function assertScreenshotHasContent(bytes, sampleId) {
  let pixels;
  try {
    pixels = pngjs.PNG.sync.read(bytes).data;
  } catch {
    throw new EvidenceError(`Native screenshot for ${sampleId} cannot be decoded`);
  }

  let firstVisibleColor;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue;
    const color = (pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2];
    if (firstVisibleColor === undefined) firstVisibleColor = color;
    else if (color !== firstVisibleColor) return;
  }
  throw new EvidenceError(`Native screenshot for ${sampleId} has no visible pixel variation`);
}
