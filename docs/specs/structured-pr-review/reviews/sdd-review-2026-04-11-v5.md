# SDD Review: structured-pr-review (Re-review #5)

**対象ドキュメント**:
- `docs/specs/structured-pr-review/requirements.md` (= 1-spec.md 相当)
- `docs/specs/structured-pr-review/2-plan.md`
- `docs/specs/structured-pr-review/3-tasks.md`

**Reviewer**: Automated (reviewing-sdd-docs skill)
**Model**:
- Primary (Codex CLI): GPT-5 Codex
- Supplementary (Claude Code): claude-opus-4-6

**Date**: 2026-04-11
**Status**: **Approved**（改善推奨 2 件あり）
**Previous Reviews**:
- [sdd-review-2026-04-11.md](./sdd-review-2026-04-11.md) (round 1, 12 findings, Revise)
- [sdd-review-2026-04-11-v2.md](./sdd-review-2026-04-11-v2.md) (round 2, 5 findings, Revise)
- [sdd-review-2026-04-11-v3.md](./sdd-review-2026-04-11-v3.md) (round 3, 3 findings, Revise)
- [sdd-review-2026-04-11-v4.md](./sdd-review-2026-04-11-v4.md) (round 4, 3 findings, Approved)

---

## 0. 前回 (v4) findings の解消状況

| # | 前回指摘 | 解消 | 確認箇所 |
| --- | --- | --- | --- |
| 1 | [改善] Phase 2 housekeeping 基本版テストが T2.10 Files / §9.2 に欠落 | ✅ | 3-tasks.md T2.10 Files 欄 L387 に `tests/pipeline/housekeeping.test.ts (新規 / 基本版)` を追加、AC にも「基本版テスト 3 ケース以上 (新規 / 更新 / inline 削除)」を追加。2-plan.md §9.2 L525 が `| tests/pipeline/housekeeping.test.ts | housekeeping 基本版 + 冪等性テスト (基本版 3 ケース / 拡張版 +2 ケース) | 2 (基本), 3 (拡張) |` に修正 |
| 2 | [改善] DL-08 理由欄の AC 参照誤り (`AC-P2-04 / AC-P2-05`) | ✅ | requirements.md §10.3 L442 DL-08 理由欄を書き換え、AC-P2-03 を主参照にして「Summary が Review body ミニサマリと Issue コメントの 2 箇所に投稿される」を根拠として明記 |
| 3 | [改善] §9 File Changes に `tests/github/pulls.test.ts` / `jest.config.js` 欠落 | ✅ | 2-plan.md §9.1 L522 に `tests/github/pulls.test.ts` (Phase 1)、§9.2 L537 に `jest.config.js` (`passWithNoTests: true` 追加 / Phase 1) を追加 |

**サマリ**: v4 の 3 件は全て完全解消。

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
| 1 | 3-tasks | Consistency | Codex | **T3.2 の Files 欄が `tests/pipeline/housekeeping.test.ts (新規)` のまま**。v5 で T2.10 の Files 欄に同ファイルを `(新規 / 基本版)` として追加したため、Phase 3 の T3.2 が「新規作成」と明示するのは矛盾する。本来 T3.2 は T2.10 で作られたテストファイルに **拡張ケース (count+1 / updateComment 404-422 フォールバック / 並列衝突ログ) を追記する** タスクであり、`(新規)` → `(拡張 / T2.10 で作成済)` 等に訂正しないと、実装者が Phase 3 で空のテストファイルを上書きする恐れがある。2-plan.md §6.1 L396 には既に「※ Phase 3 で追加（§7.3 / T3.2 / DL-08）」と注記があり、plan 側の意図とタスク側の記述が乖離している。 | 0.93 |
| 2 | 2-plan | Consistency | Codex | **§8 Design Decisions の冒頭が `Decision Log (DL-01 ~ DL-06) を前提とする` のまま**。requirements.md §10.3 には DL-07 / DL-08 が既に追加されており、2-plan.md 自体も §3.5 (`<!-- ai-review-count -->` 扱い)、§5.1 (`422/403 フォールバック = DL-07`)、§6.1 / §6.3 / §9.2 (DL-08) を前提に記述しているため、§8 冒頭の範囲表記が stale。読者が §8 を「governing decisions のサマリ」として参照した場合、DL-07 (API 失敗調停) と DL-08 (Phase 2/3 housekeeping 分担) を見落とす恐れがある。修正は `DL-01 ~ DL-08 を前提とする` への 1 語置換で足りる。 | 0.87 |

