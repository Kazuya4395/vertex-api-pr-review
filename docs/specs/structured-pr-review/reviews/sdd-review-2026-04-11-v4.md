# SDD Review: structured-pr-review (Re-review #4)

**対象ドキュメント**:
- `docs/specs/structured-pr-review/requirements.md` (= 1-spec.md 相当)
- `docs/specs/structured-pr-review/2-plan.md`
- `docs/specs/structured-pr-review/3-tasks.md`

**Reviewer**: Automated (reviewing-sdd-docs skill)
**Model**:
- Primary (Codex CLI): GPT-5 Codex
- Supplementary (Claude Code): claude-opus-4-6

**Date**: 2026-04-11
**Status**: **Approved**（改善推奨 3 件あり）
**Previous Reviews**:
- [sdd-review-2026-04-11.md](./sdd-review-2026-04-11.md) (round 1, 12 findings, Revise)
- [sdd-review-2026-04-11-v2.md](./sdd-review-2026-04-11-v2.md) (round 2, 5 findings, Revise)
- [sdd-review-2026-04-11-v3.md](./sdd-review-2026-04-11-v3.md) (round 3, 3 findings, Revise)

---

## 0. 前回 (v3) findings の解消状況

| # | 前回指摘 | 解消 | 確認箇所 |
| --- | --- | --- | --- |
| 1 | [重大] §8.1 既定プロンプトパス記述が FR-022 / DL-04 と矛盾 | ✅ | L346 が `prompts/pr-review/system.ja.md`（固定）に修正。`inputs.language` は予約パラメータとして明記、`system.{language}.md` 形式の自動補間は実装しないと明記 |
| 2 | §6.3 E2E Phase 2 末チェックに Phase 3 責務混入 | ✅ | §6.3 が「Phase 2 末 E2E」「Phase 3 末 E2E」に分離。count 更新は Phase 3 末へ移動、Phase 2 末は「Summary が updateComment で置換される」までに縮小 |
| 3 | §6.1 Testing Strategy table の Phase 2/3 混在 | ✅ | L395-396 が `tests/pipeline/housekeeping.test.ts (基本版, T2.10)` と `(拡張版, T3.2)` の 2 行に分離 |

**サマリ**: v3 の 3 件は全て完全解消。

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

**該当なし。**

### 改善推奨

> 品質向上のための修正

| # | ドキュメント | Category | Source | Description | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | 2-plan / 3-tasks | Consistency | Codex | **Phase 2 の housekeeping 基本版テストが Tasks / §9.2 File Changes に割り当てられていない**。前回 v3 修正で §6.1 Testing Strategy は「基本版 (T2.10)」と「拡張版 (T3.2)」に分離済みだが、実装タスク側では整合していない。具体的には: (a) 3-tasks.md T2.10 の Files 欄には `tests/pipeline/housekeeping.test.ts` が含まれておらず、同ファイルは T3.2 (Phase 3) でのみ新規作成される設計、(b) 2-plan.md §9.2 File Changes L524 の Phase 列が `3` のままで Phase 2 分の扱いが無い。このままだと Phase 2 で `upsertSummaryComment` / `deleteOldInlineComments` の基本版を実装しても検証タスクが Phase 3 に後ろ倒しされ、DL-08 が意図した Phase 2/3 境界が再度曖昧になる。NFR-005 の「Phase 2 完了時点でカバレッジ 80% 以上」も達成できない可能性がある。 | 0.94 |
| 2 | 1-spec | Consistency | Codex | **DL-08 の理由欄の AC 参照が誤り**。requirements.md §10.3 L442 の DL-08 理由欄に `AC-P2-04 / AC-P2-05` を参照しているが、§11.2 を確認すると: AC-P2-04 = diff hunk 外フォールバック (FR-005 系)、AC-P2-05 = max-comments 吸収 (FR-019 系) であり、いずれも「サマリ upsert」や「再実行時 housekeeping」とは直接関係しない。実際に DL-08 の根拠となるのは **AC-P2-03**（サマリが 2 箇所に投稿される）と **FR-010 / FR-016**（再実行時ハウスキーピング本文規定）である。本文仕様は整合しているが Decision Log の根拠行だけが誤参照で、traceability を追う読者に誤解を与える。 | 0.90 |
| 3 | 2-plan | Structure | Codex | **2-plan.md §9 File Changes が実タスク定義を完全に網羅していない**。3-tasks.md で明示されている以下 2 ファイルが §9.1 New Files / §9.2 Modified Files に載っていない: (a) `tests/github/pulls.test.ts`（T1.8 L186 の対象ファイル、Phase 1）、(b) `jest.config.js`（T1.7 L165 の変更対象、Phase 1）。File Changes は設計ドキュメント側の変更一覧なので、plan だけ見た実装者は T1.7/T1.8 で必要な変更を取りこぼす可能性がある。厳密にはタスク側にさえあれば実装上の問題は無いが、整合性チェックで検出される軽微な欠落。 | 0.86 |

