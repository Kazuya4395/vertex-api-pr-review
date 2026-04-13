# Vertex AI Code Review Action

A GitHub Action that provides **structured PR review** using Google Vertex AI (Gemini / Claude). Posts inline comments with severity levels, committable suggestions, and an AI Review Summary.

[Japanese / 日本語](./README.ja.md)

## Features

- Inline review comments with severity levels (P0-P3) and committable suggestions
- AI Review Summary with confidence score, important files table, and Mermaid diagrams
- Supports both **Gemini** and **Claude** models via Vertex AI
- Idempotent: re-runs clean up previous comments and update the summary
- Configurable severity threshold, file limits, and diff size limits

## Usage

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

### Required Secrets

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID |
| `GCP_CREDENTIALS` | JSON content of your GCP service account key |

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github-token` | The GITHUB_TOKEN secret | (required) |
| `gcp-project-id` | Your Google Cloud Project ID | (required) |
| `gcp-location` | Google Cloud region. Claude models require specific regions like `us-east5` | `us-east5` |
| `gcp-credentials` | JSON content of your GCP service account key | (required) |
| `model` | Vertex AI model name (e.g. `gemini-2.5-pro`, `claude-sonnet-4-5@20250929`) | `gemini-2.5-pro` |
| `system-prompt-path` | Path to a custom system prompt relative to your repo root. Output must be `ReviewResult` JSON. If empty, uses the built-in Japanese prompt | `''` (built-in) |
| `diff-size-limit` | Maximum total diff size in bytes | `100000` |
| `timeout` | Timeout in milliseconds for the Vertex AI API call | `120000` |
| `max-files` | Maximum number of files to review | `50` |
| `max-comments` | Maximum inline comments to post. Excess goes to summary | `20` |
| `per-file-diff-limit` | Maximum diff size per file in bytes | `30000` |
| `severity-threshold` | Minimum severity to post inline (`P0`, `P1`, `P2`, `P3`) | `P3` |
| `language` | Review language (`ja` or `en`). Only `ja` is supported; `en` falls back to `ja` | `ja` |
| `review-drafts` | Whether to review draft PRs | `false` |
| `max-output-tokens` | Maximum output tokens for LLM. Increase if JSON is truncated | `65536` |

### Example with All Inputs

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

## Behavior

- **Review format**: Posts a `pulls.createReview` with inline comments + a separate AI Review Summary as an issue comment
- **PR Description**: Never modified (DL-02)
- **Idempotency**: Re-runs delete old inline comments (marked with `<!-- ai-review-inline -->`) and upsert the summary comment (marked with `<!-- ai-review-summary -->`)
- **Review count**: The summary tracks review count via `<!-- ai-review-count=N -->` hidden marker
- **Severity filter**: Comments below `severity-threshold` are excluded from inline posting
- **Overflow handling**: Comments exceeding `max-comments` are included in the summary only
- **Draft PRs**: Skipped by default unless `review-drafts: true`
- **createReview failure**: If inline posting fails with 422/403, falls back to summary-only (DL-07)
- **Language**: Only Japanese (`ja`) is supported. `en` logs a warning and falls back to `ja` (DL-04)
- **Custom prompts**: Must output `ReviewResult` JSON schema. See `src/types/review.ts` for the type definition

## Concurrency

Use `concurrency` in your workflow to prevent parallel executions on the same PR, which can cause comment conflicts:

```yaml
concurrency:
  group: ai-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

## Development

```bash
npm install
npm test
npm run build
```
