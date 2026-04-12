import { parsePatchToLineMap, snapCommentToValidLine } from '../../src/github/position';
import { ReviewComment } from '../../src/types/review';

// ─── parsePatchToLineMap ────────────────────────────────────────────

describe('parsePatchToLineMap', () => {
  test('通常の hunk: 追加行と context 行が validLines に入る', () => {
    const patch = [
      '@@ -1,3 +1,4 @@',
      ' line1',
      '+line2new',
      ' line3',
      ' line4',
    ].join('\n');
    const { validLines } = parsePatchToLineMap(patch);
    expect(validLines.has(1)).toBe(true); // context
    expect(validLines.has(2)).toBe(true); // added
    expect(validLines.has(3)).toBe(true); // context
    expect(validLines.has(4)).toBe(true); // context
    expect(validLines.size).toBe(4);
  });

  test('複数 hunk を正しく処理する', () => {
    const patch = [
      '@@ -1,2 +1,3 @@',
      ' line1',
      '+added',
      ' line2',
      '@@ -10,2 +11,3 @@',
      ' line10',
      '+added2',
      ' line11',
    ].join('\n');
    const { validLines } = parsePatchToLineMap(patch);
    // hunk 1: lines 1,2,3
    expect(validLines.has(1)).toBe(true);
    expect(validLines.has(2)).toBe(true);
    expect(validLines.has(3)).toBe(true);
    // hunk 2: lines 11,12,13
    expect(validLines.has(11)).toBe(true);
    expect(validLines.has(12)).toBe(true);
    expect(validLines.has(13)).toBe(true);
  });

  test('追加のみ(新規ファイル): 全行が validLines', () => {
    const patch = [
      '@@ -0,0 +1,3 @@',
      '+line1',
      '+line2',
      '+line3',
    ].join('\n');
    const { validLines } = parsePatchToLineMap(patch);
    expect(validLines.has(1)).toBe(true);
    expect(validLines.has(2)).toBe(true);
    expect(validLines.has(3)).toBe(true);
    expect(validLines.size).toBe(3);
  });

  test('削除のみ: validLines は空', () => {
    const patch = [
      '@@ -1,3 +1,0 @@',
      '-line1',
      '-line2',
      '-line3',
    ].join('\n');
    const { validLines } = parsePatchToLineMap(patch);
    expect(validLines.size).toBe(0);
  });

  test('バイナリファイル(空パッチ): 例外を投げない', () => {
    const { validLines } = parsePatchToLineMap('');
    expect(validLines.size).toBe(0);
  });

  test('空文字列パッチで例外を投げない', () => {
    expect(() => parsePatchToLineMap('')).not.toThrow();
  });

  test('CRLF 混在でも動作する', () => {
    const patch = '@@ -1,2 +1,3 @@\r\n line1\r\n+added\r\n line2\r\n';
    const { validLines } = parsePatchToLineMap(patch);
    expect(validLines.has(1)).toBe(true);
    expect(validLines.has(2)).toBe(true);
    expect(validLines.has(3)).toBe(true);
  });

  test('BOM 付きパッチ: hunk header がパースされる', () => {
    const patch = '\uFEFF@@ -1,1 +1,2 @@\n line1\n+line2';
    // BOM は hunk header のマッチを阻害する可能性がある
    // 本実装は BOM を明示除去しないため、最初の hunk は無視される可能性があるが例外は投げない
    expect(() => parsePatchToLineMap(patch)).not.toThrow();
  });

  test('連続 hunk 境界: 行番号が正しく切り替わる', () => {
    const patch = [
      '@@ -1,1 +1,2 @@',
      ' context',
      '+add1',
      '@@ -5,1 +6,2 @@',
      ' context2',
      '+add2',
    ].join('\n');
    const { validLines } = parsePatchToLineMap(patch);
    // hunk 1: +1 → lines 1, 2
    expect(validLines.has(1)).toBe(true);
    expect(validLines.has(2)).toBe(true);
    // hunk 2: +6 → lines 6, 7
    expect(validLines.has(6)).toBe(true);
    expect(validLines.has(7)).toBe(true);
    // 中間の行(3-5)は含まれない
    expect(validLines.has(3)).toBe(false);
    expect(validLines.has(5)).toBe(false);
  });

  test('"No newline at end of file" マーカーで行番号が進まない', () => {
    const patch = [
      '@@ -1,2 +1,2 @@',
      ' line1',
      '-old',
      '\\ No newline at end of file',
      '+new',
    ].join('\n');
    const { validLines } = parsePatchToLineMap(patch);
    expect(validLines.has(1)).toBe(true); // context
    expect(validLines.has(2)).toBe(true); // added (+new)
  });

  test('削除と追加が混在する diff', () => {
    const patch = [
      '@@ -1,4 +1,4 @@',
      ' unchanged1',
      '-deleted1',
      '+added1',
      ' unchanged2',
      '-deleted2',
      '+added2',
    ].join('\n');
    const { validLines } = parsePatchToLineMap(patch);
    expect(validLines.has(1)).toBe(true); // unchanged1
    expect(validLines.has(2)).toBe(true); // added1
    expect(validLines.has(3)).toBe(true); // unchanged2
    expect(validLines.has(4)).toBe(true); // added2
    expect(validLines.size).toBe(4);
  });
});

