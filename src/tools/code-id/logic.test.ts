import { describe, it, expect } from 'vitest';
import { validate, version } from 'uuid';
import { decodeTime, isValid } from 'ulid';
import { generateIds } from './logic';
describe('ID generation', () => {
  it.each(['uuid4', 'uuid7'] as const)('generates unique valid %s', (kind) => {
    const ids = generateIds(kind, 200);
    expect(new Set(ids).size).toBe(200);
    expect(ids.every((id) => validate(id) && version(id) === (kind === 'uuid4' ? 4 : 7))).toBe(true);
  });
  it('generates monotonic ULIDs with current timestamp', () => {
    const start = Date.now();
    const ids = generateIds('ulid', 200);
    expect(ids.every(isValid)).toBe(true);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(200);
    expect(decodeTime(ids[0])).toBeGreaterThanOrEqual(start);
  });
  it.each([0, -1, 10001, 1.5, NaN])('rejects count %s', (count) => expect(() => generateIds('uuid4', count)).toThrow());
});
