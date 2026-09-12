export type LocalImportFailureCode = 'positionMigration' | 'incomplete' | 'tooLarge' | 'noSpace' | 'invalidBook' | 'readFailed' | 'recoveryPending' | 'unknown';
export interface LocalImportFailure { code: LocalImportFailureCode; message: string; }

export function localImportFailure(reason: string, recoveryPending: boolean = false): LocalImportFailure {
  if (recoveryPending) { return { code: 'recoveryPending', message: '结果未确认，请重启后检查书架' }; }
  const value = reason.toLowerCase();
  if (value.includes('position_migration_required')) { return { code: 'positionMigration', message: '目录已变化，已保留原有进度和书签，暂未覆盖旧书' }; }
  if (/not_readable|incomplete|unverified|metadataonly|requires_renderer_or_ocr/.test(value)) { return { code: 'incomplete', message: '正文不完整或暂不支持完整阅读，请保留原文件' }; }
  if (/no space|enospc|disk full|insufficient.*space|空间/.test(value)) { return { code: 'noSpace', message: '空间不足，请清理后重试' }; }
  if (/exceed|too large|limit|budget|超限/.test(value)) { return { code: 'tooLarge', message: '文件或章节过大，请换一本书' }; }
  if (/epub|decode|parse|format|chapter|格式|解析/.test(value)) { return { code: 'invalidBook', message: '文件损坏或格式不支持，请换文件' }; }
  if (/read|open|staging|document|读取/.test(value)) { return { code: 'readFailed', message: '文件读取失败，请重新选择' }; }
  return { code: 'unknown', message: '导入失败，请重试' };
}
