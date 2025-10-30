import { VertexAI } from '@google-cloud/vertexai';

type GetVertexAIReviewParams = {
  gcpProjectId: string;
  gcpLocation: string;
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
export const getGeminiReview = async (
  params: GetVertexAIReviewParams,
): Promise<string> => {
  const {
    gcpProjectId,
    gcpLocation,
    gcpCredentials,
    userPrompt,
    systemPrompt,
    model,
  } = params;

  const vertexAI = new VertexAI({
    project: gcpProjectId,
    location: gcpLocation,
    googleAuthOptions: {
      credentials: gcpCredentials,
    },
  });

  try {
    const generativeModel = vertexAI.getGenerativeModel({
      model: model,
      systemInstruction: systemPrompt,
    });

    const request = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    };

    const resp = await generativeModel.generateContent(request);
    const response = resp.response;

    return (
      response.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No feedback.'
    );
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
};
