import type { OperationFacts } from './ReaderOperationFacts';
import type { PersistedReceiptProjection } from './ReaderPersistedReceiptProjection';

export interface ReaderRecoveryView {
  message: string;
  visible: boolean;
  canRetry: boolean;
  generation: number;
}
export function readerRecoveryView<T>(receipt?: PersistedReceiptProjection<T>, read?: OperationFacts<T>, confirmedParts: number = 0): ReaderRecoveryView {
  if (receipt !== undefined && receipt.receipt.fact !== 'confirmedCurrent') {
    return { message: (receipt.facts.message?.includes(receipt.receipt.message) === true ? receipt.facts.message :
      receipt.receipt.message + (receipt.refreshError === undefined ? '' : `：${receipt.refreshError}`)) +
      (receipt.receipt.confirmation === 'unknown' && confirmedParts > 0 ? `（已有 ${confirmedParts} 项确认）` : ''),
      visible: true, canRetry: receipt.facts.canRetry, generation: receipt.facts.generation };
  }
  if (read !== undefined && read.fact !== 'idle' && read.fact !== 'current' && read.fact !== 'empty') {
    return { message: read.message ?? (read.fact === 'refreshFailed' ? '刷新失败，保留上次读取结果' :
      read.fact === 'failed' ? '读取失败' : read.fact === 'partial' ? '部分读取失败，保留已有结果' : '正在读取…'),
      visible: true, canRetry: read.canRetry, generation: read.generation };
  }
  return { message: '', visible: false, canRetry: false, generation: 0 };
}
