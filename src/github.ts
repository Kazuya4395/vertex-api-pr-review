import fetch from 'node-fetch';

/**
 * GitHubからPull Requestの差分を取得します。
 * @param owner - リポジトリのオーナー
 * @param repo - リポジトリ名
 * @param prNumber - Pull Requestの番号
 * @param token - GitHubトークン
 * @returns PRの差分テキスト
 */
export const getPullRequestDiff = async (
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<string> => {
  const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = await fetch(diffUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3.diff',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch diff: ${response.status} ${errorBody}`);
  }

  return response.text();
};

/**
 * GitHubのPull Requestにコメントを投稿します。
 * @param owner - リポジトリのオーナー
 * @param repo - リポジトリ名
 * @param prNumber - Pull Requestの番号
 * @param token - GitHubトークン
 * @param body - コメントの本文
 */
export const postCommentToGitHub = async (
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
  body: string,
): Promise<void> => {
  const commentUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  const response = await fetch(commentUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to post comment to GitHub: ${response.status} ${errorBody}`,
    );
  }
};
