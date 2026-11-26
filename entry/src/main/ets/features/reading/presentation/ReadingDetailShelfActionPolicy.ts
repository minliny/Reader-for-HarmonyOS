export interface ReadingDetailShelfActionInput {
  inBookshelf: boolean;
  bookAvailable: boolean;
  removalEnabled: boolean;
  removing: boolean;
  adding: boolean;
  cancellingAdd: boolean;
}

export interface ReadingDetailShelfAction {
  label: string;
  enabled: boolean;
  busy: boolean;
  tone: 'ink' | 'accent';
}

export function resolveReadingDetailShelfAction(input: ReadingDetailShelfActionInput): ReadingDetailShelfAction {
  const busy = input.removing || input.cancellingAdd;
  let label = input.inBookshelf ? '移除书架' : '加入书架';
  if (input.adding || input.cancellingAdd) label = '取消加入';
  else if (!input.removing && !input.bookAvailable) label = '已移除';

  return {
    label,
    enabled: input.removalEnabled && !busy && input.bookAvailable,
    busy,
    tone: input.inBookshelf ? 'ink' : 'accent',
  };
}
