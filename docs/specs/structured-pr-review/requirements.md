# 構造化 PR レビュー要件定義

| 項目 | 値 |
| --- | --- |
| ドキュメント種別 | Requirements (Phase: Spec) |
| 対象 | `vertex-api-pr-review` GitHub Action |
| 参考 PR | [overflow-tm/hr-magazine#208](https://github.com/overflow-tm/hr-magazine/pull/208) |
| 作成日 | 2026-04-11 |

---

## 1. 背景と目的

### 1.1 背景
現行 `vertex-api-pr-review` は Vertex AI (Gemini / Claude) に PR 差分を渡し、**単一の Issue コメント** としてレビュー結果を投稿する最小構成の GitHub Action である（`src/main.ts` / `src/github.ts#postCommentToGitHub`）。レビュー本文は人間向け Markdown で生成され、行ピン留め・優先度・committable suggestion などの GitHub ネイティブ機能を一切使っていない。

一方、参考 PR（`overflow-tm/hr-magazine#208`）で観測された商用 AI コードレビューサービスは以下を満たす高機能なレビュー体験を提供している。

- ファイル:行ピン留めの **Pull Request Review** として投稿される
- P0 / P1 / P2 / P3 の **優先度表示**
- **GitHub の `suggestion` コードブロック** によるワンクリック反映
- 各コメントに **Prompt To Fix With AI** details
- PR 全体に対する **AI Review Summary**(Confidence Score・Important Files Changed・Mermaid 図)

### 1.2 目的
本アクションを参考 PR と同等にリッチなレビュー体験（インライン + サマリ + suggestion + AI プロンプト連携）に拡張する。**後方互換は考慮しない**。現行の「単一 Issue コメント投稿」経路は撤去し、構造化レビュー方式に一本化する（メジャーバージョンを更新する破壊的リリースとして扱う）。

### 1.3 スコープ
- IN: レビュー投稿経路の全面刷新（構造化レビュー方式への一本化）、LLM 出力の構造化、GitHub Review API の利用、プロンプトの再設計、受け入れ基準
- OUT: 独自 GitHub App 化、商用サービスの有償機能の完全再現（Mermaid 図は best-effort）、多言語 UI の LLM ファインチューニング、レガシーモードの維持

---

## 2. 用語定義

| 用語 | 意味 |
| --- | --- |
| **Review（PR Review）** | GitHub の `POST /repos/{o}/{r}/pulls/{n}/reviews` で作られるレビューオブジェクト。複数の inline comment を 1 リクエストで束ねて投稿できる |
| **inline comment** | ファイル:行に紐付くレビューコメント。`line` / `side=RIGHT` / `commit_id` で位置指定 |
| **committable suggestion** | `\u0060\u0060\u0060suggestion` コードブロック。GitHub UI 上で "Commit suggestion" ボタンが出現する |
| **AI Review Summary** | Issue コメントとして投下する PR 全体のサマリ本文。`<!-- ai-review-summary -->` / `<!-- /ai-review-summary -->` マーカーで再実行時に upsert する |
| **Review body mini summary** | `pulls.createReview` の `body` 引数に乗せる短縮サマリ（Confidence Score と件数サマリ 1〜2 行） |
| **severity / priority** | `P0 > P1 > P2 > P3` の 4 段階。P0 がマージ阻止、P3 が nit |
| **ReviewResult** | LLM から返る正規化済み構造体（`summary` + `comments[]` + `stats`） |

---

## 3. 現状分析（棚卸しサマリ）

### 3.1 現行データフロー
1. `@actions/core` で入力 8 項目を取得
2. `context.payload.pull_request` から PR 番号と owner/repo を取得
3. `getPullRequestDiff` が `node-fetch` で unified diff を取得（`Accept: application/vnd.github.v3.diff`）
4. diff サイズが `diff-size-limit` を超えたらスキップ通知（Issue コメント）で終了
5. `prompts/system-prompt.md` を `readFileSync` で同期読み込み
6. `vertexai/index.ts` が model 名に `claude` が含まれるかで Gemini / Claude を振り分け
7. Gemini: `generateContent` のプレーンテキスト返却
8. Claude: `messages.create`（`max_tokens:4096` 固定）のプレーンテキスト返却
9. `postCommentToGitHub` が `POST /issues/{n}/comments` で **単一 Issue コメント**を投下
10. 合計 API コール: GitHub × 2 + LLM × 1

### 3.2 主要な拡張ポイント
- `src/main.ts` を `fetchContext → planReview → runLLM → postReview` の 4 段オーケストレータに分解（🔴大）
- `src/github.ts` を `@actions/github` 内蔵 octokit に全置換（🔴大、追加依存ゼロ: `@actions/github@^6` は既に dependencies 済みで未 import）。`getPullRequestDiff` / `postCommentToGitHub` は撤去
- `src/vertexai/index.ts` の戻り値を `ReviewResult` 型に正規化（🔴大）。プレーンテキスト返却経路は削除
- `gemini.ts` は `responseMimeType:'application/json'` + `responseSchema` に全面差し替え（🟡中）
- `claude.ts` は `tools` + `tool_choice` で JSON 強制、`max_tokens` を入力化（🟡中）
- `prompts/system-prompt.md` は `prompts/pr-review/system.ja.md` に全面置換（🟡中）。レガシー Markdown 指示は削除
- `action.yml` に `max-files` / `max-comments` / `per-file-diff-limit` / `severity-threshold` / `language` / `review-drafts` / `max-output-tokens` を追加（🟡中）
- `tests/` ディレクトリは存在せず、実テストがゼロ → 最低限の単体テストを新設（🟡中）

### 3.3 既知の注意点
- `@actions/github@^6` は package.json に入っているが **src/ 内で一度も import されていない**ため、octokit 化に追加依存は不要
- `jest.config.js` は存在するが `tests/` ディレクトリは未作成で、CI 上でテストは実質ゼロ
- 配布物は `dist/index.js` 1 ファイル（ncc ビルド）
- `main.ts` は `process.exit(1)` を直接呼んでいる（`core.setFailed` へ変更が望ましい）

---

## 4. 参考仕様（参考 PR 観測結果）

### 4.1 参考 PR で観測された投稿方式
| 項目 | 観測結果 |
| --- | --- |
| レビュー本体 | `POST /repos/{o}/{r}/pulls/{n}/reviews`（body は空文字） |
| Review state | `COMMENTED`（P0/P1 が存在すれば `CHANGES_REQUESTED` を使う想定だが観測外） |
| commit_id | 各 Review / inline に head commit SHA を明示 |
| inline comment | `POST /repos/{o}/{r}/pulls/{n}/comments`（review の子要素）。`side=RIGHT`, `line`, 複数行時は `start_line` |
| PR サマリ | **PR 本文（Description）を直接編集** して upsert（参考 PR の観測結果） |
| 言語 | 日本語（PR 本文言語に追従） |
| 件数目安 | 1 PR あたり 1〜4 件の inline |
| 再レビュー | サマリは同一マーカー内で上書き、inline は追加投稿 |

> **本プロジェクトでの差分**: 参考 PR は PR 本文を直接編集していたが、本プロジェクトでは §10.3 DL-02 の決定により **PR 本文を一切編集しない**。サマリは (a) Review body ミニサマリ + (b) Issue コメント（マーカー upsert）の 2 箇所に分けて投稿する。

### 4.2 優先度表示（本プロジェクトの採用方式）
§10.3 DL-01 の決定により、優先度は **絵文字ベース** で表現する（外部 SVG や第三者ホスト画像は一切参照しない）。

| Priority | 表示 | 意味 |
| --- | --- | --- |
| P0 | 🔴 | critical / マージ阻止 |
| P1 | 🟠 | high / マージ前対応推奨 |
| P2 | 🟡 | medium / 可読性・保守性 |
| P3 | 🟢 | low / nit・任意 |

### 4.3 inline コメントテンプレ（本プロジェクトの構造）
```markdown
{🔴|🟠|🟡|🟢} **P{0|1|2|3}: {一文見出し}**

{現象 → 根拠 → 影響 → 推奨アクション}

```suggestion
{修正コード}
```

<details><summary>Prompt To Fix With AI</summary>

`````markdown
This is a comment left during a code review.
Path: {path}
Line: {range}

Comment:
**{見出し}**

{本文}

```suggestion
{修正コード}
```

How can I resolve this? If you propose a fix, please make it concise.
`````

</details>

<!-- ai-review-inline -->
```

### 4.4 AI Review Summary テンプレ（Issue コメントとして投下）
```markdown
<!-- ai-review-summary -->
<!-- ai-review-count=1 -->

<h3>AI Review Summary</h3>

{2〜4 文で PR 変更範囲と狙いを要約、既存レビュー指摘への対応状況}

<h3>Confidence Score: {1-5}/5</h3>

{マージ可否の一言 + 理由}
{残課題の整理（P0/P1 の有無・マージブロック要因）}
{特に注意が必要なファイル}

<h3>Important Files Changed</h3>

| Filename | Overview |
|----------|----------|
| {path} | {何が変わったか + 指摘との対応} |

<h3>Sequence Diagram</h3>

```mermaid
sequenceDiagram
    ...
```

<details><summary>Prompt To Fix All With AI</summary>

`````markdown
{全 inline コメントを `---` 区切りで結合}
`````

</details>

<sub>Reviews ({N}): Last reviewed commit: ["{commit title}"]({commit URL})</sub>

> AI Review also left **{M} inline comments** on this PR.

<!-- /ai-review-summary -->
```

**Review body ミニサマリ**（`pulls.createReview` の `body`）:
```markdown
🤖 **AI Review** — Confidence {1-5}/5 — 🔴{P0 件} 🟠{P1 件} 🟡{P2 件} 🟢{P3 件}

詳細は下部の AI Review Summary コメントを参照。
```

---

## 5. 機能要件（FR）

### 5.1 トリガー
- **FR-001 [Must] レビューイベント駆動**: `pull_request` の `opened` / `synchronize` / `reopened` を起点にレビューを実行する。Draft PR はデフォルト除外（`inputs.review-drafts: false`）。`workflow_dispatch` 手動起動は初期リリースのスコープ外とし、必要になった時点で `inputs.pull-request-number` 入力を追加して拡張する（§10.4 OQ-01）。

### 5.2 レビュー投稿
- **FR-002 [Must] Pull Request Review 単位で投稿**: `octokit.pulls.createReview` で `event: 'COMMENT'` の Review を 1 件作成し、その `comments[]` に全 inline を同梱する。Review `body` には §4.4 の **Review body ミニサマリ**（Confidence + 件数）を入れる。
- **FR-003 [Must] commit_id 明示**: `octokit.pulls.get` で取得した `head.sha` を Review と全 inline に付与する。
- **FR-004 [Must] inline line 指定**: 単行は `line`、複数行は `start_line` + `line`、`side='RIGHT'`（複数行時は `start_side='RIGHT'`）で指定する。
- **FR-005 [Must] diff 外フォールバック**: diff hunk 範囲外の行指定は GitHub API が 422 を返すため、`parsePatchToLineMap` で有効行セットを構築し、外れたコメントは (a) 最寄り有効行へスナップ、(b) それも不可能ならサマリ末尾に箇条書き退避、のいずれかで救済する。

### 5.3 inline コメント構造
- **FR-006 [Must] 優先度分類（P0–P3）**: LLM が出す `severity` を `P0 / P1 / P2 / P3` の 4 段階に正規化する。LLM への指示は §8 プロンプト要件で定義。
- **FR-007 [Must] inline 本文テンプレ**: 以下 5 パーツ + 隠しマーカーを必須構造とする。
  1. 優先度絵文字（🔴 / 🟠 / 🟡 / 🟢）+ `P{0-3}:` ラベル
  2. 一文の太字見出し
  3. 本文（現象 → 根拠 → 影響 → 推奨アクションの 4 段）
  4. `suggestion` ブロック（単一ファイル・指定 line 範囲内に収まる場合のみ）
  5. `Prompt To Fix With AI` details セクション
  6. 末尾に `<!-- ai-review-inline -->` 隠しマーカー（FR-016 ハウスキーピング用）
- **FR-008 [Must] committable suggestion の制約**: suggestion ブロックは「同一ファイル・同一 line 範囲で完結する修正」に限定する。多ファイル跨ぎや構造的リファクタは suggestion を省略し本文の説明のみとする。
- **FR-009 [Should] Prompt To Fix With AI 自動生成**: 各 inline コメント本文を元に、末尾に `How can I resolve this? If you propose a fix, please make it concise.` を付与した details セクションを機械的に生成する。生成は LLM に依頼せず、Action 側の純粋関数（`renderPromptToFixWithAI`）が担う。

### 5.4 PR サマリ
- **FR-010 [Must] サマリ二重投稿**: サマリは以下の 2 箇所に分散して投稿する。**PR 本文（Description）は一切編集しない**（§10.3 DL-02）。
  - (a) **Review body ミニサマリ**: `pulls.createReview` の `body` 引数に §4.4 のミニサマリ Markdown を埋め込む
  - (b) **AI Review Summary コメント**: `octokit.issues.createComment` で §4.4 のフルテンプレ（Important Files Changed / Mermaid / Prompt To Fix All With AI 等）を投下する。本文先頭に `<!-- ai-review-summary -->` / 末尾に `<!-- /ai-review-summary -->` マーカーを含める
- **FR-011 [Should] Confidence Score**: LLM に 1〜5 の 5 段階で自己申告させる。基準は `prompts/pr-review/system.ja.md` に定義する（P0 あり→最大 2、P1 あり→最大 3、P2 のみ→4、指摘なし→5）。
- **FR-012 [Should] Important Files Changed 表**: 変更ファイルごとに 1 行の要約を表形式で出力する（`| Filename | Overview |`）。行数は `inputs.max-files` で制限。
- **FR-013 [Could] Mermaid 図（best-effort）**: 変更の性質に応じて `sequenceDiagram` / `flowchart` を LLM に要求する。失敗（レンダー不可）時はセクションごと省略。
- **FR-014 [Should] Prompt To Fix All With AI**: 全 inline コメントを `---` 区切りで結合した 1 つの details セクションをサマリ末尾に格納する。
- **FR-015 [Should] レビュー履歴メタ情報**: サマリ末尾の `<sub>` 内に `Reviews ({N}): Last reviewed commit: [...]` を表示する。`N` は AI Review Summary コメントの先頭に埋めた `<!-- ai-review-count=N -->` 隠しメタをパースして `+1` する（§10.3 DL-03）。初回投稿時は `1`。

### 5.5 再実行・冪等性
- **FR-016 [Must] 再実行時のハウスキーピング**: 新しい Review を作成する前に、以下 2 種類の既存アーティファクトを upsert する。
  - **Inline コメント**: 自 bot（GitHub Actions）の既存 inline コメントのうち本文に `<!-- ai-review-inline -->` 隠しマーカーを含むものを `listReviewComments` → `deleteReviewComment` で一括削除する
  - **AI Review Summary コメント**: `issues.listComments` で自 bot のコメントを走査し、`<!-- ai-review-summary -->` マーカーを含むコメントが存在すれば `issues.updateComment` で本文を置換（履歴カウンタを `+1`）。存在しなければ `issues.createComment` で新規投下
- **FR-017 [Could] 将来の戦略 B（非必須）**: `{path, line, titleHash}` をキーにした stable ID 埋め込みによる差分更新は将来拡張とし、本要件では実装しない。

### 5.6 件数・サイズ制御
- **FR-018 [Must] 最大ファイル数**: `inputs.max-files`（既定 50）。超過したファイルは LLM 投入から除外し、サマリに「除外された N ファイル」として明記する。
- **FR-019 [Must] 最大 inline コメント数**: `inputs.max-comments`（既定 20）。超過分は優先度順でサマリ末尾に吸収する。
- **FR-020 [Must] 最大 diff サイズ**: `diff-size-limit`（既定 100KB）を合計上限として維持し、加えて `inputs.per-file-diff-limit`（既定 30KB）を追加する。いずれかを超えたファイルは投入から除外し、サマリに明記する。
- **FR-021 [Should] severity しきい値**: `inputs.severity-threshold`（既定 `P3`、つまり全て投稿）。`P2` 以上のみ投稿したい運用に対応する（§10.3 DL-05）。

### 5.7 多言語
- **FR-022 [Should] 言語切替**: `inputs.language`（`ja` / `en`、既定 `ja`）。プロンプト側は `{language}` プレースホルダでテンプレ切替する予定だが、**初期リリースは `ja` のみ実装**する。`en` を指定した場合は `core.warning` で警告ログを出しつつ `ja` プロンプトで動作する（§10.3 DL-04）。

### 5.8 失敗時挙動
- **FR-023 [Must] LLM 失敗時の処理**: LLM 呼び出し失敗時はエラー内容を `core.error` に記録し、`core.setFailed` でジョブを失敗させる。`process.exit(1)` は廃止する。PR コメント / Review は一切投稿しない（フォールバック投稿は行わない）。
- **FR-024 [Must] Review 作成失敗のフォールバック**: `pulls.createReview` が 422/403（inline 行指定エラー / 権限エラー）を返した場合に限り、inline 投稿は諦めて AI Review Summary コメントのみを `issues.createComment` で投下する。`core.warning` で inline 投稿失敗をログ出力し、ジョブは成功扱いとする。上記以外の GitHub API 失敗（500 系、ネットワーク断等）は NFR-009 に従って `core.setFailed` で終了する（§10.3 DL-07 参照）。

---

## 6. 非機能要件（NFR）

| ID | カテゴリ | 要件 |
| --- | --- | --- |
| **NFR-001** | パフォーマンス | 中規模 PR（変更ファイル 20・diff 50KB）で実行時間 90 秒以内を目標。Vertex AI の 1 コールあたり `timeout`（既定 120s）に収めること |
| **NFR-002** | コスト | LLM 呼び出しは原則 1 回（巨大 PR 時のみチャンク分割 2〜3 回）。GitHub API コールは 1 PR あたり 5〜10 回以内 |
| **NFR-003** | セキュリティ | シークレット（`gcp-credentials`）はログ出力禁止。`core.setSecret` で明示マスクする |
| **NFR-004** | 観測性 | `core.info` / `core.warning` で各フェーズの所要時間・投稿件数・失敗行数をログ出力する |
| **NFR-005** | テスト容易性 | `parsePatchToLineMap` / `snapCommentToValidLine` / `renderInlineComment` / `renderReviewBodyMini` / `renderIssueSummary` は純粋関数として単体テストを書けること。カバレッジ 80% 以上を Phase 2 完了時点で達成 |
| **NFR-006** | ポータビリティ | GitHub App を新設せず、`GITHUB_TOKEN` + `permissions: { pull-requests: write, contents: read }` のみで全機能を提供する |
| **NFR-007** | ビルドサイズ | `dist/index.js` は 6MB 以内。追加依存はゼロ（`@actions/github` は既存） |
| **NFR-008** | 再現性 | 同一 diff + 同一 model + 同一 seed（設定可能なら）でレビュー結果が近似すること。LLM 側の揺らぎは許容する |
| **NFR-009** | エラー耐性 | GitHub / Vertex いずれかの API 失敗時、トレーススタックをログに残した上で `core.setFailed` で終了すること。**例外**: `pulls.createReview` の 422/403（inline 行指定エラー / 権限エラー）のみは FR-024 のフォールバック経路（AI Review Summary コメントのみ投下・ジョブ成功扱い）を優先する。詳細は §10.3 DL-07 |

---

## 7. 入出力仕様

### 7.1 action.yml 入力

既存 8 項目に加え、以下を新設する。

| 入力 | 型 / 既定 | 説明 |
| --- | --- | --- |
| `max-files` | number / `50` | **新規**。LLM に渡すファイル数の上限 |
| `max-comments` | number / `20` | **新規**。投稿する inline コメントの最大数 |
| `per-file-diff-limit` | number / `30000` | **新規**。1 ファイルあたりの diff サイズ上限（bytes） |
| `severity-threshold` | `P0` \| `P1` \| `P2` \| `P3` / `P3` | **新規**。このしきい値以上の指摘のみ投稿（§10.3 DL-05） |
| `language` | `ja` \| `en` / `ja` | **新規**。初期リリースは `ja` のみ実装、`en` は将来拡張（§10.3 DL-04） |
| `review-drafts` | boolean / `false` | **新規**。Draft PR をレビュー対象にするか |
| `max-output-tokens` | number / `8192` | **新規**。LLM の `max_tokens` 相当。構造化 JSON 出力の途中切れ対策 |

既存入力（`github-token`, `gcp-project-id`, `gcp-location`, `gcp-credentials`, `model`, `system-prompt-path`, `diff-size-limit`, `timeout`）は型と名前を維持するが、以下の既定値を変更する。

- `model` の既定値: `gemini-2.5-flash` → **`gemini-2.5-pro`**（§10.3 DL-06、構造化出力の安定性を優先）
- `system-prompt-path` の既定参照先: `prompts/system-prompt.md` → **`prompts/pr-review/system.ja.md`**

`model` は構造化出力対応モデル（Gemini 1.5+ / 2.5 系、Claude 3.5 Sonnet+）に限定し README に明記する。

### 7.2 GitHub API マッピング
| ユースケース | メソッド | 備考 |
| --- | --- | --- |
| PR 基本情報 | `octokit.pulls.get` | `head.sha` 取得 |
| ファイル単位 diff | `octokit.pulls.listFiles` | 100 件/page、ページング必須 |
| Review 作成 | `octokit.pulls.createReview` | `event: 'COMMENT'`, `comments[]` に全 inline 同梱、`body` にミニサマリ |
| 既存 inline 一覧 | `octokit.pulls.listReviewComments` | ハウスキーピング用 |
| 既存 inline 削除 | `octokit.pulls.deleteReviewComment` | FR-016 |
| 既存 Issue コメント一覧 | `octokit.issues.listComments` | AI Review Summary コメントの upsert 判定用 |
| Summary コメント作成 | `octokit.issues.createComment` | FR-010(b) 初回投下 / FR-024 フォールバック |
| Summary コメント更新 | `octokit.issues.updateComment` | 再実行時の upsert（FR-016） |

### 7.3 LLM 出力 JSON スキーマ（`ReviewResult`）
```ts
type ReviewSeverity = 'P0' | 'P1' | 'P2' | 'P3';

type ReviewCategory = 'bug' | 'security' | 'perf' | 'style' | 'test' | 'docs' | 'a11y';

type ReviewComment = {
  path: string;            // 新ファイル側のパス
  line: number;            // 末尾行（新ファイル側の行番号）
  startLine?: number;      // 複数行時のみ
  side: 'RIGHT';           // 固定（本仕様では LEFT を使わない）
  severity: ReviewSeverity;
  category: ReviewCategory;
  title: string;           // 見出し（句点無しの一文）
  body: string;            // 本文 Markdown（現象→根拠→影響→推奨）
  suggestion?: string;     // committable suggestion 本体（コードのみ、fences なし）
};

type ReviewResult = {
  summary: string;               // PR 総括（2〜4 文 + 残課題）
  confidence: 1 | 2 | 3 | 4 | 5; // Confidence Score
  importantFiles: { path: string; overview: string }[];
  mermaid?: { kind: 'sequenceDiagram' | 'flowchart'; source: string };
  comments: ReviewComment[];
  stats: { filesReviewed: number; tokensUsed?: number };
};
```

- **Gemini**: `generationConfig.responseMimeType = 'application/json'` + `responseSchema` に上記を OpenAPI subset で渡す。`parts[0].text` を `JSON.parse` する。
- **Claude**: `tools: [{ name: 'submit_review', input_schema: {...} }]` + `tool_choice: { type: 'tool', name: 'submit_review' }` で tool use を強制。`content.find(c => c.type === 'tool_use').input` をそのまま返す。
- `max_tokens` は `inputs.max-output-tokens`（新規、既定 8192）で設定可能にする。現行 Claude の 4096 固定は廃止。

### 7.4 Markdown レンダリング責務分担
- **Action 側（純粋関数）**: `renderInlineComment(c: ReviewComment): string` / `renderReviewBodyMini(r: ReviewResult): string` / `renderIssueSummary(r: ReviewResult, historyCount: number): string` / `renderPromptToFixWithAI(c: ReviewComment): string`。テンプレは §4.3 / §4.4 を参照。
- **LLM 側**: 構造化フィールド（title / body / severity / suggestion）のみを返す。Markdown 装飾・優先度絵文字の差し込みは一切行わない。
- **理由**: (1) LLM の揺らぎで優先度表示や details 構造が崩れるのを防ぐ、(2) テスト容易性、(3) 多言語対応はテンプレ側で閉じる。

---

## 8. システムプロンプト方針

### 8.1 ディレクトリ構成
```
prompts/
  pr-review/
    system.ja.md       # 日本語。ReviewResult JSON を返すよう指示
    system.en.md       # 英語版（DL-04 により将来追加、初期リリースでは未作成）
```

既存の `prompts/system-prompt.md` は削除し、`inputs.system-prompt-path` 未指定時の既定参照先を **`prompts/pr-review/system.ja.md`（固定）** に切り替える。`inputs.language` は将来 `system.en.md` を追加したときの分岐に備えた予約パラメータであり、初期リリースでは §10.3 DL-04 / §5.7 FR-022 に従い `en` 指定時も `core.warning` で警告を出しつつ `ja` プロンプトにフォールバックする（`system.{language}.md` 形式での自動補間は実装しない）。カスタムプロンプトを使いたいユーザーは引き続き `system-prompt-path` を指定できるが、**出力は `ReviewResult` JSON スキーマ必須** という制約を README に明記する。

### 8.2 プロンプトに含める主要指示
1. **役割**: 経験豊富なシニアエンジニアとしてレビュー
2. **出力形式**: 上記 `ReviewResult` の JSON のみを返す（Markdown / 前後の地の文禁止）
3. **severity の判定基準**
   - P0: 本番障害・データ破損・セキュリティ脆弱性・ビルド破壊
   - P1: 型不整合・潜在バグ・エラーハンドリング欠如・リグレッション可能性
   - P2: 可読性・保守性・定数未使用・マジックナンバー・軽微なパフォーマンス
   - P3: nit・スタイル・コメント追加推奨
4. **Confidence Score の判定基準**（P0 件数と対応状況の関数）
5. **suggestion の出力ルール**: 同一ファイル内の連続した行に収まる修正のみ。複雑なリファクタは `suggestion` を省略
6. **Mermaid 生成の条件**: API 呼び出しフロー → `sequenceDiagram`、UI 状態分岐 → `flowchart`、判断が付かない場合は省略
7. **言語**: `{language}` プレースホルダ（日本語／英語）
8. **観点の優先順位**: バグ > セキュリティ > パフォーマンス > 可読性 > テスト > ドキュメント

---

## 9. 実装計画（Phase 1/2/3）

後方互換を考慮しないため、各 Phase は「新機能の積み上げ」のみを行う。既存コード（`getPullRequestDiff` / `postCommentToGitHub` / 旧 `system-prompt.md`）は Phase 2 で撤去する。

### 9.1 Phase 1 — 基盤整備
目的: octokit 化と行位置マッピングユーティリティをテスト込みで先に整備する。旧 `src/github.ts` は温存し、構造化レビュー側のラッパを **新規ディレクトリとして追加**する（旧ファイル削除は Phase 2）。

1. `src/github/client.ts` に `@actions/github` の `getOctokit` ラッパを新設
2. `src/github/pulls.ts` に `pulls.get` / `pulls.listFiles` / `pulls.createReview` / `pulls.listReviewComments` / `pulls.deleteReviewComment` の薄いラッパを追加
3. `src/github/comments.ts` に Issue コメント系 `issues.listComments` / `issues.createComment` / `issues.updateComment` の薄いラッパを追加
4. `src/github/position.ts` に `parsePatchToLineMap` / `snapCommentToValidLine` を実装
5. `tests/` ディレクトリを新設、`tests/github/position.test.ts` / `tests/github/pulls.test.ts` / `tests/github/comments.test.ts`（octokit モック）を追加
6. `src/types/review.ts` / `src/types/inputs.ts` に `ReviewResult` / `ReviewComment` / `ReviewSeverity` / `ReviewCategory` / `ActionInputs` を定義
7. `main.ts` / `vertexai/*` と旧 `src/github.ts` は未改修のままでも CI が通る状態を作る（旧ファイルの削除は Phase 2 Step 9 で実施）

**完了条件**: jest 単体テストが 0 failure。`position.ts` に対するカバレッジ 90% 以上。

### 9.2 Phase 2 — 構造化レビュー本体
目的: 構造化レビュー方式へ全面移行する（破壊的変更）。

1. `prompts/pr-review/system.ja.md` を新設（§8.2 準拠）。`prompts/system-prompt.md` を削除
2. `gemini.ts` を `responseMimeType:'application/json'` + `responseSchema` に書き換え、`ReviewResult` を返す
3. `claude.ts` を `tools` + `tool_choice` による tool use 強制に書き換え、`ReviewResult` を返す。`max_tokens` を `inputs.max-output-tokens` から受け取る
4. `vertexai/index.ts` のインタフェースを `(userDiff, ctx) => Promise<ReviewResult>` に統一。プレーンテキスト経路を削除
5. `src/renderer/` を新設: `renderInlineComment` / `renderReviewBodyMini` / `renderIssueSummary` / `renderPromptToFixWithAI` を純粋関数として実装
6. `src/main.ts` を 4 段オーケストレータ（`fetchContext → planReview → runLLM → postReview`）に再構築
   - listFiles → patch 解析 → LLM 呼び出し → `snapCommentToValidLine` で妥当性検証 → `pulls.createReview` で inline + Review body ミニサマリを一括投稿 → `issues.listComments` → `issues.updateComment` / `issues.createComment` で AI Review Summary コメントを upsert
7. `action.yml` の `model` 既定値を `gemini-2.5-pro` に更新し、§7.1 の新規入力を追加
8. 旧 `getPullRequestDiff` / `postCommentToGitHub` を呼び出している側（`main.ts`）の参照を撤去
9. **旧 `src/github.ts` ファイル本体を削除**（Phase 1 で並行追加した `src/github/{client,pulls,comments,position}.ts` に完全移行）
10. `tests/` に renderer / main のテストを追加、全体カバレッジ 80% 目標
11. `dist/index.js` をリビルド
12. README.md / README.ja.md を構造化レビュー方式前提で全面書き換え

**完了条件**: 本リポの実 PR に対して inline + Review body ミニサマリ + AI Review Summary コメント + suggestion + Prompt To Fix With AI が投稿される。旧 Issue コメント経路（`postCommentToGitHub`）は 1 箇所も残っていない。

### 9.3 Phase 3 — 運用強化
目的: 再実行耐性・観測性・ドキュメント整備。

1. 再実行ハウスキーピングの本実装: `<!-- ai-review-inline -->` 付き自 bot inline コメント削除、`<!-- ai-review-summary -->` 付き AI Review Summary コメントの upsert、`<!-- ai-review-count=N -->` 隠しメタによる履歴カウンタ更新
2. `stats.tokensUsed` をサマリフッタに追記
3. `core.info` / `core.warning` でフェーズごとの所要時間と件数をログ出力（NFR-004）
4. README に §10.3 Decision Log のトラブルシューティング情報を追記
5. メジャーバージョンタグ（`v2`）を切り、GitHub Marketplace 記載を更新

**完了条件**: 同一 PR を 2 回連続で実行しても inline が重複せず、AI Review Summary コメントが更新され履歴カウンタが `+1` される。GitHub Marketplace の README が構造化レビュー方式前提で更新されている。

---

## 10. リスクと制約・Decision Log

### 10.1 技術リスク
| ID | リスク | 影響 | 対応方針 |
| --- | --- | --- | --- |
| R-01 | **行位置マッピング失敗**（LLM が diff hunk 外を指す） | inline 投稿が 422 で全滅する可能性 | `parsePatchToLineMap` + `snapCommentToValidLine` + FR-005 フォールバック。テスト必須 |
| R-02 | **LLM 出力切れ**（Claude `max_tokens:4096` で comments 配列が途中で切れる） | JSON パース失敗 → レビュー空振り | `max_tokens` 入力化 + 既定 8192 + JSON repair（`jsonrepair` 等）または LLM 再呼び出し |
| R-03 | **GitHub rate limit** | 再実行多発リポジトリで失敗 | createReview を 1 コールに集約、ハウスキーピングは変更があるときのみ |
| R-04 | **トークン予算** | 大規模 PR で context 溢れ | `max-files` と `per-file-diff-limit` でフィルタ、超過ファイルはサマリに明記 |
| R-05 | **Mermaid レンダリング失敗** | サマリ本体が崩れる | LLM 出力をパースして `mermaid { source }` が空なら該当セクション丸ごと省略 |
| R-06 | **AI Review Summary コメントの並列 upsert 衝突** | 同一 PR に対する複数の Action ジョブが同時に updateComment を叩くと競合する | `listComments` → 最初に見つけた `<!-- ai-review-summary -->` を更新 → 失敗時は新規作成。README で `concurrency:` を使ったジョブ直列化を推奨 |
| R-07 | **suggestion ブロックの ```diff 崩れ** | Markdown がエスケープ不足 | renderer のテスト必須。`suggestion` 内の ``` は禁止 |

### 10.2 ブランド中立性の方針
- 第三者ブランド資産（外部ホストのバッジ画像・商標名）は一切参照しない。優先度表示は §10.3 DL-01 の決定により **絵文字ベース**（🔴🟠🟡🟢）とし、追加のアセット配置を必要としない
- ドキュメントやコード上でも「構造化 PR レビュー」「AI Review Summary」など中立な名称を用い、参考 PR の提供元サービス名を直接参照しない

### 10.3 Decision Log（決定済み事項）
以下は合意確認済みの決定事項。Phase 2 以降の実装はこれらを前提とする。

| ID | 項目 | 決定 | 理由 |
| --- | --- | --- | --- |
| **DL-01** | 優先度表示の実装方式 | **絵文字ベース**（🔴 P0 / 🟠 P1 / 🟡 P2 / 🟢 P3） | 外部ホスト依存ゼロ・追加アセット不要・運用最単純。第三者ブランドとの意匠衝突を避ける |
| **DL-02** | サマリの投稿先 | **Review body ミニサマリ + Issue コメント（マーカー upsert）の併用**。PR 本文 Description は一切編集しない | PR 本文への破壊的編集を避けつつ、PR 一覧ページと PR 詳細ページの両方でサマリを視認できる。ユーザー編集との競合リスクをゼロにする |
| **DL-03** | レビュー履歴カウント `N` の算出 | **`<!-- ai-review-count=N -->` 隠しメタカウンタ**。AI Review Summary コメント本文の先頭に埋め込み、upsert 時に `+1` する | パース単純・テスト容易・GitHub API コール追加不要 |
| **DL-04** | 多言語の初期対応 | **`ja` のみ実装**。`inputs.language` は仕様上存在するが `en` 指定時は警告ログを出して `ja` プロンプトで動作 | プロンプト 1 本で初期リリースまでの距離を最短化。将来 `system.en.md` を追加する余地は残す |
| **DL-05** | `severity-threshold` の既定値 | **`P3`**（全件投稿） | レビューの網羅性を優先。P3 が騒がしい場合はユーザー側で `P2` に調整可能 |
| **DL-06** | `model` の既定値 | **`gemini-2.5-pro`** | 構造化出力（`responseSchema`）の安定性と長文 JSON の整合性を優先。コスト重視の運用は `gemini-2.5-flash` へ切替可能 |
| **DL-07** | API 失敗時の扱い（FR-024 と NFR-009 の調停） | **`pulls.createReview` の 422/403 のみ FR-024 フォールバック**（inline 断念 → Summary のみ投下 → ジョブ成功）。それ以外の GitHub / Vertex API 失敗は NFR-009 に従い `core.setFailed` で即終了 | 422/403 は行ピン留め失敗・権限欠落が主因で Summary による代替救済が可能。500 系やネットワーク断はリトライ対象であり、成功扱いで握り潰すと無通知のリグレッションを招く |
| **DL-08** | housekeeping の Phase 2/3 分担 | **Phase 2 (T2.10) で `deleteOldInlineComments` と `upsertSummaryComment` の基本版（create / update の出し分け）を両方実装**。Phase 3 (T3.1) では `<!-- ai-review-count=N -->` の完全パース・`updateComment` 404/422 時のフォールバック・並列衝突時の `core.warning` 等の**拡張機能のみ追加**する | FR-010（サマリ二重投稿の防止）と FR-016（再実行時のハウスキーピング）は Phase 2 時点で Summary upsert まで機能しないと満たせない（AC-P2-03 で「Summary が Review body ミニサマリと Issue コメントの 2 箇所に投稿される」ことを要求）。一方、`<!-- ai-review-count -->` のインクリメントと衝突フォールバックは FR-015 / R-06 に対応する拡張であり、Phase 3 の運用強化フェーズで追加するのが適切 |

### 10.4 Open Issues / Deferred Decisions（未解決・先送り事項）

実装フェーズで再度判断が必要になる事項、および初期リリース後に検討する拡張事項を記録する。Decision Log（§10.3）が「合意済み決定」であるのに対し、本節は「保留・要再確認・次バージョン候補」を扱う。

| ID | 種別 | 項目 | 現時点の方針 | 判断タイミング |
| --- | --- | --- | --- | --- |
| **OQ-01** | 機能拡張 | `workflow_dispatch` 手動起動のサポート（任意 PR 番号を input で受け取る） | 初期リリースのスコープ外（FR-001）。要望が出たら `inputs.pull-request-number` を追加し、`context.payload.pull_request` が存在しない場合は `pulls.get` 経由で取得する設計に拡張する | Phase 3 リリース後、ユーザー要望が来た時点 |
| **OQ-02** | 機能拡張 | `prompts/pr-review/system.en.md` の追加（英語プロンプト本実装） | DL-04 により初期リリースは `ja` のみ。`en` 指定は `core.warning` で警告して `ja` で動作 | 別 Issue 起票後 |
| **OQ-03** | リスク対応 | Claude の `max_tokens` 入力化後も JSON が途中で切れるケースの最終手段 | R-02 の対応として `inputs.max-output-tokens` 既定 8192 + 1 回の JSON repair。それでも直らない場合のチャンク分割再呼び出しは未実装 | Phase 2 の E2E で発生を確認した時点 |
| **OQ-04** | 運用 | `v2` タグ付与と GitHub Marketplace 更新の自動化（release-please / semantic-release） | Phase 3 は手動 tag を前提。自動化するかは別 Issue 化 | Phase 3 完了後 |
| **OQ-05** | テスト | Action 本体の E2E テストを CI 化するか | PD-03 により本タスクのスコープ外。`jest` はローカル / PR CI のみで実行 | Phase 3 完了後 |

> **運用ルール**: 実装中に判断が必要になった未解決事項は本節に OQ-06 以降として追記する。解決した事項は Decision Log（§10.3）に移動する。

---

## 11. 受け入れ基準（Acceptance Criteria）

### 11.1 Phase 1 受け入れ基準
- [ ] AC-P1-01: `parsePatchToLineMap` に対するテストが 10 ケース以上存在し、全て通る（通常 hunk / 複数 hunk / 追加のみ / 削除のみ / バイナリ / 空パッチ / 行連結 / etc.）
- [ ] AC-P1-02: 旧 `src/github.ts` は Phase 1 時点ではそのまま温存し、octokit ベースのラッパ群を `src/github/client.ts` / `src/github/pulls.ts` / `src/github/comments.ts` / `src/github/position.ts` に新規追加する形で §7.2 のラッパ（`issues.listComments` / `issues.updateComment` を含む）が揃っている。旧 `src/github.ts` の削除は Phase 2 で実施する（§9.1 Phase 1 / §9.2 Phase 2 参照）
- [ ] AC-P1-03: `src/types/review.ts` に `ReviewResult` / `ReviewComment` / `ReviewSeverity` / `ReviewCategory` が定義されている
- [ ] AC-P1-04: `tests/` ディレクトリが新設され、jest が 0 failure で通る

### 11.2 Phase 2 受け入れ基準
- [ ] AC-P2-01: 本リポのサンプル PR に対し、1 回の createReview で inline コメントが複数件投稿される
- [ ] AC-P2-02: 各 inline コメントに優先度絵文字（🔴🟠🟡🟢）/ 太字見出し / 本文 / suggestion / Prompt To Fix With AI details の 5 パーツ + 末尾の `<!-- ai-review-inline -->` マーカーが含まれる
- [ ] AC-P2-03: サマリが 2 箇所に投稿される: (a) Review body にミニサマリ（Confidence + 件数）、(b) Issue コメントとして AI Review Summary フルテンプレ（`<!-- ai-review-summary -->` マーカー付き）
- [ ] AC-P2-04: LLM が diff hunk 外の行を返したケースで、inline 投稿が 422 で落ちず FR-005 フォールバックが発動する
- [ ] AC-P2-05: `max-comments` を超える指摘は優先度順にサマリへ吸収される
- [ ] AC-P2-06: `severity-threshold: P2` 指定で P3 指摘が投稿されない
- [ ] AC-P2-07: Gemini / Claude の両方で `ReviewResult` が同じ構造にパースされる
- [ ] AC-P2-08: renderer 系関数のカバレッジが 80% 以上
- [ ] AC-P2-09: 旧 `getPullRequestDiff` / `postCommentToGitHub` / `prompts/system-prompt.md` / プレーンテキスト経路がソースツリーから完全に消えている
- [ ] AC-P2-10: PR 本文（Description）が実行前後で一切変更されない（DL-02 検証）

### 11.3 Phase 3 受け入れ基準
- [ ] AC-P3-01: 同一 PR への 2 回目の実行で、過去の自 bot inline コメントが削除され二重投稿しない。AI Review Summary コメントは `updateComment` で置換され、`<!-- ai-review-count=N -->` が `+1` されている
- [ ] AC-P3-02: README.md / README.ja.md が構造化レビュー方式前提で書き換わっている（旧「単一 Issue コメント投稿」の記載が残っていない）
- [ ] AC-P3-03: `stats.tokensUsed` がサマリフッタに表示され、各フェーズの所要時間が `core.info` でログ出力される
- [ ] AC-P3-04: `v2` タグが切られ、`dist/index.js` が 6MB 以内

---

## 12. 参考資料

- 参考 PR: https://github.com/overflow-tm/hr-magazine/pull/208（商用 AI コードレビューサービスの出力例）
- GitHub REST API — Reviews: https://docs.github.com/en/rest/pulls/reviews
- GitHub REST API — Review Comments: https://docs.github.com/en/rest/pulls/comments
- GitHub REST API — Issue Comments: https://docs.github.com/en/rest/issues/comments
- Vertex AI Generative AI — Responses (Gemini `responseSchema`): Google Cloud 公式ドキュメント
- Anthropic Claude on Vertex AI — Tool Use: Anthropic 公式ドキュメント
- 現行ソース: `src/main.ts`, `src/github.ts`, `src/vertexai/{index,gemini,claude}.ts`, `prompts/system-prompt.md`, `action.yml`

---

## 付録 A: FR サマリ一覧

| ID | Priority | 要件 |
| --- | --- | --- |
| FR-001 | Must | レビューイベント駆動（`pull_request` の opened/synchronize/reopened、Draft 除外） |
| FR-002 | Must | `pulls.createReview` で Review 単位投稿（body にミニサマリ） |
| FR-003 | Must | commit_id 明示 |
| FR-004 | Must | inline line / side / start_line 指定 |
| FR-005 | Must | diff 外行のスナップ / サマリ退避フォールバック |
| FR-006 | Must | 優先度 P0–P3 正規化 |
| FR-007 | Must | inline 本文 5 パーツ + `<!-- ai-review-inline -->` マーカー |
| FR-008 | Must | committable suggestion の制約 |
| FR-009 | Should | Prompt To Fix With AI 機械生成 |
| FR-010 | Must | サマリ二重投稿（Review body ミニ + Issue コメントフル） |
| FR-011 | Should | Confidence Score 1–5 |
| FR-012 | Should | Important Files Changed 表 |
| FR-013 | Could | Mermaid 図（best-effort） |
| FR-014 | Should | Prompt To Fix All With AI |
| FR-015 | Should | `<!-- ai-review-count=N -->` 隠しメタによる履歴カウント |
| FR-016 | Must | 再実行時のハウスキーピング（inline 削除 + Summary upsert） |
| FR-017 | Could | 戦略 B（stable ID 差分更新）は将来拡張 |
| FR-018 | Must | `max-files` 上限 |
| FR-019 | Must | `max-comments` 上限 |
| FR-020 | Must | `per-file-diff-limit` 導入 |
| FR-021 | Should | `severity-threshold` 導入（既定 P3） |
| FR-022 | Should | `language` 切替（初期は `ja` のみ実装） |
| FR-023 | Must | LLM 失敗時は setFailed（フォールバック投稿なし） |
| FR-024 | Must | Review 作成失敗時は AI Review Summary コメントのみ投稿に退避 |
