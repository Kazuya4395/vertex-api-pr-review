import { ReviewResult } from '../types/review';
import { getClaudeReview } from './claude';
import { getGeminiReview } from './gemini';

export type RunLLMParams = {
  gcpProjectId: string;
  gcpLocation?: string;
  gcpCredentials: Record<string, unknown>;
  userPrompt: string;
  systemPrompt: string;
  model: string;
  timeout: number;
  maxOutputTokens: number;
};

/**
 * Vertex AI LLM を呼び出し ReviewResult を返す。
 * model 名に 'claude' が含まれるかで dispatch する。
 */
export const runLLM = async (
  params: RunLLMParams,
): Promise<ReviewResult> => {
  const { model } = params;

  if (model.includes('claude')) {
    return getClaudeReview(params);
  }

  return getGeminiReview(params);
};
