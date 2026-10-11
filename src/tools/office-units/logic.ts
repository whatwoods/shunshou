export type Unit = { name: string; factor: number; offset?: number };
const u = (name: string, factor: number, offset = 0): Unit => ({ name, factor, offset });
export const units: Record<string, Unit[]> = {
  长度: [
    u('米 m', 1),
    u('千米 km', 1000),
    u('厘米 cm', 0.01),
    u('毫米 mm', 0.001),
    u('英寸 in', 0.0254),
    u('英尺 ft', 0.3048),
    u('码 yd', 0.9144),
    u('英里 mi', 1609.344),
    u('市尺', 1 / 3),
    u('市寸', 1 / 30),
    u('里', 500)
  ],
  重量: [
    u('千克 kg', 1),
    u('克 g', 0.001),
    u('毫克 mg', 0.000001),
    u('吨 t', 1000),
    u('市斤', 0.5),
    u('市两', 0.05),
    u('磅 lb', 0.45359237),
    u('盎司 oz', 0.028349523125)
  ],
  面积: [
    u('平方米 m²', 1),
    u('平方千米 km²', 1e6),
    u('公顷 ha', 1e4),
    u('亩', 2000 / 3),
    u('平方英尺 ft²', 0.09290304),
    u('英亩 acre', 4046.8564224)
  ],
  体积: [
    u('升 L', 1),
    u('毫升 mL', 0.001),
    u('立方米 m³', 1000),
    u('立方厘米 cm³', 0.001),
    u('美制加仑', 3.785411784),
    u('英制加仑', 4.54609)
  ],
  温度: [u('摄氏度 °C', 1, 273.15), u('华氏度 °F', 5 / 9, 255.3722222222222), u('开尔文 K', 1)],
  速度: [u('米/秒 m/s', 1), u('千米/时 km/h', 1 / 3.6), u('英里/时 mph', 0.44704), u('节 kn', 1852 / 3600)],
  存储: [
    u('字节 B', 1),
    u('位 bit', 1 / 8),
    u('KB（1000 B）', 1e3),
    u('MB', 1e6),
    u('GB', 1e9),
    u('TB', 1e12),
    u('KiB（1024 B）', 1024),
    u('MiB', 1024 ** 2),
    u('GiB', 1024 ** 3),
    u('TiB', 1024 ** 4)
  ],
  时间: [u('秒 s', 1), u('毫秒 ms', 0.001), u('微秒 μs', 0.000001), u('分钟 min', 60), u('小时 h', 3600), u('天', 86400), u('周', 604800)]
};
export function convert(value: number, from: Unit, to: Unit) {
  if (!Number.isFinite(value)) throw new Error('请输入有效数字');
  const base = value * from.factor + (from.offset || 0);
  if (units['温度'].includes(from) && base < -1e-10) throw new Error('温度不能低于绝对零度');
  const result = (base - (to.offset || 0)) / to.factor;
  if (!Number.isFinite(result)) throw new Error('数值过大，请缩小后重试');
  return result;
}
