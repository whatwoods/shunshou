import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { Input, BlobSource, ALL_FORMATS, Output, BufferTarget, Mp4OutputFormat, Conversion, EncodedPacketSink } from 'mediabunny';
it('真实 H.264 + AAC 视频按关键帧流复制，保留音画且编码数据不变', async () => {
  const bytes = await readFile(new URL('./fixtures/clip.mp4', import.meta.url));
  const input = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  try {
    const sourceVideo = (await input.getPrimaryVideoTrack())!;
    const originalKey = await new EncodedPacketSink(sourceVideo).getKeyPacket(1.4);
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      trim: { start: 1.4, end: 2.6 },
      copy: { mode: 'forced', shiftTolerance: Infinity, boundaryPolicy: 'expand' },
      showWarnings: false
    });
    expect(conversion.discardedTracks).toHaveLength(0);
    expect(conversion.isValid).toBe(true);
    await conversion.execute();
    const decoded = new Input({ source: new BlobSource(new Blob([output.target.buffer!])), formats: ALL_FORMATS });
    try {
      const copiedVideo = (await decoded.getPrimaryVideoTrack())!;
      expect(await copiedVideo.getCodec()).toBe('avc');
      expect(await (await decoded.getPrimaryAudioTrack())?.getCodec()).toBe('aac');
      const copiedKey = await new EncodedPacketSink(copiedVideo).getFirstPacket();
      expect(copiedKey?.data).toEqual(originalKey?.data);
      expect(await decoded.computeDuration()).toBeGreaterThanOrEqual(1.2);
      expect(await decoded.computeDuration()).toBeLessThanOrEqual(4.1);
    } finally {
      decoded.dispose();
    }
  } finally {
    input.dispose();
  }
});
