// SourceApi — facade for source.import.
//
// Mirrors Legado ImportBookSourceViewModel.importSource
// (app/src/main/java/io/legado/app/ui/association/ImportBookSourceViewModel.kt).
// Accepts a pasted Legado BookSource JSON string, dispatches source.import to
// Core, returns success/failure.
import { ReaderCoreClient } from './ReaderCoreClient';

export interface ImportResult {
  success: boolean;
  data: string;
}

export class SourceApi {
  private client: ReaderCoreClient;

  constructor(client: ReaderCoreClient) {
    this.client = client;
  }

  async importBookSource(bookSourceJson: string): Promise<ImportResult> {
    let source: Object;
    try {
      source = JSON.parse(bookSourceJson);
    } catch (e) {
      const fail: ImportResult = { success: false, data: `invalid JSON: ${e}` };
      return fail;
    }
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['bookSource'] = source;
    const requestId = this.client.sendCommand('source.import', params);
    try {
      const data = await this.client.awaitResult(requestId, 30000);
      const ok: ImportResult = { success: true, data: JSON.stringify(data) };
      return ok;
    } catch (e) {
      const fail: ImportResult = { success: false, data: `${e}` };
      return fail;
    }
  }
}
