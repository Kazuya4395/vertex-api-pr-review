# SDD Review: structured-pr-review

**対象ドキュメント**:
- `docs/specs/structured-pr-review/requirements.md` (= 1-spec.md 相当)
- `docs/specs/structured-pr-review/2-plan.md`
- `docs/specs/structured-pr-review/3-tasks.md`

**Reviewer**: Automated (reviewing-sdd-docs skill)
**Model**:
- Primary (Codex CLI): GPT-5 Codex
- Supplementary (Claude Code): claude-opus-4-6

**Date**: 2026-04-11
**Status**: Revise

---

## 1. Review Scope

| ドキュメント | 存在 | レビュー |
| --- | --- | --- |
| `1-spec.md` (requirements.md) | Yes | Yes |
| `2-plan.md` | Yes | Yes |
| `3-tasks.md` | Yes | Yes |

---

## 2. 問題点

### 重大

> ドキュメントの目的を損なう、構造的な欠陥・矛盾

| # | ドキュメント | Category | Source | Description |
| --- | --- | --- | --- | --- |
| 1 | 1-spec / 2-plan / 3-tasks | Consistency | Codex | **`src/github.ts` の扱いが 3 ドキュメント間で矛盾**。`requirements.md` AC-P1-02 と §9.1 Phase 1 Step 1 は「`src/github.ts` を `@actions/github` の `getOctokit` ベースに書き換える」と記述しているが、`2-plan.md` §1.2 / §9 と `3-tasks.md` T1.2〜T1.4 は `src/github/{client,pulls,comments}.ts` に**分割**し、旧 `src/github.ts` は Phase 2 (T2.13) で**削除**する設計になっている。Phase 1 完了時点でどちらの構造が正なのかが決まらず、実装者が判断不能。 |
| 2 | 1-spec | Consistency | Codex | **`createReview` 失敗時の挙動が FR-024 と NFR-009 で矛盾**。FR-024 は「`createReview` が 422/403 を返した場合、inline は諦めて AI Review Summary コメントのみを投下し、ジョブは成功扱いとする」。一方 NFR-009 は「GitHub / Vertex いずれかの API 失敗時、トレーススタックをログに残した上で `core.setFailed` で終了する」と規定している。同一事象(GitHub API 失敗)に対して「成功扱い」と「setFailed 終了」という逆の方針が書かれており、実装者が判断不能。 |
| 3 | 2-plan | Consistency | Codex | **§1.3 データフロー例で `createReview` に渡す `comments` の型が §3.3 のシグネチャと矛盾**。§1.3 の擬似コードは `comments: result.comments.map(renderInlineComment)` と書かれており `renderInlineComment` は `string` を返すため、結果として `string[]` を渡す形になっている。しかし §3.3 の `createReview` シグネチャは `{ path, line, start_line?, side, body }[]` を要求する。§1.3 の例はミスリーディングで、実装者が誤った形で pipeline を組む可能性がある。 |
| 4 | 2-plan / 3-tasks | Consistency | Codex | **`listReviewComments` / `deleteReviewComment` の配置が plan と tasks で矛盾**。`2-plan.md` §1.2 Component Diagram では `src/github/comments.ts` が「inline/issue コメントの crud」を担当すると書かれているが、`3-tasks.md` T1.3 はこの 2 関数を **`src/github/pulls.ts`** に置き、T1.4 は `comments.ts` を「Issue コメント系のみ」に限定している。実装時にどちらのファイルに置くべきかが決められない。 |

### 改善推奨

> 品質向上のための修正

