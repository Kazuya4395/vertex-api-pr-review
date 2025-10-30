import { getClaudeReview } from './claude';
import { getGeminiReview } from './gemini';

export type GetVertexAIReviewParams = {
  gcpProjectId: string;
  gcpLocation?: string;
  gcpCredentials: any;
  userPrompt: string;
  systemPrompt: string;
  model: string;
  timeout: number;
};

/**
 * Vertex AIを使用してPRのレビューを取得します。
 * @param params - レビュー取得に必要なパラメータ
 * @returns Vertex AIによるレビューコメント
 */
export const getVertexAIReview = async (
  params: GetVertexAIReviewParams,
): Promise<string> => {
  const { model } = params;

  if (model.includes('claude')) {
    return getClaudeReview(params);
  }

  return getGeminiReview(params);
};
