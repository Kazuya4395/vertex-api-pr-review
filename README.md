# AI Code Review Action

This GitHub Action uses Google's Vertex AI (Gemini) to automatically review your pull requests. It helps improve code quality by providing instant feedback on potential bugs, readability, and maintainability.

## How It Works

When a pull request is opened or updated, this action:

1.  Fetches the diff of the pull request.
2.  Sends the diff to the Vertex AI API with a configurable prompt.
3.  Posts the AI-generated review as a comment on the pull request.

## Usage

1.  **Create a workflow file** in your repository (e.g., `.github/workflows/review.yml`):

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
          - name: Run AI Code Review
            uses: Kazuya4395/vertex-api-pr-review@v1
            with:
              github-token: ${{ secrets.GITHUB_TOKEN }}
              gcp-project-id: ${{ secrets.GCP_PROJECT_ID }}
              gcp-credentials: ${{ secrets.GCP_CREDENTIALS }}
    ```

2.  **Set up secrets** in your repository's settings (`Settings` > `Secrets and variables` > `Actions`):
    - `GCP_PROJECT_ID`: Your Google Cloud Project ID.
    - `GCP_CREDENTIALS`: The JSON content of your GCP service account key.

## Action Inputs

You can customize the action's behavior using the `with` keyword in your workflow file.

| Input                | Description                                                                                     | Default            |
| -------------------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| `github-token`       | The GITHUB_TOKEN secret.                                                                        | N/A                |
| `gcp-project-id`     | Your Google Cloud Project ID.                                                                   | N/A                |
| `gcp-location`       | The Google Cloud region for your project.                                                       | `global`           |
| `gcp-credentials`    | The JSON content of your GCP service account key.                                               | N/A                |
| `model`              | The Vertex AI model to use for the review (e.g., `gemini-1.5-pro`, `claude-3-sonnet@20240229`). | `gemini-2.5-flash` |
| `system-prompt-path` | The path to a custom system prompt file. If not provided, a default prompt will be used.        | N/A                |
| `diff-size-limit`    | The maximum diff size (in bytes) to review. Larger diffs will be skipped.                       | `100000`           |
| `timeout`            | The timeout (in milliseconds) for the Vertex AI API call.                                       | `120000`           |

### Example with custom inputs:

```yaml
- name: Run AI Code Review
  uses: Kazuya4395/vertex-api-pr-review@v1 # Replace with your repo and version
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    gcp-project-id: ${{ secrets.GCP_PROJECT_ID }}
    gcp-credentials: ${{ secrets.GCP_CREDENTIALS }}
    gcp-location: 'us-central1' # Optional: defaults to 'global'
    model: 'claude-3-sonnet@20240229'
    system-prompt-path: '.github/prompts/my-custom-prompt.md'
    diff-size-limit: '200000'
    timeout: '180000'
```

## Development

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Run tests: `npm test`
4.  Build the project: `npm run build`
