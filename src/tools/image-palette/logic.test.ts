import { it, expect } from 'vitest';
import { colorValues } from '../../lib/image/extras';
it('生成标准 HEX 和 RGB', () => expect(colorValues([0, 127, 255])).toEqual({ hex: '#007FFF', rgb: 'rgb(0, 127, 255)' }));
it('钳制并舍入通道', () => expect(colorValues([-1, 4.6, 300]).hex).toBe('#0005FF'));
