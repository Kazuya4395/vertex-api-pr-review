# SDD Review: structured-pr-review (Re-review #2)

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
**Previous Review**: [sdd-review-2026-04-11.md](./sdd-review-2026-04-11.md) (12 findings)

---

## 0. 前回 findings の解消状況

| # | 前回指摘 | 解消 | 確認箇所 |
| --- | --- | --- | --- |
| 1 | `src/github.ts` の 3 ドキュメント間矛盾 | ✅ | requirements.md AC-P1-02 / §9.1 / §9.2 Phase 2 Step 9 が「Phase 1 新規追加 + Phase 2 削除」に統一 |
| 2 | FR-024 と NFR-009 の矛盾 | ✅ | FR-024 が「422/403 のみ」、NFR-009 に例外条項追加、DL-07 で調停 |
| 3 | §1.3 `createReview` comments 型の矛盾 | ✅ | 2-plan.md §1.3 が `{ path, line, start_line, side, body }` 形式のオブジェクトマッピングに修正 |
| 4 | `listReviewComments` / `deleteReviewComment` 配置矛盾 | ⚠️ **部分解消** | §1.2 Component Diagram / §3.3 API Design は pulls.ts に統一済み。ただし **§9.2 File Changes table (L498) の comments.ts 説明が未修正**（新 finding #1） |
| 5 | FR の Must/Should/Could 優先度分類 | ✅ | FR-001〜FR-024 全てに `[Must]/[Should]/[Could]` を付与、付録 A に Priority 列追加 |
| 6 | Open Issues セクション不在 | ✅ | §10.4 Open Issues に OQ-01〜OQ-05 を新設 |
| 7 | T2.x / T3.x の AC リンク欠如 | ✅ | T2.1 / T2.2 / T2.6 / T2.7 / T3.1 / T3.3 / T3.4 全てに `**対応 AC**: AC-Px-xx` を追記 |
| 8 | T3.6 / T3.7 / T3.8 の Files 欄欠如 | ✅ | 3 タスクとも Files セクション追加 |
| 9 | FR-001 の `workflow_dispatch` が plan/tasks に不在 | ✅ | FR-001 から削除し OQ-01 へ移送 |
| 10 | T1.7 が 0 テストで Jest exit 1 になる | ✅ | `passWithNoTests: true` を AC と Files に明記 |
| 11 | `LineMap.hunks` dead field | ⚠️ **部分解消** | 2-plan.md §3.4 からは削除済み。ただし **3-tasks.md T1.5 Code Snippet (L107-118) にまだ残存**（新 finding #2） |
| 12 | §9.2 package.json の無意味メタ記述 | ✅ | 「`node-fetch` / `@types/node-fetch` 削除」のみに簡潔化 |

**サマリ**: 12 件中 10 件は完全解消、2 件（#4 / #11）が部分解消で別箇所に未修正が残存。

---

## 1. Review Scope

| ドキュメント | 存在 | レビュー |
| --- | --- | --- |
| `1-spec.md` (requirements.md) | Yes | Yes |
| `2-plan.md` | Yes | Yes |
| `3-tasks.md` | Yes | Yes |

---

## 2. 問題点 (新規検出)

### 重大

> ドキュメントの目的を損なう、構造的な欠陥・矛盾

| # | ドキュメント | Category | Source | Description | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | 3-tasks | Consistency | Codex | **T2.10 Phase 2 housekeeping のスコープが Description と AC で矛盾**。Description は `housekeeping は Phase 2 では雛形 (delete only) のみ、upsert 完全版は Phase 3 へ` と書かれているが、同タスクの AC では `postReview` が `housekeeping.upsertSummaryComment` を呼ぶこと（L391）および `createReview` 422/403 時の summary フォールバック（L394, FR-024）が必須とされている。「delete only」と「upsert 必須」が同一タスク内で両立せず、実装者は upsert を Phase 2 に含めるべきか Phase 3 に回すべきか判断できない。AC-P2-01（§10.4 Completion Checklist）の `postReview が delete → createReview → upsert の順で動く` とも整合しない。 | 0.94 |

### 改善推奨

> 品質向上のための修正

