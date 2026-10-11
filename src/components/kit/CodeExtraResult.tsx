import { copyText } from '../../lib/files';
import { toast } from '../Toast';
import { CopyIcon } from '../ui';
export function CodeExtraResult({ label, value }: { label: string; value: string }) {
  return (
    <div className="ce-result">
      <div>
        <span>{label}</span>
        <code>{value}</code>
      </div>
      <button
        className="btn-soft"
        onClick={async () => {
          const ok = await copyText(value);
          toast(ok ? '已复制' : '复制失败，请选中文字复制', ok ? 'done' : 'error');
        }}
      >
        <CopyIcon size={16} />
        复制
      </button>
    </div>
  );
}
