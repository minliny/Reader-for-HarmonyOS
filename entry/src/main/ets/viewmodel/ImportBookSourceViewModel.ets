// ImportBookSourceViewModel — drives SettingsPage "导入书源" entry.
//
// Accepts pasted Legado BookSource JSON, calls SourceApi.importBookSource
// (Rust Core source.import). Mirrors Legado ImportBookSourceViewModel.
import { ReaderCoreClient } from '../api/ReaderCoreClient';
import { SourceApi } from '../api/SourceApi';

export interface ImportState {
  loading: boolean;
  success: boolean;
  error: string;
}

export class ImportBookSourceViewModel {
  private sourceApi: SourceApi;

  constructor() {
    this.sourceApi = new SourceApi(ReaderCoreClient.get());
  }

  async importBookSource(json: string): Promise<ImportState> {
    if (json.trim().length === 0) {
      const fail: ImportState = { loading: false, success: false, error: '书源 JSON 不能为空' };
      return fail;
    }
    const result = await this.sourceApi.importBookSource(json);
    const state: ImportState = {
      loading: false,
      success: result.success,
      error: result.success ? '' : result.data
    };
    return state;
  }
}
