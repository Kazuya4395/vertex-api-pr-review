# 構造化 PR レビュー 技術設計 (Plan)

| 項目 | 値 |
| --- | --- |
| ドキュメント種別 | Technical Plan (Phase: Plan) |
| Issue | [#3](https://github.com/Kazuya4395/vertex-api-pr-review/issues/3) |
| Spec | [./requirements.md](./requirements.md) |
| Version | 1.0 |
| Date | 2026-04-11 |
| Status | Draft |

---

## 1. Architecture Overview

### 1.1 System Context

```
┌───────────────────────────────────────────────────────────────┐
│                      GitHub Actions Runner                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │               vertex-api-pr-review (Node 20)              │ │
│  │                                                            │ │
│  │   main.ts (4 段オーケストレータ)                            │ │
│  │   ┌──────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐   │ │
│  │   │ fetchCtx │→ │ planRev  │→ │ runLLM │→ │ postRev  │   │ │
│  │   └──────────┘  └──────────┘  └────────┘  └──────────┘   │ │
│  │        │             │             │            │          │ │
│  └────────┼─────────────┼─────────────┼────────────┼──────────┘ │
└───────────┼─────────────┼─────────────┼────────────┼───────────┘
            │             │             │            │
            ▼             │             ▼            ▼
   ┌────────────────┐    │    ┌──────────────┐  ┌──────────────┐
   │  GitHub REST   │    │    │  Vertex AI   │  │  GitHub REST │
   │  (octokit)     │    │    │  (Gemini /   │  │  (octokit)   │
   │  pulls.get     │    │    │   Claude)    │  │  createReview│
   │  pulls.listFil │    │    │  JSON 強制   │  │  issues.*    │
   └────────────────┘    │    └──────────────┘  └──────────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ position mapping │
                 │ (純粋関数)        │
                 └──────────────────┘
```

### 1.2 Component Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                           src/                                 │
├───────────────────────────────────────────────────────────────┤
│  main.ts                  -- エントリ + 4 段オーケストレータ      │
│                                                                 │
│  types/                                                         │
│    review.ts              -- ReviewResult / ReviewComment 等    │
│    inputs.ts              -- ActionInputs (型付き入力)           │
│                                                                 │
│  github/                                                        │
│    client.ts              -- getOctokit ラッパ                   │
│    pulls.ts               -- pulls.get/listFiles/createReview/  │
│                              listReviewComments/deleteReviewCmt │
│    comments.ts            -- Issue コメント系 crud のみ          │
│                              (issues.list/create/updateComment) │
│    position.ts            -- parsePatchToLineMap / snap...      │
│                                                                 │
│  vertexai/                                                      │
│    index.ts               -- dispatch (gemini|claude)            │
│    gemini.ts              -- responseSchema JSON 強制            │
│    claude.ts              -- tool_choice による JSON 強制        │
│    schema.ts              -- ReviewResult → responseSchema 変換  │
│                                                                 │
│  renderer/                                                      │
│    inlineComment.ts       -- renderInlineComment                 │
│    reviewBodyMini.ts      -- renderReviewBodyMini                │
│    issueSummary.ts        -- renderIssueSummary                  │
│    promptToFixWithAi.ts   -- renderPromptToFixWithAI             │
│                                                                 │
│  pipeline/                                                      │
│    fetchContext.ts        -- PR head.sha / files / diff 取得     │
│    planReview.ts          -- max-files / per-file-limit 適用     │
│    runLLM.ts              -- vertexai 呼び出し + snap 検証        │
│    postReview.ts          -- createReview + upsert summary       │
│    housekeeping.ts        -- 既存 inline / summary の upsert     │
└───────────────────────────────────────────────────────────────┘
```

### 1.3 データフロー (新)

```
action.yml inputs
    │
    ▼
main.ts
    │
    ├─→ fetchContext()
    │       pulls.get  → head.sha
    │       pulls.listFiles (ページング)
    │       per-file patch を保持
    │
    ├─→ planReview()
    │       max-files / per-file-diff-limit 適用
    │       除外ファイルリスト生成
    │       parsePatchToLineMap() で行セット構築
    │
    ├─→ runLLM()
    │       vertexai.getReview(filteredDiff, systemPrompt, inputs)
    │       ReviewResult を受領
    │       snapCommentToValidLine() で各 comment を補正
    │       severity-threshold でフィルタ
    │       max-comments を超えた分を summary に退避
    │
    └─→ postReview()
            housekeeping.deleteOldInlineComments()
            pulls.createReview({
              event: 'COMMENT',
              commit_id: head.sha,
              body: renderReviewBodyMini(result),
              comments: result.comments.map(c => ({
                path: c.path,
                line: c.line,
                start_line: c.startLine,
                side: c.side,
                body: renderInlineComment(c),
              })),
            })
            housekeeping.upsertSummaryComment(
              renderIssueSummary(result, historyCount)
            )
            // ※ createReview に渡す各 comment は §3.3 の
            //    createReview シグネチャに従い object に整形する。
            //    renderInlineComment は body 文字列のみを返す。
```

---

## 2. Technology Stack

| Layer | Technology | Rationale |
| --- | --- | --- |
| Runtime | Node.js 20 (GitHub Actions `using: node20`) | `action.yml` の既存設定を踏襲 |
| GitHub API Client | `@actions/github` (octokit) | 既に `package.json` に dependency 済・未 import。追加依存ゼロ |
| LLM (Gemini) | `@google-cloud/vertexai` の `generateContent` + `responseSchema` | 構造化 JSON 出力の公式サポート |
| LLM (Claude) | `@anthropic-ai/vertex-sdk` の `messages.create` + `tools`/`tool_choice` | tool use 強制で JSON 出力を保証 |
| 認証 | `google-auth-library` (既存) | Claude 経路で GoogleAuth 利用 |
| Type Checking | TypeScript 5.9 (既存 `tsconfig.json`) | 既存ビルド踏襲 |
| Test Runner | Jest 30 + ts-jest (既存 devDependencies) | `jest.config.js` あり・`tests/` 新設 |
| Bundler | `@vercel/ncc` (既存) | `dist/index.js` の単一ファイル配布 |
| Patch Parser | 自前実装 (外部ライブラリなし) | `parse-diff` を入れるほどでもない。テスト容易性優先 |
| JSON Repair | 自前 + fallback (再呼び出し) | `jsonrepair` 等の追加依存を避ける |

**新規依存: ゼロ**。`node-fetch` は octokit 化と同時に削除する。

---

## 3. API Design

### 3.1 ActionInputs 型

```typescript
// src/types/inputs.ts
export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type Language = 'ja' | 'en';

export type ActionInputs = {
  githubToken: string;
  gcpProjectId: string;
  gcpLocation: string;
  gcpCredentials: Record<string, unknown>;
  model: string;                 // default: 'gemini-2.5-pro'
  systemPromptPath: string;      // default: 'prompts/pr-review/system.ja.md'
  diffSizeLimit: number;         // default: 100000
  timeout: number;               // default: 120000
  // 新規
  maxFiles: number;              // default: 50
  maxComments: number;           // default: 20
  perFileDiffLimit: number;      // default: 30000
  severityThreshold: Severity;   // default: 'P3'
  language: Language;            // default: 'ja'
  reviewDrafts: boolean;         // default: false
  maxOutputTokens: number;       // default: 8192
};
```

### 3.2 ReviewResult 型

`requirements.md#7.3` を正とする。再掲:

```typescript
// src/types/review.ts
export type ReviewSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export type ReviewCategory =
  | 'bug' | 'security' | 'perf' | 'style' | 'test' | 'docs' | 'a11y';

export type ReviewComment = {
  path: string;
  line: number;
  startLine?: number;
  side: 'RIGHT';
  severity: ReviewSeverity;
  category: ReviewCategory;
  title: string;
  body: string;
  suggestion?: string;
};

export type ReviewResult = {
  summary: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  importantFiles: { path: string; overview: string }[];
  mermaid?: { kind: 'sequenceDiagram' | 'flowchart'; source: string };
  comments: ReviewComment[];
  stats: { filesReviewed: number; tokensUsed?: number };
};
```

### 3.3 GitHub API ラッパ

```typescript
// src/github/client.ts
import { getOctokit } from '@actions/github';
export const createClient = (token: string) => getOctokit(token);
export type GitHubClient = ReturnType<typeof createClient>;

// src/github/pulls.ts — Pull Request (pulls) API ラッパ群
export const getPullRequest = (c, o, r, n) =>
  c.rest.pulls.get({ owner: o, repo: r, pull_number: n });

export const listFiles = async (c, o, r, n) => {
  // ページング: 100 件/page を全ページ取得
};

export const createReview = (c, params: {
  owner, repo, pull_number, commit_id, body, event: 'COMMENT',
  comments: { path, line, start_line?, side, body }[],
}) => c.rest.pulls.createReview(params);

// pulls API 経由のためこちらに配置（`octokit.rest.pulls.*`）
export const listReviewComments = (c, o, r, n) =>
  c.rest.pulls.listReviewComments({ owner: o, repo: r, pull_number: n, per_page: 100 });

export const deleteReviewComment = (c, o, r, commentId) =>
  c.rest.pulls.deleteReviewComment({ owner: o, repo: r, comment_id: commentId });

// src/github/comments.ts — Issue コメント系ラッパのみ（`octokit.rest.issues.*`）
export const listIssueComments = ...
export const createIssueComment = ...
export const updateIssueComment = ...
```

### 3.4 Position Mapping

```typescript
// src/github/position.ts
export type LineMap = {
  validLines: Set<number>;        // 有効な新ファイル側行番号（+ 行と context 行）
};

export const parsePatchToLineMap = (patch: string): LineMap;

export const snapCommentToValidLine = (
  comment: ReviewComment,
  lineMap: LineMap,
  maxDistance?: number,
): { comment: ReviewComment; snapped: boolean } | null;
// 完全一致時は snapped: false、近傍へスナップ時は snapped: true、
// maxDistance 内に有効行が無ければ null（= サマリ退避）
```

> **Note**: 初期実装では `validLines` のみで十分のため、`hunks`（hunk 範囲の配列）フィールドは LineMap から外す。将来「hunk 境界をまたぐ複数行コメントの許容判定」が必要になった時点で追加する（§11 Open Questions に記録する）。

### 3.5 Vertex AI

```typescript
// src/vertexai/index.ts
export type RunLLMParams = ActionInputs & {
  systemPrompt: string;
  filteredDiff: string;
};

export const runLLM = (p: RunLLMParams): Promise<ReviewResult> => {
  if (p.model.includes('claude')) return runClaude(p);
  return runGemini(p);
};

// src/vertexai/gemini.ts
// generationConfig.responseMimeType = 'application/json'
// generationConfig.responseSchema = buildResponseSchema()

// src/vertexai/claude.ts
// tools: [{ name: 'submit_review', input_schema: buildInputSchema() }]
// tool_choice: { type: 'tool', name: 'submit_review' }
```

### 3.6 Renderer

全て純粋関数 (入力 → 文字列):

```typescript
export const renderInlineComment = (c: ReviewComment): string;
export const renderReviewBodyMini = (r: ReviewResult): string;
export const renderIssueSummary = (r: ReviewResult, historyCount: number, head: { sha: string; title: string; url: string }): string;
export const renderPromptToFixWithAI = (c: ReviewComment): string;
```

テンプレは `requirements.md#4.3` / `#4.4` を正とする。

---

## 4. Data Model

このプロジェクトは永続ストレージを持たない。PR 側の状態 (コメントと隠しマーカー) が唯一の永続層。

### 4.1 隠しマーカー定義

| マーカー | 埋め込み先 | 用途 |
| --- | --- | --- |
| `<!-- ai-review-inline -->` | 各 inline コメント本文末尾 | 再実行時に自 bot の inline を識別・削除 (FR-016) |
| `<!-- ai-review-summary -->` / `<!-- /ai-review-summary -->` | AI Review Summary Issue コメントの先頭/末尾 | upsert 時の対象識別 (FR-010b, FR-016) |
| `<!-- ai-review-count=N -->` | AI Review Summary 先頭 (上記マーカー直下) | 履歴回数 (DL-03, FR-015) |

### 4.2 履歴カウンタのライフサイクル

```
初回実行:
  listIssueComments → マーカー付きコメントなし
  → createIssueComment(count=1)

2回目実行:
  listIssueComments → count=1 コメント発見
  → updateIssueComment(count=2)

並列実行衝突 (R-06):
  update が 422/404 で失敗したら createIssueComment(count=1) へフォールバック
  README で concurrency: を推奨
```

---

## 5. Error Handling Strategy

### 5.1 Error Classification

| Error Type | 発生箇所 | 方針 |
| --- | --- | --- |
| Input validation | main.ts | `core.setFailed` で即終了 |
| `pulls.get` / `listFiles` 失敗 | fetchContext | `core.setFailed` で終了 (NFR-009) |
| LLM 呼び出し失敗 | runLLM | `core.setFailed` で終了。フォールバック投稿しない (FR-023) |
| LLM JSON パース失敗 | runLLM | 1 回だけ JSON repair を試み、ダメなら `core.setFailed` |
| `createReview` が 422/403 | postReview | inline を諦め、`issues.createComment` で summary のみ投下。ジョブは成功扱い (FR-024) |
| `issues.updateComment` の 404 (並列衝突) | housekeeping | `issues.createComment` にフォールバック (R-06) |
| `deleteReviewComment` 失敗 | housekeeping | `core.warning` でログ、継続 |

### 5.2 Retry Strategy

**外部 API に対する自動リトライは実装しない**。理由:

1. GitHub Actions 自体がジョブ単位でリトライ可能
2. Vertex AI の一時エラーは実測でレアケース、指数バックオフを入れると実行時間が伸びる
3. octokit は 5xx に対して内部的に 1 回リトライする (デフォルト挙動)
4. housekeeping 系のみ、下記の最小限のフォールバックを実装:
   - `updateComment` 失敗 → `createComment`
   - `createReview` 失敗 → `createComment` (summary のみ)

### 5.3 LLM 出力のサニタイズ

```typescript
// runLLM 内
const raw: unknown = parseLLMOutput(response);  // Gemini: parts[0].text / Claude: tool_use.input
const result = ReviewResultSchema.parse(raw);   // zod ではなく手書きバリデータで追加依存を避ける
const snapped = result.comments
  .map(c => snapCommentToValidLine(c, lineMap))
  .filter((s): s is NonNullable<typeof s> => s !== null);
// null になった comment は summary.tail に退避
```

---

## 6. Testing Strategy

### 6.1 Unit Tests (Phase 1 で整備)

| ファイル | テスト対象 | ケース数目安 |
| --- | --- | --- |
| `tests/github/position.test.ts` | `parsePatchToLineMap` | 10+ (通常 hunk / 複数 hunk / 追加のみ / 削除のみ / バイナリ / 空 / etc.) |
| `tests/github/position.test.ts` | `snapCommentToValidLine` | 6+ (完全一致 / 前後スナップ / 範囲外 / 複数行 / 連続 hunk 境界) |
| `tests/renderer/inlineComment.test.ts` | `renderInlineComment` | 5+ (各 severity / suggestion 有無 / 複数行) |
| `tests/renderer/reviewBodyMini.test.ts` | `renderReviewBodyMini` | 4+ (件数集計 / P0 のみ / 指摘なし / confidence 5) |
| `tests/renderer/issueSummary.test.ts` | `renderIssueSummary` | 5+ (マーカー埋め込み / count 更新 / mermaid 省略 / importantFiles 空) |
| `tests/renderer/promptToFixWithAI.test.ts` | `renderPromptToFixWithAI` | 3+ |
| `tests/vertexai/schema.test.ts` | `buildResponseSchema` (Gemini) | 1+ (生成結果のキー検証) |
| `tests/vertexai/schema.test.ts` | `buildInputSchema` (Claude tool) | 1+ |
| `tests/pipeline/housekeeping.test.ts` (基本版, T2.10) | `upsertSummaryComment` 基本版 / `deleteOldInlineComments` | 3+ (新規 / 更新 / inline 削除) |
| `tests/pipeline/housekeeping.test.ts` (拡張版, T3.2) | `upsertSummaryComment` の count+1 / 404-422 フォールバック / 並列衝突ログ | 3+ (count+1 / updateComment 失敗時の createComment フォールバック / R-06 `core.warning`) ※ Phase 3 で追加（§7.3 / T3.2 / DL-08） |

カバレッジ目標: `position.ts` は 90% 以上、renderer は 80% 以上、全体 80% 以上 (NFR-005)。

### 6.2 Integration Tests

octokit は `nock` を使わず、`jest.mock('@actions/github')` でモックする。Vertex AI も同様にモック化し、`ReviewResult` を返す fake を注入する。

### 6.3 End-to-End 検証

本リポジトリの実 PR 上で Action を実行する。Phase 2 末と Phase 3 末で検証範囲を分離する（§10.3 DL-08 / §7 Rollout Plan）。

**Phase 2 末 E2E**（T2.10 までの基本動作検証）:

- [ ] inline 複数件 + Review body ミニサマリ + Summary Issue コメントが同時投稿される
- [ ] diff hunk 外の架空行指定でもクラッシュしない
- [ ] 2 回連続実行で自 bot inline が重複せず、Summary が `updateComment` で置換される（`<!-- ai-review-count -->` の `+1` インクリメント検証は Phase 3 末へ）
- [ ] PR 本文 (Description) が実行前後で完全一致 (DL-02, AC-P2-10)

**Phase 3 末 E2E**（T3.1 拡張機能の検証）:

- [ ] 2 回連続実行で Summary の `<!-- ai-review-count -->` が `1 → 2` に更新される (AC-P3-01)
- [ ] `updateComment` が 404/422 を返すケースで `createComment` フォールバックが動作する
- [ ] R-06 並列衝突時に `core.warning` ログが出力される

### 6.4 CI 設定

既存 `jest.config.js` を尊重し、`tests/` を `testMatch` に追加。`npm test` で全テスト実行。`npm run build` で `dist/index.js` 再生成。GitHub Actions 側ワークフローは `action.yml` の自動テストがないため、本タスクでは CI 追加は行わない (別 Issue 候補)。

---

## 7. Rollout Plan

### 7.1 Phase 1: 基盤整備

実装順序:

1. `feature/phase1-foundation` ブランチを切る
2. `src/types/{inputs,review}.ts` を追加
3. `src/github/{client,pulls,comments}.ts` を octokit ベースで実装
4. `src/github/position.ts` を純粋関数として実装
5. `tests/` を新設しテストを全て書き切る
6. `main.ts` / `vertexai/*` は触らない (既存のまま CI 通す)
7. `node-fetch` は Phase 2 で削除するので dependency は Phase 1 では維持
8. PR: Phase 1 完了コミット → main へマージ

### 7.2 Phase 2: 構造化レビュー本体

実装順序:

1. `feature/phase2-structured-review` ブランチを切る
2. `prompts/pr-review/system.ja.md` を新設、`prompts/system-prompt.md` を削除
3. `src/vertexai/schema.ts` で `responseSchema` / `input_schema` を定義
4. `src/vertexai/gemini.ts` を `responseMimeType:'application/json'` + `responseSchema` 化
5. `src/vertexai/claude.ts` を `tools` + `tool_choice` 化、`max_tokens` を `inputs.maxOutputTokens` から受ける
6. `src/vertexai/index.ts` のシグネチャを `(params) => Promise<ReviewResult>` に変更
7. `src/renderer/*` を純粋関数として実装
8. `src/pipeline/{fetchContext,planReview,runLLM,postReview,housekeeping}.ts` を実装
9. `src/main.ts` を 4 段オーケストレータに再構築
10. `src/github.ts` (旧) と `prompts/system-prompt.md` を削除
11. `action.yml` 更新:
    - `model` 既定値を `gemini-2.5-pro`
    - `system-prompt-path` の既定を `prompts/pr-review/system.ja.md`
    - `max-files` / `max-comments` / `per-file-diff-limit` / `severity-threshold` / `language` / `review-drafts` / `max-output-tokens` を追加
12. `package.json` から `node-fetch` / `@types/node-fetch` を削除
13. renderer / pipeline のテストを追加
14. `npm run build` で `dist/index.js` 再生成
15. 本リポの実 PR で動作確認 (E2E)
16. PR: Phase 2 完了 → main へマージ

### 7.3 Phase 3: 運用強化

実装順序:

1. `feature/phase3-housekeeping` ブランチを切る
2. `housekeeping.ts` の upsert ロジックを本実装 (衝突時フォールバック含む)
3. `<!-- ai-review-count=N -->` のパース/更新を完全実装
4. `stats.tokensUsed` を Summary に表示
5. `core.info` でフェーズごとの所要時間・件数をログ出力
6. README.md / README.ja.md を構造化レビュー方式前提で全面書き換え
7. 2 回連続実行による冪等性 E2E 検証
8. `v2` タグを切る (手動)
9. PR: Phase 3 完了 → main へマージ → `v2` タグ → GitHub Marketplace 掲載更新

---

## 8. Design Decisions

`requirements.md#10.3` の Decision Log (DL-01 ~ DL-08) を前提とする。本ドキュメントで追加で決定した事項:

| ID | 項目 | 決定 | 理由 |
| --- | --- | --- | --- |
| **PD-01** | パッチパーサー | 自前実装 (外部ライブラリなし) | `parse-diff` を入れるほどの規模ではない・テスト容易性・追加依存ゼロの方針 |
| **PD-02** | 型バリデーション | 手書きバリデータ (`zod` 不採用) | 追加依存ゼロの方針 (NFR-007)。検証対象が `ReviewResult` 1 つのみで手書きで十分 |
| **PD-03** | CI でのテスト自動化 | 本タスクでは追加しない | スコープ外。別 Issue 化 |
| **PD-04** | リトライ戦略 | 自動リトライは実装しない (housekeeping の fallback のみ) | 実装複雑度とのトレードオフ。ジョブ単位リトライが既に GitHub Actions 側で可能 |
| **PD-05** | `node-fetch` 削除タイミング | Phase 2 末 | Phase 1 では旧 `github.ts` が未削除のため dependency を残す |
| **PD-06** | ディレクトリ構造 | `src/github/`, `src/vertexai/`, `src/renderer/`, `src/pipeline/`, `src/types/` に分割 | 責務分離・テスト容易性・ファイル肥大化回避 |

---

## 9. File Changes

### 9.1 New Files

| File | Purpose | Phase |
| --- | --- | --- |
| `src/types/inputs.ts` | `ActionInputs` 型 | 1 |
| `src/types/review.ts` | `ReviewResult` / `ReviewComment` 等の型 | 1 |
| `src/github/client.ts` | octokit ラッパ | 1 |
| `src/github/pulls.ts` | pulls API 群ラッパ | 1 |
| `src/github/comments.ts` | Issue コメント系 crud ラッパ (`issues.listComments` / `createComment` / `updateComment`) | 1 |
| `src/github/position.ts` | `parsePatchToLineMap` / `snapCommentToValidLine` | 1 |
| `src/vertexai/schema.ts` | Gemini `responseSchema` / Claude `input_schema` ビルダ | 2 |
| `src/renderer/inlineComment.ts` | inline コメントテンプレ | 2 |
| `src/renderer/reviewBodyMini.ts` | Review body ミニサマリテンプレ | 2 |
| `src/renderer/issueSummary.ts` | AI Review Summary テンプレ | 2 |
| `src/renderer/promptToFixWithAi.ts` | Prompt To Fix With AI 生成 | 2 |
| `src/pipeline/fetchContext.ts` | `pulls.get` + `listFiles` | 2 |
| `src/pipeline/planReview.ts` | `max-files` / `per-file-diff-limit` 適用 | 2 |
| `src/pipeline/runLLM.ts` | LLM 呼び出し + snap 検証 | 2 |
| `src/pipeline/postReview.ts` | `createReview` + summary upsert | 2 |
| `src/pipeline/housekeeping.ts` | 既存 inline 削除 + summary upsert | 2 (雛形) / 3 (完全版) |
| `prompts/pr-review/system.ja.md` | 日本語システムプロンプト | 2 |
| `tests/github/position.test.ts` | position ユニットテスト | 1 |
| `tests/github/comments.test.ts` | octokit モックテスト | 1 |
| `tests/github/pulls.test.ts` | pulls API 群ラッパのモックテスト | 1 |
| `tests/renderer/*.test.ts` | renderer ユニットテスト | 2 |
| `tests/vertexai/schema.test.ts` | schema ビルダテスト | 2 |
| `tests/pipeline/housekeeping.test.ts` | housekeeping 基本版 + 冪等性テスト (基本版 3 ケース: 新規 / 更新 / inline 削除、拡張版 +2 ケース: count+1 / 衝突時フォールバック) | 2 (基本), 3 (拡張) |

### 9.2 Modified Files

| File | Change | Phase |
| --- | --- | --- |
| `src/main.ts` | 4 段オーケストレータに全面書き換え。`process.exit(1)` → `core.setFailed` | 2 |
| `src/vertexai/index.ts` | `(params) => Promise<ReviewResult>` にシグネチャ変更 | 2 |
| `src/vertexai/gemini.ts` | `responseSchema` + JSON 返却に書き換え | 2 |
| `src/vertexai/claude.ts` | `tools` + `tool_choice` に書き換え。`max_tokens` を入力化 | 2 |
| `action.yml` | 既定値変更 + 新規入力 7 件追加 | 2 |
| `package.json` | `node-fetch` / `@types/node-fetch` を dependencies / devDependencies から削除 | 2 |
| `jest.config.js` | `passWithNoTests: true` 追加 (Phase 1 の段階的テスト整備を可能にするため / T1.7) | 1 |
| `README.md` / `README.ja.md` | 構造化レビュー方式前提で全面書き換え | 3 |
| `dist/index.js` | ncc 再ビルド | 2, 3 |

### 9.3 Deleted Files

| File | Reason | Phase |
| --- | --- | --- |
| `src/github.ts` (旧) | octokit 化で `src/github/*` に分離 | 2 |
| `prompts/system-prompt.md` | `prompts/pr-review/system.ja.md` に置換 | 2 |

---

## 10. Risks and Mitigations

`requirements.md#10.1` の R-01 ~ R-07 を継承。本 Plan で追加で特定したリスク:

| Risk | Impact | Probability | Mitigation |
| --- | --- | --- | --- |
| **PR-01** Phase 1 と Phase 2 の間で main がズレる | Medium | Low | 各 Phase を短期間で完了・PR マージ直後に次 Phase に着手 |
| **PR-02** `parsePatchToLineMap` のエッジケース (CRLF / BOM / 極端に長い hunk) | Medium | Medium | Phase 1 のテストで 10+ ケースを網羅 (AC-P1-01) |
| **PR-03** Claude の tool_choice が model version 依存でエラー | Medium | Low | Claude 4.5 以降で動作確認。未対応 model は README で非推奨に明記 |
| **PR-04** `dist/index.js` のサイズが 6MB を超える | Low | Low | ncc ビルド後に size チェックを CI に追加 (別 Issue) |

---

## 11. Open Questions

- [ ] Phase 2 の Draft PR 対応 (`inputs.review-drafts`) は初期実装必須か? → 必須とし、`context.payload.pull_request.draft` を参照して fetchContext で早期リターン
- [ ] `prompts/pr-review/system.en.md` は Phase 3 で追加するか? → いいえ、DL-04 により将来の別 Issue
- [ ] `v2` タグ付与は手動 or release-please? → 手動 (Phase 3 の最終ステップ)

---

## 12. References

- [./requirements.md](./requirements.md) - Phase 1 Spec 相当
- [Issue #3](https://github.com/Kazuya4395/vertex-api-pr-review/issues/3) - 親 Issue
- GitHub REST API — Pulls: https://docs.github.com/en/rest/pulls
- GitHub REST API — Issue Comments: https://docs.github.com/en/rest/issues/comments
- `@actions/github` docs: https://github.com/actions/toolkit/tree/main/packages/github
- Vertex AI Gemini `responseSchema`: Google Cloud 公式
- Anthropic Claude Tool Use: Anthropic 公式
