import * as core from '@actions/core';
import { readFileSync } from 'fs';
import path from 'path';
import { ActionInputs } from '../types/inputs';
import { ReviewComment, ReviewResult, ReviewSeverity } from '../types/review';
import { runLLM as callLLM } from '../vertexai';
import { parsePatchToLineMap, snapCommentToValidLine } from '../github/position';
import { PlanResult } from './planReview';

const SEVERITY_ORDER: Record<ReviewSeverity, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export type RunLLMResult = {
  result: ReviewResult;
  /** severity-threshold でフィルタ or max-comments 超過で退避されたコメント */
  overflowComments: ReviewComment[];
};

/**
 * LLM を呼び出し、結果の comments を補正・フィルタする。
 *
 * 1. vertexai.runLLM を呼ぶ
 * 2. snapCommentToValidLine で全 comments を補正
 * 3. severity-threshold でフィルタ
 * 4. max-comments 超過分を summary 末尾退避
 */
export const runReviewLLM = async (
  plan: PlanResult,
  inputs: ActionInputs,
  filePatches: Map<string, string>,
): Promise<RunLLMResult> => {
  // システムプロンプトの読み込み
  let systemPromptPath = inputs.systemPromptPath;
  if (!systemPromptPath) {
    systemPromptPath = path.join(__dirname, '../../prompts/pr-review/system.ja.md');
  }

  // FR-022: language=en 時のフォールバック
  if (inputs.language === 'en') {
    core.warning('English prompt is not yet implemented, falling back to Japanese (ja)');
  }

  const systemPrompt = readFileSync(systemPromptPath, 'utf8')
    .replace(/\{language\}/g, inputs.language === 'en' ? 'Japanese' : 'Japanese');

  // LLM 呼び出し
  const result = await callLLM({
    gcpProjectId: inputs.gcpProjectId,
    gcpLocation: inputs.gcpLocation,
    gcpCredentials: inputs.gcpCredentials,
    userPrompt: plan.userPrompt,
    systemPrompt,
    model: inputs.model,
    timeout: inputs.timeout,
    maxOutputTokens: inputs.maxOutputTokens,
  });

  // 除外ファイルがある場合は summary に追記
  if (plan.excludedFiles.length > 0) {
    result.summary += `\n\n(${plan.excludedFiles.length} ファイルは diff サイズ超過のためレビュー対象外)`;
  }

  // snapCommentToValidLine で全 comments を補正
  const snappedComments: ReviewComment[] = [];
  let snappedCount = 0;
  let droppedCount = 0;

  for (const comment of result.comments) {
    const patch = filePatches.get(comment.path);
    if (!patch) {
      droppedCount++;
      continue;
    }

    const lineMap = parsePatchToLineMap(patch);
    const snapResult = snapCommentToValidLine(comment, lineMap);

    if (snapResult === null) {
      droppedCount++;
      continue;
    }

    if (snapResult.snapped) {
      snappedCount++;
    }
    snappedComments.push(snapResult.comment);
  }

  if (snappedCount > 0) {
    core.info(`Snapped ${snappedCount} comment(s) to nearest valid line`);
  }
  if (droppedCount > 0) {
    core.info(`Dropped ${droppedCount} comment(s) outside valid diff range`);
  }

  // severity-threshold でフィルタ
  const thresholdOrder = SEVERITY_ORDER[inputs.severityThreshold];
  const filtered = snappedComments.filter(
    (c) => SEVERITY_ORDER[c.severity] <= thresholdOrder,
  );

  // max-comments 超過分は優先度順でソートし退避
  filtered.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const posted = filtered.slice(0, inputs.maxComments);
  const overflow = filtered.slice(inputs.maxComments);

  result.comments = posted;

  return { result, overflowComments: overflow };
};
