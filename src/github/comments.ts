import { GitHubClient } from './client';

export const listIssueComments = async (
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
) => {
  const comments: Awaited<
    ReturnType<GitHubClient['rest']['issues']['listComments']>
  >['data'] = [];
  let page = 1;
  for (;;) {
    const { data } = await client.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      page,
    });
    comments.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return comments;
};

export const createIssueComment = (
  client: GitHubClient,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
) =>
  client.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

export const updateIssueComment = (
  client: GitHubClient,
  owner: string,
  repo: string,
  commentId: number,
  body: string,
) =>
  client.rest.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body,
  });
