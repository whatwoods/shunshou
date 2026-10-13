import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToolPage } from '../ToolPage';
import { DropZone, DropOverlay } from '../DropZone';
import { ActionBar, KeyHint } from '../ActionBar';
import { NextSteps } from '../FileMatch';
import { DownloadIcon, Field, Led, Segmented, Slider, SwitchRow } from '../ui';
import { toolById } from '../../tools';
import { useFileDrop } from '../../lib/useFileDrop';
import { fmtSize, pickFiles, saveBlob } from '../../lib/files';
import { usePersisted, useSettingsLock } from '../../lib/settings';
import { useShortcuts } from '../../lib/useShortcuts';
import { useHandOff } from '../../lib/useHandOff';
import { toast } from '../Toast';
import { AvClient } from '../../lib/av/client';
import { estimatedBytes, timeLabel } from '../../lib/av/logic';
import { DEFAULT_AV, type AvMode, type AvSettings, type MediaInfo, type MediaResult } from '../../lib/av/types';
import './AvWorkbench.css';
import { Select } from '../Select';

const SUB: Record<AvMode, string> = {
  gif: '选一段画面，做成动图。',
  compress: '降分辨率和码率，视频变小。',
  audio: '只留下视频里的声音。',
  trim: '留下想要的那一段。',
  frame: '找到那一帧，存成图片。',
  'audio-edit': '截一段，换个格式。',
  convert: '换格式、转正画面、去声音。'
};
const RUN: Record<AvMode, string> = {
  gif: '生成 GIF',
  compress: '开始压缩',
  audio: '提取音频',
  trim: '截取这一段',
  frame: '截取当前帧',
  'audio-edit': '导出这一段',
  convert: '开始转换'
};
const ACCEPT = 'video/*,audio/*,.mp4,.mov,.mkv,.webm,.m4v,.avi,.m4a,.wav,.mp3,.ogg';
function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
export default function AvWorkbench({ mode }: { mode: AvMode }) {
  const audioOnly = mode === 'audio' || mode === 'audio-edit';
  const id = `av-${mode}`;
  // 动图默认窄一点；只要声音时默认 MP3，哪里都能播
  const initial = useMemo(
    () =>
      ({
        ...DEFAULT_AV,
        width: mode === 'gif' ? 480 : DEFAULT_AV.width,
        audioFormat: audioOnly ? 'mp3' : DEFAULT_AV.audioFormat
      }) as AvSettings,
    [mode, audioOnly]
  );
  const [settings, setSettings] = usePersisted<AvSettings>(id, initial);
  const [file, setFile] = useState<File>();
  const [info, setInfo] = useState<MediaInfo>();
  const [result, setResult] = useState<MediaResult>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [time, setTime] = useState(0);
  const client = useRef<AvClient | null>(null);
  const generation = useRef(0);
  const media = useRef<HTMLMediaElement | null>(null);
  const mounted = useRef(false);
  const previewSelection = useRef(false);
  const fileUrl = useObjectUrl(file);
  const resultUrl = useObjectUrl(result?.blob);
  const select = useCallback(
    async (files: File[]) => {
      const next = files[0];
      if (!next) return;
      const gen = ++generation.current;
      client.current?.dispose();
      client.current = null;
      previewSelection.current = false;
      setFile(next);
      setInfo(undefined);
      setResult(undefined);
      setError('');
      setBusy(true);
      setProgress(0);
      setStart(0);
      setEnd(0);
      setTime(0);
      try {
        client.current = new AvClient();
        const value = await client.current.request<MediaInfo>({ kind: 'load', file: next });
        if (gen !== generation.current) return;
        if (!value.hasVideo && mode !== 'audio' && mode !== 'audio-edit') throw new Error('这个文件里没有视频，请换一个。');
        setInfo(value);
        setEnd(mode === 'gif' ? Math.min(value.duration, 5) : value.duration);
      } catch (e) {
        if (gen === generation.current) setError(e instanceof Error ? e.message : '读不了这个文件，可能不完整。');
      } finally {
        if (gen === generation.current) setBusy(false);
      }
    },
    [mode]
  );
  const dragging = useFileDrop(select);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      client.current?.dispose();
    };
  }, []);
  useHandOff((files) => {
    // 交接是同步取走的；放到微任务里再处理，避开 StrictMode 的第一次卸载
    queueMicrotask(() => {
      if (mounted.current) void select(files);
    });
  });
  // 设置变了（包括“恢复默认”），旧结果就不对应了；正在跑的任务回来时设置已经变了，也不算数
  const signature = JSON.stringify([settings, start, end]);
  const live = useRef(signature);
  live.current = signature;
  useEffect(() => setResult(undefined), [signature]);
  useSettingsLock(busy);
  const update = <K extends keyof AvSettings>(key: K, value: AvSettings[K]) => setSettings((old) => ({ ...old, [key]: value }));
  function seek(value: number) {
    previewSelection.current = false;
    setTime(value);
    if (media.current) {
      media.current.pause();
      media.current.currentTime = value;
    }
  }
  async function process(batch = false, direction?: -1 | 1) {
    if (!client.current || !info || busy) return;
    const gen = generation.current;
    const at = signature;
    setBusy(true);
    setError('');
    setProgress(0);
    setResult(undefined);
    media.current?.pause();
    try {
      const output = await client.current.request<MediaResult>(
        mode === 'frame' && !batch ? { kind: 'frame', time, direction, settings } : { kind: 'run', mode, start, end, settings, batch },
        setProgress
      );
      if (gen !== generation.current || live.current !== at) return;
      setResult(output);
      if (output.timestamp !== undefined) seek(output.timestamp);
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : '没处理完，换个输出格式再试。');
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }
  function cancel() {
    generation.current++;
    client.current?.dispose();
    client.current = null;
    setBusy(false);
    setInfo(undefined);
    setError('已取消。重新选个文件就能继续。');
  }
  const download = () => {
    if (!result) {
      toast('还没有可下载的结果');
      return;
    }
    saveBlob(result.blob, result.name);
    toast(`已下载 ${result.name}`);
  };
  useShortcuts({
    run: () => {
      if (!info || busy) return false;
      void process();
    },
    save: download,
    cancel: busy ? cancel : undefined
  });
  const range = mode === 'gif' || mode === 'trim' || mode === 'frame' || mode === 'audio-edit';
  const onTimeUpdate = (element: HTMLMediaElement) => {
    setTime(element.currentTime);
    if (previewSelection.current && element.currentTime >= end) {
      element.pause();
      previewSelection.current = false;
    }
  };
  async function playSelection() {
    if (!media.current || end <= start) return;
    seek(start);
    previewSelection.current = true;
    try {
      await media.current.play();
    } catch {
      previewSelection.current = false;
      toast('浏览器预览不了，但可以直接处理试试。', 'error');
    }
  }
  const split = (label: string, value: string) => (
    <span className="field-split">
      {label}
      <span className="field-value">{value}</span>
    </span>
  );
  return (
    <ToolPage
      tool={toolById(id)!}
      sub={
        <>
          {SUB[mode]}
          <span className="upload-led">
            <Led status="done" />0 B 上传
          </span>
        </>
      }
    >
      <DropOverlay show={dragging} title={audioOnly ? '松手，打开音频' : '松手，打开视频'} />
      {/* 没有文件时版式不变：拖放区占预览的位置，右边的设置可以先选好 */}
      <div className="av-workbench">
        {!file ? (
          <DropZone
            className="in-layout"
            accept={ACCEPT}
            multiple={false}
            title={audioOnly ? '把视频或音频拖到这里' : '把视频拖到这里'}
            hint="也可以直接粘贴"
            onFiles={select}
          />
        ) : (
          <div className="av-preview-panel">
            <div className="av-file">
              <strong>{file.name}</strong>
              <span>
                {fmtSize(file.size)}
                {info && ` · ${timeLabel(info.duration)}${info.hasVideo ? ` · ${info.width} × ${info.height}` : ''}`}
              </span>
            </div>
            {audioOnly && !info?.hasVideo ? (
              <audio
                ref={(node) => {
                  media.current = node;
                }}
                src={fileUrl || undefined}
                controls
                preload="metadata"
                className="av-audio"
                onTimeUpdate={(e) => onTimeUpdate(e.currentTarget)}
              />
            ) : (
              <video
                ref={(node) => {
                  media.current = node;
                }}
                src={fileUrl || undefined}
                controls
                preload="metadata"
                playsInline
                className="av-video"
                onTimeUpdate={(e) => onTimeUpdate(e.currentTarget)}
              />
            )}
            {info && (
              <p className="av-note">
                {[info.videoCodec && `视频 ${info.videoCodec}`, info.hasAudio ? `音频 ${info.audioCodec}` : '无音轨']
                  .filter(Boolean)
                  .join(' · ')}
                。
              </p>
            )}
            {mode === 'frame' && info && (
              <div className="av-frame-controls">
                <label>
                  定位到（秒）
                  <input
                    type="number"
                    min="0"
                    max={info.duration}
                    step="0.001"
                    value={Number(time.toFixed(3))}
                    onChange={(e) => seek(Math.max(0, Math.min(info.duration, e.currentTarget.valueAsNumber || 0)))}
                    disabled={busy}
                  />
                </label>
                <div className="av-buttons">
                  <button type="button" className="btn-soft" disabled={busy} onClick={() => process(false, -1)}>
                    上一帧
                  </button>
                  <button type="button" className="btn-soft" disabled={busy} onClick={() => process(false, 1)}>
                    下一帧
                  </button>
                </div>
              </div>
            )}
            {range && info && (
              <div className="av-range">
                <label>
                  {split('开始', timeLabel(start))}
                  <Slider
                    label="开始时间轴"
                    min={0}
                    max={info.duration}
                    step={0.001}
                    value={start}
                    disabled={busy}
                    onChange={(v) => {
                      setStart(Math.min(v, end - 0.001));
                      setResult(undefined);
                    }}
                  />
                </label>
                <label>
                  {split('结束', timeLabel(end))}
                  <Slider
                    label="结束时间轴"
                    min={0}
                    max={info.duration}
                    step={0.001}
                    value={end}
                    disabled={busy}
                    onChange={(v) => {
                      setEnd(Math.max(v, start + 0.001));
                      setResult(undefined);
                    }}
                  />
                </label>
                <div className="av-two">
                  <label>
                    开始秒数
                    <input
                      type="number"
                      min="0"
                      max={end}
                      step="0.001"
                      value={start}
                      disabled={busy}
                      onChange={(e) => {
                        setStart(e.currentTarget.valueAsNumber || 0);
                        setResult(undefined);
                      }}
                    />
                  </label>
                  <label>
                    结束秒数
                    <input
                      type="number"
                      min={start}
                      max={info.duration}
                      step="0.001"
                      value={end}
                      disabled={busy}
                      onChange={(e) => {
                        setEnd(e.currentTarget.valueAsNumber || 0);
                        setResult(undefined);
                      }}
                    />
                  </label>
                </div>
                <div className="av-buttons">
                  <button
                    type="button"
                    className="link-btn"
                    disabled={busy}
                    onClick={() => {
                      setStart(time);
                      setResult(undefined);
                    }}
                  >
                    当前位置设为开始
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    disabled={busy}
                    onClick={() => {
                      setEnd(time);
                      setResult(undefined);
                    }}
                  >
                    设为结束
                  </button>
                  <button type="button" className="link-btn" disabled={busy} onClick={playSelection}>
                    播放选段
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {(info || !file) && (
          <div className="av-settings">
            <h2 className="group-title">输出设置</h2>
            <fieldset disabled={busy} className="group settings-group">
              {(mode === 'gif' || mode === 'compress') && (
                <Field label="最大宽度">
                  <Select value={settings.width} onChange={(e) => update('width', Number(e.target.value))}>
                    {(mode === 'gif' ? [320, 480, 640, 960, 1280] : [0, 640, 1280, 1920, 2560, 3840]).map((n) => (
                      <option key={n} value={n}>
                        {n ? `${n} px` : '原尺寸'}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {mode === 'gif' && (
                <>
                  <Field label="帧率">
                    <Select value={settings.fps} onChange={(e) => update('fps', Number(e.target.value))}>
                      {[5, 10, 12, 15, 20, 24, 30].map((n) => (
                        <option key={n} value={n}>
                          {n} 帧 / 秒
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <SwitchRow checked={settings.dither} onChange={(v) => update('dither', v)}>
                    柔化颜色过渡
                  </SwitchRow>
                </>
              )}
              {(mode === 'compress' || mode === 'trim' || mode === 'convert') && (
                <Field div label="输出格式">
                  <Segmented
                    label="输出格式"
                    value={settings.videoFormat}
                    onChange={(v) => update('videoFormat', v)}
                    options={[
                      { value: 'mp4', label: 'MP4' },
                      { value: 'webm', label: 'WebM' }
                    ]}
                  />
                </Field>
              )}
              {mode === 'compress' && (
                <Field
                  div
                  block
                  label={split(
                    '视频码率',
                    info
                      ? `${settings.bitrate} Mbps · 约 ${fmtSize(estimatedBytes(info.duration, settings.bitrate, info.hasAudio))}`
                      : `${settings.bitrate} Mbps`
                  )}
                >
                  <Slider
                    label="视频码率"
                    min={2}
                    max={120}
                    value={Math.round(settings.bitrate * 10)}
                    onChange={(v) => update('bitrate', v / 10)}
                  />
                </Field>
              )}
              {audioOnly && (
                <>
                  <Field div block label="音频格式">
                    <Segmented
                      label="音频格式"
                      value={settings.audioFormat}
                      onChange={(v) => update('audioFormat', v)}
                      options={[
                        { value: 'mp3', label: 'MP3' },
                        { value: 'm4a', label: 'M4A' },
                        { value: 'wav', label: 'WAV' },
                        { value: 'ogg', label: 'OGG' }
                      ]}
                    />
                  </Field>
                  {settings.audioFormat !== 'wav' && (
                    <Field label="音频码率">
                      <Select value={settings.audioBitrate} onChange={(e) => update('audioBitrate', Number(e.target.value))}>
                        {[64, 96, 128, 192, 256, 320].map((rate) => (
                          <option value={rate} key={rate}>
                            {rate} kbps
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </>
              )}
              {mode === 'convert' && (
                <>
                  <Field div block label="顺时针旋转">
                    <Segmented
                      label="顺时针旋转"
                      value={String(settings.rotation)}
                      onChange={(v) => update('rotation', Number(v) as AvSettings['rotation'])}
                      options={[0, 90, 180, 270].map((r) => ({ value: String(r), label: r ? `${r}°` : '不转' }))}
                    />
                  </Field>
                  <SwitchRow checked={settings.mute} onChange={(v) => update('mute', v)}>
                    去掉声音
                  </SwitchRow>
                </>
              )}
              {mode === 'trim' && (
                <Field div block label="截取方式">
                  <Segmented
                    label="截取方式"
                    value={settings.trimMode}
                    onChange={(v) => update('trimMode', v)}
                    options={[
                      { value: 'copy', label: '快速无损' },
                      { value: 'exact', label: '精确到帧' }
                    ]}
                  />
                </Field>
              )}
              {mode === 'frame' && (
                <>
                  <Field div label="图片格式">
                    <Segmented
                      label="图片格式"
                      value={settings.imageFormat}
                      onChange={(v) => update('imageFormat', v)}
                      options={[
                        { value: 'png', label: 'PNG' },
                        { value: 'jpeg', label: 'JPEG' }
                      ]}
                    />
                  </Field>
                  {settings.imageFormat === 'jpeg' && (
                    <Field div block label={split('JPEG 画质', String(Math.round(settings.quality * 100)))}>
                      <Slider
                        label="JPEG 画质"
                        min={20}
                        max={100}
                        value={Math.round(settings.quality * 100)}
                        onChange={(v) => update('quality', v / 100)}
                      />
                    </Field>
                  )}
                  <Field label="批量截帧间隔（秒）">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={settings.interval}
                      onChange={(e) => update('interval', e.currentTarget.valueAsNumber || 0)}
                    />
                  </Field>
                </>
              )}
            </fieldset>
            <p className="group-note">
              {mode === 'gif' && '256 色调色板，先预览再下载，最多 1800 帧。'}
              {mode === 'compress' && '最高 60 帧 / 秒，音频 128 kbps。体积是估算，画面简单会更小。'}
              {audioOnly && '处理主音轨。转 WAV 不再损失，但找不回已丢的细节；MP3 为 44.1 kHz、最多双声道。'}
              {mode === 'convert' && '保留原尺寸和帧率，能直接复制就不转码。旋转后请预览确认。'}
              {mode === 'trim' &&
                (settings.trimMode === 'copy'
                  ? '不转码，起止会对齐到附近关键帧，可能多一点。要严格起止，选“精确到帧”。'
                  : '严格按所选时间截取，要重新编码，会慢一些。')}
              {mode === 'frame' && '按真实帧时间逐帧定位，可变帧率也准。批量导出按选好的时间段，最多 500 张。'}
            </p>
            {!file && <p className="group-note">先选好也行，放进文件后按这里的设置处理。</p>}
          </div>
        )}
      </div>
      {error && (
        <div className="av-error" role="alert">
          <Led status="error" />
          {error}
        </div>
      )}
      {result && (
        <section className="av-result" aria-label="处理结果">
          <div className="av-result-head">
            <h2>
              <Led status="done" />
              处理好了
            </h2>
            <span>
              {fmtSize(result.blob.size)}
              {mode === 'compress' && file
                ? ` · ${result.blob.size < file.size ? `减少 ${Math.round((1 - result.blob.size / file.size) * 100)}%` : '比原文件大，可调低码率再试'}`
                : ''}
            </span>
          </div>
          {result.note && <p className="av-note">{result.note}</p>}
          {result.timestamp !== undefined && <p className="av-note">实际帧时间：{timeLabel(result.timestamp)}</p>}
          {resultUrl &&
            (result.blob.type.startsWith('image/') ? (
              <img src={resultUrl} className="av-result-image" alt={mode === 'gif' ? '生成的 GIF 动图预览' : '截取的视频画面'} />
            ) : result.blob.type.startsWith('audio/') ? (
              <audio controls src={resultUrl} />
            ) : result.blob.type.startsWith('video/') ? (
              <video controls playsInline src={resultUrl} className="av-video" />
            ) : null)}
          {result.blob.type !== 'application/zip' && <NextSteps outputs={[result]} from={id} />}
        </section>
      )}
      {file && (
        <ActionBar
          led={busy ? 'work' : result ? 'done' : error ? 'error' : 'idle'}
          status={
            busy
              ? info
                ? `正在处理 · ${Math.round(progress * 100)}%`
                : '正在读取…'
              : result
                ? `${result.name} · ${fmtSize(result.blob.size)}`
                : info && range
                  ? `选中 ${timeLabel(Math.max(0, end - start))}`
                  : file.name
          }
        >
          {busy ? (
            <button type="button" className="btn-soft" onClick={cancel}>
              取消
            </button>
          ) : (
            <button type="button" className="btn-soft" onClick={() => pickFiles(ACCEPT, false).then(select)}>
              换个文件
            </button>
          )}
          {mode === 'frame' && info && !busy && (
            <button type="button" className="btn-soft" onClick={() => process(true)}>
              按间隔打包
            </button>
          )}
          {result && !busy ? (
            <button type="button" className="btn" onClick={download}>
              <DownloadIcon size={15} />
              下载{result.blob.type === 'application/zip' ? ' ZIP' : ''}
              <KeyHint keys="save" />
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy || !info} onClick={() => process()}>
              {busy ? '正在处理…' : RUN[mode]}
              {!busy && <KeyHint keys="run" />}
            </button>
          )}
        </ActionBar>
      )}
      <p className="av-note av-support">用浏览器自带的编解码，能开哪些格式看浏览器，新版 Chrome、Edge 最全。导出的文件暂存在内存里。</p>
    </ToolPage>
  );
}
