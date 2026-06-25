// FilePickerAdapter — clean-room HarmonyOS file picker wrapper.
// Uses @ohos.file.picker to let the user select local book files, reads the
// picked URI through FileAccessAdapter, and returns a redacted opaque handoff
// (raw file paths are never exported). Picker execution requires a device or
// simulator; in headless contexts callers should treat failure as ENV_BLOCKED.

import { picker } from '@kit.CoreFileKit';
import { FileAccessAdapter, FileAccessResult } from '../adapters/FileAccessAdapter';
import {
  LocalFilePermissionTokenAdapter,
  PermissionTokenEvidence
} from '../adapters/LocalBookPlatformAdapters';

export interface PickedFile {
  uri: string;           // opaque picker URI (redacted in evidence)
  data: Uint8Array;
  mimeType: string;
  fileSize: number;
  displayName: string;
}

export interface PickerResult {
  picked: PickedFile | null;
  permissionHandoff: PermissionTokenEvidence;
  denied: boolean;
  errorClass: string;
}

const SUPPORTED_SUFFIXES = ['.txt', '.epub', '.cbz', '.html', '.pdf'];

export class FilePickerAdapter {
  private fileAccess: FileAccessAdapter;
  private tokenAdapter: LocalFilePermissionTokenAdapter;

  constructor(fileAccess?: FileAccessAdapter) {
    this.fileAccess = fileAccess ?? new FileAccessAdapter();
    this.tokenAdapter = new LocalFilePermissionTokenAdapter();
  }

  /**
   * Open the document picker and return the selected file as a redacted
   * handoff. Returns denied=true if the user cancels or selection is empty.
   * Throws bounded error classes on picker/device failure (no raw URIs leaked).
   */
  async pickDocument(): Promise<PickerResult> {
    try {
      const documentPicker = new picker.DocumentViewPicker();
      const options = new picker.DocumentSelectOptions();
      options.maxSelectNumber = 1;
      options.fileSuffixFilters = SUPPORTED_SUFFIXES;
      const uris: string[] = await documentPicker.select(options);
      if (!uris || uris.length === 0) {
        const handoff = this.tokenAdapter.createHandoff('picker://cancelled', new Uint8Array(0), 'application/octet-stream');
        return { picked: null, permissionHandoff: handoff, denied: true, errorClass: 'cancelled' };
      }
      const uri = uris[0];
      const result: FileAccessResult = await this.fileAccess.readFile(uri);
      const displayName = this.extractDisplayName(uri);
      const picked: PickedFile = {
        uri,
        data: result.data,
        mimeType: result.mimeType ?? 'application/octet-stream',
        fileSize: result.fileSize,
        displayName
      };
      const handoff = this.tokenAdapter.createHandoff(uri, result.data, result.mimeType ?? 'application/octet-stream');
      return { picked, permissionHandoff: handoff, denied: false, errorClass: 'none' };
    } catch (e) {
      const text = JSON.stringify(e);
      let errorClass = 'picker_error';
      if (text.indexOf('permission') !== -1 || text.indexOf('Permission') !== -1) { errorClass = 'permission'; }
      if (text.indexOf('cancel') !== -1) { errorClass = 'cancelled'; }
      const handoff = this.tokenAdapter.createHandoff('picker://error', new Uint8Array(0), 'application/octet-stream');
      return { picked: null, permissionHandoff: handoff, denied: true, errorClass };
    }
  }

  private extractDisplayName(uri: string): string {
    const slash = uri.lastIndexOf('/');
    const name = slash >= 0 ? uri.substring(slash + 1) : uri;
    // Redact any query/fragment and keep only the file name for display.
    const q = name.indexOf('?');
    return q >= 0 ? name.substring(0, q) : name;
  }
}