---

## 3. 整合性チェック結果

### spec ↔ plan 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | 全 FR が plan で対応されている | OK | FR-001〜FR-024 が plan §1〜§7 で網羅。v3 の §8.1 矛盾は解消済み |
| 2 | 技術選定が NFR を満たす | OK | 追加依存ゼロ (NFR-007)、octokit + `GITHUB_TOKEN` のみ (NFR-006)、純粋関数 (NFR-005)、dist 6MB 以内 (NFR-007) が plan §2/§6 で対応 |
| 3 | Scope(Out) の内容が plan に紛れていない | OK | 独自 GitHub App 化・多言語 UI FT・商用サービス完全再現・レガシーモード維持は plan に出現しない |

### plan ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | File Changes がタスクとして網羅されている | **NG (軽微)** | `tests/github/pulls.test.ts` / `jest.config.js` が §9 に欠落（新 finding #3） |
| 2 | Testing Strategy が Phase 2 / 3 タスクに反映されている | **NG (軽微)** | §6.1 は Phase 2/3 分離済だが、T2.10 の Files 欄に基本版テストが欠落（新 finding #1） |
| 3 | Architecture の Setup が Phase 1 に含まれている | OK | types / github/\* / position / tests 基盤が T1.1〜T1.8 で揃う |
| 4 | Rollout Plan の Phase 2/3 境界が整合 | OK | §6.3 E2E / §6.1 Testing Strategy / DL-08 / T2.10 / T3.1 の Phase 境界が一貫 |

### spec ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | Acceptance Criteria が Completion Checklist に含まれている | OK | Completion Checklist で AC-P1-01〜AC-P3-04 を全て参照。個別タスク側の AC-Px-xx リンクも揃っている |
| 2 | 全要件がいずれかのタスクでカバーされている | OK | FR-001〜FR-024 を T1.x〜T3.x で網羅 |
| 3 | Decision Log の traceability | **NG (軽微)** | DL-08 理由欄の AC 参照が誤り（新 finding #2） |

---

## 4. Verdict

**判定**: **Approved**（改善推奨 3 件あり、ただし実装着手は可能）

**コメント**:
前回 v3 の重大 1 件 + 改善 2 件は完全解消。これで 4 ラウンドにわたるレビューで検出された計 20 件の findings のうち、重大な構造的欠陥は全て解消された状態に到達した。

今回新たに検出された 3 件は **いずれも改善推奨レベル** で、実装を阻害するアンビギュイティは含まれていない:
- **#1** は DL-08 の波及整理の残余（T2.10 の Files 欄と §9.2 の Phase 列にテストファイルが明示されていない）だが、§6.1 Testing Strategy で「基本版 T2.10」と明記されているため実装者は意図を読み取れる
- **#2** は Decision Log の誤参照で本文仕様は正しい
- **#3** は 2 ファイルのドキュメント欠落でタスク側には存在する

Codex CLI の overall_verdict は `passed_with_comments`、Claude Code の補完レビューでも同結論（重大なし / 改善 3 件）。マルチモデル両方で「通過可能」と判定されたため、**Approved** とする。

ただし 3 件を修正すれば v5 では「改善推奨ゼロ」が期待でき、Phase 1 着手前の最終仕上げとして修正することを **強く推奨** する。修正規模は 4〜6 行 / 2 ファイル程度。

---

## 5. 次のアクション (任意)

### 改善推奨（着手前の仕上げとして推奨）

