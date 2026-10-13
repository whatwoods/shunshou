export function wifi(ssid: string, password: string, security: string, hidden: boolean) {
  const escape = (s: string) => s.replace(/[\\;,:"']/g, (c) => '\\' + c);
  if (!ssid.trim()) throw new Error('请输入 Wi-Fi 名称');
  if (!['WPA', 'WEP', 'nopass'].includes(security)) throw new Error('请选择有效的加密方式');
  return `WIFI:T:${security};S:${escape(ssid)};P:${security === 'nopass' ? '' : escape(password)};H:${hidden};;`;
}
export function validColors(dark: string, light: string) {
  if (!/^#[0-9a-f]{6}$/i.test(dark) || !/^#[0-9a-f]{6}$/i.test(light)) throw new Error('颜色需要使用六位 HEX');
  if (dark.toLowerCase() === light.toLowerCase()) throw new Error('前景和背景不能相同，请提高对比度');
}