| # | ドキュメント | Category | Source | Description |
| --- | --- | --- | --- | --- |
| 5 | 1-spec | Quality | Codex | **FR の優先度分類がない**。FR-001〜FR-024 は ID のみで Must/Should/Could の分類を持たない。severity P0〜P3 は runtime 出力の優先度であり、要件自体の優先度ではない。実装時のトレードオフ判断(どれが削減可能でどれが必須か)が付かない。`Priority` 列を追加するか、FR をカテゴリ別にブロック化することを推奨。 |
| 6 | 1-spec | Structure | Codex | **Decision Log はあるが Open Issues / 未解決項目セクションがない**。§10.3 の Decision Log は解決済み事項のみ。実装フェーズで発生する未解決の質問・前提確認・保留事項を記録する専用セクション(例: §10.4 Open Questions)がなく、不明点を追記する場所がない。`2-plan.md` §11 Open Questions はあるので、spec 側にも同等の欄を持たせると整合する。 |
| 7 | 3-tasks | Consistency | Codex | **個別タスクの AC が `AC-Px-xx` にリンクされていない**。末尾の Completion Checklist は `AC-P1-01〜AC-P1-04 / AC-P2-01〜AC-P2-10 / AC-P3-01〜AC-P3-04` を全て参照するが、T2.1/T2.2/T2.6/T2.7/T3.1/T3.3/T3.4 などの個別タスクはローカルな AC 箇条書きのみで、どの `AC-Px-xx` を満たすものかが書かれていない。タスク単位の完了判定と spec 側の AC の traceability が弱い。 |
| 8 | 3-tasks | Structure | Codex | **T3.6 / T3.7 / T3.8 に `Files` セクションが欠如**。テンプレ仕様では各タスクに Description / Files / Acceptance Criteria を揃えることが求められているが、T3.6 (E2E 検証) / T3.7 (dist サイズ検証) / T3.8 (v2 タグ + Marketplace 更新) は Files 欄が丸ごと抜けている。運用・検証系タスクでも `dist/index.js` / `README.md` / `CHANGELOG.md` 等の影響ファイルは記載可能。 |
| 9 | 1-spec / 2-plan / 3-tasks | Coverage | Claude | **FR-001 の `workflow_dispatch` トリガーが plan / tasks に出てこない**。`requirements.md` FR-001 は「`pull_request` の `opened` / `synchronize` / `reopened` **および `workflow_dispatch`** を起点にレビュー」と規定しているが、`2-plan.md` / `3-tasks.md` は `pull_request` コンテキスト前提で書かれており、`workflow_dispatch` 時の動作(対象 PR 番号の取得方法、必須 input の定義)が設計・実装計画のどこにも出てこない。spec から削除するか、plan に `inputs.pull-request-number` 等の手動起動用入力を追加すべき。 |
| 10 | 3-tasks | Quality | Claude | **T1.7 の Acceptance Criteria が実行不能になる可能性**。T1.7 は「Jest テスト基盤整備」で AC に `npm test が 0 failure で通る` と書かれているが、この時点では T1.8 のテスト実装前なのでテストファイル 0 件となり、Jest はデフォルトで `exit 1` (No tests found) する。`jest --passWithNoTests` オプションを指定するか、T1.7 と T1.8 を単一タスクに統合するか、T1.7 の AC を「`npm test` がテスト 0 件の場合を許容する設定になっている」に変更すべき。 |
| 11 | 2-plan | Quality | Claude | **`LineMap.hunks` フィールドが dead field の可能性**。§3.4 で `LineMap = { validLines: Set<number>; hunks: { start: number; end: number }[] }` と定義されているが、`snapCommentToValidLine` の疑似コードは `validLines` のみ参照しており、`hunks` がどこで使われるか明記されていない。不要なら削除、必要なら利用箇所を明記すべき。 |
| 12 | 2-plan | Clarity | Claude | **§9.2 Modified Files に無意味なメタ記述**。`package.json` 行の Change 欄に `node-fetch / @types/node-fetch 削除、version: 2.0.0 → 2.0.0 は既に 2.0.0 なので維持` と書かれている。後半の自己言及的な記述は読み手を混乱させる。「`node-fetch` / `@types/node-fetch` 削除」のみに簡潔化すべき。 |

---

## 3. 整合性チェック結果

### spec ↔ plan 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | 全 FR が plan で対応されている | **NG** | FR-001 の `workflow_dispatch` トリガーが plan に不在 (#9)。FR-024 と NFR-009 の内部矛盾 (#2) により、plan 側でどちらを実装すべきか確定できない |
| 2 | 技術選定が NFR を満たす | OK | 追加依存ゼロ (NFR-007)、octokit + `GITHUB_TOKEN` のみ (NFR-006)、renderer 純粋関数 (NFR-005)、dist 6MB (NFR-007) が plan §2/§6 で対応 |
| 3 | Scope(Out) の内容が plan に紛れていない | OK | 独自 GitHub App 化・多言語 UI FT・商用サービス完全再現・レガシーモード維持はいずれも plan に出現しない |

