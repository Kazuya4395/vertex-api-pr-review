import { ReviewComment } from '../types/review';

export type LineMap = {
  validLines: Set<number>;
};

/**
 * unified diff の patch 文字列を解析し、新ファイル側の有効行セット(validLines)を構築する。
 * '+' 行と ' '(context) 行を validLines に追加し、'-' 行はスキップする。
 */
export const parsePatchToLineMap = (patch: string): LineMap => {
  const validLines = new Set<number>();

  if (!patch) return { validLines };

  // CRLF → LF に正規化
  const normalized = patch.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let newLine = 0;

  for (const line of lines) {
    // hunk header: @@ -a,b +c,d @@
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      newLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    // 先頭文字で判定
    if (line.startsWith('+')) {
      // 追加行: 新ファイル側の有効行
      validLines.add(newLine);
      newLine++;
    } else if (line.startsWith('-')) {
      // 削除行: 新ファイル側行番号は進まない
    } else if (line.startsWith(' ')) {
      // context 行: 新ファイル側の有効行
      validLines.add(newLine);
      newLine++;
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file" — 行番号は進まない
    } else if (newLine > 0 && line.length > 0) {
      // context 行（先頭スペースが欠落しているケース）
      // 一部の diff ツールは context 行の先頭スペースを省略することがある
      validLines.add(newLine);
      newLine++;
    }
  }

  return { validLines };
};

/**
 * LLM が返したコメントの行番号が validLines に無い場合、最近傍の有効行へスナップする。
 * スナップ不能（maxDistance 内に有効行なし）な場合は null を返す（= サマリ退避）。
 */
export const snapCommentToValidLine = (
  comment: ReviewComment,
  lineMap: LineMap,
  maxDistance = 3,
): { comment: ReviewComment; snapped: boolean } | null => {
  const { validLines } = lineMap;

  // 複数行コメントの場合: startLine と line の両方が有効であることを確認
  if (comment.startLine !== undefined) {
    const startValid = validLines.has(comment.startLine);
    const endValid = validLines.has(comment.line);
    if (startValid && endValid) {
      return { comment, snapped: false };
    }
    // 複数行で片方でも無効ならスナップ対象（startLine/line を個別にスナップ）
    const snappedStart = startValid
      ? comment.startLine
      : findNearest(validLines, comment.startLine, maxDistance);
    const snappedEnd = endValid
      ? comment.line
      : findNearest(validLines, comment.line, maxDistance);

    if (snappedStart === null || snappedEnd === null) return null;
    if (snappedStart > snappedEnd) return null;

    return {
      comment: { ...comment, startLine: snappedStart, line: snappedEnd },
      snapped: true,
    };
  }

  // 単一行コメント
  if (validLines.has(comment.line)) {
    return { comment, snapped: false };
  }

  const nearest = findNearest(validLines, comment.line, maxDistance);
  if (nearest === null) return null;

  return {
    comment: { ...comment, line: nearest },
    snapped: true,
  };
};

/** maxDistance 以内で最近傍の有効行を探す。同距離なら前方(小さい行)を優先。 */
const findNearest = (
  validLines: Set<number>,
  target: number,
  maxDistance: number,
): number | null => {
  for (let d = 1; d <= maxDistance; d++) {
    if (validLines.has(target - d)) return target - d;
    if (validLines.has(target + d)) return target + d;
  }
  return null;
};
