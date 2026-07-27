// Reader UI file.select backed by HarmonyOS DocumentViewPicker.
// Cancellation is represented by an empty URI list. Platform/permission
// failures throw and are never converted into a synthetic empty selection.
import picker from '@ohos.file.picker';
import fs from '@ohos.file.fs';
import common from '@ohos.app.ability.common';
import { LocalBookFormatPolicy } from '../LocalBookFormatPolicy';

export interface ReaderSelectedFile {
  path: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface ReaderFileSelectionResponse {
  selected: boolean;
  files: ReaderSelectedFile[];
}

function suffixFilterForMime(mimeType: string): string | null {
  const localBookFilter = LocalBookFormatPolicy.suffixFilterForMime(mimeType);
  if (localBookFilter !== null) return localBookFilter;
  switch (mimeType.toLowerCase()) {
    case 'application/json': return '.json';
    case 'font/ttf':
    case 'application/x-font-ttf': return '.ttf';
    case 'font/otf':
    case 'application/x-font-opentype': return '.otf';
    case 'font/collection': return '.ttc';
    case 'image/*': return '.jpg,.jpeg,.png,.webp,.gif,.bmp';
    default: return null;
  }
}

function mimeForName(name: string): string | undefined {
  const lower = name.toLowerCase();
  const localBookDecision = LocalBookFormatPolicy.decide(name);
  if (localBookDecision.mimeType !== undefined) return localBookDecision.mimeType;
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.otf')) return 'font/otf';
  if (lower.endsWith('.ttc')) return 'font/collection';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return undefined;
}

export class FileSelectionHostAdapter {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async select(mimeTypes: string[], allowsMultiple: boolean): Promise<ReaderFileSelectionResponse> {
    const documentPicker = new picker.DocumentViewPicker(this.context);
    const options = new picker.DocumentSelectOptions();
    const filters: string[] = [];
    let canApplyExactFilter = true;
    for (let i = 0; i < mimeTypes.length; i++) {
      if (mimeTypes[i] === '*/*') {
        canApplyExactFilter = false;
        break;
      }
      const filter = suffixFilterForMime(mimeTypes[i]);
      if (filter === null) {
        // DocumentViewPicker exposes suffix filters rather than arbitrary MIME
        // filters. Do not pretend an unknown MIME was enforced.
        canApplyExactFilter = false;
        break;
      }
      filters.push(filter);
    }
    if (canApplyExactFilter && filters.length > 0) options.fileSuffixFilters = filters;
    // Figma Library/LocalImportDialog (2657:916) explicitly caps the batch
    // at 50. Set this after all other option writes so the final native option
    // write carries the requested selection cardinality into the picker.
    options.maxSelectNumber = allowsMultiple ? 50 : 1;

    let uris: string[];
    try {
      uris = await documentPicker.select(options);
    } catch (e) {
      throw new Error(`FileSelectionHostAdapter.select failed: ${e}`);
    }
    const files: ReaderSelectedFile[] = [];
    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i];
      const slash = uri.lastIndexOf('/');
      const name = slash >= 0 ? uri.substring(slash + 1) : uri;
      const file: ReaderSelectedFile = { path: uri, name: name };
      const mimeType = mimeForName(name);
      if (mimeType !== undefined) file.mimeType = mimeType;
      try {
        const stat = fs.statSync(uri);
        file.size = stat.size;
      } catch (e) {
        // Some provider URIs do not expose stat metadata. The selected URI is
        // still the real platform grant; size is optional in the response.
      }
      files.push(file);
    }
    return { selected: files.length > 0, files: files };
  }
}
