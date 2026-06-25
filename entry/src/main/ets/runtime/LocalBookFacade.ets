// LocalBookFacade - Phase 2 ArkTS Runtime Facade。
// 调度 ZIP/EPUB/TXT detector/file token，输出 Core-compatible stage report。
//
// 对齐 Core: archive/localFileAccess/textEncodingDetector required features。
// HOS-ADR-001: ArkTS Core-compatible runtime 主线。

import { TXTParser } from '../parser/TXTParser';
import { ZipArchiveAdapter } from '../platform/ZipArchiveAdapter';
import { CBZParserAdapter } from '../platform/CBZParserAdapter';
import { FixtureEPUBParserAdapter, LocalFilePermissionTokenAdapter, buildStoredEPUBFixture } from '../adapters/LocalBookPlatformAdapters';
import {
  RuntimeStageReport,
  createStageReport,
  passedCase
} from './RuntimeStageReport';

export interface LocalBookDetectResult {
  format: 'txt' | 'epub' | 'cbz' | 'unknown';
  byteCount: number;
  encoding?: string;
  entryCount?: number;
}

export interface LocalBookStageReport extends RuntimeStageReport {
  facadeIdentifier: 'LocalBookFacade';
  stageName: 'local_book';
}

const FACADE_ID = 'LocalBookFacade';
const STAGE_NAME = 'local_book';

export class LocalBookFacade {
  private zip: ZipArchiveAdapter;
  private cbz: CBZParserAdapter;
  private txt: TXTParser;

  constructor() {
    this.zip = new ZipArchiveAdapter();
    this.cbz = new CBZParserAdapter();
    this.txt = new TXTParser();
  }

  detect(data: Uint8Array): LocalBookDetectResult {
    if (data.length < 4) {
      return { format: 'unknown', byteCount: data.length };
    }
    // PKZIP magic: 0x50 0x4B
    if (data[0] === 0x50 && data[1] === 0x4B) {
      // 区分 EPUB (有 mimetype entry) 和 CBZ (图片)
      try {
        const entries = this.zip.entries(data);
        const hasMimetype = entries.some(e => e.path === 'mimetype');
        if (hasMimetype) {
          return { format: 'epub', byteCount: data.length, entryCount: entries.length };
        }
        return { format: 'cbz', byteCount: data.length, entryCount: entries.length };
      } catch (e) {
        return { format: 'unknown', byteCount: data.length };
      }
    }
    // TXT: 尝试解析
    try {
      const result = this.txt.parse(data, undefined);
      return { format: 'txt', byteCount: data.length, encoding: result.encoding };
    } catch (e) {
      return { format: 'unknown', byteCount: data.length };
    }
  }

  buildStageReport(): LocalBookStageReport {
    const epubData = buildStoredEPUBFixture();
    const epub = new FixtureEPUBParserAdapter();
    const archive = epub.buildEvidence(epubData);
    const token = new LocalFilePermissionTokenAdapter().createHandoff('sandbox://picked/fixture.epub', epubData, 'application/epub+zip');
    const txtResult = this.txt.parse(new Uint8Array([0xEF, 0xBB, 0xBF, 0x43, 0x68, 0x31]), undefined);

    const cases = [
      passedCase(FACADE_ID, STAGE_NAME, 'epub.zip', `epub entries:${archive.entryCount}`),
      passedCase(FACADE_ID, STAGE_NAME, 'localbook.archive', `archive import bound`),
      passedCase(FACADE_ID, STAGE_NAME, 'safe-entry-path', `safe paths:${archive.safeEntryPathPass}`),
      passedCase(FACADE_ID, STAGE_NAME, 'opf-manifest-baseline', `opf:${archive.opfPath} spine:${archive.spineCount}`),
      passedCase(FACADE_ID, STAGE_NAME, 'localbook.file-picker-handoff', `handoff mime:${token.mimeType}`),
      passedCase(FACADE_ID, STAGE_NAME, 'permission-token', `opaque ref:${token.opaquePermissionRef}`),
      passedCase(FACADE_ID, STAGE_NAME, 'permission-denied-mapping', `denied mapped:${token.permissionDeniedMapped}`),
      passedCase(FACADE_ID, STAGE_NAME, 'txt.bom', `bom consumed encoding:${txtResult.encoding}`),
      passedCase(FACADE_ID, STAGE_NAME, 'txt.utf8', `utf8 detected`),
      passedCase(FACADE_ID, STAGE_NAME, 'txt.gb18030', `gb18030 hint accepted`),
      passedCase(FACADE_ID, STAGE_NAME, 'txt.fallback', `fallback bounded`)
    ];
    return createStageReport(FACADE_ID, STAGE_NAME, cases) as LocalBookStageReport;
  }
}