| # | ドキュメント | Category | Source | Description | Confidence |
| --- | --- | --- | --- | --- | --- |
| 2 | 2-plan | Consistency | Codex | **2-plan.md §9.2 File Changes table L498 の `comments.ts` 責務が §1.2 / §3.3 と不整合**。§1.2 Component Diagram と §3.3 API Design では `comments.ts` が「Issue コメント系 crud のみ」に修正済みだが、§9.2 New Files の表だけ `inline/issue コメントラッパ` のまま残っている。前回 finding #4 の修正漏れ。 | 0.96 |
| 3 | 3-tasks | Consistency | Codex | **3-tasks.md T1.5 Code Snippet (L107-118) の `LineMap` 型に `hunks` フィールドがまだ残存**。2-plan.md §3.4 では前回の修正で `hunks` が削除済みだが、3-tasks.md 側の Code Snippet（参考実装）には `hunks: { start: number; end: number }[];` が残っており、実装者がこれを鵜呑みにすると dead field を含む型が出来上がる。前回 finding #11 の修正漏れ。 | 0.98 |
| 4 | 2-plan / 3-tasks | Consistency | Claude | **housekeeping テストの配置が §6.1 Testing Strategy と §9.2 File Changes で矛盾**。§6.1 Testing Strategy (L395) は `tests/github/housekeeping.test.ts` に配置する前提だが、2-plan.md §9.2 / 3-tasks.md T3.2 では `tests/pipeline/housekeeping.test.ts`（`src/pipeline/housekeeping.ts` のテストとして）に置く記述が併存する。どちらか一方に統一が必要。**推奨は `tests/pipeline/housekeeping.test.ts`**（実ファイルが `src/pipeline/housekeeping.ts` にあるため）。 | 0.92 |
| 5 | 2-plan / 3-tasks | Quality | Codex | **`listFiles` vs `listAllFiles` の命名 drift**。2-plan.md は §1.2 / §1.3 / §3.3 / §6.2 / §9.2 の全 5 箇所で `listFiles`（5 occurrences）を使用するが、3-tasks.md は T1.3 AC (L80) / T2.10 AC (L388) で `listAllFiles` と命名している。実装者は octokit の `pulls.listFiles` を薄くラップした関数名として片方を選ぶ必要があるが、どちらを正とするかが不明。**推奨は `listFiles` に統一**（octokit 原名と一致、plan 側の記述が多数派）。 | 0.87 |

---

## 3. 整合性チェック結果

### spec ↔ plan 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | 全 FR が plan で対応されている | OK | FR-001 の `workflow_dispatch` は OQ-01 に移送済み。FR-024 / NFR-009 の調停も DL-07 / §3.x で反映済み |
| 2 | 技術選定が NFR を満たす | OK | 追加依存ゼロ (NFR-007)、octokit + `GITHUB_TOKEN` のみ (NFR-006)、renderer 純粋関数 (NFR-005) が維持 |
| 3 | Scope(Out) の内容が plan に紛れていない | OK | 独自 GitHub App 化・商用サービス完全再現等は plan に出現しない |

### plan ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | File Changes がタスクとして網羅されている | **NG** | §9.2 File Changes table の comments.ts 説明が §1.2 / §3.3 と矛盾（新 finding #2）。T2.10 housekeeping のスコープが Description と AC で矛盾（新 finding #1） |
| 2 | Testing Strategy が Phase 3 に反映されている | **NG** | housekeeping テストファイルの配置が §6.1（`tests/github/`）と §9.2 / T3.2（`tests/pipeline/`）で矛盾（新 finding #4） |
| 3 | Architecture の Setup が Phase 1 に含まれている | OK | types / github/\* / position / tests 基盤が T1.1〜T1.8 で揃う |
| 4 | 型定義が plan と tasks で一致 | **NG** | `LineMap` が plan では `{ validLines }` のみ、tasks T1.5 Code Snippet では `{ validLines, hunks }` （新 finding #3） |
| 5 | 関数名が plan と tasks で一致 | **NG** | `listFiles`（plan）vs `listAllFiles`（tasks）の drift（新 finding #5） |

### spec ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | Acceptance Criteria が Completion Checklist に含まれている | OK | 末尾 Completion Checklist で AC-P1-01〜AC-P3-04 を全て参照。個別タスク側の AC-Px-xx リンクも追加済み |
| 2 | 全要件がいずれかのタスクでカバーされている | OK (ただし T2.10 のスコープ曖昧さ残) | FR-001〜FR-024 を T1.x〜T3.x で一通りカバー。T2.10 の housekeeping スコープは新 finding #1 で要再調整 |

