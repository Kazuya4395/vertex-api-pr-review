# SDD Review: structured-pr-review (Re-review #6)

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
- [sdd-review-2026-04-11-v5.md](./sdd-review-2026-04-11-v5.md) (round 5, 2 findings, Approved)

---

## 0. 前回 (v5) findings の解消状況

| # | 前回指摘 | 解消 | 確認箇所 |
| --- | --- | --- | --- |
| 1 | [改善] T3.2 Files 欄が `tests/pipeline/housekeeping.test.ts (新規)` のまま | ✅ | 3-tasks.md T3.2 L528 が `(拡張 / T2.10 で基本版作成済)` に修正、Description L525 にも「T2.10 で作成した基本版に拡張機能を追記する」旨を追記 |
| 2 | [改善] 2-plan.md §8 L484 の DL 範囲参照が `DL-01 ~ DL-06` のまま | ✅ | 2-plan.md §8 L484 が `Decision Log (DL-01 ~ DL-08) を前提とする` に修正 |

**サマリ**: v5 の 2 件は全て完全解消。

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
| 1 | 3-tasks | Consistency | Codex | **T3.5 (README 更新) の AC に DL 参照範囲 stale が残存**。L589 で `Decision Log (DL-01 ~ DL-06) の要点が「挙動」節に反映` と記述されているが、v5 修正で 2-plan.md §8 は `DL-01 ~ DL-08` に更新済みかつ requirements.md §10.3 は DL-01〜DL-08 を定義済み。この stale を放置すると、README 書き換え時に DL-07（API 失敗調停、summary-only fallback）と DL-08（Phase 2/3 housekeeping 分担）の要点が README に反映されないまま T3.5 が完了扱いになる。1 語置換（`~ DL-06` → `~ DL-08`）で解消可能。 | 0.96 |
| 2 | 3-tasks | Consistency | Codex | **FR-022 の `language=en` フォールバック挙動が tasks AC に明示的に落ちていない**（これは v1〜v5 までで見逃されていた **pre-existing の traceability ギャップ**）。requirements.md §5.7 FR-022 と §8.1 では「`inputs.language=en` 指定時は `core.warning` を出して `prompts/pr-review/system.ja.md` にフォールバックする」ことを要求しているが、3-tasks.md の T2.14 (action.yml 更新) では `language` input の追加と既定パス更新を確認するのみ、T2.10 (pipeline 実装) の AC にも `en → ja` 分岐の実装・検証項目が無い。現状では `language` input を action.yml に足すだけで両タスクが完了扱いにできてしまい、`en → ja` 分岐の未実装リグレッションを tasks レベルで検出できない。T2.10 か T2.14 に「`language=en` 指定時に `core.warning` を出しつつ `system.ja.md` を使う挙動を実装・確認する」という AC を 1 行追加すべき。requirements.md §11.2 の AC 一覧にも FR-022 に対応する AC-P2-xx 項目が存在しないため、AC 側の追加も検討可。 | 0.86 |

---

## 3. 整合性チェック結果

### spec ↔ plan 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | 全 FR が plan で対応されている | OK | FR-001〜FR-024 が plan §1〜§8 で網羅 |
| 2 | 技術選定が NFR を満たす | OK | 追加依存ゼロ / octokit + `GITHUB_TOKEN` / renderer 純粋関数を維持 |
| 3 | Scope(Out) の内容が plan に紛れていない | OK |  |
| 4 | Decision Log 参照の一貫性 | OK | v5 で指摘された §8 冒頭の DL 範囲 stale は解消済み |

### plan ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | File Changes がタスクとして網羅されている | OK | T3.2 Files 欄も `(拡張 / T2.10 で基本版作成済)` に修正済み |
| 2 | Testing Strategy が Phase 2/3 タスクに反映されている | OK | §6.1 と T2.10 / T3.2 の基本版/拡張版分離が整合 |
| 3 | Architecture の Setup が Phase 1 に含まれている | OK | types / github/\* / position / tests 基盤が T1.1〜T1.8 で揃う |
| 4 | Rollout Plan の Phase 2/3 境界が整合 | OK | §6.3 E2E / §6.1 Testing Strategy / DL-08 / T2.10 / T3.1 / T3.2 の Phase 境界が一貫 |