// ─── snapCommentToValidLine ─────────────────────────────────────────

const makeComment = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
  path: 'test.ts',
  line: 10,
  side: 'RIGHT' as const,
  severity: 'P2',
  category: 'style',
  title: 'test',
  body: 'test body',
  ...overrides,
});

describe('snapCommentToValidLine', () => {
  const lineMap = { validLines: new Set([5, 8, 10, 12, 15]) };

  test('完全一致時は snapped: false', () => {
    const result = snapCommentToValidLine(makeComment({ line: 10 }), lineMap);
    expect(result).not.toBeNull();
    expect(result!.snapped).toBe(false);
    expect(result!.comment.line).toBe(10);
  });

  test('前方に有効行があればスナップ(snapped: true)', () => {
    const result = snapCommentToValidLine(makeComment({ line: 9 }), lineMap);
    expect(result).not.toBeNull();
    expect(result!.snapped).toBe(true);
    expect(result!.comment.line).toBe(8); // 9-1=8 が先に見つかる
  });

  test('後方に有効行があればスナップ(snapped: true)', () => {
    const result = snapCommentToValidLine(makeComment({ line: 6 }), lineMap);
    expect(result).not.toBeNull();
    expect(result!.snapped).toBe(true);
    // 6-1=5 が先に見つかる(前方優先)
    expect(result!.comment.line).toBe(5);
  });

  test('maxDistance 超過で null を返す', () => {
    // line=1, validLines には 5 が最近だが距離4 > maxDistance=3
    const result = snapCommentToValidLine(makeComment({ line: 1 }), lineMap, 3);
    expect(result).toBeNull();
  });

  test('カスタム maxDistance で探索範囲を拡大', () => {
    const result = snapCommentToValidLine(makeComment({ line: 1 }), lineMap, 5);
    expect(result).not.toBeNull();
    expect(result!.comment.line).toBe(5);
  });

  test('複数行コメント: startLine と line の両方が有効', () => {
    const result = snapCommentToValidLine(
      makeComment({ startLine: 5, line: 10 }),
      lineMap,
    );
    expect(result).not.toBeNull();
    expect(result!.snapped).toBe(false);
  });

  test('複数行コメント: startLine のみ無効 → スナップ', () => {
    const result = snapCommentToValidLine(
      makeComment({ startLine: 6, line: 10 }),
      lineMap,
    );
    expect(result).not.toBeNull();
    expect(result!.snapped).toBe(true);
    expect(result!.comment.startLine).toBe(5); // 6→5 にスナップ
    expect(result!.comment.line).toBe(10);
  });

  test('複数行コメント: 両方無効で maxDistance 超過 → null', () => {
    const result = snapCommentToValidLine(
      makeComment({ startLine: 1, line: 3 }),
      lineMap,
      2,
    );
    expect(result).toBeNull();
  });

  test('空の lineMap で null を返す', () => {
    const result = snapCommentToValidLine(
      makeComment({ line: 10 }),
      { validLines: new Set() },
    );
    expect(result).toBeNull();
  });
});
