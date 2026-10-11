import { decodeBytes, decodeText } from '../code-base64/logic';
export function parseJwt(token: string) {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('JWT 应有三段，以两个英文句点分隔');
  if (!parts[0] || !parts[1]) throw new Error('头部和载荷不能为空');
  for (const p of parts) if (!/^[\w-]*$/.test(p)) throw new Error('JWT 分段含有非法 Base64URL 字符');
  const header = JSON.parse(decodeText(parts[0]));
  const payload = JSON.parse(decodeText(parts[1]));
  if (!header || typeof header !== 'object' || Array.isArray(header) || !payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new Error('头部和载荷必须是 JSON 对象');
  return { parts, header: header as Record<string, unknown>, payload: payload as Record<string, unknown> };
}
export function timeClaims(payload: Record<string, unknown>, now = Date.now()) {
  return ['iat', 'nbf', 'exp'].flatMap((key) => {
    const value = payload[key];
    if (value === undefined) return [];
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(new Date(value * 1000).getTime()))
      return [{ key, text: '时间字段不是有效的 Unix 秒数', status: 'invalid' }];
    return [
      {
        key,
        text: new Date(value * 1000).toISOString(),
        status:
          key === 'exp' ? (value * 1000 <= now ? 'expired' : 'valid') : key === 'nbf' ? (value * 1000 > now ? 'future' : 'valid') : 'issued'
      }
    ];
  });
}
export const algorithms = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'ES256', 'ES384', 'ES512', 'EdDSA'] as const;
export async function verifyJwt(token: string, keyText: string, expected: string) {
  const { parts, header } = parseJwt(token);
  if (header.alg !== expected) throw new Error('头部算法与选定算法不同，请先确认令牌来源使用的算法');
  if (header.crit !== undefined || header.b64 === false) throw new Error('暂不支持带 crit 或 b64=false 扩展的令牌');
  if (!algorithms.includes(expected as (typeof algorithms)[number])) throw new Error('不支持此验签算法');
  if (!keyText) throw new Error('请填写密钥或公钥');
  const data = new TextEncoder().encode(parts.slice(0, 2).join('.'));
  const sig = decodeBytes(parts[2]);
  let key: CryptoKey;
  let algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
  if (expected.startsWith('HS')) {
    const hash = 'SHA-' + expected.slice(2);
    algorithm = { name: 'HMAC' };
    key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyText), { name: 'HMAC', hash }, false, ['verify']);
  } else {
    const hash = 'SHA-' + expected.slice(2);
    const name = expected.startsWith('RS')
      ? 'RSASSA-PKCS1-v1_5'
      : expected.startsWith('PS')
        ? 'RSA-PSS'
        : expected.startsWith('ES')
          ? 'ECDSA'
          : 'Ed25519';
    const params: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams =
      name === 'ECDSA'
        ? { name, namedCurve: expected === 'ES256' ? 'P-256' : expected === 'ES384' ? 'P-384' : 'P-521' }
        : name === 'Ed25519'
          ? { name }
          : { name, hash };
    if (keyText.trim().startsWith('{')) key = await crypto.subtle.importKey('jwk', JSON.parse(keyText), params, false, ['verify']);
    else {
      if (!keyText.includes('-----BEGIN PUBLIC KEY-----')) throw new Error('请提供 SPKI 格式公钥（BEGIN PUBLIC KEY），或 JWK JSON');
      const pem = keyText.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
      key = await crypto.subtle.importKey('spki', decodeBytes(pem) as Uint8Array<ArrayBuffer>, params, false, ['verify']);
    }
    algorithm =
      name === 'RSA-PSS' ? { name, saltLength: 32 } : name === 'ECDSA' ? { name, hash: expected === 'ES512' ? 'SHA-512' : hash } : { name };
  }
  return crypto.subtle.verify(algorithm, key, sig as Uint8Array<ArrayBuffer>, data);
}