### spec ↔ tasks 整合性 (担当: Claude Code)

| # | チェック項目 | 判定 | 備考 |
| --- | --- | --- | --- |
| 1 | Acceptance Criteria が Completion Checklist に含まれている | OK | AC-P1-01〜AC-P3-04 を全て参照 |
| 2 | 全要件がいずれかのタスクでカバーされている | **NG (軽微)** | FR-022 `language=en → ja` フォールバック実装の検証 AC がタスク側に存在しない（新 finding #2）。FR レベルでは spec に明記され plan §8.1 にも書かれているが、tasks の AC には落ちていない |
| 3 | Decision Log の traceability | **NG (軽微)** | T3.5 AC が DL-01 ~ DL-06 のまま stale（新 finding #1）。本文整合性の問題で DL 追加時の波及修正漏れ |

---

## 4. Verdict

**判定**: **Approved**（改善推奨 2 件あり、実装着手は可能）

**コメント**:
前回 v5 の 2 件は完全解消。重大な構造的欠陥ゼロの状態を **3 ラウンド連続**で維持しており、Codex の overall_verdict も **3 連続 `passed_with_comments`**。

今回新たに検出された 2 件の性質は異なる:
- **#1** は v5 修正時の波及漏れ（2-plan.md §8 を修正したが 3-tasks.md T3.5 の類似表記を見落とした）。1 語置換で解消
- **#2** は **pre-existing traceability ギャップ**で、v1〜v5 まで見逃されていた。spec 側には FR-022 / DL-04 / §8.1 と 3 箇所で言語フォールバック仕様が書かれているにも関わらず、tasks 側の AC にこの挙動を検証する項目が 1 つも存在しない。実装者が FR-022 を実装せずに T2.10 / T2.14 を完了扱いにしてもタスク AC レベルでは検出できない。ただし重大 finding ではなく「改善推奨」止まりの理由は、spec / plan に仕様が明記されている以上、実装者が真面目に spec を読めば実装漏れは発生しにくいため

両 finding とも 1〜2 行追加で解消可能。v6 以降は「もう重大レベルの問題は出ない」段階に到達している。Codex CLI の overall_verdict は `passed_with_comments`、Claude Code の補完レビューでも同結論（重大なし / 改善 2 件）。マルチモデル両方で「通過可能」と判定されたため、**Approved** とする。

**重要な所見**: 5 ラウンド以上続けると「v5 修正の波及漏れ」のような副作用が毎回 1 件ずつ発生している。v7 では最終確認として finding ゼロを目指せる規模だが、これ以上のラウンドは **逓減リターン** のため、今回の 2 件を修正して Phase 1 実装に着手することを推奨する。

---

## 5. 次のアクション (任意)

### 改善推奨（最終仕上げとして強く推奨）

- [ ] **#1 解消**: `3-tasks.md` T3.5 L589 を修正
  - 現行: `- [ ] Decision Log (DL-01 ~ DL-06) の要点が「挙動」節に反映`
  - 修正案: `- [ ] Decision Log (DL-01 ~ DL-08) の要点が「挙動」節に反映`
- [ ] **#2 解消**: `3-tasks.md` T2.14 (推奨) または T2.10 の AC に言語フォールバックを追加
  - 推奨案 (T2.14 に追加、`action.yml` の `language` 入力追加タスクのため文脈が近い):
    ```markdown
    - [ ] `language: en` 指定時に `core.warning("english prompt is not implemented, falling back to ja")` 相当のログが出力され、`prompts/pr-review/system.ja.md` が使われる（FR-022 / DL-04 / §8.1）
    ```
  - 代替案 (T2.10 pipeline 実装側に追加、より実装寄り):
    ```markdown
    - [ ] pipeline が `inputs.language === 'en'` を検出した場合、`core.warning` でフォールバック警告を出力し、`prompts/pr-review/system.ja.md` を読み込んで Action を継続する (FR-022)
    ```

### 実装着手判断

