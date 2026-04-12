/**
 * ReviewResult 型定義（LLM 出力 JSON スキーマ）
 *
 * requirements.md §7.3 を正として定義する。純粋な型ファイルであり、
 * 他ファイルからの import はゼロ（T1.1 AC #4）。
 */

export type ReviewSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export type ReviewCategory =
  | 'bug'
  | 'security'
  | 'perf'
  | 'style'
  | 'test'
  | 'docs'
  | 'a11y';

export type ReviewComment = {
  path: string; // 新ファイル側のパス
  line: number; // 末尾行（新ファイル側の行番号）
  startLine?: number; // 複数行時のみ
  side: 'RIGHT'; // 固定（本仕様では LEFT を使わない）
  severity: ReviewSeverity;
  category: ReviewCategory;
  title: string; // 見出し（句点無しの一文）
  body: string; // 本文 Markdown（現象→根拠→影響→推奨）
  suggestion?: string; // committable suggestion 本体（コードのみ、fences なし）
};

export type ReviewResult = {
  summary: string; // PR 総括（2〜4 文 + 残課題）
  confidence: 1 | 2 | 3 | 4 | 5; // Confidence Score
  importantFiles: { path: string; overview: string }[];
  mermaid?: { kind: 'sequenceDiagram' | 'flowchart'; source: string };
  comments: ReviewComment[];
  stats: { filesReviewed: number; tokensUsed?: number };
};
