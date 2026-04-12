/**
 * ActionInputs 型定義
 *
 * 2-plan.md §3.1 を正として定義する。純粋な型ファイルであり、
 * 他ファイルからの import はゼロ（T1.1 AC #4）。
 */

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type Language = 'ja' | 'en';

export type ActionInputs = {
  githubToken: string;
  gcpProjectId: string;
  gcpLocation: string;
  gcpCredentials: Record<string, unknown>;
  model: string; // default: 'gemini-2.5-pro'
  systemPromptPath: string; // default: 'prompts/pr-review/system.ja.md'
  diffSizeLimit: number; // default: 100000
  timeout: number; // default: 120000
  // 新規 (requirements.md §7.1 / FR-018, FR-019, FR-020, FR-021, FR-022, FR-023 系)
  maxFiles: number; // default: 50
  maxComments: number; // default: 20
  perFileDiffLimit: number; // default: 30000
  severityThreshold: Severity; // default: 'P3'
  language: Language; // default: 'ja'
  reviewDrafts: boolean; // default: false
  maxOutputTokens: number; // default: 8192
};
