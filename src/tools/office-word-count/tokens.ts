import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';

// 用 OpenAI 公开的 o200k 分词器精确计数（GPT-4o 这一代模型用它）。
// 用户文本里出现 <|endoftext|> 这类特殊标记时按普通文字数，不报错
export function tokenCount(text: string): number {
  return text ? countTokens(text, { disallowedSpecial: new Set() }) : 0;
}