- [x] **Phase 1 実装に着手可能**: 上記 2 件は実装ブロッカーではない
- [ ] **v7 レビューは実施しない**（逓減リターン。修正後はそのまま Phase 1 着手を推奨）
- [ ] T1.1 `src/types/inputs.ts` から実装開始

---

## 6. Appendix A: ラウンド履歴

| ラウンド | Date | Findings | 重大 | 改善 | Codex Verdict | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 (初回) | 2026-04-11 | 12 | 4 | 8 | failed | Revise |
| 2 (v2) | 2026-04-11 | 5 | 1 | 4 | failed | Revise |
| 3 (v3) | 2026-04-11 | 3 | 1 | 2 | failed | Revise |
| 4 (v4) | 2026-04-11 | 3 | 0 | 3 | passed_with_comments | Approved |
| 5 (v5) | 2026-04-11 | 2 | 0 | 2 | passed_with_comments | Approved |
| 6 (v6) | 2026-04-11 | 2 | 0 | 2 | **passed_with_comments** | **Approved** |

**進捗グラフ**:
- 重大 findings: 4 → 1 → 1 → 0 → 0 → **0** ✅ (**3 連続ゼロ**)
- 総 findings: 12 → 5 → 3 → 3 → 2 → **2** (5 ラウンド目以降は最小値で安定)
- Codex verdict: **3 連続** `passed_with_comments`

---

## 6. Appendix B: 修正規模の見積

| 修正箇所 | 修正行数 | 影響ファイル |
| --- | --- | --- |
| #1 T3.5 AC の DL 範囲 `~ DL-06` → `~ DL-08` | 1 行 | `3-tasks.md` |
| #2 T2.14 or T2.10 に FR-022 AC 追加 | 1 行 | `3-tasks.md` |
| **合計** | **2 行** | **1 ファイル** |

v5 と同規模の **2 行修正** で、影響ファイルは 3-tasks.md 1 本のみに縮小。

---

## 7. 最終評価

**ドキュメント 3 点の品質総括**:

| 観点 | 評価 | 備考 |
| --- | --- | --- |
| 構造・テンプレート準拠 | ★★★★★ | Overview / Scope / FR / NFR / AC / Decision Log / Open Issues 全て揃う |
| 要件の優先度分類 | ★★★★★ | FR-001〜FR-024 に [Must]/[Should]/[Could]、付録 A に Priority 列 |
| 用語定義の整合性 | ★★★★★ | Phase 1/2/3 境界、housekeeping 責務、FR-024 vs NFR-009 調停が明示 |
| Decision Log / Open Issues | ★★★★★ | DL-01〜DL-08 / OQ-01〜OQ-05 揃う |
| 技術選定 Rationale | ★★★★★ | 却下した代替案を記録 |
| ASCII ダイアグラム | ★★★★☆ | System Context / Component / データフロー 3 図 |
| Testing Strategy | ★★★★★ | Phase 2/3 分離済、T2.10 / T3.2 の割り当ても整合 |
| Rollout Plan | ★★★★★ | Phase 1/2/3 の順序・実装ステップ・コミット単位が明確 |
| spec → plan → tasks の traceability | ★★★★☆ | AC-Px-xx リンクは揃うが FR-022 が tasks AC まで落ちていない軽微ギャップ |
| 実装可能性 | ★★★★★ | 各タスクが独立完了可能、依存関係明示 |

**総評**: 6 回のレビューサイクルを経て、3 点のドキュメントは高い整合性水準を安定維持している。v5 → v6 で検出された 2 件は内容レベルの欠陥ではなく、stale string と pre-existing traceability gap。**Phase 1 実装着手を承認する**。Phase 1 は T1.1 〜 T1.8 の 8 タスクがすべて独立して実装可能であり、改善推奨 2 件の修正と並行して安全に進められる。

**逓減リターン警告**: これ以上のレビューラウンドは findings 数が 2 件前後で下げ止まっており、検出されるのは stale string や pre-existing ギャップなど「局所的な文面の取りこぼし」レベル。修正コストと検出価値のバランスを考慮すると、**v7 はスキップして Phase 1 実装に着手することを推奨** する。
