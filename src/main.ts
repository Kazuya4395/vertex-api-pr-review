import * as core from '@actions/core';
import { context } from '@actions/github';
import { readFileSync } from 'fs';
import path from 'path';
import { getPullRequestDiff, postCommentToGitHub } from './github';
import { getVertexAIReview } from './vertexai';

/**
 * メインの実行関数
 */
const main = async () => {
  try {
    // action.ymlからの入力を取得
    const githubToken = core.getInput('github-token', { required: true });
    const gcpProjectId = core.getInput('gcp-project-id', { required: true });
    const gcpLocation = core.getInput('gcp-location');
    const gcpCredentials = JSON.parse(
      core.getInput('gcp-credentials', { required: true }),
    );
    const model = core.getInput('model');
    let systemPromptPath = core.getInput('system-prompt-path');
    if (!systemPromptPath) {
      systemPromptPath = path.join(__dirname, '../prompts/system-prompt.md');
    }
    const diffSizeLimit = parseInt(core.getInput('diff-size-limit'), 10);
    const timeout = parseInt(core.getInput('timeout'), 10);

    // PR情報を取得
    if (!context.payload.pull_request) {
      throw new Error('This action can only be run on pull requests.');
    }
    const prNumber = context.payload.pull_request.number;
    const { owner, repo: repoName } = context.repo;

    console.log(`Fetching diff for PR #${prNumber} in ${owner}/${repoName}...`);
    const diff = await getPullRequestDiff(
      owner,
      repoName,
      prNumber,
      githubToken,
    );
    console.log('Diff fetched successfully. Length:', diff.length);

    if (diff.length > diffSizeLimit) {
      console.log('Diff is too large, skipping AI review.');
      const commentBody =
        '🤖 **Vertex AI Review**\n\nDiffが大きすぎるため、AIによるレビューをスキップしました。';
      await postCommentToGitHub(
        owner,
        repoName,
        prNumber,
        githubToken,
        commentBody,
      );
      return;
    }
    console.log(`Using model: ${model}`);
    console.log('Requesting review from Vertex AI...');
    const systemPrompt = readFileSync(systemPromptPath, 'utf8');
    const reviewComment = await getVertexAIReview({
      gcpProjectId,
      gcpLocation,
      gcpCredentials,
      userPrompt: diff,
      systemPrompt,
      model,
      timeout,
    });
    console.log('Review received from Vertex AI.');

    const finalComment = `# 🤖 Vertex AI Review（${model}）\n\n${reviewComment}`;
    await postCommentToGitHub(
      owner,
      repoName,
      prNumber,
      githubToken,
      finalComment,
    );
    console.log('Successfully posted review comment to GitHub.');
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    process.exit(1);
  }
};

main();
