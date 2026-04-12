# SDD Review: structured-pr-review (Re-review #3)

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
**Previous Reviews**:
- [sdd-review-2026-04-11.md](./sdd-review-2026-04-11.md) (round 1, 12 findings)
- [sdd-review-2026-04-11-v2.md](./sdd-review-2026-04-11-v2.md) (round 2, 5 findings)

---

## 0. 前回 (v2) findings の解消状況

| # | 前回指摘 | 解消 | 確認箇所 |
| --- | --- | --- | --- |
| 1 | [重大] T2.10 housekeeping のスコープが Description と AC で矛盾 | ✅ | T2.10 Description L377 が `Phase 2 で両方実装、Phase 3 は拡張のみ` に書き換え済み。requirements.md §10.3 DL-08 が追加され、T3.1 Description L506 も「T2.10 で実装した基本版への拡張機能追加」に統一 |
| 2 | 2-plan.md §9.2 L498 comments.ts 責務 | ✅ | L498 が `Issue コメント系 crud ラッパ (issues.listComments / createComment / updateComment)` に修正 |
| 3 | 3-tasks.md T1.5 Code Snippet LineMap.hunks 残存 | ✅ | L107-118 の Code Snippet から `hunks` フィールドを削除、`{ validLines: Set<number>; }` のみに統一 |
| 4 | housekeeping テスト配置不整合 | ✅ | 2-plan.md §6.1 L395 が `tests/pipeline/housekeeping.test.ts` に修正済み。T3.2 も一致 |
| 5 | `listAllFiles` vs `listFiles` 命名 drift | ✅ | 3-tasks.md T1.3 L80 / T2.10 L388 が `listFiles` に統一 |

**サマリ**: v2 の 5 件は全て完全解消。

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
| 1 | 1-spec | Consistency | Codex | **`language=en` 時の既定プロンプト解決方針が spec 内で矛盾**。§8.1 L346 は「`inputs.system-prompt-path` 未指定時の既定参照先を `prompts/pr-review/system.{language}.md` に切り替える」と記載しているが、これは `language=en` 指定時に未作成の `prompts/pr-review/system.en.md` を読みに行く実装を許容する文面になっている。一方 FR-022 / DL-04 は「`en` 指定時は `core.warning` で警告を出しつつ `ja` プロンプトで動作する」と規定しており、§8.1 と矛盾する。2-plan.md §9.1 と 3-tasks.md T2.4 では既定値を `prompts/pr-review/system.ja.md` と書いており、spec 側だけがズレている。実装者が §8.1 を素直に読むと `system.{language}.md` 補間による自動解決を書いてしまい、FR-022 の `en → ja` フォールバックと衝突する。 | 0.89 |

### 改善推奨

> 品質向上のための修正

| # | ドキュメント | Category | Source | Description | Confidence |
| --- | --- | --- | --- | --- | --- |
| 2 | 2-plan | Consistency | Codex | **§6.3 End-to-End 検証の Phase 2 末チェックに Phase 3 責務が混入**。L405 は「本リポジトリの実 PR 上で Action を実行 (Phase 2 末)」と定義しているが、L409 の「2 回連続実行で Summary の `<!-- ai-review-count -->` が `1 → 2` に更新される」は DL-08 / T3.1 によって Phase 3 に送られた機能である。Phase 2 E2E で Phase 3 の responsibilities を検証すると、Phase 2 の完了条件が曖昧になり、T2.10 を完了しても E2E が通らない状況が発生する。該当行を削除するか、Phase 3 セクションへ移動すべき。 | 0.91 |
| 3 | 2-plan | Consistency | Claude | **§6.1 Testing Strategy table の housekeeping テストケースに Phase 3 責務が混入**。L395 `tests/pipeline/housekeeping.test.ts` のケース欄は `5+ (新規 / 更新 / count+1 / inline 削除 / 衝突時フォールバック)` となっているが、`count+1` と `衝突時フォールバック` は DL-08 により Phase 3 (T3.1) の拡張機能に割り当てられている。§6.1 は「Phase 1 で整備」の Unit Tests 一覧であるため、Phase 2 の T2.10 基本版テスト (`新規 / 更新 / inline 削除`) と Phase 3 の T3.2 拡張テスト (`count+1 / 衝突時フォールバック`) を分離するか、注記を追加する必要がある。3-tasks.md T3.2 の AC も「初回 create / 2 回目 update / count+1 / 並列衝突 fallback の 4 ケース以上」と明記しており、Phase 3 側にテストケースが重複して存在する状態。 | 0.85 |

---

## 3. 整合性チェック結果

### spec ↔ plan 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | 全 FR が plan で対応されている | **NG** | FR-022 (§5.7 言語切替) の `en → ja` フォールバック方針が §8.1 L346 と矛盾（新 finding #1） |
| 2 | 技術選定が NFR を満たす | OK | 追加依存ゼロ (NFR-007)、octokit + `GITHUB_TOKEN` のみ (NFR-006)、renderer 純粋関数 (NFR-005) が維持 |
| 3 | Scope(Out) の内容が plan に紛れていない | OK | 独自 GitHub App 化・商用サービス完全再現等は plan に出現しない |

