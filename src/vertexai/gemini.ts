import { VertexAI } from '@google-cloud/vertexai';
import { GetVertexAIReviewParams } from '.';

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
    gcpLocation = 'us-east5',
    gcpCredentials,
    userPrompt,
    systemPrompt,
    model,
    timeout,
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
      timeout,
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
