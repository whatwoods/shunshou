import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { Input, BlobSource, ALL_FORMATS, EncodedPacketSink } from 'mediabunny';
import { convertMedia } from '../../lib/av/convert';
import { DEFAULT_AV, type MediaInfo } from '../../lib/av/types';
it('MP4 旋转 90 度并静音，保留视频编码数据', async () => {
  const bytes = await readFile(new URL('../av-trim/fixtures/clip.mp4', import.meta.url));
  const input = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  try {
    const video = (await input.getPrimaryVideoTrack())!;
    const info: MediaInfo = {
      duration: await input.computeDuration(),
      width: await video.getDisplayWidth(),
      height: await video.getDisplayHeight(),
      fps: 8,
      hasAudio: true,
      hasVideo: true,
      videoCodec: 'avc',
      audioCodec: 'aac'
    };
    const result = await convertMedia(
      input,
      info,
      'clip',
      'convert',
      0,
      info.duration,
      { ...DEFAULT_AV, rotation: 90, mute: true },
      () => {}
    );
    const output = new Input({ source: new BlobSource(result.blob), formats: ALL_FORMATS });
    try {
      const rotated = (await output.getPrimaryVideoTrack())!;
      expect(await rotated.getRotation()).toBe(90);
      expect(await rotated.getDisplayWidth()).toBe(info.height);
      expect(await rotated.getDisplayHeight()).toBe(info.width);
      expect(await output.getPrimaryAudioTrack()).toBeNull();
      expect((await new EncodedPacketSink(rotated).getFirstPacket())?.data).toEqual(
        (await new EncodedPacketSink(video).getFirstPacket())?.data
      );
    } finally {
      output.dispose();
    }
  } finally {
    input.dispose();
  }
});
it('真实 VP9/Opus MP4 转成 WebM，保留双轨且编码字节一致', async () => {
  const bytes = await readFile(new URL('./fixtures/vp9-opus.mp4', import.meta.url));
  const input = new Input({ source: new BlobSource(new Blob([bytes])), formats: ALL_FORMATS });
  try {
    const video = (await input.getPrimaryVideoTrack())!;
    const info: MediaInfo = {
      duration: await input.computeDuration(),
      width: 64,
      height: 48,
      fps: 8,
      hasAudio: true,
      hasVideo: true,
      videoCodec: 'vp9',
      audioCodec: 'opus'
    };
    const result = await convertMedia(input, info, 'clip', 'convert', 0, info.duration, { ...DEFAULT_AV, videoFormat: 'webm' }, () => {});
    expect(result.blob.type).toBe('video/webm');
    const output = new Input({ source: new BlobSource(result.blob), formats: ALL_FORMATS });
    try {
      const converted = (await output.getPrimaryVideoTrack())!;
      expect(await converted.getCodec()).toBe('vp9');
      expect(await (await output.getPrimaryAudioTrack())?.getCodec()).toBe('opus');
      expect((await new EncodedPacketSink(converted).getFirstPacket())?.data).toEqual(
        (await new EncodedPacketSink(video).getFirstPacket())?.data
      );
    } finally {
      output.dispose();
    }
  } finally {
    input.dispose();
  }
});
