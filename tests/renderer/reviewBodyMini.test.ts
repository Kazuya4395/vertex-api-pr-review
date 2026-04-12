import { renderReviewBodyMini } from '../../src/renderer/reviewBodyMini';
import { ReviewResult } from '../../src/types/review';

const makeResult = (overrides: Partial<ReviewResult> = {}): ReviewResult => ({
  summary: 'テスト用サマリ',
  confidence: 3,
  importantFiles: [],
  comments: [],
  stats: { filesReviewed: 5 },
  ...overrides,
});

describe('renderReviewBodyMini', () => {
  test('Confidence と件数サマリが含まれる', () => {
    const result = renderReviewBodyMini(makeResult({
      confidence: 4,
      comments: [
        { path: 'a.ts', line: 1, side: 'RIGHT', severity: 'P2', category: 'style', title: 't', body: 'b' },
        { path: 'b.ts', line: 2, side: 'RIGHT', severity: 'P3', category: 'docs', title: 't', body: 'b' },
      ],
    }));
    expect(result).toContain('Confidence 4/5');
    expect(result).toContain('🔴0');
    expect(result).toContain('🟠0');
    expect(result).toContain('🟡1');
    expect(result).toContain('🟢1');
  });

  test('指摘なし時でも正しく動作する', () => {
    const result = renderReviewBodyMini(makeResult({ confidence: 5, comments: [] }));
    expect(result).toContain('Confidence 5/5');
    expect(result).toContain('🔴0');
    expect(result).toContain('🟠0');
    expect(result).toContain('🟡0');
    expect(result).toContain('🟢0');
  });

  test('詳細誘導テキストが含まれる', () => {
    const result = renderReviewBodyMini(makeResult());
    expect(result).toContain('詳細は下部の AI Review Summary コメントを参照');
  });

  test('2 行構成である', () => {
    const result = renderReviewBodyMini(makeResult());
    const nonEmptyLines = result.split('\n').filter((l) => l.length > 0);
    expect(nonEmptyLines).toHaveLength(2);
  });
});
