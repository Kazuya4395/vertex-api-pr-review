import * as core from '@actions/core';
import { GitHubClient } from '../github/client';
import { createReview } from '../github/pulls';
import { createIssueComment } from '../github/comments';
import { ReviewResult, ReviewComment } from '../types/review';
import { renderInlineComment } from '../renderer/inlineComment';
import { renderReviewBodyMini } from '../renderer/reviewBodyMini';
import { renderIssueSummary } from '../renderer/issueSummary';
import { deleteOldInlineComments, upsertSummaryComment } from './housekeeping';

type PostReviewParams = {
  client: GitHubClient;
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  commitTitle: string;
  commitUrl: string;
  result: ReviewResult;
  overflowComments: ReviewComment[];
  historyCount: number;
};

/**
 * レビュー結果を GitHub に投稿する。
 *
 * 1. housekeeping: 旧 inline コメント削除
 * 2. pulls.createReview (inline + body ミニサマリ)
 * 3. housekeeping: AI Review Summary upsert
 *
 * FR-024: createReview が 422/403 → summary のみ投下のフォールバック
 */
export const postReview = async (params: PostReviewParams): Promise<void> => {
  const {
    client, owner, repo, pullNumber,
    headSha, commitTitle, commitUrl,
    result, overflowComments, historyCount,
  } = params;

  // 1. 旧 inline 削除
  await deleteOldInlineComments(client, owner, repo, pullNumber);

  // 2. Review 作成
  const reviewBody = renderReviewBodyMini(result);
  const inlineComments = result.comments.map((c) => ({
    path: c.path,
    line: c.line,
    ...(c.startLine ? { start_line: c.startLine, start_side: 'RIGHT' as const } : {}),
    side: 'RIGHT' as const,
    body: renderInlineComment(c),
  }));

  let reviewPosted = false;
  try {
    await createReview(client, {
      owner,
      repo,
      pullNumber,
      commitId: headSha,
      body: reviewBody,
      comments: inlineComments,
    });
    reviewPosted = true;
  } catch (error: unknown) {
    const status = (error as any)?.status;
    if (status === 422 || status === 403) {
      // FR-024: inline 投稿失敗 → summary のみ投下
      core.warning(`createReview failed with ${status}, falling back to summary-only`);
    } else {
      throw error;
    }
  }

  // 3. AI Review Summary upsert
  const summaryBody = renderIssueSummary(result, historyCount, {
    sha: headSha,
    commitTitle,
    commitUrl,
  });
  await upsertSummaryComment(client, owner, repo, pullNumber, summaryBody);

  // overflow comments がある場合のログ
  if (overflowComments.length > 0) {
    core.info(`${overflowComments.length} comment(s) exceeded max-comments and were included in summary only`);
  }
};