- [ ] **#1 解消**: 以下 2 箇所を調整
  - `3-tasks.md` T2.10 の Files 欄に `tests/pipeline/housekeeping.test.ts (基本版)` を追加、AC にも `housekeeping 基本版テスト (新規 / 更新 / inline 削除) が 3 ケース以上実装されている` を追加
  - `2-plan.md` §9.2 L524 の `tests/pipeline/housekeeping.test.ts` 行を `| tests/pipeline/housekeeping.test.ts | housekeeping 基本版 + 冪等性テスト | 2 (基本), 3 (拡張) |` に修正
- [ ] **#2 解消**: `requirements.md` §10.3 L442 DL-08 理由欄の `AC-P2-04 / AC-P2-05` を `AC-P2-03 / FR-010 / FR-016` に修正
- [ ] **#3 解消**: `2-plan.md` §9.1 New Files に `tests/github/pulls.test.ts` (Phase 1) を追加、§9.2 Modified Files に `jest.config.js` (`passWithNoTests: true` 追加 / Phase 1) を追加

### 実装着手判断

- [x] **Phase 1 実装に着手可能**: 上記 3 件は実装ブロッカーではないため、修正と並行して Phase 1 の T1.1〜T1.8 に着手できる
- [ ] 改善推奨 3 件を修正後、v5 レビューを任意で実施（必須ではない）
- [ ] T1.1 `src/types/inputs.ts` から実装開始

---

## 6. Appendix A: ラウンド履歴

| ラウンド | Date | Findings | 重大 | 改善 | Codex Verdict | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (初回) | 2026-04-11 | 12 | 4 | 8 | failed | Revise |
| 2 (v2) | 2026-04-11 | 5 | 1 | 4 | failed | Revise |
| 3 (v3) | 2026-04-11 | 3 | 1 | 2 | failed | Revise |
| 4 (v4) | 2026-04-11 | 3 | 0 | 3 | **passed_with_comments** | **Approved** |

**進捗グラフ**:
- 重大 findings: 4 → 1 → 1 → **0** ✅
- 総 findings: 12 → 5 → 3 → 3 (同数だが重大度が最軽量レベルに低下)
- Codex verdict: 3 ラウンド連続の `failed` から `passed_with_comments` へ遷移

---

## 6. Appendix B: 修正規模の見積

| 修正箇所 | 修正行数 | 影響ファイル |
| --- | --- | --- |
| #1 T2.10 Files 欄 + §9.2 Phase 列 | 2〜3 行 | `3-tasks.md` + `2-plan.md` |
| #2 DL-08 理由欄 AC 参照 | 1 行 | `requirements.md` |
| #3 §9.1 / §9.2 テスト関連ファイル追加 | 2 行 | `2-plan.md` |
| **合計** | **5〜6 行** | **3 ファイル** |

---

## 7. 最終評価

**ドキュメント 3 点の品質総括**:

| 観点 | 評価 | 備考 |
| --- | --- | --- |
| 構造・テンプレート準拠 | ★★★★★ | Overview / Scope / FR / NFR / AC / Decision Log / Open Issues 全て揃う |
| 要件の優先度分類 | ★★★★★ | FR-001〜FR-024 に [Must]/[Should]/[Could]、付録 A に Priority 列 |
| 用語定義の整合性 | ★★★★★ | Phase 1/2/3 境界、housekeeping 責務、FR-024 vs NFR-009 調停が明示 |
| Decision Log / Open Issues | ★★★★★ | DL-01〜DL-08 / OQ-01〜OQ-05 |
| 技術選定 Rationale | ★★★★★ | 却下した代替案 (parse-diff / zod / retry etc.) を記録 |
| ASCII ダイアグラム | ★★★★☆ | System Context / Component / データフロー 3 図 |
| Testing Strategy | ★★★★☆ | Phase 2/3 分離済、ただし housekeeping 基本版テストの tasks 側割り当てが軽微に欠落 |
| Rollout Plan | ★★★★★ | Phase 1/2/3 の順序・実装ステップ・コミット単位が明確 |
| spec → plan → tasks の traceability | ★★★★☆ | AC-Px-xx リンク揃う、DL-08 の AC 参照のみ誤り |
| 実装可能性 | ★★★★★ | 各タスクが独立完了可能、依存関係明示 |

**総評**: 3 回の Revise を経てドキュメントは高水準に到達した。**Phase 1 実装着手を承認する**。改善推奨 3 件は任意修正として Phase 1 開始後に並行対応しても問題ないレベル。