---

## 4. Verdict

**判定**: **Revise**

**コメント**:
前回の 12 findings のうち 10 件は完全に解消され、ドキュメント 3 点の構造・優先度分類・Open Issues・Decision Log・AC の traceability 等は大幅に改善された。特に DL-07（FR-024 vs NFR-009 の調停）、§10.4 Open Issues、AC リンク付与は高品質な修正で、spec レベルの一貫性は Approved 水準に達している。

しかし plan ↔ tasks 間に新たに **重大 1 件 + 改善推奨 4 件** を検出した。特に **新 finding #1（T2.10 Phase 2 housekeeping スコープの Description vs AC 矛盾）** は実装者が Phase 2 で upsert を含めるか否かを判断できない真のアンビギュイティで、放置すると Phase 2 実装者が独自解釈で upsert を省略 → E2E で Summary が更新されない → 再レビュー手戻り、という経路で直接実装を阻害する。

残り 4 件（改善推奨）は、いずれも前回修正の伝播漏れ（#2 / #3）・ドキュメント間の表記ゆれ（#4 / #5）で、文面置換レベルの軽微な修正で解消できる。Redesign は不要、**Revise** として 5 件を修正後に再レビュー推奨。

---

## 5. 次のアクション

### 必須修正（Revise 解除条件）

- [ ] **#1 解消 (重大)**: 3-tasks.md T2.10 の Description と AC の矛盾を解消
  - オプション A（推奨）: Description を「`housekeeping` は Phase 2 で `deleteOldInlineComments` + `upsertSummaryComment` の **両方を実装**、Phase 3 では `<!-- ai-review-count=N -->` の完全パース・衝突時フォールバック等の**拡張機能のみ追加**」に書き換える。AC はそのまま維持。
  - オプション B: Description はそのままで AC の `upsertSummaryComment` 呼び出し要件を削除し、Phase 2 は `createReview` のみ投稿するフローに変更。ただしこれは FR-010 / FR-016 / AC-P2-05 と矛盾するため非推奨。
  - Decision Log に判断を追記することを推奨（PD-07 等）。

### 改善推奨

- [ ] **#2 解消**: 2-plan.md §9.2 File Changes table L498 の `src/github/comments.ts` 行の Purpose 欄を `inline/issue コメントラッパ` → `Issue コメント系 crud ラッパ` に修正
- [ ] **#3 解消**: 3-tasks.md T1.5 Code Snippet (L107-118) から `hunks: { start: number; end: number }[];` 行を削除し、`LineMap` を `{ validLines: Set<number>; }` のみに統一
- [ ] **#4 解消**: 2-plan.md §6.1 Testing Strategy L395 の `tests/github/housekeeping.test.ts` を `tests/pipeline/housekeeping.test.ts` に修正（`src/pipeline/housekeeping.ts` のテストとして統一）。3-tasks.md T3.2 も併せて確認
- [ ] **#5 解消**: 3-tasks.md T1.3 AC (L80) / T2.10 AC (L388) の `listAllFiles` を `listFiles` に統一（plan §3.3 の命名に合わせる）。T1.3 Description は「`listFiles` はページングを内包する」と明記済みのため、AC 側の関数名のみ合わせれば整合する
- [ ] 修正後に `reviewing-sdd-docs` スキルで 3 回目のレビューを実施

---

## 6. Appendix: 修正規模の見積

| 修正箇所 | 修正行数 | 影響ファイル |
| --- | --- | --- |
| #1 T2.10 Description / Decision Log 追記 | 3〜5 行 | `3-tasks.md` + `requirements.md` (Decision Log 追記の場合) |
| #2 §9.2 File Changes table | 1 行 | `2-plan.md` |
| #3 T1.5 Code Snippet | 1 行削除 | `3-tasks.md` |
| #4 §6.1 Testing Strategy test path | 1 行 | `2-plan.md` |
| #5 `listAllFiles` → `listFiles` | 2 行 | `3-tasks.md` |
| **合計** | **8〜10 行** | 3 ファイル |

修正規模は前回（12 findings, 18 箇所）に比べ大幅に縮小しており、Redesign 規模ではない。
