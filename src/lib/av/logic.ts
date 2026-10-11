export function validateRange(start: number, end: number, duration: number) {
  if (![start, end, duration].every(Number.isFinite) || start < 0 || end <= start || end > duration + 0.001)
    throw new Error('结束时间要晚于开始时间，且不超过总时长。');
  return { start, end: Math.min(end, duration) };
}
export function timestamps(start: number, end: number, interval: number, limit = 1000): number[] {
  if (!Number.isFinite(interval) || interval <= 0) throw new Error('间隔必须大于 0 秒。');
  validateRange(start, end, end);
  const count = Math.ceil((end - start) / interval - 1e-9);
  if (count > limit) throw new Error(`这次会生成 ${count} 帧，请缩短片段或增大间隔（最多 ${limit} 帧）。`);
  return Array.from({ length: count }, (_, i) => start + i * interval);
}
export function fitWidth(width: number, height: number, maxWidth: number): { width: number; height: number } {
  const scale = maxWidth > 0 ? Math.min(1, maxWidth / width) : 1;
  return { width: Math.max(2, Math.round((width * scale) / 2) * 2), height: Math.max(2, Math.round((height * scale) / 2) * 2) };
}
export function estimatedBytes(seconds: number, megabits: number, hasAudio: boolean) {
  return Math.ceil((seconds * (megabits * 1_000_000 + (hasAudio ? 128_000 : 0))) / 8);
}
export function timeLabel(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00.000';
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
