# Vertex AI Code Review Action

Google Vertex AI (Gemini / Claude) を使用した**構造化 PR レビュー** GitHub Action です。重要度付きインラインコメント、committable suggestion、AI Review Summary を投稿します。

[English](./README.md)

## 機能

- 重要度レベル (P0-P3) 付きインラインレビューコメントと committable suggestion
- Confidence Score、重要ファイル表、Mermaid 図を含む AI Review Summary
- Vertex AI 経由で **Gemini** と **Claude** の両モデルに対応
- 冪等性: 再実行時に旧コメントを削除し Summary を更新
- 重要度しきい値、ファイル数制限、diff サイズ制限の設定が可能

## 使い方

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: ai-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - name: Run AI Code Review
        uses: Kazuya4395/vertex-api-pr-review@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gcp-project-id: ${{ secrets.GCP_PROJECT_ID }}
          gcp-credentials: ${{ secrets.GCP_CREDENTIALS }}
```

### 必須シークレット

| シークレット | 説明 |
|-------------|------|
| `GCP_PROJECT_ID` | Google Cloud プロジェクト ID |
| `GCP_CREDENTIALS` | GCP サービスアカウントキーの JSON |

## 入力パラメータ

| 入力 | 説明 | デフォルト |
|------|------|-----------|
| `github-token` | GITHUB_TOKEN シークレット | (必須) |
| `gcp-project-id` | Google Cloud プロジェクト ID | (必須) |
| `gcp-location` | Google Cloud リージョン。Claude モデルは `us-east5` 等の特定リージョンが必要 | `us-east5` |
| `gcp-credentials` | GCP サービスアカウントキーの JSON | (必須) |
| `model` | Vertex AI モデル名 (例: `gemini-2.5-pro`, `claude-sonnet-4-5@20250929`) | `gemini-2.5-pro` |
| `system-prompt-path` | カスタムプロンプトのパス。出力は `ReviewResult` JSON 必須 | `prompts/pr-review/system.ja.md` |
| `diff-size-limit` | diff 合計サイズの上限 (bytes) | `100000` |
| `timeout` | Vertex AI API のタイムアウト (ms) | `120000` |
| `max-files` | レビュー対象の最大ファイル数 | `50` |
| `max-comments` | インラインコメントの最大投稿数。超過分は Summary に退避 | `20` |
| `per-file-diff-limit` | ファイルごとの diff サイズ上限 (bytes) | `30000` |
| `severity-threshold` | インライン投稿する最小重要度 (`P0`, `P1`, `P2`, `P3`) | `P3` |
| `language` | レビュー言語 (`ja` / `en`)。現在 `ja` のみ対応。`en` は `ja` にフォールバック | `ja` |
| `review-drafts` | Draft PR をレビュー対象にするか | `false` |
| `max-output-tokens` | LLM の最大出力トークン数。JSON が途切れる場合に増加 | `8192` |

### 全入力パラメータの設定例

```yaml
- name: Run AI Code Review
  uses: Kazuya4395/vertex-api-pr-review@v2
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    gcp-project-id: ${{ secrets.GCP_PROJECT_ID }}
    gcp-credentials: ${{ secrets.GCP_CREDENTIALS }}
    model: 'gemini-2.5-pro'
    max-files: '30'
    max-comments: '15'
    per-file-diff-limit: '20000'
    severity-threshold: 'P2'
    review-drafts: 'true'
    max-output-tokens: '16384'
```

## 挙動

- **レビュー形式**: `pulls.createReview` でインラインコメントを投稿し、別途 AI Review Summary を Issue コメントとして投下
- **PR 本文**: 一切変更しない (DL-02)
- **冪等性**: 再実行時は旧インラインコメント (`<!-- ai-review-inline -->` マーカー付き) を削除し、Summary コメント (`<!-- ai-review-summary -->` マーカー付き) を upsert
- **レビュー回数**: Summary 内の `<!-- ai-review-count=N -->` 隠しマーカーでカウントを追跡
- **重要度フィルタ**: `severity-threshold` 未満のコメントはインライン投稿から除外
- **超過コメント**: `max-comments` を超えたコメントは Summary にのみ含まれる
- **Draft PR**: デフォルトでスキップ。`review-drafts: true` で有効化
- **createReview 失敗時**: 422/403 の場合は Summary のみ投下にフォールバック (DL-07)
- **言語**: 現在は日本語 (`ja`) のみ対応。`en` 指定時は警告ログを出力し `ja` にフォールバック (DL-04)
- **カスタムプロンプト**: 出力は `ReviewResult` JSON スキーマに準拠する必要あり。型定義は `src/types/review.ts` を参照

## 並列実行制御

同一 PR への並列実行によるコメント衝突を防ぐため、ワークフローに `concurrency` を設定してください:

```yaml
concurrency:
  group: ai-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

## 開発

```bash
npm install
npm test
npm run build
```
