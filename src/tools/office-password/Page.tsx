import { useEffect, useState } from 'react';
import { OfficePage, OutputActions, Panel, SideGroup, Status, TextLayout, usePreference } from '../../components/kit/OfficeKit';
import { Field, Segmented, SwitchRow } from '../../components/ui';
import { defaults, generate, strength } from './logic';

const SETS = [
  ['upper', '大写字母'],
  ['lower', '小写字母'],
  ['digits', '数字'],
  ['symbols', '符号'],
  ['exclude', '排除易混字符 Il1O0o']
] as const;

export default function Page() {
  const [p, setP] = usePreference('office-password', defaults);
  // 结果记着是按哪套规则生成的：长度、字符集一改（包括“恢复默认”）就按新规则重新生成一批
  const sig = JSON.stringify(p);
  const [made, setMade] = useState<{ list: ReturnType<typeof generate>; sig: string }>();
  const [error, setError] = useState('');
  const result = made?.sig === sig ? made.list : undefined;
  function make() {
    try {
      setMade({ list: generate(p), sig });
      setError('');
    } catch (e) {
      setMade(undefined);
      setError((e as Error).message);
    }
  }
  useEffect(make, [sig]);
  const text = result?.values.join('\n') || '';
  const max = p.phrase ? 20 : 256;
  return (
    <OfficePage id="office-password" sub="本机安全随机生成，不保存。">
      <TextLayout
        side={
          <>
            <SideGroup title="类型">
              <Field div block label="生成">
                <Segmented
                  label="类型"
                  value={p.phrase ? 'phrase' : 'chars'}
                  onChange={(v) => setP({ ...p, phrase: v === 'phrase' })}
                  options={[
                    { value: 'chars', label: '随机字符' },
                    { value: 'phrase', label: '口令短语' }
                  ]}
                />
              </Field>
              <Field label={p.phrase ? '单词数' : '长度'} hint={p.phrase ? '4–20' : '4–256'}>
                <input
                  type="number"
                  min={4}
                  max={max}
                  value={p.phrase ? p.words : p.length}
                  onChange={(e) => setP({ ...p, [p.phrase ? 'words' : 'length']: Number(e.target.value) })}
                />
              </Field>
              <Field label="数量" hint="1–100">
                <input type="number" min={1} max={100} value={p.count} onChange={(e) => setP({ ...p, count: Number(e.target.value) })} />
              </Field>
            </SideGroup>
            {p.phrase ? (
              <SideGroup note="从 2048 个英文词里随机抽，7 个词约 77 bit。不是钱包助记词。" />
            ) : (
              <SideGroup title="包含" note="每个字符等概率抽取，不保证每种字符都出现。">
                {SETS.map(([k, label]) => (
                  <SwitchRow key={k} checked={p[k]} onChange={(v) => setP({ ...p, [k]: v })}>
                    {label}
                  </SwitchRow>
                ))}
              </SideGroup>
            )}
          </>
        }
      >
        <Panel
          title="生成结果"
          actions={
            <>
              <button type="button" className="btn btn-sm" onClick={make}>
                换一批
              </button>
              <OutputActions compact text={text} ready={!!result} name="passwords.txt" />
            </>
          }
          foot={result && `估计随机熵 ${result.entropy.toFixed(1)} bit · ${strength(result.entropy)}`}
        >
          <div className="office-result">{text}</div>
        </Panel>
        {error && <Status error={error} />}
      </TextLayout>
    </OfficePage>
  );
}
