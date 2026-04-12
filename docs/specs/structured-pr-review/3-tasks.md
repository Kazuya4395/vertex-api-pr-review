# 構造化 PR レビュー 実装タスク (Tasks)

| 項目 | 値 |
| --- | --- |
| ドキュメント種別 | Implementation Tasks (Phase: Tasks) |
| Issue | [#3](https://github.com/Kazuya4395/vertex-api-pr-review/issues/3) |
| Spec | [./requirements.md](./requirements.md) |
| Plan | [./2-plan.md](./2-plan.md) |
| Version | 1.0 |
| Date | 2026-04-11 |
| Status | In Progress |

---

## Progress Notes

- **2026-04-11**: SDD ドキュメント作成 (Spec = `requirements.md`, Plan = `2-plan.md`, Tasks = 本ファイル)
- **2026-04-11**: 6 ラウンドのマルチモデルレビュー (Codex GPT-5 + Claude Opus 4.6) を経て Approved 判定
- **2026-04-11**: Phase 1 着手 — T1.1 完了 (`src/types/inputs.ts` / `src/types/review.ts` 新規作成, `tsc --noEmit` 通過)
- **2026-04-12**: T1.2〜T1.8 完了 — Phase 1 全完。30 tests passed, coverage 97.05% (position.ts 94.44%)
- **2026-04-12**: T2.1〜T2.14 完了 — Phase 2 全完。73 tests passed, coverage 98.65% (Stmts) / 90.66% (Branch)。dist/index.js = 2417KB (< 6MB)
- **2026-04-12**: T3.1〜T3.5 完了 — housekeeping upsert 拡張 / 冪等性テスト / tokensUsed / 観測性ログ / README 全面書き換え
- **2026-04-12**: T3.7 完了 — 83 tests passed, dist/index.js = 2420KB (< 6MB), tsc 通過

---

## Task Overview

| Phase | Tasks | Description |
| --- | --- | --- |
| 1. 基盤整備 | T1.1 - T1.8 | 型定義 / octokit 化 / position mapping / テスト基盤 |
| 2. 構造化レビュー本体 | T2.1 - T2.14 | プロンプト / vertexai JSON 強制 / renderer / pipeline / main 再構築 / action.yml 更新 |
| 3. 運用強化 | T3.1 - T3.8 | housekeeping 完成 / README 刷新 / v2 リリース |

---

## Phase 1: 基盤整備

### T1.1 型定義ファイルの作成

**Description**: `ActionInputs` と `ReviewResult` 系の型を定義する。純粋な型定義のみ、実装ロジックは含まない。

**Files**:
- `src/types/inputs.ts` (新規)
- `src/types/review.ts` (新規)

**Acceptance Criteria**:
- [ ] `ActionInputs` 型が `2-plan.md#3.1` のとおり全フィールドを持つ
- [ ] `ReviewSeverity` / `ReviewCategory` / `ReviewComment` / `ReviewResult` が `requirements.md#7.3` と一致
- [ ] `tsc --noEmit` が通る
- [ ] 他ファイルからの import がゼロの純粋な型ファイル

---

### T1.2 octokit クライアントラッパの作成

**Description**: `@actions/github` の `getOctokit` を薄くラップし、テスト容易性を確保する。`@actions/github` は既に `package.json` にあり追加依存不要。

**Files**:
- `src/github/client.ts` (新規)

**Code Snippet** (参考):
```typescript
import { getOctokit } from '@actions/github';
export const createClient = (token: string) => getOctokit(token);
export type GitHubClient = ReturnType<typeof createClient>;
```

**Acceptance Criteria**:
- [ ] `createClient` が GitHub token を受け取り octokit インスタンスを返す
- [ ] `GitHubClient` 型が export されている
- [ ] `@actions/github` のバージョンは既存 `^6.0.1` を使用 (アップデートしない)

---

### T1.3 pulls API ラッパの作成

**Description**: `pulls.get` / `pulls.listFiles` / `pulls.createReview` / `pulls.listReviewComments` / `pulls.deleteReviewComment` の薄いラッパを提供。`listFiles` はページングを内包する。

**Files**:
- `src/github/pulls.ts` (新規)

**Acceptance Criteria**:
- [ ] `getPullRequest(client, owner, repo, number)` が `pulls.get` を呼ぶ
- [ ] `listFiles` が 100 件/page で全ページ取得する (per_page=100)
- [ ] `createReview` が `event: 'COMMENT'` 固定で Review を作成する
- [ ] `listReviewComments` / `deleteReviewComment` のラッパが存在
- [ ] 入出力はすべて型付け (any を使わない)

---

### T1.4 comments API ラッパの作成

**Description**: Issue コメント系 (`issues.listComments` / `issues.createComment` / `issues.updateComment`) の薄いラッパを提供。PR 本体への inline コメント (`pulls.createReviewComment`) は T1.3 に含む。

**Files**:
- `src/github/comments.ts` (新規)

**Acceptance Criteria**:
- [ ] 3 つのラッパが全て存在し型付けされている
- [ ] `listIssueComments` はページングを内包する

---

### T1.5 patch → line map パーサーの実装

**Description**: unified diff の `patch` 文字列を解析し、新ファイル側の有効行セットを構築する純粋関数を実装する。

**Files**:
- `src/github/position.ts` (新規)

**Code Snippet** (参考):
```typescript
export type LineMap = {
  validLines: Set<number>;
};

export const parsePatchToLineMap = (patch: string): LineMap => {
  // @@ -a,b +c,d @@ をパース
  // '+' 行と ' ' 行を validLines に追加
  // '-' 行はスキップ
};
```

**Acceptance Criteria**:
- [ ] `@@ -a,b +c,d @@` hunk header を正しくパースする
- [ ] 連続 hunk を全て処理する
- [ ] `+` 行と ` ` (context) 行を `validLines` に追加
- [ ] `-` 行は無視
- [ ] バイナリファイル・空パッチで例外を投げない
- [ ] CRLF 混在でも動作する

---

### T1.6 snap ロジックの実装

**Description**: LLM が返したコメントの行番号が `validLines` に無い場合、最近傍の有効行へスナップする。スナップ不能な場合は `null` を返し、サマリ退避とする。

**Files**:
- `src/github/position.ts` (T1.5 と同ファイル)

**Code Snippet** (参考):
```typescript
export const snapCommentToValidLine = (
  comment: ReviewComment,
  lineMap: LineMap,
  maxDistance = 3,
): { comment: ReviewComment; snapped: boolean } | null => {
  if (lineMap.validLines.has(comment.line)) {
    return { comment, snapped: false };
  }
  // 前後 maxDistance 行以内で最近傍を探す
};
```

**Acceptance Criteria**:
- [ ] 完全一致時は `snapped: false` で返す
- [ ] 近傍に有効行があれば `line` を補正し `snapped: true` で返す
- [ ] `maxDistance` を超えたら `null` を返す
- [ ] 複数行コメント (`startLine` 指定) の場合、`startLine` と `line` の両方が有効であることを確認

---

### T1.7 Jest テスト基盤の整備

**Description**: `tests/` ディレクトリを新設し、`jest.config.js` の `testMatch` と `passWithNoTests` を調整する。T1.8 より先に単独で Phase 1 CI を通せるようにするのが目的。既存 `jest.config.js` を壊さないこと。

**Files**:
- `tests/` (新規ディレクトリ)
- `jest.config.js` (`passWithNoTests: true` を追加、`testMatch` に `tests/**/*.test.ts` を含める)

**Commands**:
```bash
npm test
```

**Acceptance Criteria**:
- [ ] `tests/` ディレクトリが存在する
- [ ] `jest.config.js` に `passWithNoTests: true` が設定されており、テストファイル 0 件の状態でも `npm test` が exit 0 で完了する（T1.8 実装前の暫定状態を許容）
- [ ] `testMatch` に `tests/**/*.test.ts` パターンが含まれる
- [ ] `ts-jest` プリセットが動作する（型チェック付きで TS ファイルを実行できる）

---

### T1.8 position / client のユニットテスト追加

**Description**: `parsePatchToLineMap` / `snapCommentToValidLine` に対するテストを 10 ケース以上書く。octokit ラッパは `jest.mock('@actions/github')` でモックしテストする。

**Files**:
- `tests/github/position.test.ts` (新規)
- `tests/github/pulls.test.ts` (新規)
- `tests/github/comments.test.ts` (新規)

**Commands**:
```bash
npm test -- tests/github
```

**Acceptance Criteria**:
- [ ] AC-P1-01: `parsePatchToLineMap` のテストが 10 ケース以上存在し全て通る (通常 hunk / 複数 hunk / 追加のみ / 削除のみ / バイナリ / 空 / CRLF / BOM / 連続 hunk 境界 / 行連結)
- [ ] `snapCommentToValidLine` のテストが 6 ケース以上存在し全て通る
- [ ] `position.ts` のカバレッジが 90% 以上
- [ ] octokit ラッパのテストで `jest.mock` が正しく動作
- [ ] AC-P1-04: `tests/` 全体で 0 failure

---

## Phase 2: 構造化レビュー本体

### T2.1 日本語システムプロンプトの作成

**Description**: `prompts/pr-review/system.ja.md` を新設し、`requirements.md#8.2` に沿った内容を書く。既存の `prompts/system-prompt.md` は T2.13 で削除する。

**Files**:
- `prompts/pr-review/system.ja.md` (新規)

**Acceptance Criteria**:
- [ ] 8 項目の主要指示 (役割 / 出力形式 / severity 基準 / Confidence 基準 / suggestion ルール / Mermaid 条件 / 言語 / 観点優先順位) が含まれる
- [ ] LLM に対し "必ず `ReviewResult` JSON のみを返せ" と明示
- [ ] Markdown 装飾・絵文字の差し込みを LLM 側で行わないよう指示
- [ ] **対応 AC**: AC-P2-07（Gemini / Claude の両方で `ReviewResult` が同じ構造にパースされる）の前提プロンプトとして機能

---

### T2.2 schema ビルダの実装

**Description**: Gemini `responseSchema` と Claude `input_schema` を `ReviewResult` 型から生成する純粋関数を実装する。

**Files**:
- `src/vertexai/schema.ts` (新規)

**Code Snippet** (参考):
```typescript
export const buildGeminiResponseSchema = () => ({
  type: 'object',
  properties: {
    summary: { type: 'string' },
    confidence: { type: 'integer', minimum: 1, maximum: 5 },
    importantFiles: { type: 'array', items: { ... } },
    comments: { type: 'array', items: { ... } },
    stats: { ... },
  },
  required: ['summary', 'confidence', 'comments', 'stats'],
});

export const buildClaudeInputSchema = () => ({ /* 同構造 */ });
```

**Acceptance Criteria**:
- [ ] Gemini 用 schema が OpenAPI subset 形式で返される
- [ ] Claude 用 input_schema が JSON Schema 形式で返される
- [ ] 両者とも `ReviewResult` の全フィールドをカバー
- [ ] ユニットテストでキー構造を検証
- [ ] **対応 AC**: AC-P2-07（Gemini / Claude の両方で `ReviewResult` が同じ構造にパースされる）

---

### T2.3 Gemini クライアントの構造化出力対応

**Description**: `src/vertexai/gemini.ts` を `responseMimeType: 'application/json'` + `responseSchema` に書き換え、`ReviewResult` を返すようにする。

**Files**:
- `src/vertexai/gemini.ts` (全面書き換え)

**Acceptance Criteria**:
- [ ] `generationConfig.responseMimeType = 'application/json'` が指定される
- [ ] `generationConfig.responseSchema` に `buildGeminiResponseSchema()` の結果が渡される
- [ ] 戻り値の型が `Promise<ReviewResult>`
- [ ] `parts[0].text` を `JSON.parse` して返す
- [ ] JSON パース失敗時は `core.error` でログ + throw

---

### T2.4 Claude クライアントの tool use 強制対応

**Description**: `src/vertexai/claude.ts` を `tools` + `tool_choice` による tool use 強制に書き換え。`max_tokens` を `inputs.maxOutputTokens` から受け取る。

**Files**:
- `src/vertexai/claude.ts` (全面書き換え)

**Acceptance Criteria**:
- [ ] `tools: [{ name: 'submit_review', input_schema: buildClaudeInputSchema() }]` が指定される
- [ ] `tool_choice: { type: 'tool', name: 'submit_review' }` が指定される
- [ ] `max_tokens` がハードコード `4096` ではなく `inputs.maxOutputTokens` から来る
- [ ] `response.content.find(c => c.type === 'tool_use').input` を返す
- [ ] 戻り値の型が `Promise<ReviewResult>`

---

### T2.5 vertexai ディスパッチャのシグネチャ変更

**Description**: `src/vertexai/index.ts` のインタフェースを `(params) => Promise<ReviewResult>` に統一し、プレーンテキスト経路を削除する。

**Files**:
- `src/vertexai/index.ts` (書き換え)

**Acceptance Criteria**:
- [ ] `runLLM(params): Promise<ReviewResult>` として export される
- [ ] model 名に `claude` が含まれるかで dispatch する既存ロジックは維持
- [ ] 戻り値の string 経路が完全に消えている

---

### T2.6 inline コメント renderer の実装

**Description**: `renderInlineComment(c: ReviewComment): string` を純粋関数として実装する。テンプレは `requirements.md#4.3` を正とする。末尾に `<!-- ai-review-inline -->` を必ず付与。

**Files**:
- `src/renderer/inlineComment.ts` (新規)

**Acceptance Criteria**:
- [ ] 5 パーツ (絵文字 + 見出し / 本文 / suggestion / Prompt To Fix With AI details / 末尾マーカー) が出力される
- [ ] suggestion が undefined のときは suggestion ブロックごと省略
- [ ] 絵文字マッピング: P0=🔴 / P1=🟠 / P2=🟡 / P3=🟢
- [ ] `title` に句点が含まれても太字見出しとして正しく出力
- [ ] ユニットテスト 5 ケース以上で検証 (T2.11)
- [ ] **対応 AC**: AC-P2-02（各 inline コメントに優先度絵文字 / 太字見出し / 本文 / suggestion / Prompt To Fix With AI details の 5 パーツ + 末尾マーカー）

---

### T2.7 Review body ミニサマリ renderer の実装

**Description**: `renderReviewBodyMini(r: ReviewResult): string` を純粋関数として実装する。テンプレは `requirements.md#4.4` の「Review body ミニサマリ」節を正とする。

**Files**:
- `src/renderer/reviewBodyMini.ts` (新規)

**Code Snippet** (参考):
```typescript
export const renderReviewBodyMini = (r: ReviewResult): string => {
  const counts = countBySeverity(r.comments);
  return [
    `🤖 **AI Review** — Confidence ${r.confidence}/5 — 🔴${counts.P0} 🟠${counts.P1} 🟡${counts.P2} 🟢${counts.P3}`,
    ``,
    `詳細は下部の AI Review Summary コメントを参照。`,
  ].join('\n');
};
```

**Acceptance Criteria**:
- [ ] Confidence + 件数サマリ 1 行 + 詳細誘導 1 行の 2 行構成
- [ ] 件数集計が正しい
- [ ] 指摘なし時 (全件 0) でも正しく動作
- [ ] ユニットテスト 4 ケース以上で検証
- [ ] **対応 AC**: AC-P2-03 の (a)（Review body にミニサマリが出力される）

---

### T2.8 AI Review Summary renderer の実装

**Description**: `renderIssueSummary(r: ReviewResult, historyCount: number, head: {...}): string` を純粋関数として実装する。テンプレは `requirements.md#4.4` のフルテンプレを正とする。

**Files**:
- `src/renderer/issueSummary.ts` (新規)

**Acceptance Criteria**:
- [ ] `<!-- ai-review-summary -->` / `<!-- ai-review-count=N -->` / `<!-- /ai-review-summary -->` マーカーが埋め込まれる
- [ ] `historyCount` が先頭メタに正しく反映される
- [ ] `r.mermaid` が undefined ならセクション丸ごと省略
- [ ] `importantFiles` が空なら表を省略
- [ ] Prompt To Fix All With AI が `---` 区切りで全 inline を結合
- [ ] ユニットテスト 5 ケース以上で検証

---

### T2.9 Prompt To Fix With AI renderer の実装

**Description**: 各 inline コメントに紐付く Prompt To Fix With AI details セクションを機械的に生成する純粋関数。LLM には依頼しない (FR-009)。

**Files**:
- `src/renderer/promptToFixWithAi.ts` (新規)

**Acceptance Criteria**:
- [ ] details の 5 重バッククォート構造がテンプレ通り
- [ ] 末尾に `How can I resolve this? If you propose a fix, please make it concise.` が入る
- [ ] path / line range / title / body / suggestion が正しく埋め込まれる

---

### T2.10 pipeline の実装 (fetchContext / planReview / runLLM / postReview / housekeeping)

**Description**: `main.ts` から呼ばれる 4 段オーケストレータの各段を実装する。`housekeeping` は Phase 2 で `deleteOldInlineComments` と `upsertSummaryComment` の**両方を実装**する（FR-010 / FR-016 を満たすため、サマリ upsert は Phase 2 から必須）。Phase 3 では `<!-- ai-review-count=N -->` の完全パース・衝突時フォールバック等の**拡張機能のみ追加**する（§10.3 DL-08 参照）。

**対応 AC**: AC-P2-01 / AC-P2-04 / AC-P2-05 / AC-P2-06 / AC-P2-07

**Files**:
- `src/pipeline/fetchContext.ts` (新規)
- `src/pipeline/planReview.ts` (新規)
- `src/pipeline/runLLM.ts` (新規)
- `src/pipeline/postReview.ts` (新規)
- `src/pipeline/housekeeping.ts` (新規)
- `tests/pipeline/housekeeping.test.ts` (新規 / 基本版)

**Acceptance Criteria**:
- [ ] `fetchContext` が `pulls.get` + `listFiles` を呼び、`{ headSha, files, totalSize }` を返す
- [ ] `planReview` が `max-files` / `per-file-diff-limit` を適用し除外リストを返す
- [ ] `runLLM` が `vertexai.runLLM` を呼び、`snapCommentToValidLine` で全 comments を補正、`severity-threshold` でフィルタ、`max-comments` 超過分を summary 末尾退避
- [ ] `postReview` が `housekeeping.deleteOldInlineComments()` → `pulls.createReview` → `housekeeping.upsertSummaryComment` の順で実行
- [ ] `housekeeping.deleteOldInlineComments` が `<!-- ai-review-inline -->` を含む自 bot inline のみ削除
- [ ] `housekeeping.upsertSummaryComment` が `<!-- ai-review-summary -->` マーカー付きの既存コメントを `issues.updateComment` で更新、未存在時は `issues.createComment` で新規作成する（Phase 2 時点の実装範囲。`<!-- ai-review-count=N -->` の完全パース・衝突フォールバック等は Phase 3 で追加）
- [ ] `tests/pipeline/housekeeping.test.ts` (基本版) に以下 3 ケース以上が実装されている: (a) 新規作成 (`<!-- ai-review-summary -->` なしの状態で `issues.createComment` が呼ばれる)、(b) 更新 (`<!-- ai-review-summary -->` 付きコメント存在時に `issues.updateComment` が呼ばれる)、(c) inline 削除 (`<!-- ai-review-inline -->` 付きの自 bot inline のみ `pulls.deleteReviewComment` で削除)
- [ ] エラー時は `core.setFailed` で終了 (FR-023)
- [ ] `createReview` 422/403 時は summary のみ投下のフォールバックが動作 (FR-024)

---

### T2.11 renderer / schema のユニットテスト追加

**Description**: T2.6 ~ T2.9 で実装した renderer と T2.2 の schema ビルダに対しユニットテストを追加する。

**Files**:
- `tests/renderer/inlineComment.test.ts` (新規)
- `tests/renderer/reviewBodyMini.test.ts` (新規)
- `tests/renderer/issueSummary.test.ts` (新規)
- `tests/renderer/promptToFixWithAi.test.ts` (新規)
- `tests/vertexai/schema.test.ts` (新規)

**Commands**:
```bash
npm test -- tests/renderer tests/vertexai
```

**Acceptance Criteria**:
- [ ] AC-P2-08: renderer 系のカバレッジが 80% 以上
- [ ] 全テストが 0 failure
- [ ] `jest --coverage` で確認可能

---

### T2.12 main.ts の 4 段オーケストレータ再構築

**Description**: `src/main.ts` を pipeline の 4 段を順に呼ぶ薄いエントリに再構築する。入力取得 + setFailed による終了のみを担い、実ロジックは pipeline に委譲する。

**Files**:
- `src/main.ts` (全面書き換え)

**Code Snippet** (参考):
```typescript
const main = async () => {
  try {
    const inputs = readInputs();
    core.setSecret(JSON.stringify(inputs.gcpCredentials));
    const client = createClient(inputs.githubToken);
    const ctx = await fetchContext(client, context);
    if (shouldSkip(ctx, inputs)) return;
    const plan = planReview(ctx, inputs);
    const result = await runLLM(plan, inputs);
    await postReview(client, context, ctx.headSha, result);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
};
main();
```

**Acceptance Criteria**:
- [ ] `process.exit(1)` が消え `core.setFailed` に置換
- [ ] 入力パース + クレデンシャルマスキング (`core.setSecret`) を実施
- [ ] Draft PR 時は早期 return (FR-001, inputs.reviewDrafts=false のとき)
- [ ] ロジックが pipeline 関数呼び出しのみに簡略化

---

### T2.13 旧ファイル削除 (github.ts / system-prompt.md / node-fetch)

**Description**: 旧 `src/github.ts` と `prompts/system-prompt.md` を削除する。`package.json` から `node-fetch` / `@types/node-fetch` を削除する。

**Files**:
- `src/github.ts` (削除)
- `prompts/system-prompt.md` (削除)
- `package.json` (dependency 削除)

**Commands**:
```bash
npm uninstall node-fetch @types/node-fetch
```

**Acceptance Criteria**:
- [ ] AC-P2-09: 旧 `getPullRequestDiff` / `postCommentToGitHub` / `prompts/system-prompt.md` / プレーンテキスト経路がソースツリーから完全に消えている
- [ ] `grep -r 'node-fetch' src/` でヒットゼロ
- [ ] `grep -r 'getPullRequestDiff\|postCommentToGitHub' src/` でヒットゼロ
- [ ] `npm run build` が通る
- [ ] `npm test` が通る

---

### T2.14 action.yml 更新 + dist リビルド

**Description**: `action.yml` に新規入力 7 件を追加し、既定値 (`model` / `system-prompt-path`) を更新する。`dist/index.js` を再生成する。

**Files**:
- `action.yml` (書き換え)
- `dist/index.js` (再生成)

**Commands**:
```bash
npm run build
```

**Acceptance Criteria**:
- [ ] `max-files` / `max-comments` / `per-file-diff-limit` / `severity-threshold` / `language` / `review-drafts` / `max-output-tokens` が追加されている
- [ ] `model` の default が `gemini-2.5-pro`
- [ ] `system-prompt-path` の default 参照先が `prompts/pr-review/system.ja.md`
- [ ] `language: en` 指定時に `core.warning("english prompt is not implemented, falling back to ja")` 相当のログが出力され、`prompts/pr-review/system.ja.md` が使われる (FR-022 / DL-04 / requirements.md §8.1)
- [ ] `dist/index.js` が再生成され、本リポの実 PR で動作する (E2E)
- [ ] AC-P2-01 〜 AC-P2-07, AC-P2-10 が全て満たされる (E2E 検証)

---

## Phase 3: 運用強化

### T3.1 housekeeping の upsert 拡張機能追加

**Description**: T2.10 で実装した `housekeeping.upsertSummaryComment` の基本版（create / update の出し分けのみ）に、Phase 3 の拡張機能を追加する。具体的には (a) `<!-- ai-review-count=N -->` 隠しメタのパースと `+1` インクリメント、(b) `updateComment` が 404/422 を返した場合の `createComment` フォールバック、(c) R-06 並列実行衝突時の `core.warning` ログ出力。

**Files**:
- `src/pipeline/housekeeping.ts` (追記・拡張)

**Acceptance Criteria**:
- [ ] 初回実行時は `createComment(count=1)` （T2.10 で既に実装済の挙動）
- [ ] 2 回目実行時は `updateComment(count=2)` （`<!-- ai-review-count -->` を `+1` インクリメント）
- [ ] `updateComment` が 404/422 を返した場合 `createComment` にフォールバック
- [ ] R-06 の並列衝突ログが `core.warning` で出力
- [ ] `parseReviewCount` / `incrementReviewCount` の純粋関数が単体テストされている
- [ ] **対応 AC**: AC-P3-01（2 回目実行で自 bot inline が重複せず、Summary が `updateComment` で置換され `<!-- ai-review-count=N -->` が `+1` される）

---

### T3.2 housekeeping の冪等性テスト追加

**Description**: T2.10 で作成した基本版 `tests/pipeline/housekeeping.test.ts`(新規 / 更新 / inline 削除 の 3 ケース)に、Phase 3 の拡張機能テスト(count+1 / `updateComment` 404-422 時の `createComment` フォールバック / 並列衝突時の `core.warning`)を追記し、2 回連続実行の冪等性を検証する。

**Files**:
- `tests/pipeline/housekeeping.test.ts` (拡張 / T2.10 で基本版作成済)

**Commands**:
```bash
npm test -- tests/pipeline/housekeeping
```

**Acceptance Criteria**:
- [ ] 初回 create / 2 回目 update / count+1 / 並列衝突 fallback の 4 ケース以上
- [ ] 全テスト 0 failure
- [ ] AC-P3-01 の前段として機能

---

### T3.3 stats.tokensUsed の Summary 表示

**Description**: LLM 呼び出し結果から取れる使用トークン数を `ReviewResult.stats.tokensUsed` に格納し、`renderIssueSummary` で Summary フッタに表示する。

**Files**:
- `src/vertexai/gemini.ts` (usageMetadata から取得)
- `src/vertexai/claude.ts` (usage から取得)
- `src/renderer/issueSummary.ts` (フッタ表示)

**Acceptance Criteria**:
- [ ] Gemini `response.usageMetadata.totalTokenCount` を `stats.tokensUsed` に格納
- [ ] Claude `response.usage.input_tokens + output_tokens` を `stats.tokensUsed` に格納
- [ ] Summary フッタの `<sub>` 内に `tokens: N` が表示される
- [ ] `tokensUsed` が undefined なら表示を省略 (renderer 側の分岐)
- [ ] **対応 AC**: AC-P3-03 の前半（`stats.tokensUsed` がサマリフッタに表示される）

---

### T3.4 観測性ログの追加

**Description**: `core.info` でフェーズごとの所要時間と件数をログ出力する (NFR-004)。

**Files**:
- `src/pipeline/*.ts` (各 pipeline に log 追加)
- `src/main.ts` (totalDuration ログ)

**Acceptance Criteria**:
- [ ] `fetchContext` 完了時に `files: N, totalSize: N bytes, duration: Nms`
- [ ] `runLLM` 完了時に `comments: N, snapped: N, dropped: N, duration: Nms`
- [ ] `postReview` 完了時に `reviewId: N, summaryCommentId: N, duration: Nms`
- [ ] main 完了時に `total duration: Nms`
- [ ] シークレットは一切ログに出ない
- [ ] **対応 AC**: AC-P3-03 の後半（各フェーズの所要時間が `core.info` でログ出力される、NFR-004）

---

### T3.5 README.md / README.ja.md の全面書き換え

**Description**: README を構造化レビュー方式前提に書き換える。旧「単一 Issue コメント投稿」の記載を完全に削除。新入力を全て記載。`concurrency:` での並列化抑制を推奨 (R-06 対策)。

**Files**:
- `README.md` (全面書き換え)
- `README.ja.md` (全面書き換え)

**Acceptance Criteria**:
- [ ] AC-P3-02: 旧「単一 Issue コメント投稿」の記載が残っていない
- [ ] 新入力 7 件の説明が全て存在
- [ ] Decision Log (DL-01 ~ DL-08) の要点が「挙動」節に反映
- [ ] サンプル YAML に `concurrency:` の例が含まれる
- [ ] カスタムプロンプト使用時の `ReviewResult` JSON スキーマ必須制約を明記

---

### T3.6 E2E 冪等性検証

**Description**: 本リポの実 PR に対し Action を 2 回連続実行し、冪等性を検証する。

**Files**:
- `.github/workflows/*.yml` （既存の Action 起動ワークフローを利用、変更なし）
- 本リポ内の実 PR（検証対象として使用、ファイル変更は発生しない）
- `docs/specs/structured-pr-review/reviews/e2e-verification-YYYY-MM-DD.md` （検証結果レポートを新規作成）

**Commands**:
```bash
# GitHub Actions 上で手動 re-run x2
gh run list --workflow="<workflow name>" --limit 5
gh run rerun <run-id>
```

**Acceptance Criteria**:
- [ ] AC-P3-01: 2 回目実行で自 bot inline が重複しない
- [ ] AI Review Summary コメントが `updateComment` で置換されている
- [ ] `<!-- ai-review-count -->` が `1 → 2` に更新されている
- [ ] PR 本文 (Description) が実行前後で完全一致 (DL-02, AC-P2-10)
- [ ] 検証結果が `docs/specs/structured-pr-review/reviews/e2e-verification-YYYY-MM-DD.md` に記録されている

---

### T3.7 dist サイズ検証 + 最終リビルド

**Description**: `dist/index.js` のサイズが 6MB 以内であることを確認し、Phase 3 の全変更を反映した最終ビルドを行う。

**Files**:
- `dist/index.js` （`npm run build` により再生成）
- `dist/licenses.txt` （ncc が生成する場合は追従）
- `package.json` / `package-lock.json` （依存整合性確認のみ、変更なし）

**Commands**:
```bash
npm run build
ls -lh dist/index.js
npm test
npm run lint
```

**Acceptance Criteria**:
- [ ] AC-P3-04: `dist/index.js` のサイズが 6MB 以内 (NFR-007)
- [ ] `npm test` が 0 failure
- [ ] `npm run lint` が 0 error
- [ ] `dist/index.js` が Phase 3 の全変更を反映している（ハウスキーピング本実装 / tokensUsed 表示 / 観測性ログ）

---

### T3.8 v2 タグ切り + Marketplace 更新

**Description**: `v2` タグを手動で切り、GitHub Marketplace の掲載情報を更新する。

**Files**:
- `README.md` / `README.ja.md` （Marketplace 掲載文面の最終確認、必要に応じ微調整）
- `CHANGELOG.md` （新規作成または追記、破壊的変更を明記）
- `package.json` の `version` フィールド（`2.0.0` に更新）
- Git tag `v2`（ローカル + origin）

**Commands**:
```bash
git tag v2
git push origin v2
gh release create v2 --title "v2.0.0 Structured PR Review" --notes-file CHANGELOG.md
gh issue close 3 --comment "Phase 3 完了"
```

**Acceptance Criteria**:
- [ ] AC-P3-04: `v2` タグが存在
- [ ] GitHub Marketplace の README が Phase 3 版で更新されている
- [ ] CHANGELOG or Release Notes に破壊的変更 (後方互換なし) が明記されている
- [ ] `package.json` の `version` が `2.0.0` に更新されている
- [ ] Issue #3 を Close

---

## Completion Checklist

### Phase 1 完了条件
- [ ] T1.1 ~ T1.8 全ての Acceptance Criteria が満たされている
- [ ] AC-P1-01 ~ AC-P1-04 全てが満たされている (`requirements.md#11.1`)
- [ ] `npm test` が 0 failure
- [ ] `position.ts` のカバレッジが 90% 以上
- [ ] Phase 1 PR がマージされている

### Phase 2 完了条件
- [ ] T2.1 ~ T2.14 全ての Acceptance Criteria が満たされている
- [ ] AC-P2-01 ~ AC-P2-10 全てが満たされている (`requirements.md#11.2`)
- [ ] 本リポの実 PR で inline + Review body ミニ + Summary Issue コメントが投稿される
- [ ] renderer カバレッジ 80% 以上
- [ ] 旧 `getPullRequestDiff` / `postCommentToGitHub` / `prompts/system-prompt.md` / `node-fetch` が完全撤去
- [ ] Phase 2 PR がマージされている

### Phase 3 完了条件
- [ ] T3.1 ~ T3.8 全ての Acceptance Criteria が満たされている
- [ ] AC-P3-01 ~ AC-P3-04 全てが満たされている (`requirements.md#11.3`)
- [ ] 2 回連続実行で冪等性が検証されている
- [ ] `dist/index.js` が 6MB 以内
- [ ] `v2` タグが push され、Issue #3 が Close されている
