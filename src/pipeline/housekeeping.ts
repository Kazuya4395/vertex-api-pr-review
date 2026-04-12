import * as core from '@actions/core';
import { GitHubClient } from '../github/client';
import { listReviewComments, deleteReviewComment } from '../github/pulls';
import { listIssueComments, createIssueComment, updateIssueComment } from '../github/comments';

const INLINE_MARKER = '<!-- ai-review-inline -->';
const SUMMARY_START_MARKER = '<!-- ai-review-summary -->';
const COUNT_REGEX = /<!-- ai-review-count=(\d+) -->/;

/**
 * 自 bot の既存 inline コメントのうち INLINE_MARKER を含むものを一括削除する。
 * FR-016: 再実行時のハウスキーピング
 */
export const deleteOldInlineComments = async (
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<number> => {
  const comments = await listReviewComments(client, owner, repo, pullNumber);
  let deleted = 0;

  for (const comment of comments) {
    if (comment.body?.includes(INLINE_MARKER)) {
      await deleteReviewComment(client, owner, repo, comment.id);
      deleted++;
    }
  }

  if (deleted > 0) {
    core.info(`Deleted ${deleted} old inline comment(s)`);
  }

  return deleted;
};

/**
 * コメント本文から `<!-- ai-review-count=N -->` をパースしてカウントを返す。
 * 見つからなければ 0 を返す。
 */
export const parseReviewCount = (body: string): number => {
  const match = body.match(COUNT_REGEX);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * 本文中の `<!-- ai-review-count=N -->` を `<!-- ai-review-count=N+1 -->` に置換する。
 * 見つからなければそのまま返す。
 */
export const incrementReviewCount = (body: string, currentCount: number): string => {
  return body.replace(
    COUNT_REGEX,
    `<!-- ai-review-count=${currentCount + 1} -->`,
  );
};

/**
 * AI Review Summary コメントの upsert。
 * - SUMMARY_START_MARKER 付きコメントが存在すれば:
 *   - 既存コメントの count をパースし +1 した body で updateComment
 *   - updateComment が 404/422 を返した場合は createComment にフォールバック (R-06 並列衝突対策)
 * - 存在しなければ createComment で新規作成 (count=1)
 */
export const upsertSummaryComment = async (
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
): Promise<{ action: 'created' | 'updated'; commentId: number; historyCount: number }> => {
  const comments = await listIssueComments(client, owner, repo, pullNumber);

  const existing = comments.find(
    (c) => c.body?.includes(SUMMARY_START_MARKER),
  );

  if (existing) {
    const currentCount = parseReviewCount(existing.body ?? '');
    const newCount = currentCount > 0 ? currentCount + 1 : 2;
    const updatedBody = incrementReviewCount(body, currentCount);

    try {
      await updateIssueComment(client, owner, repo, existing.id, updatedBody);
      core.info(`Updated existing AI Review Summary comment (id: ${existing.id}, count: ${newCount})`);
      return { action: 'updated', commentId: existing.id, historyCount: newCount };
    } catch (error: unknown) {
      const status = (error as any)?.status;
      if (status === 404 || status === 422) {
        // R-06: 並列実行衝突でコメントが消えた場合のフォールバック
        core.warning(`updateComment failed with ${status} (possible parallel execution conflict), falling back to createComment`);
        const { data: created } = await createIssueComment(client, owner, repo, pullNumber, body);
        core.info(`Created new AI Review Summary comment via fallback (id: ${created.id})`);
        return { action: 'created', commentId: created.id, historyCount: 1 };
      }
      throw error;
    }
  }

  const { data: created } = await createIssueComment(client, owner, repo, pullNumber, body);
  core.info(`Created new AI Review Summary comment (id: ${created.id})`);
  return { action: 'created', commentId: created.id, historyCount: 1 };
};
