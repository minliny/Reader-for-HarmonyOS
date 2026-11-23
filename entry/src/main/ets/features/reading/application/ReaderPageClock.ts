export function formatReaderPageClock(epochMillis: number): string {
  const date = new Date(epochMillis);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${hour}:${minute}`;
}
