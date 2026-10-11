import {
  Conversion,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  WavOutputFormat,
  OggOutputFormat,
  Mp3OutputFormat,
  Quality,
  canEncodeVideo,
  canEncodeAudio,
  type Input,
  type ConversionVideoOptions,
  type ConversionAudioOptions
} from 'mediabunny';
import { fitWidth, validateRange } from './logic';
import type { AvMode, AvSettings, MediaInfo, MediaResult } from './types';

export async function convertMedia(
  input: Input,
  info: MediaInfo,
  filename: string,
  mode: AvMode,
  start: number,
  end: number,
  settings: AvSettings,
  onProgress: (value: number) => void
): Promise<MediaResult> {
  validateRange(start, end, info.duration);
  const audioOnly = mode === 'audio' || mode === 'audio-edit';
  if (audioOnly && !info.hasAudio) throw new Error('这个文件没有声音，请换一个。');
  if (!audioOnly && !info.hasVideo) throw new Error('文件里没有视频画面，请换一个。');
  const format = audioOnly ? settings.audioFormat : settings.videoFormat;
  if (format === 'mp3' && !(await canEncodeAudio('mp3'))) {
    const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder');
    registerMp3Encoder();
  }
  const outputFormat =
    format === 'wav'
      ? new WavOutputFormat()
      : format === 'mp3'
        ? new Mp3OutputFormat()
        : format === 'ogg'
          ? new OggOutputFormat()
          : format === 'webm'
            ? new WebMOutputFormat()
            : new Mp4OutputFormat({ fastStart: 'in-memory' });
  const output = new Output({ format: outputFormat, target: new BufferTarget() });
  const dims = mode === 'compress' ? fitWidth(info.width, info.height, settings.width) : undefined;
  if (mode === 'compress') {
    const supported = await canEncodeVideo(format === 'webm' ? 'vp9' : 'avc', dims);
    if (!supported) throw new Error('浏览器不支持这个格式或分辨率，换 MP4 / WebM 或调小尺寸再试。');
    if (info.hasAudio && !(await canEncodeAudio(format === 'webm' ? 'opus' : 'aac')))
      throw new Error('浏览器编不了这种声音，换 MP4 / WebM，或用新版 Chrome / Edge。');
  }
  let video: ConversionVideoOptions = {};
  let audio: ConversionAudioOptions = {};
  if (audioOnly) {
    video = { discard: true };
    audio = {
      codec: format === 'wav' ? 'pcm-s16' : format === 'mp3' ? 'mp3' : format === 'ogg' ? 'opus' : 'aac',
      quality: new Quality({ bitrate: settings.audioBitrate * 1000 })
    };
    if (format === 'mp3') {
      const track = (await input.getPrimaryAudioTrack())!;
      // LAME accepts one or two channels; normalize uncommon source rates to a broadly supported output rate.
      audio.numberOfChannels = Math.min(2, await track.getNumberOfChannels());
      audio.sampleRate = 44100;
    }
  } else if (mode === 'compress') {
    // 编码器按帧率分配码率，不告诉它帧率时 60 帧视频会超出目标一倍；高帧率顺便降到 60
    video = {
      ...dims,
      fit: 'fill',
      frameRate: Math.min(60, Math.max(1, Math.round(info.fps))),
      codec: format === 'webm' ? 'vp9' : 'avc',
      quality: new Quality({ bitrate: settings.bitrate * 1_000_000 }),
      forceTranscode: true
    };
    audio = { codec: format === 'webm' ? 'opus' : 'aac', quality: new Quality({ bitrate: 128_000 }), forceTranscode: true };
  } else if (mode === 'convert') {
    video = { rotate: settings.rotation, codec: format === 'webm' ? 'vp9' : 'avc' };
    audio = { discard: settings.mute, codec: format === 'webm' ? 'opus' : 'aac' };
  }
  const conversion = await Conversion.init({
    input,
    output,
    tracks: 'primary',
    trim: { start, end },
    showWarnings: false,
    copy:
      mode === 'trim' && settings.trimMode === 'copy'
        ? { mode: 'forced', shiftTolerance: Infinity, boundaryPolicy: 'expand' }
        : mode === 'trim' || mode === 'audio-edit'
          ? { boundaryTolerance: 0 }
          : mode === 'convert'
            ? { shiftTolerance: Infinity }
            : {},
    video,
    audio
  });
  const rejected = conversion.discardedTracks.filter((track) => track.reason !== 'discarded_by_user');
  if (!conversion.isValid || rejected.length) {
    await conversion.cancel();
    throw new Error(
      mode === 'trim' && settings.trimMode === 'copy'
        ? '这种编码不能直接放进这个格式，换 MP4 / WebM，或选“精确到帧”。'
        : '浏览器处理不了这个文件的编码，换个输出格式，或用新版 Chrome / Edge 再试。'
    );
  }
  conversion.onProgress = onProgress;
  try {
    await conversion.execute();
  } catch (error) {
    await conversion.cancel();
    throw error;
  }
  const buffer = output.target.buffer;
  if (!buffer?.byteLength) throw new Error('没能生成文件，换个输出格式试试。');
  const mime =
    format === 'wav'
      ? 'audio/wav'
      : format === 'mp3'
        ? 'audio/mpeg'
        : format === 'ogg'
          ? 'audio/ogg'
          : format === 'm4a'
            ? 'audio/mp4'
            : `video/${format}`;
  return {
    blob: new Blob([buffer], { type: mime }),
    name: `${filename}-${mode}.${format}`,
    note:
      mode === 'trim' && settings.trimMode === 'copy'
        ? '没有重新编码，画质不变；起止可能对齐到附近关键帧。'
        : mode === 'convert' && settings.mute
          ? '已移除音轨。'
          : undefined
  };
}
