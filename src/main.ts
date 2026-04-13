import * as core from '@actions/core';
import { context } from '@actions/github';
import { ActionInputs } from './types/inputs';
import { createClient } from './github/client';
import { fetchContext } from './pipeline/fetchContext';
import { planReview } from './pipeline/planReview';
import { runReviewLLM } from './pipeline/runLLM';
import { postReview } from './pipeline/postReview';

/**
 * action.yml の入力をパースして ActionInputs に変換する。
 */
const readInputs = (): ActionInputs => ({
  githubToken: core.getInput('github-token', { required: true }),
  gcpProjectId: core.getInput('gcp-project-id', { required: true }),
  gcpLocation: core.getInput('gcp-location') || 'us-east5',
  gcpCredentials: JSON.parse(core.getInput('gcp-credentials', { required: true })),
  model: core.getInput('model') || 'gemini-2.5-pro',
  systemPromptPath: core.getInput('system-prompt-path') || '',
  diffSizeLimit: parseInt(core.getInput('diff-size-limit'), 10) || 100000,
  timeout: parseInt(core.getInput('timeout'), 10) || 120000,
  maxFiles: parseInt(core.getInput('max-files'), 10) || 50,
  maxComments: parseInt(core.getInput('max-comments'), 10) || 20,
  perFileDiffLimit: parseInt(core.getInput('per-file-diff-limit'), 10) || 30000,
  severityThreshold: (core.getInput('severity-threshold') || 'P3') as ActionInputs['severityThreshold'],
  language: (core.getInput('language') || 'ja') as ActionInputs['language'],
  reviewDrafts: core.getBooleanInput('review-drafts', { required: false }) || false,
  maxOutputTokens: parseInt(core.getInput('max-output-tokens'), 10) || 65536,
});

const main = async () => {
  const totalStart = Date.now();
  try {
    const inputs = readInputs();

    // NFR-003: シークレットをマスク
    core.setSecret(JSON.stringify(inputs.gcpCredentials));

    const client = createClient(inputs.githubToken);
    const { owner, repo } = context.repo;
    const pr = context.payload.pull_request;

    if (!pr) {
      throw new Error('This action can only be run on pull_request events.');
    }

    const pullNumber = pr.number;

    // FR-001: Draft PR は既定で除外
    if (pr.draft && !inputs.reviewDrafts) {
      core.info('Skipping draft PR (set review-drafts: true to enable)');
      return;
    }

    // Stage 1: fetchContext
    const fetchStart = Date.now();
    const ctx = await fetchContext(client, owner, repo, pullNumber);
    core.info(`[fetchContext] files: ${ctx.files.length}, totalSize: ${ctx.totalSize} bytes, duration: ${Date.now() - fetchStart}ms`);

    // Stage 2: planReview
    const plan = planReview(ctx, inputs);
    core.info(`[planReview] included: ${plan.includedFiles.length}, excluded: ${plan.excludedFiles.length}`);

    if (plan.includedFiles.length === 0) {
      core.info('No files to review after filtering');
      return;
    }

    // Stage 3: runLLM
    const llmStart = Date.now();
    const filePatches = new Map<string, string>();
    for (const f of ctx.files) {
      if (f.patch) {
        filePatches.set(f.filename, f.patch);
      }
    }

    const { result, overflowComments } = await runReviewLLM(plan, inputs, filePatches);
    core.info(`[runLLM] comments: ${result.comments.length}, confidence: ${result.confidence}/5, duration: ${Date.now() - llmStart}ms`);

    // Stage 4: postReview
    const postStart = Date.now();
    const historyCount = 1;
    const commitUrl = `https://github.com/${owner}/${repo}/commit/${ctx.headSha}`;
    const commitTitle = ctx.headSha.slice(0, 7);

    await postReview({
      client,
      owner,
      repo,
      pullNumber,
      headSha: ctx.headSha,
      commitTitle,
      commitUrl,
      result,
      overflowComments,
      historyCount,
    });

    core.info(`[postReview] duration: ${Date.now() - postStart}ms`);
    core.info(`[total] duration: ${Date.now() - totalStart}ms`);
  } catch (error) {
    core.info(`[total] duration: ${Date.now() - totalStart}ms (failed)`);
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
};

main();
