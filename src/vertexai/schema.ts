/**
 * ReviewResult 型から Gemini responseSchema / Claude input_schema を生成する純粋関数。
 * requirements.md §7.3 のスキーマ定義を正とする。
 */

const reviewCommentSchema = {
  type: 'object' as const,
  properties: {
    path: { type: 'string' as const },
    line: { type: 'integer' as const },
    startLine: { type: 'integer' as const },
    side: { type: 'string' as const, enum: ['RIGHT'] },
    severity: { type: 'string' as const, enum: ['P0', 'P1', 'P2', 'P3'] },
    category: {
      type: 'string' as const,
      enum: ['bug', 'security', 'perf', 'style', 'test', 'docs', 'a11y'],
    },
    title: { type: 'string' as const },
    body: { type: 'string' as const },
    suggestion: { type: 'string' as const },
  },
  required: ['path', 'line', 'side', 'severity', 'category', 'title', 'body'],
};

const importantFileSchema = {
  type: 'object' as const,
  properties: {
    path: { type: 'string' as const },
    overview: { type: 'string' as const },
  },
  required: ['path', 'overview'],
};

const mermaidSchema = {
  type: 'object' as const,
  properties: {
    kind: {
      type: 'string' as const,
      enum: ['sequenceDiagram', 'flowchart'],
    },
    source: { type: 'string' as const },
  },
  required: ['kind', 'source'],
};

const statsSchema = {
  type: 'object' as const,
  properties: {
    filesReviewed: { type: 'integer' as const },
    tokensUsed: { type: 'integer' as const },
  },
  required: ['filesReviewed'],
};

/**
 * Gemini responseSchema 用（OpenAPI subset 形式）
 */
export const buildGeminiResponseSchema = () => ({
  type: 'object' as const,
  properties: {
    summary: { type: 'string' as const },
    confidence: { type: 'integer' as const, minimum: 1, maximum: 5 },
    importantFiles: {
      type: 'array' as const,
      items: importantFileSchema,
    },
    mermaid: mermaidSchema,
    comments: {
      type: 'array' as const,
      items: reviewCommentSchema,
    },
    stats: statsSchema,
  },
  required: ['summary', 'confidence', 'comments', 'stats'],
});

/**
 * Claude input_schema 用（JSON Schema 形式）
 */
export const buildClaudeInputSchema = () => ({
  type: 'object' as const,
  properties: {
    summary: { type: 'string' as const, description: 'PR 総括（2〜4 文 + 残課題）' },
    confidence: {
      type: 'integer' as const,
      minimum: 1,
      maximum: 5,
      description: 'Confidence Score (1-5)',
    },
    importantFiles: {
      type: 'array' as const,
      items: importantFileSchema,
      description: '変更ファイルの要約リスト',
    },
    mermaid: {
      ...mermaidSchema,
      description: 'Mermaid 図（任意）',
    },
    comments: {
      type: 'array' as const,
      items: reviewCommentSchema,
      description: 'レビューコメント配列',
    },
    stats: {
      ...statsSchema,
      description: 'レビュー統計',
    },
  },
  required: ['summary', 'confidence', 'comments', 'stats'],
});
