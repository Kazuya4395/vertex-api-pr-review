import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { GoogleAuth } from 'google-auth-library';

type GetClaudeReviewParams = {
  gcpProjectId: string;
  gcpLocation: string;
  gcpCredentials: any;
  userPrompt: string;
  systemPrompt: string;
  model: string;
};

/**
 * Claudeを使用してPRのレビューを取得します。
 * @param params - レビュー取得に必要なパラメータ
 * @returns Claudeによるレビューコメント
 */
export const getClaudeReview = async (
  params: GetClaudeReviewParams,
): Promise<string> => {
  const {
    gcpProjectId,
    gcpLocation,
    gcpCredentials,
    userPrompt,
    systemPrompt,
    model,
  } = params;

  const googleAuth = new GoogleAuth({
    credentials: gcpCredentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = new AnthropicVertex({
    projectId: gcpProjectId,
    region: gcpLocation,
    googleAuth,
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
