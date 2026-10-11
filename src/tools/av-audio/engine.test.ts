import { expect, it } from 'vitest';
import { Input, BlobSource, ALL_FORMATS, Output, BufferTarget, WavOutputFormat, Conversion } from 'mediabunny';
import { sineWav } from '../av-audio-edit/fixture';

it('真实 PCM 音轨读取、转换、重新解析成功且时长正确', async () => {
  const input = new Input({ source: new BlobSource(sineWav()), formats: ALL_FORMATS });
  const output = new Output({ format: new WavOutputFormat(), target: new BufferTarget() });
  try {
    expect(await input.computeDuration()).toBeCloseTo(1, 3);
    const conversion = await Conversion.init({ input, output, video: { discard: true }, audio: { codec: 'pcm-s16' }, showWarnings: false });
    expect(conversion.isValid).toBe(true);
    await conversion.execute();
    const decoded = new Input({ formats: ALL_FORMATS, source: new BlobSource(new Blob([output.target.buffer!])) });
    try {
      expect(await decoded.computeDuration()).toBeCloseTo(1, 3);
      expect(await (await decoded.getPrimaryAudioTrack())?.getCodec()).toBe('pcm-s16');
    } finally {
      decoded.dispose();
    }
  } finally {
    input.dispose();
  }
});
