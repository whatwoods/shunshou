import { Input, ALL_FORMATS, BlobSource, CanvasSink, type InputVideoTrack } from 'mediabunny';
import { fitWidth, timestamps, validateRange } from './logic';
import { ditherRgba } from './palette';
import { convertMedia } from './convert';
import type { AvRequest, AvSettings, MediaInfo, MediaResult } from './types';

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<AvRequest & { id: number }>) => void) | null;
  postMessage: (message: unknown) => void;
};
let input: Input | undefined;
let video: InputVideoTrack | null = null;
let info: MediaInfo;
let filename = 'video';
let lastFrame = { timestamp: 0, duration: 0 };
let frameSink: CanvasSink | undefined;
function progress(id: number, value: number) {
  scope.postMessage({ id, progress: value });
}
function videoRequired(): InputVideoTrack {
  if (!video) throw new Error('文件里没有视频画面，请换一个。');
  return video;
}
async function frame(time: number, settings: AvSettings, direction?: -1 | 1): Promise<MediaResult> {
  frameSink ??= new CanvasSink(videoRequired(), { poolSize: 1 });
  if (direction) {
    const current = await frameSink.getCanvas(Math.min(Math.max(0, time), Math.max(0, info.duration - 0.000001)));
    if (current) lastFrame = current;
  }
  if (direction === -1) time = Math.max(0, lastFrame.timestamp - 0.000001);
  if (direction === 1) time = lastFrame.timestamp + Math.max(lastFrame.duration, 0.000001);
  const canvas = await frameSink.getCanvas(Math.min(Math.max(0, time), Math.max(0, info.duration - 0.000001)));
  if (!canvas) throw new Error('这个时间没有可读取的画面，请换一个时间点。');
  lastFrame = canvas;
  const blob = await (canvas.canvas as OffscreenCanvas).convertToBlob({ type: `image/${settings.imageFormat}`, quality: settings.quality });
  return {
    blob,
    name: `${filename}-${canvas.timestamp.toFixed(3)}.${settings.imageFormat === 'jpeg' ? 'jpg' : 'png'}`,
    timestamp: canvas.timestamp,
    frameDuration: canvas.duration
  };
}
async function run(request: Extract<AvRequest, { kind: 'run' }>, id: number): Promise<MediaResult> {
  const { mode, settings, batch } = request;
  if (!input) throw new Error('请先选择一个文件。');
  const { start, end } = validateRange(request.start, request.end, info.duration);
  if (mode === 'frame' || mode === 'gif') {
    const track = videoRequired();
    const dims =
      mode === 'gif'
        ? fitWidth(info.width, info.height, Math.min(settings.width || 640, 1280))
        : { width: info.width, height: info.height };
    const sink = new CanvasSink(track, { ...dims, fit: 'fill', poolSize: 1 });
    const times = timestamps(start, end, mode === 'gif' ? 1 / settings.fps : settings.interval, mode === 'gif' ? 1800 : 500);
    if (mode === 'frame' && !batch) return frame(start, settings);
    if (mode === 'gif') {
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
      const gif = GIFEncoder();
      let index = 0;
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        if (!wrapped) throw new Error('这一段有解不开的画面，缩短一点或换个文件。');
        const canvas = wrapped.canvas as OffscreenCanvas;
        const context = canvas.getContext('2d')!;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const palette = quantize(pixels, 256, { format: 'rgb565' });
        const indexed = applyPalette(settings.dither ? ditherRgba(pixels, canvas.width) : pixels, palette, 'rgb565');
        // GIF duration is quantized to centiseconds; cumulative rounding prevents drift at e.g. 12 FPS.
        const until = Math.min(end - start, (index + 1) / settings.fps);
        const delay = (Math.round(until * 100) - Math.round((index / settings.fps) * 100)) * 10;
        gif.writeFrame(indexed, canvas.width, canvas.height, { palette, delay: Math.max(10, delay), repeat: 0 });
        progress(id, ++index / times.length);
      }
      gif.finish();
      return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), name: `${filename}.gif` };
    }
    const { zipSync } = await import('fflate');
    const files: Record<string, Uint8Array> = {};
    let index = 0;
    let total = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      if (!wrapped) throw new Error('部分画面无法解码，请换一个时间范围。');
      const blob = await (wrapped.canvas as OffscreenCanvas).convertToBlob({
        type: `image/${settings.imageFormat}`,
        quality: settings.quality
      });
      total += blob.size;
      if (total > 512 * 1024 * 1024) throw new Error('截图合计超过 512 MB，请增大间隔或分段导出。');
      files[`${String(index + 1).padStart(4, '0')}-${wrapped.timestamp.toFixed(3)}.${settings.imageFormat === 'jpeg' ? 'jpg' : 'png'}`] =
        new Uint8Array(await blob.arrayBuffer());
      progress(id, ++index / times.length);
    }
    return {
      blob: new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }),
      name: `${filename}-frames.zip`,
      note: `已导出 ${index} 张截图。`
    };
  }
  return convertMedia(input, info, filename, mode, start, end, settings, (value) => progress(id, value));
}
scope.onmessage = async ({ data }) => {
  const { id } = data;
  try {
    if (data.kind === 'load') {
      input?.dispose();
      input = new Input({ formats: ALL_FORMATS, source: new BlobSource(data.file) });
      filename = data.file.name.replace(/\.[^.]+$/, '') || 'video';
      video = await input.getPrimaryVideoTrack();
      const audio = await input.getPrimaryAudioTrack();
      const duration = await input.computeDuration();
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('读不到有效时长，请检查文件是否完整。');
      const stats = video ? await video.computePacketStats(100) : null;
      info = {
        duration,
        width: video ? await video.getDisplayWidth() : 0,
        height: video ? await video.getDisplayHeight() : 0,
        fps: stats?.averagePacketRate || 30,
        hasVideo: !!video,
        hasAudio: !!audio,
        videoCodec: video ? (await video.getCodec()) || '未知' : '',
        audioCodec: audio ? (await audio.getCodec()) || '未知' : ''
      };
      frameSink = undefined;
      lastFrame = { timestamp: 0, duration: 0 };
      scope.postMessage({ id, result: info });
    } else {
      const result = data.kind === 'frame' ? await frame(data.time, data.settings, data.direction) : await run(data, id);
      scope.postMessage({ id, result });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    scope.postMessage({
      id,
      error: /[\u3400-\u9fff]/.test(message) ? message : `没处理完，文件可能不完整，或换个输出格式再试。${message ? `（${message}）` : ''}`
    });
  }
};
