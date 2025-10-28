import aiplatform from '@google-cloud/aiplatform';

const { PredictionServiceClient } = aiplatform.v1;

type GetVertexAIReviewParams = {
  gcpProjectId: string;
  gcpLocation: string;
  gcpCredentials: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  userPrompt: string; // diff
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
  const {
    gcpProjectId,
    gcpLocation,
    gcpCredentials,
    userPrompt,
    systemPrompt,
    model,
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

  const request = {
    model: fullModelPath,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  };

  const [response] = await client.generateContent(request, {
    timeout,
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No feedback.';
};
