# 抠图模型怎么来的

`src/tools/image-cutout/models/` 里的两个模型都来自 rembg 的发行页（https://github.com/danielgatis/rembg/releases/tag/v0.0.0），许可都是 Apache-2.0：

- `u2netp.onnx`：U²-NetP（https://github.com/xuebinqin/U-2-Net），原样使用，4.6 MB。“快速”档。
  sha256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`
- `isnet-part-*.bin`：ISNet 通用版（DIS，https://github.com/xuebinqin/DIS），rembg 的 `isnet-general-use.onnx`
  （sha256 `60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a`，176 MB）。“精细”档。

ISNet 做了两处改动。在 4 张测试图上和原模型逐像素比过：遮罩最多差 2/255，平均不到 0.1/255，看不出区别。

1. 只保留最终那一路输出，去掉只为训练用的旁支输出；
2. 权重改成 fp16 存储，图的开头插 Cast 转回 fp32，计算仍是 fp32。下载体积从 176 MB 降到 90 MB。

然后按 23 000 000 字节一块拆成 4 块（Cloudflare 单个静态文件不能超过 25 MiB）：

```bash
python3 -m venv venv && ./venv/bin/pip install onnx numpy
./venv/bin/python scripts/models/isnet-store16.py isnet-general-use.onnx isnet-s16.onnx
split -b 23000000 -a 1 isnet-s16.onnx isnet-part-   # 再把 isnet-part-a … d 改名加上 .bin
```

`src/tools/image-cutout/runtime/` 是 onnxruntime-web 的 WebGPU 版 wasm（`ort-wasm-simd-threaded.asyncify.wasm`）拆成的两块，
升级 onnxruntime-web 后要重新拆，`runtime.test.ts` 会检查版本和内容。
