import { expect, test } from 'vitest';
import { encodeText, encodeBytes } from '../code-base64/logic';
import { parseJwt, timeClaims, verifyJwt } from './logic';
const make = (header: unknown, payload: unknown) =>
  encodeText(JSON.stringify(header), true) + '.' + encodeText(JSON.stringify(payload), true);
test('解析 UTF8 与时间边界', () => {
  const token = make({ alg: 'HS256' }, { name: '中文', exp: 100 });
  expect(parseJwt(token + '.').payload.name).toBe('中文');
  expect(timeClaims({ exp: 100 }, 100000)[0].status).toBe('expired');
  expect(timeClaims({ nbf: 101 }, 100000)[0].status).toBe('future');
  expect(() => parseJwt('a.b')).toThrow();
});
test('HMAC验签拒绝错误密钥和算法混淆', async () => {
  const data = make({ alg: 'HS256' }, { sub: '123' });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const token = data + '.' + encodeBytes(new Uint8Array(signature), true);
  expect(await verifyJwt(token, 'secret', 'HS256')).toBe(true);
  expect(await verifyJwt(token, 'wrong', 'HS256')).toBe(false);
  await expect(verifyJwt(token, 'secret', 'RS256')).rejects.toThrow('算法');
});
test('RSA与ECDSA公钥验签', async () => {
  for (const [alg, params, signParams] of [
    [
      'RS256',
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      { name: 'RSASSA-PKCS1-v1_5' }
    ],
    ['ES256', { name: 'ECDSA', namedCurve: 'P-256' }, { name: 'ECDSA', hash: 'SHA-256' }]
  ] as const) {
    const pair = (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])) as CryptoKeyPair;
    const data = make({ alg }, { sub: '123' });
    const signature = await crypto.subtle.sign(signParams, pair.privateKey, new TextEncoder().encode(data));
    const token = data + '.' + encodeBytes(new Uint8Array(signature), true);
    const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
    expect(await verifyJwt(token, JSON.stringify(publicKey), alg)).toBe(true);
  }
});
