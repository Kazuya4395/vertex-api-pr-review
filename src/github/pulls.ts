import { GitHubClient } from './client';

type RepoParams = {
  owner: string;
  repo: string;
  pullNumber: number;
};

export const getPullRequest = (
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
) => client.rest.pulls.get({ owner, repo, pull_number: pullNumber });

export const listFiles = async (
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
) => {
  const files: Awaited<
    ReturnType<GitHubClient['rest']['pulls']['listFiles']>
  >['data'] = [];
  let page = 1;
  for (;;) {
    const { data } = await client.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
      page,
    });
    files.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return files;
};

export const createReview = (
  client: GitHubClient,
  params: {
    owner: string;
    repo: string;
    pullNumber: number;
    commitId: string;
    body: string;
    comments: {
      path: string;
      line: number;
      start_line?: number;
      side: 'RIGHT';
      body: string;
    }[];
  },
) =>
  client.rest.pulls.createReview({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.pullNumber,
    commit_id: params.commitId,
    body: params.body,
    event: 'COMMENT',
    comments: params.comments,
  });

export const listReviewComments = async (
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
) => {
  const comments: Awaited<
    ReturnType<GitHubClient['rest']['pulls']['listReviewComments']>
  >['data'] = [];
  let page = 1;
  for (;;) {
    const { data } = await client.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
      page,
    });
    comments.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return comments;
};

export const deleteReviewComment = (
  client: GitHubClient,
  owner: string,
  repo: string,
  commentId: number,
) =>
  client.rest.pulls.deleteReviewComment({
    owner,
    repo,
    comment_id: commentId,
  });
