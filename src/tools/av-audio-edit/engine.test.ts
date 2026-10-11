import { expect, it } from 'vitest';
import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';
import { convertMedia } from '../../lib/av/convert';
import { DEFAULT_AV, type MediaInfo } from '../../lib/av/types';
import { sineWav } from './fixture';
const info: MediaInfo = {
  duration: 1,
  width: 0,
  height: 0,
  fps: 0,
  hasAudio: true,
  hasVideo: false,
  videoCodec: '',
  audioCodec: 'pcm-s16'
};
it('真实 PCM 音频按选区剪辑后为 0.5 秒 WAV', async () => {
  const input = new Input({ source: new BlobSource(sineWav(44100)), formats: ALL_FORMATS });
  try {
    const result = await convertMedia(input, info, 'tone', 'audio-edit', 0.2, 0.7, { ...DEFAULT_AV, audioFormat: 'wav' }, () => {});
    expect(result.blob.type).toBe('audio/wav');
    const output = new Input({ source: new BlobSource(result.blob), formats: ALL_FORMATS });
    try {
      expect(await output.computeDuration()).toBeCloseTo(0.5, 3);
    } finally {
      output.dispose();
    }
  } finally {
    input.dispose();
  }
});
it('本地 LAME 将真实 PCM 选区编码为可读取的 MP3', async () => {
  const input = new Input({ source: new BlobSource(sineWav(44100)), formats: ALL_FORMATS });
  try {
    const result = await convertMedia(input, info, 'tone', 'audio-edit', 0.2, 0.7, { ...DEFAULT_AV, audioFormat: 'mp3' }, () => {});
    expect(result.blob.type).toBe('audio/mpeg');
    expect(result.name).toBe('tone-audio-edit.mp3');
    const output = new Input({ source: new BlobSource(result.blob), formats: ALL_FORMATS });
    try {
      expect(await (await output.getPrimaryAudioTrack())?.getCodec()).toBe('mp3');
      expect(await output.computeDuration()).toBeGreaterThanOrEqual(0.5);
      expect(await output.computeDuration()).toBeLessThan(0.6);
      expect(result.blob.size).toBeGreaterThan(1000);
    } finally {
      output.dispose();
    }
  } finally {
    input.dispose();
  }
});
it('拒绝无音轨和越界选区，不生成空结果', async () => {
  const input = new Input({ source: new BlobSource(sineWav()), formats: ALL_FORMATS });
  try {
    await expect(convertMedia(input, { ...info, hasAudio: false }, 'silent', 'audio-edit', 0, 1, DEFAULT_AV, () => {})).rejects.toThrow(
      '没有声音'
    );
    await expect(convertMedia(input, info, 'tone', 'audio-edit', 0.8, 0.7, DEFAULT_AV, () => {})).rejects.toThrow('结束时间要晚于开始时间');
  } finally {
    input.dispose();
  }
});