---

## 3. 整合性チェック結果

### spec ↔ plan 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | 全 FR が plan で対応されている | OK | FR-001〜FR-024 が plan §1〜§7 で網羅。v3 で指摘された §8.1 矛盾は解消済み |
| 2 | 技術選定が NFR を満たす | OK | 追加依存ゼロ (NFR-007)、octokit + `GITHUB_TOKEN` のみ (NFR-006)、renderer 純粋関数 (NFR-005) が維持 |
| 3 | Scope(Out) の内容が plan に紛れていない | OK | 独自 GitHub App 化・多言語 UI FT・商用サービス完全再現・レガシーモード維持は plan に出現しない |
| 4 | Decision Log 参照の一貫性 | **NG (軽微)** | §8 冒頭が DL-01 ~ DL-06 のまま DL-07 / DL-08 が反映されていない（新 finding #2） |

### plan ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | File Changes がタスクとして網羅されている | OK | v4 で指摘された `tests/github/pulls.test.ts` / `jest.config.js` / housekeeping.test.ts の Phase 列がすべて整合 |
| 2 | Testing Strategy が Phase 2 / 3 タスクに反映されている | **NG (軽微)** | §6.1 / §9.2 は T2.10 基本版 + T3.2 拡張版に分離済み。しかし 3-tasks.md T3.2 Files 欄のみ `(新規)` のままで plan の意図と乖離（新 finding #1） |
| 3 | Architecture の Setup が Phase 1 に含まれている | OK | types / github/\* / position / tests 基盤が T1.1〜T1.8 で揃う |
| 4 | Rollout Plan の Phase 2/3 境界が整合 | OK | §6.3 E2E / §6.1 Testing Strategy / DL-08 / T2.10 / T3.1 の Phase 境界が一貫 |

### spec ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | Acceptance Criteria が Completion Checklist に含まれている | OK | Completion Checklist で AC-P1-01〜AC-P3-04 を全て参照。個別タスク側の AC-Px-xx リンクも揃っている |
| 2 | 全要件がいずれかのタスクでカバーされている | OK | FR-001〜FR-024 を T1.x〜T3.x で網羅 |
| 3 | Decision Log の traceability | OK | v4 で指摘された DL-08 理由欄の AC 参照誤りも解消済み |

---

## 4. Verdict

**判定**: **Approved**（改善推奨 2 件あり、実装着手は可能）

**コメント**:
前回 v4 の改善推奨 3 件は全て完全解消。重大な構造的欠陥ゼロの状態を 2 ラウンド連続で維持しており、Codex の overall_verdict も 2 連続 `passed_with_comments`。

今回新たに検出された 2 件は **いずれも前回 v5 修正の波及漏れ** で、内容は軽微:
- **#1** は T2.10 に `tests/pipeline/housekeeping.test.ts (基本版)` を追加した際、Phase 3 側 T3.2 の Files 欄の `(新規)` 表記を更新し忘れた純粋な二重登録の残余
- **#2** は DL-07 / DL-08 を requirements.md に追加した際に 2-plan.md §8 冒頭の DL 参照範囲 `DL-01 ~ DL-06` を更新し忘れた stale

いずれも **1 行修正で解消可能** で、実装をブロックしない。

Codex CLI の overall_verdict は `passed_with_comments`、Claude Code の補完レビューでも同結論（重大なし / 改善 2 件）。マルチモデル両方で「通過可能」と判定されたため、**Approved** とする。

ただし 2 件を修正すれば v6 では「改善推奨ゼロ」を達成できる見込みで、Phase 1 着手前の最終仕上げとして修正することを **推奨** する。修正規模は 2 行 / 2 ファイル。

---

## 5. 次のアクション (任意)

### 改善推奨（着手前の仕上げとして推奨）

- [ ] **#1 解消**: `3-tasks.md` T3.2 L528 Files 欄を以下に修正
  - 現行: `- \`tests/pipeline/housekeeping.test.ts\` (新規)`
  - 修正案: `- \`tests/pipeline/housekeeping.test.ts\` (拡張 / T2.10 で基本版作成済)`
  - 同 Description L525 にも「T2.10 で作成した基本版テストに、拡張機能 (count+1 / 404-422 フォールバック / 並列衝突ログ) のケースを追記する」と明記することを推奨
