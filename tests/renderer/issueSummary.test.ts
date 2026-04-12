import { renderIssueSummary } from '../../src/renderer/issueSummary';
import { ReviewResult } from '../../src/types/review';

const baseResult: ReviewResult = {
  summary: 'テスト PR の要約です。変更は安全です。',
  confidence: 4,
  importantFiles: [
    { path: 'src/main.ts', overview: 'エントリポイントの書き換え' },
  ],
  comments: [
    {
      path: 'src/main.ts',
      line: 10,
      side: 'RIGHT',
      severity: 'P2',
      category: 'style',
      title: 'マジックナンバーの使用',
      body: '定数に切り出してください。',
    },
  ],
  stats: { filesReviewed: 3 },
};

const head = {
  sha: 'abc1234567890',
  commitTitle: 'feat: add new feature',
  commitUrl: 'https://github.com/owner/repo/commit/abc1234567890',
};

describe('renderIssueSummary', () => {
  test('開始・終了マーカーが含まれる', () => {
    const result = renderIssueSummary(baseResult, 1, head);
    expect(result).toContain('<!-- ai-review-summary -->');
    expect(result).toContain('<!-- /ai-review-summary -->');
  });

  test('ai-review-count マーカーが正しい', () => {
    const result = renderIssueSummary(baseResult, 3, head);
    expect(result).toContain('<!-- ai-review-count=3 -->');
  });

  test('summary セクションが含まれる', () => {
    const result = renderIssueSummary(baseResult, 1, head);
    expect(result).toContain('<h3>AI Review Summary</h3>');
    expect(result).toContain('テスト PR の要約です。');
  });

  test('importantFiles テーブルが含まれる', () => {
    const result = renderIssueSummary(baseResult, 1, head);
    expect(result).toContain('| src/main.ts | エントリポイントの書き換え |');
  });

  test('importantFiles が空なら表が省略される', () => {
    const result = renderIssueSummary({ ...baseResult, importantFiles: [] }, 1, head);
    expect(result).not.toContain('Important Files Changed');
  });

  test('mermaid が存在する場合はセクションが含まれる', () => {
    const withMermaid: ReviewResult = {
      ...baseResult,
      mermaid: { kind: 'sequenceDiagram', source: 'sequenceDiagram\n    A->>B: call' },
    };
    const result = renderIssueSummary(withMermaid, 1, head);
    expect(result).toContain('```mermaid');
    expect(result).toContain('sequenceDiagram');
  });

  test('mermaid が undefined ならセクションが省略される', () => {
    const result = renderIssueSummary(baseResult, 1, head);
    expect(result).not.toContain('```mermaid');
  });

  test('Prompt To Fix All With AI が含まれる', () => {
    const result = renderIssueSummary(baseResult, 1, head);
    expect(result).toContain('Prompt To Fix All With AI');
    expect(result).toContain('How can I resolve this?');
  });

  test('comments が空なら Prompt To Fix All が省略される', () => {
    const result = renderIssueSummary({ ...baseResult, comments: [] }, 1, head);
    expect(result).not.toContain('Prompt To Fix All With AI');
  });

  test('フッタに Reviews count とコミットリンクが含まれる', () => {
    const result = renderIssueSummary(baseResult, 2, head);
    expect(result).toContain('Reviews (2)');
    expect(result).toContain('feat: add new feature');
    expect(result).toContain(head.commitUrl);
  });

  test('inline comments 数がフッタに含まれる', () => {
    const result = renderIssueSummary(baseResult, 1, head);
    expect(result).toContain('**1 inline comments**');
  });

  test('tokensUsed がある場合はフッタに表示される', () => {
    const withTokens: ReviewResult = {
      ...baseResult,
      stats: { filesReviewed: 3, tokensUsed: 12345 },
    };
    const result = renderIssueSummary(withTokens, 1, head);
    expect(result).toContain('tokens: 12345');
  });

  test('tokensUsed が undefined の場合はフッタに表示されない', () => {
    const result = renderIssueSummary(baseResult, 1, head);
    expect(result).not.toContain('tokens:');
  });
});
