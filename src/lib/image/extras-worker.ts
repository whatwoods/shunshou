import { decode } from './decode';
import { stitchLayout, colorValues, type StitchSettings } from './extras';
self.onmessage = async (
  e: MessageEvent<{ mode: 'stitch' | 'palette'; files: File[]; settings: StitchSettings; count: number; point?: { x: number; y: number } }>
) => {
  const bitmaps: ImageBitmap[] = [];
  try {
    const { mode, files, settings, count, point } = e.data;
    for (const file of files) bitmaps.push(await decode(file));
    if (mode === 'stitch') {
      const layout = stitchLayout(bitmaps, settings),
        canvas = new OffscreenCanvas(layout.width, layout.height),
        ctx = canvas.getContext('2d')!;
      if (settings.background !== 'transparent' || settings.format === 'jpeg') {
        ctx.fillStyle = settings.background === 'black' ? 'black' : 'white';
        ctx.fillRect(0, 0, layout.width, layout.height);
      }
      ctx.imageSmoothingQuality = 'high';
      bitmaps.forEach((image, i) => {
        const b = layout.boxes[i];
        ctx.drawImage(image, b.x, b.y, b.width, b.height);
      });
      self.postMessage({
        ok: true,
        blob: await canvas.convertToBlob({ type: `image/${settings.format}`, quality: 0.92 }),
        width: layout.width,
        height: layout.height
      });
    } else {
      const image = bitmaps[0];
      if (!image) throw new Error('请先选择图片');
      if (point) {
        const c = new OffscreenCanvas(1, 1),
          ctx = c.getContext('2d')!;
        ctx.drawImage(
          image,
          Math.min(image.width - 1, Math.max(0, Math.floor(point.x * image.width))),
          Math.min(image.height - 1, Math.max(0, Math.floor(point.y * image.height))),
          1,
          1,
          0,
          0,
          1,
          1
        );
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        self.postMessage({ ok: true, picked: { ...colorValues([...pixel].slice(0, 3)), alpha: pixel[3] / 255 } });
      } else {
        const scale = Math.min(1, 128 / Math.max(image.width, image.height)),
          sample = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale))),
          ctx = sample.getContext('2d')!;
        ctx.drawImage(image, 0, 0, sample.width, sample.height);
        const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
        const opaque: number[] = [];
        for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 127) opaque.push(data[i], data[i + 1], data[i + 2], 255);
        if (!opaque.length) throw new Error('图片完全透明，找不到可用颜色');
        const { quantize } = await import('gifenc');
        const colors = quantize(new Uint8Array(opaque), Math.max(2, Math.min(16, count))).map(colorValues);
        const previewScale = Math.min(1, 1600 / Math.max(image.width, image.height));
        const preview = new OffscreenCanvas(
          Math.max(1, Math.round(image.width * previewScale)),
          Math.max(1, Math.round(image.height * previewScale))
        );
        preview.getContext('2d')!.drawImage(image, 0, 0, preview.width, preview.height);
        const swatch = new OffscreenCanvas(colors.length * 120, 160),
          sc = swatch.getContext('2d')!;
        colors.forEach((color, i) => {
          sc.fillStyle = color.hex;
          sc.fillRect(i * 120, 0, 120, 160);
          sc.fillStyle = 'white';
          sc.fillRect(i * 120, 120, 120, 40);
          sc.fillStyle = 'black';
          sc.font = '14px sans-serif';
          sc.fillText(color.hex, i * 120 + 20, 145);
        });
        self.postMessage({
          ok: true,
          colors,
          blob: await swatch.convertToBlob(),
          preview: await preview.convertToBlob(),
          width: image.width,
          height: image.height
        });
      }
    }
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    bitmaps.forEach((b) => b.close());
  }
};