- [ ] **#2 解消**: `2-plan.md` §8 L484 を以下に修正
  - 現行: `` `requirements.md#10.3` の Decision Log (DL-01 ~ DL-06) を前提とする ``
  - 修正案: `` `requirements.md#10.3` の Decision Log (DL-01 ~ DL-08) を前提とする ``

### 実装着手判断

- [x] **Phase 1 実装に着手可能**: 上記 2 件は実装ブロッカーではないため、修正と並行して Phase 1 の T1.1〜T1.8 に着手できる
- [ ] 改善推奨 2 件を修正後、v6 レビューを任意で実施（必須ではない）
- [ ] T1.1 `src/types/inputs.ts` から実装開始

---

## 6. Appendix A: ラウンド履歴

| ラウンド | Date | Findings | 重大 | 改善 | Codex Verdict | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (初回) | 2026-04-11 | 12 | 4 | 8 | failed | Revise |
| 2 (v2) | 2026-04-11 | 5 | 1 | 4 | failed | Revise |
| 3 (v3) | 2026-04-11 | 3 | 1 | 2 | failed | Revise |
| 4 (v4) | 2026-04-11 | 3 | 0 | 3 | passed_with_comments | Approved |
| 5 (v5) | 2026-04-11 | 2 | 0 | 2 | **passed_with_comments** | **Approved** |

**進捗グラフ**:
- 重大 findings: 4 → 1 → 1 → 0 → **0** ✅ (2 連続ゼロ)
- 総 findings: 12 → 5 → 3 → 3 → **2** (過去最小)
- Codex verdict: 2 連続 `passed_with_comments`

---

## 6. Appendix B: 修正規模の見積

| 修正箇所 | 修正行数 | 影響ファイル |
| --- | --- | --- |
| #1 T3.2 Files 欄の `(新規)` 訂正 | 1 行 (+Description 任意 1 行) | `3-tasks.md` |
| #2 §8 冒頭 DL 参照範囲 | 1 行 | `2-plan.md` |
| **合計** | **2 行** | **2 ファイル** |

過去最小の修正規模（v4 の 5〜6 行 → v5 の 2 行）。

---

## 7. 最終評価

**ドキュメント 3 点の品質総括**:

| 観点 | 評価 | 備考 |
| --- | --- | --- |
| 構造・テンプレート準拠 | ★★★★★ | Overview / Scope / FR / NFR / AC / Decision Log / Open Issues 全て揃う |
| 要件の優先度分類 | ★★★★★ | FR-001〜FR-024 に [Must]/[Should]/[Could]、付録 A に Priority 列 |
| 用語定義の整合性 | ★★★★★ | Phase 1/2/3 境界、housekeeping 責務、FR-024 vs NFR-009 調停が明示 |
| Decision Log / Open Issues | ★★★★☆ | DL-01〜DL-08 / OQ-01〜OQ-05 揃うが、2-plan.md §8 冒頭の DL 参照範囲のみ軽微 stale |
| 技術選定 Rationale | ★★★★★ | 却下した代替案 (parse-diff / zod / retry etc.) を記録 |
| ASCII ダイアグラム | ★★★★☆ | System Context / Component / データフロー 3 図 |
| Testing Strategy | ★★★★☆ | Phase 2/3 分離済、ただし T3.2 Files 欄が軽微に stale |
| Rollout Plan | ★★★★★ | Phase 1/2/3 の順序・実装ステップ・コミット単位が明確 |
| spec → plan → tasks の traceability | ★★★★★ | AC-Px-xx / FR-xxx / DL-xx リンクが全て整合 |
| 実装可能性 | ★★★★★ | 各タスクが独立完了可能、依存関係明示 |

**総評**: 5 回のレビューサイクルを経て、ドキュメント 3 点は極めて高い整合性水準に達した。残存する 2 件の改善推奨は **内容ではなく文字列アップデートの取りこぼし** であり、修正しても Phase 1 実装と並行で十分対応可能。**Phase 1 実装着手を承認する**。

v4 → v5 で総 findings は 3 → 2 に減少、Codex verdict は 2 連続 `passed_with_comments`、重大 0 件を維持。Approved 判定を再確認する。
