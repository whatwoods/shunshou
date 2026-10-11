export async function decode(file: File): Promise<ImageBitmap> {
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type)) {
    const [{ default: factory }, { default: wasmUrl }] = await Promise.all([
      import('libheif-js/libheif-wasm/libheif.js'),
      import('libheif-js/libheif-wasm/libheif.wasm?url')
    ]);
    const module = await factory({ wasmBinary: await (await fetch(wasmUrl)).arrayBuffer() });
    const decoder = new module.HeifDecoder();
    const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
    try {
      const image = images[0];
      if (!image) throw new Error('未找到 HEIC 图片');
      const data = await new Promise<ImageData>((resolve, reject) =>
        image.display(new ImageData(image.get_width(), image.get_height()), (d) => (d ? resolve(d) : reject(new Error('HEIC 解码失败'))))
      );
      return await createImageBitmap(data);
    } finally {
      images.forEach((i) => i.free());
      decoder.decoder.delete();
    }
  }
  try {
    return await createImageBitmap(file);
  } catch {
    if (/\.avif$/i.test(file.name)) {
      const { default: decode } = await import('@jsquash/avif/decode');
      const data = await decode(await file.arrayBuffer());
      if (!data) throw new Error('AVIF 解码失败');
      return createImageBitmap(data);
    }
    throw new Error('图片打不开，请检查文件是否完整，或换一种格式');
  }
}
