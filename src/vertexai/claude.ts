import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { GoogleAuth } from 'google-auth-library';
import { GetVertexAIReviewParams } from '.';

/**
 * Claudeを使用してPRのレビューを取得します。
 * @param params - レビュー取得に必要なパラメータ
 * @returns Claudeによるレビューコメント
 */
export const getClaudeReview = async (
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

  const googleAuth = new GoogleAuth({
    credentials: gcpCredentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = new AnthropicVertex({
    projectId: gcpProjectId,
    region: gcpLocation,
    googleAuth,
    timeout,
  });

  try {
    const response = await client.messages.create({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 4096,
    });

    if (
      response.content.length > 0 &&
      response.content[0].type === 'text' &&
      response.content[0].text
    ) {
      return response.content[0].text;
    } else {
      return '';
    }
  } catch (error) {
    console.error('Claude API Error:', error);
    throw error;
  }
};
