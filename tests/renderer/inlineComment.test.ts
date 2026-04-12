import { renderInlineComment } from '../../src/renderer/inlineComment';
import { ReviewComment } from '../../src/types/review';

const baseComment: ReviewComment = {
  path: 'src/main.ts',
  line: 42,
  side: 'RIGHT',
  severity: 'P1',
  category: 'bug',
  title: '変数が未定義の可能性がある',
  body: '`data` が null の場合にクラッシュします。nullチェックを追加してください。',
};

describe('renderInlineComment', () => {
  test('5 パーツ構成で出力される', () => {
    const result = renderInlineComment(baseComment);
    // 1. 絵文字 + 見出し
    expect(result).toContain('🟠 **P1: 変数が未定義の可能性がある**');
    // 2. 本文
    expect(result).toContain('`data` が null の場合にクラッシュします。');
    // 4. Prompt To Fix With AI
    expect(result).toContain('<details><summary>Prompt To Fix With AI</summary>');
    // 5. 末尾マーカー
    expect(result).toContain('<!-- ai-review-inline -->');
  });

  test('suggestion がある場合は suggestion ブロックが含まれる', () => {
    const comment: ReviewComment = {
      ...baseComment,
      suggestion: 'if (data == null) return;',
    };
    const result = renderInlineComment(comment);
    expect(result).toContain('```suggestion');
    expect(result).toContain('if (data == null) return;');
    expect(result).toContain('```');
  });

  test('suggestion が undefined の場合は suggestion ブロックが省略される', () => {
    const result = renderInlineComment(baseComment);
    expect(result).not.toContain('```suggestion');
  });

  test('severity ごとに正しい絵文字が使われる', () => {
    const severities = [
      { severity: 'P0' as const, emoji: '🔴' },
      { severity: 'P1' as const, emoji: '🟠' },
      { severity: 'P2' as const, emoji: '🟡' },
      { severity: 'P3' as const, emoji: '🟢' },
    ];
    for (const { severity, emoji } of severities) {
      const result = renderInlineComment({ ...baseComment, severity });
      expect(result).toContain(`${emoji} **${severity}:`);
    }
  });

  test('startLine がある場合 Prompt To Fix With AI の Line に範囲が含まれる', () => {
    const comment: ReviewComment = {
      ...baseComment,
      startLine: 40,
      line: 42,
    };
    const result = renderInlineComment(comment);
    expect(result).toContain('Line: 40-42');
  });

  test('末尾マーカーが最終行に含まれる', () => {
    const result = renderInlineComment(baseComment);
    const lines = result.split('\n');
    expect(lines[lines.length - 1]).toBe('<!-- ai-review-inline -->');
  });
});
