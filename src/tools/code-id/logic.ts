import { v4, v7 } from 'uuid';
import { monotonicFactory } from 'ulid';
export type IdKind = 'uuid4' | 'uuid7' | 'ulid';
const nextUlid = monotonicFactory();
export function generateIds(kind: IdKind, count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 10000) throw new Error('数量请填 1 到 1 万的整数');
  if (!['uuid4', 'uuid7', 'ulid'].includes(kind)) throw new Error('请选择标识类型');
  const next = kind === 'uuid4' ? v4 : kind === 'uuid7' ? v7 : nextUlid;
  return Array.from({ length: count }, () => next());
}