### plan ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | File Changes がタスクとして網羅されている | OK | 前回 v2 で指摘された comments.ts 表記、LineMap.hunks、listFiles 命名、T2.10 スコープが全て解消 |
| 2 | Testing Strategy が Phase 3 に反映されている | **NG** | §6.1 L395 housekeeping テストのケース欄が Phase 2/3 混在（新 finding #3） |
| 3 | Architecture の Setup が Phase 1 に含まれている | OK | types / github/\* / position / tests 基盤が T1.1〜T1.8 で揃う |
| 4 | Rollout Plan の Phase 2/3 境界が spec / plan / tasks で整合 | **NG** | §6.3 E2E Phase 2 末チェックに Phase 3 責務（count 更新）が残存（新 finding #2） |

### spec ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | Acceptance Criteria が Completion Checklist に含まれている | OK | 末尾 Completion Checklist で AC-P1-01〜AC-P3-04 を全て参照。個別タスク側の AC-Px-xx リンクも揃っている |
| 2 | 全要件がいずれかのタスクでカバーされている | OK | FR-001〜FR-024 を T1.x〜T3.x で網羅 |

---

## 4. Verdict

**判定**: **Revise**

**コメント**:
前回 v2 の 5 件は完全解消。特に DL-08 の追加により T2.10 (Phase 2) / T3.1 (Phase 3) の housekeeping 責務分担が明確になったのは大きな改善で、plan ↔ tasks の核心部分は整合性が取れている。

しかし今回、DL-08 追加に伴う波及チェックが不完全だった結果、**重大 1 件 + 改善推奨 2 件** を新規検出した。特に **重大 #1** は前回レビューでも見逃されていた既存の矛盾で、FR-022 の `en → ja` フォールバック実装時に §8.1 との齟齬が表面化する。実装者が §8.1 の「system.{language}.md」補間を素直に読むと、未作成の `system.en.md` を参照する実装を書いてしまい、Phase 2 E2E で必ず発覚する。

改善推奨 #2 / #3 はいずれも DL-08 追加時に Phase 2/3 境界の波及修正が漏れた箇所で、いずれも 1〜2 行の文面修正で解消可能。Redesign 不要、**Revise** として 3 件の修正後に 4 回目のレビューを推奨。

---

## 5. 次のアクション

### 必須修正（Revise 解除条件）

- [ ] **#1 解消 (重大)**: requirements.md §8.1 L346 の記述を修正。推奨案:
  - 現行: `inputs.system-prompt-path 未指定時の既定参照先を prompts/pr-review/system.{language}.md に切り替える`
  - 修正案: `inputs.system-prompt-path 未指定時の既定参照先を prompts/pr-review/system.ja.md に切り替える。inputs.language は将来 system.en.md を追加したときの分岐に備えた予約パラメータであり、初期リリースでは DL-04 / FR-022 に従い常に ja プロンプトにフォールバックする`
  - もしくは §8.1 ディレクトリ構成の説明と §5.7 FR-022 / DL-04 を相互リンクさせ、既定値解決ロジックを一本化

### 改善推奨

- [ ] **#2 解消**: 2-plan.md §6.3 L409 `2 回連続実行で inline が重複せず、Summary の <!-- ai-review-count --> が 1 → 2 に更新される` を修正
  - 案 A: `2 回連続実行で inline が重複せず、Summary が updateComment で置換される` に短縮（Phase 2 末の検証項目としてはこれで十分、count 更新は Phase 3 側で検証）
  - 案 B: 該当行を §7.3 Phase 3 の E2E 検証セクションへ移動（現状 §7.3 L467「2 回連続実行による冪等性 E2E 検証」がある）
- [ ] **#3 解消**: 2-plan.md §6.1 L395 Testing Strategy table の housekeeping 行を分割
  - T2.10 基本版用: `tests/pipeline/housekeeping.test.ts` (`upsertSummaryComment 基本版 / deleteOldInlineComments` / 3+ (新規 / 更新 / inline 削除))
  - T3.2 拡張版用: 注記として `※ count+1 / 衝突時フォールバックは Phase 3 T3.2 で追加 (§7.3)` を併記
- [ ] 修正後に `reviewing-sdd-docs` スキルで 4 回目のレビューを実施

---

## 6. Appendix: 修正規模の見積

| 修正箇所 | 修正行数 | 影響ファイル |
| --- | --- | --- |
| #1 §8.1 既定プロンプトパス記述 | 1〜3 行 | `requirements.md` |
| #2 §6.3 Phase 2 末 E2E | 1 行（削除 or 短縮） | `2-plan.md` |
| #3 §6.1 Testing Strategy table | 1〜2 行 | `2-plan.md` |
| **合計** | **3〜6 行** | **2 ファイル** |

修正規模は v2 (8〜10 行 / 3 ファイル) より更に縮小。全て文面置換レベルで解消可能。

---

## 7. Review の 3 回ラウンド履歴

| ラウンド | Date | Findings | Status | 主な検出 |
| --- | --- | --- | --- | --- |
| 1 (初回) | 2026-04-11 | 12 (重大 4 + 改善 8) | Revise | src/github.ts 矛盾 / FR-024 vs NFR-009 / workflow_dispatch / Priority 分類欠如 |
| 2 (v2) | 2026-04-11 | 5 (重大 1 + 改善 4) | Revise | T2.10 スコープ矛盾 / 前回修正の伝播漏れ 3 件 / 命名 drift |
| 3 (v3) | 2026-04-11 | 3 (重大 1 + 改善 2) | Revise | §8.1 既定プロンプトパス / DL-08 波及漏れ 2 件 |

各ラウンドで findings 数は順調に減少している（12 → 5 → 3）。構造・優先度分類・AC の traceability といった基本品質は Approved 水準に到達しており、残りは全て「ドキュメント間の局所的な整合性」レベルの問題。
