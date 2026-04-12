import * as core from '@actions/core';
import { ActionInputs } from '../types/inputs';
import { FetchContextResult } from './fetchContext';

type PlanFile = {
  filename: string;
  patch?: string;
};

export type PlanResult = {
  /** LLM に渡すファイル一覧（フィルタ済） */
  includedFiles: PlanFile[];
  /** 除外されたファイル一覧（サマリに表示用） */
  excludedFiles: string[];
  /** LLM に渡す diff 結合テキスト */
  userPrompt: string;
};

/**
 * max-files / per-file-diff-limit / diff-size-limit を適用し、
 * LLM に投入するファイルを選定する。
 */
export const planReview = (
  ctx: FetchContextResult,
  inputs: ActionInputs,
): PlanResult => {
  const included: PlanFile[] = [];
  const excluded: string[] = [];
  let accumulatedSize = 0;

  for (const file of ctx.files) {
    // max-files 超過
    if (included.length >= inputs.maxFiles) {
      excluded.push(file.filename);
      continue;
    }

    const patchSize = file.patch?.length ?? 0;

    // per-file-diff-limit 超過
    if (patchSize > inputs.perFileDiffLimit) {
      core.info(`Excluding ${file.filename}: patch size ${patchSize} > per-file-diff-limit ${inputs.perFileDiffLimit}`);
      excluded.push(file.filename);
      continue;
    }

    // diff-size-limit (合計) 超過
    if (accumulatedSize + patchSize > inputs.diffSizeLimit) {
      core.info(`Excluding ${file.filename}: cumulative size would exceed diff-size-limit ${inputs.diffSizeLimit}`);
      excluded.push(file.filename);
      continue;
    }

    accumulatedSize += patchSize;
    included.push({ filename: file.filename, patch: file.patch });
  }

  if (excluded.length > 0) {
    core.info(`Excluded ${excluded.length} file(s) from LLM input`);
  }

  // diff をファイル単位で結合して user prompt を構築
  const userPrompt = included
    .map((f) => `## ${f.filename}\n\n\`\`\`diff\n${f.patch ?? ''}\n\`\`\``)
    .join('\n\n');

  return { includedFiles: included, excludedFiles: excluded, userPrompt };
};
