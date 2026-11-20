import { errorMessageOf } from '../../app/ErrorMessage.ts';

/**
 * How a failed shelf read may be described to the user. The kind is derived
 * from the Core error envelope or the native startup message; raw platform
 * text, paths and SQL never reach the page. Every kind keeps the durable facts
 * unchanged: books, progress and sources stay in the same database file.
 */
export type BookshelfReadFailureKind =
  | 'schemaTooNew'
  | 'dataFormatTooNew'
  | 'storageUpgradeIncomplete'
  | 'storageBusy'
  | 'storageTimeout'
  | 'storageUnavailable'
  | 'storageCorrupt'
  | 'runtimeUnavailable'
  | 'cancelled'
  | 'unknown';

export interface BookshelfReadFailurePresentation {
  kind: BookshelfReadFailureKind;
  title: string;
  message: string;
  canRetry: boolean;
}

const DEFAULT_PRESENTATION: BookshelfReadFailurePresentation = {
  kind: 'unknown',
  title: '书架加载失败',
  message: '无法读取书架内容。书架、阅读进度和书源均已保留，请重试。',
  canRetry: true,
};

function failureEnvelope(error: unknown): Record<string, Object> | undefined {
  const raw = objectOf(error);
  const event = objectOf(raw?.['event']);
  return objectOf(event?.['error']) ?? objectOf(raw?.['error']) ?? raw;
}

function objectOf(value: unknown): Record<string, Object> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Object> : undefined;
}

function stringField(source: Record<string, Object> | undefined, key: string): string {
  const value = source?.[key];
  return typeof value === 'string' ? value : '';
}

function schemaTooNew(actual: number, supported: number): BookshelfReadFailurePresentation {
  return {
    kind: 'schemaTooNew',
    title: '本地数据版本过新',
    message: `本地数据由更新版本的 Reader 写入（数据 v${actual}，当前支持 v${supported}）。` +
      '书架、阅读进度和书源均已保留，请安装更新版本后继续使用。',
    canRetry: false,
  };
}

function dataFormatTooNew(actual: number, supported: number): BookshelfReadFailurePresentation {
  return {
    kind: 'dataFormatTooNew',
    title: '本地数据格式过新',
    message: `本地数据格式高于当前 Reader 支持范围（格式 v${actual}，当前支持 v${supported}）。` +
      '书架、阅读进度和书源均已保留，请安装更新版本后继续使用。',
    canRetry: false,
  };
}

/**
 * Core reports schema incompatibility in the native startup message because
 * the database is rejected before any request can be dispatched. Structured
 * request errors carry the same facts in `details.category` once a runtime is
 * already active.
 */
export function classifyBookshelfReadFailure(error: unknown): BookshelfReadFailurePresentation {
  const message = errorMessageOf(error);
  const failure = failureEnvelope(error);
  const code = stringField(failure, 'code');
  const details = objectOf(failure?.['details']);

  const schemaMessage = /storage schema too new: actual=(\d+) supported=(\d+)/.exec(message);
  if (schemaMessage !== null) return schemaTooNew(Number(schemaMessage[1]), Number(schemaMessage[2]));
  const formatMessage = /storage data format too new: actual=(\d+) supported=(\d+)/.exec(message);
  if (formatMessage !== null) return dataFormatTooNew(Number(formatMessage[1]), Number(formatMessage[2]));

  const category = stringField(details, 'category');
  const schemaDetail = (): BookshelfReadFailurePresentation | undefined => {
    const actual = details?.['actualSchema'];
    const supported = details?.['supportedSchema'];
    if (category !== 'STORAGE_SCHEMA_TOO_NEW' || typeof actual !== 'number' || typeof supported !== 'number') return undefined;
    return schemaTooNew(actual, supported);
  };
  const formatDetail = (): BookshelfReadFailurePresentation | undefined => {
    const actual = details?.['actualDataFormatGeneration'];
    const supported = details?.['supportedDataFormatGeneration'];
    if (category !== 'STORAGE_DATA_FORMAT_TOO_NEW' || typeof actual !== 'number' || typeof supported !== 'number') return undefined;
    return dataFormatTooNew(actual, supported);
  };
  const structured = schemaDetail() ?? formatDetail();
  if (structured !== undefined) return structured;

  if (code === 'BUSY' || code === 'TRANSACTION_PENDING' || /database is locked|sqlite.*busy/i.test(message)) {
    return {
      kind: 'storageBusy',
      title: '书架暂时被占用',
      message: '本地数据正在处理其他操作，书架和阅读进度均已保留，请稍后重试。',
      canRetry: true,
    };
  }
  if (code === 'TIMEOUT' || /timed out|deadline elapsed/i.test(message)) {
    return {
      kind: 'storageTimeout',
      title: '书架读取超时',
      message: '本地数据读取超时，书架和阅读进度均已保留，请重试。',
      canRetry: true,
    };
  }
  if (code === 'CANCELLED') {
    return {
      kind: 'cancelled',
      title: '书架读取已取消',
      message: '书架读取已取消，可重新读取。',
      canRetry: true,
    };
  }
  if (/database disk image is malformed|file is not a database|sqlite.*corrupt/i.test(message)) {
    return {
      kind: 'storageCorrupt',
      title: '本地书库无法读取',
      message: '书架数据库校验失败，原始数据文件仍保留。请勿卸载应用，并反馈此问题以便恢复。',
      canRetry: false,
    };
  }
  if (/migration backup/i.test(message)) {
    return {
      kind: 'storageUpgradeIncomplete',
      title: '数据升级未完成',
      message: '本地数据升级尚未完成，原始数据和已验证的升级备份均已保留，请重试。',
      canRetry: true,
    };
  }
  if (/failed to open Core SQLite database|unable to open database file|disk I\/O error|readonly database/i.test(message)) {
    return {
      kind: 'storageUnavailable',
      title: '本地书库无法打开',
      message: '书架数据库未能打开，原始数据文件仍保留，请重试；若持续失败请反馈此问题。',
      canRetry: true,
    };
  }
  if (/runtime is closed|did not become ready|not ready|READER_RUNTIME_NOT_READY/i.test(message)) {
    return {
      kind: 'runtimeUnavailable',
      title: '阅读核心未就绪',
      message: '阅读核心尚未启动或已关闭，书架数据保持原样，请返回后重试。',
      canRetry: true,
    };
  }
  return DEFAULT_PRESENTATION;
}
