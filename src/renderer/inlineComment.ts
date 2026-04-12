import { ReviewComment } from '../types/review';
import { renderPromptToFixWithAI } from './promptToFixWithAi';

const SEVERITY_EMOJI: Record<string, string> = {
  P0: '\u{1F534}',
  P1: '\u{1F7E0}',
  P2: '\u{1F7E1}',
  P3: '\u{1F7E2}',
};

const MARKER = '<!-- ai-review-inline -->';

/**
 * ReviewComment を inline コメント用 Markdown にレンダリングする純粋関数。
 * テンプレは requirements.md §4.3 を正とする。
 *
 * 5 パーツ構成:
 * 1. 優先度絵文字 + P{0-3} ラベル + 太字見出し
 * 2. 本文（現象→根拠→影響→推奨）
 * 3. suggestion ブロック（ある場合のみ）
 * 4. Prompt To Fix With AI details セクション
 * 5. 末尾マーカー <!-- ai-review-inline -->
 */
export const renderInlineComment = (c: ReviewComment): string => {
  const emoji = SEVERITY_EMOJI[c.severity] ?? '';
  const lines: string[] = [];

  // 1. 見出し
  lines.push(`${emoji} **${c.severity}: ${c.title}**`);
  lines.push('');

  // 2. 本文
  lines.push(c.body);
  lines.push('');

  // 3. suggestion（ある場合のみ）
  if (c.suggestion) {
    lines.push('```suggestion');
    lines.push(c.suggestion);
    lines.push('```');
    lines.push('');
  }

  // 4. Prompt To Fix With AI
  lines.push(renderPromptToFixWithAI(c));
  lines.push('');

  // 5. 末尾マーカー
  lines.push(MARKER);

  return lines.join('\n');
};
