import aiplatform from '@google-cloud/aiplatform';

const { PredictionServiceClient } = aiplatform.v1;

type GetVertexAIReviewParams = {
  gcpProjectId: string;
  gcpLocation: string;
  gcpCredentials: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  diff: string;
  model: string;
  prompt: string;
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
  const {
    gcpProjectId,
    gcpLocation,
    gcpCredentials,
    diff,
    model,
    prompt,
    timeout,
  } = params;

  const clientOptions = {
    apiEndpoint:
      gcpLocation === 'global'
        ? 'aiplatform.googleapis.com'
        : `${gcpLocation}-aiplatform.googleapis.com`,
  };
  const client = new PredictionServiceClient({
    ...clientOptions,
    credentials: gcpCredentials,
  });

  const fullModelPath = `projects/${gcpProjectId}/locations/${gcpLocation}/publishers/google/models/${model}`;
  const fullPrompt = prompt.replace('{{DIFF}}', diff);

  const request = {
    model: fullModelPath,
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
  };

  const [response] = await client.generateContent(request, {
    timeout,
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No feedback.';
};
