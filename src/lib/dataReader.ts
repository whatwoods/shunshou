import Papa from 'papaparse';
import { dataDefaults, fromJson, fromRows, uniqueColumns, type ParseOptions, type TableData } from './dataCore';

export async function detectEncoding(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: file.size > bytes.length });
    return 'utf-8';
  } catch {
    return 'gb18030';
  }
}
// 解码出错（文件不是所选编码）时抛这个，读取会换编码重来或提示用户
class EncodingError extends Error {}

export async function readCsv(
  file: File,
  options: ParseOptions,
  progress?: (rows: number) => void,
  chunkSize = 1024 * 1024
): Promise<TableData> {
  if (options.encoding !== 'auto') {
    try {
      return await readCsvAs(file, options.encoding, options, progress, chunkSize);
    } catch (e) {
      if (e instanceof EncodingError)
        throw new Error(`文件里有不符合 ${options.encoding.toUpperCase()} 编码的字节，可以把编码改成“自动”或 GB18030 再试。`);
      throw e;
    }
  }
  // 自动：开头 64 KB 只用来猜一个起点。按 UTF-8 读时整份严格解码，后面一旦出现非法字节（比如前面全是数字、中文在很后面的 GBK 表格），
  // 就整份换成 GB18030 重读，不会把后面的中文静默变成乱码
  const guess = await detectEncoding(file);
  try {
    return await readCsvAs(file, guess, options, progress, chunkSize);
  } catch (e) {
    if (e instanceof EncodingError && guess === 'utf-8') return readCsvAs(file, 'gb18030', options, progress, chunkSize);
    if (e instanceof EncodingError) throw new Error('文件编码认不出来，可以在“编码”里手动选一个再试。');
    throw e;
  }
}

async function readCsvAs(
  file: File,
  encoding: string,
  options: ParseOptions,
  progress: ((rows: number) => void) | undefined,
  chunkSize: number
): Promise<TableData> {
  // UTF-8 用严格模式：遇到非法字节就报错，而不是悄悄换成 �
  const decoder = new TextDecoder(encoding, { fatal: encoding === 'utf-8' });
  const decode = (bytes: ArrayBuffer, stream: boolean) => {
    try {
      return decoder.decode(bytes, { stream });
    } catch {
      throw new EncodingError(encoding);
    }
  };
  const sample = new TextDecoder(encoding).decode(await file.slice(0, 65536).arrayBuffer(), { stream: file.size > 65536 });
  const guess = Papa.parse<string[]>(sample, { delimiter: options.delimiter, preview: 10 });
  const newline = guess.meta.linebreak === '\r\n' ? '\r\n' : guess.meta.linebreak === '\r' ? '\r' : '\n';
  const config: Papa.ParseConfig = { delimiter: options.delimiter || guess.meta.delimiter || ',', newline };
  let columns: string[] | undefined;
  const rows: TableData['rows'] = [];
  let partial = '';
  // TextDecoder 的流式状态保留跨字节块的中文字符；Papa 负责跨块引号与多行字段。
  for (let offset = 0; offset < file.size || (file.size === 0 && offset === 0); offset += chunkSize) {
    const end = Math.min(file.size, offset + chunkSize);
    const finished = end >= file.size;
    partial += decode(await file.slice(offset, end).arrayBuffer(), !finished);
    const result = new Papa.Parser(config).parse(partial, 0, !finished) as Papa.ParseResult<string[]>;
    const error = result.errors[0];
    if (error) throw new Error(`CSV 格式不完整：${error.message}。请检查引号或分隔符。`);
    partial = finished ? '' : partial.slice(result.meta.cursor);
    const batch = options.keepEmpty ? result.data : result.data.filter((row) => row.some((cell) => cell.trim() !== ''));
    if (batch.length) {
      const table = fromRows(batch, columns === undefined && options.header, options.infer);
      if (!columns) columns = table.columns;
      while (columns.length < table.columns.length) columns.push(`列 ${columns.length + 1}`);
      for (const row of table.rows) rows.push(row);
      progress?.(rows.length);
    }
    if (finished) break;
  }
  return { columns: uniqueColumns(columns ?? []), rows };
}
export async function readFileTables(
  file: File,
  options: ParseOptions = dataDefaults,
  progress?: (rows: number) => void
): Promise<Record<string, TableData>> {
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    const XLSX = await import('@e965/xlsx');
    if (/\.xls$/i.test(file.name)) XLSX.set_cptable(await import('@e965/xlsx/dist/cpexcel.full.mjs'));
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    return Object.fromEntries(
      workbook.SheetNames.map((name) => [
        name,
        fromRows(
          XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '', raw: true }),
          options.header,
          options.infer
        )
      ])
    );
  }
  if (/\.parquet$/i.test(file.name)) {
    const [{ parquetReadObjects }, { compressors }] = await Promise.all([import('hyparquet'), import('hyparquet-compressors')]);
    const rows = await parquetReadObjects({
      file: { byteLength: file.size, slice: (start, end) => file.slice(start, end).arrayBuffer() },
      compressors
    });
    return { 数据: fromJson(rows) };
  }
  if (/\.json$/i.test(file.name)) return { 数据: fromJson(JSON.parse(await file.text())) };
  return { 数据: await readCsv(file, options, progress) };
}
