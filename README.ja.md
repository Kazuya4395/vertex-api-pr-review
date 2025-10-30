# AIコードレビューアクション

このGitHub Actionは、GoogleのVertex AI (Gemini) を利用して、プルリクエストを自動的にレビューします。潜在的なバグ、可読性、保守性に関するフィードバックを即座に提供することで、コード品質の向上を支援します。

## 仕組み

プルリクエストがオープンまたは更新されると、このアクションは以下の処理を実行します：

1.  プルリクエストの差分（diff）を取得します。
2.  設定可能なプロンプトと共に、差分をVertex AI APIに送信します。
3.  AIが生成したレビューを、プルリクエストのコメントとして投稿します。

## 使い方

1.  **ワークフローファイルの作成**: リポジトリにワークフローファイル（例: `.github/workflows/review.yml`）を作成します。

    ```yaml
    name: AI Code Review

    on:
      pull_request:
        types: [opened, synchronize]

    jobs:
      review:
        runs-on: ubuntu-latest
        permissions:
          contents: read
          pull-requests: write
        steps:
          - uses: actions/checkout@v4
          - name: AIコードレビューを実行
            uses: Kazuya4395/vertex-api-pr-review@v1
            with:
              github-token: ${{ secrets.GITHUB_TOKEN }}
              gcp-project-id: ${{ secrets.GCP_PROJECT_ID }}
              gcp-credentials: ${{ secrets.GCP_CREDENTIALS }}
    ```

2.  **シークレットの設定**: リポジトリの `Settings` > `Secrets and variables` > `Actions` で、以下のシークレットを設定します。
    - `GCP_PROJECT_ID`: あなたのGoogle CloudプロジェクトID。
    - `GCP_CREDENTIALS`: GCPサービスアカウントキーのJSONコンテンツ。

## アクションの入力

ワークフローファイルの `with` キーワードを使って、アクションの挙動をカスタマイズできます。

| 入力                 | 説明                                                                                                                                                                                                                    | デフォルト値       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `github-token`       | `GITHUB_TOKEN` シークレット。                                                                                                                                                                                           | N/A                |
| `gcp-project-id`     | あなたのGoogle CloudプロジェクトID。                                                                                                                                                                                    | N/A                |
| `gcp-location`       | プロジェクトのGoogle Cloudリージョン。注意: Claudeモデルは `us-east5` のような特定のリージョンでのみ利用可能です。                                                                                                      | `us-east5`         |
| `gcp-credentials`    | GCPサービスアカウントキーのJSONコンテンツ。                                                                                                                                                                             | N/A                |
| `model`              | レビューに使用するVertex AIモデル。（例: `gemini-2.5-flash`, `claude-sonnet-4-5@20250929`）。利用可能なモデルは[こちら](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions)を参照してください。 | `gemini-2.5-flash` |
| `system-prompt-path` | カスタムシステムプロンプトファイルのパス。指定しない場合はデフォルトのプロンプトが使用されます。                                                                                                                        | N/A                |
| `diff-size-limit`    | レビュー対象とする差分の最大サイズ（バイト）。これを超えるとスキップされます。                                                                                                                                          | `100000`           |
| `timeout`            | Vertex AI API呼び出しのタイムアウト（ミリ秒）。                                                                                                                                                                         | `120000`           |

### カスタム入力の例:

```yaml
- name: AIコードレビューを実行
  uses: Kazuya4395/vertex-api-pr-review@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    gcp-project-id: ${{ secrets.GCP_PROJECT_ID }}
    gcp-credentials: ${{ secrets.GCP_CREDENTIALS }}
    gcp-location: 'us-east5' # オプション: デフォルトは 'us-east5'。
    model: 'claude-sonnet-4-5@20250929'
    system-prompt-path: '.github/prompts/my-custom-prompt.md'
    diff-size-limit: '200000'
    timeout: '180000'
```

## 開発

1.  リポジトリをクローンします。
2.  依存関係をインストールします: `npm install`
3.  テストを実行します: `npm test`
4.  プロジェクトをビルドします: `npm run build`