### plan ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | File Changes がタスクとして網羅されている | **NG** | `listReviewComments`/`deleteReviewComment` の配置が plan (comments.ts) と tasks (T1.3 pulls.ts) で矛盾 (#4) |
| 2 | Testing Strategy が Phase 3 に反映されている | OK (設計上 Phase 1/2 配置) | このプロジェクトはユニットテストを Phase 1 (T1.8) / Phase 2 (T2.11) に配置し、Phase 3 は housekeeping テスト (T3.2) と E2E (T3.6) のみ。plan §6 と一致 |
| 3 | Architecture の Setup が Phase 1 に含まれている | OK | types / github/\* / position / tests 基盤が T1.1〜T1.8 で整う |

### spec ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | Acceptance Criteria が Completion Checklist に含まれている | OK | 3-tasks.md 末尾 Completion Checklist で AC-P1-01〜AC-P3-04 を全て参照している |
| 2 | 全要件がいずれかのタスクでカバーされている | **NG** | AC-P1-02 が tasks T1.2〜T1.4 の分割方針と矛盾 (#1)。FR-001 の `workflow_dispatch` が未カバー (#9) |

---

## 4. Verdict

**判定**: **Revise**

**コメント**:
ドキュメント 3 点とも分量・詳細度は高く、アーキテクチャ・Decision Log・Rollout Plan 等の基本構造は揃っている。一方で、**spec / plan / tasks の 3 ドキュメント間で 4 件の重大な矛盾**(#1〜#4)が検出された。特に #1 (`src/github.ts` の扱い) と #2 (FR-024 vs NFR-009) は実装開始時に必ず判断に迷うポイントであり、放置したまま Phase 1 に着手すると実装側が独断で解釈を固定する → レビュー時の手戻りに直結する。

構造的欠陥ではなく、いずれも記述の補正で解消可能なため **Redesign ではなく Revise** とする。上記 4 件の重大矛盾を解消し、余力があれば改善推奨 #5〜#12 も反映した上で再レビューすることを推奨する。

**次のアクション**:
- [ ] **#1 解消**: requirements.md AC-P1-02 と §9.1 Phase 1 Step 1 の文言を `src/github/{client,pulls,comments,position}.ts` に分割する方針に書き換え、旧 `src/github.ts` の扱いを「Phase 2 で削除」と明記する
- [ ] **#2 解消**: FR-024 を優先し NFR-009 から「GitHub API 失敗時は必ず setFailed」を削除、または NFR-009 を「`createReview` の 422/403 以外の GitHub API 失敗時は setFailed」と条件付けする。どちらの方針にするかを Decision Log (DL-07) として追記
- [ ] **#3 解消**: 2-plan.md §1.3 の擬似コードを `comments: result.comments.map(c => ({ path: c.path, line: c.line, start_line: c.startLine, side: c.side, body: renderInlineComment(c) }))` のようにオブジェクト化、または単に「※ 各 comment は §3.3 のシグネチャに従い整形する」と補足
- [ ] **#4 解消**: `listReviewComments` / `deleteReviewComment` の配置を plan と tasks で統一。推奨は **`pulls.ts`** (pulls API 経由の呼び出しだから)。plan §1.2 Component Diagram と §3.3 のコメントを修正
- [ ] **#9 解消**: FR-001 から `workflow_dispatch` を削除するか、plan に `inputs.pull-request-number` を追加して手動起動フローを定義
- [ ] **#10 解消**: T1.7 を T1.8 に統合するか、`jest --passWithNoTests` を AC に追記
- [ ] 改善推奨 #5〜#8, #11, #12 の反映(任意、再レビュー時に一緒にチェック)
- [ ] 修正後に `reviewing-sdd-docs` スキルで再レビュー
