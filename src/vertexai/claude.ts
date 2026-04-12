import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { GoogleAuth } from 'google-auth-library';
import { ReviewResult } from '../types/review';
import { buildClaudeInputSchema } from './schema';
import { RunLLMParams } from './index';

/**
 * Claude を使用してPRレビューを取得する。
 * tools + tool_choice で構造化 JSON 出力を強制する。
 */
export const getClaudeReview = async (
  params: RunLLMParams,
): Promise<ReviewResult> => {
  const {
    gcpProjectId,
    gcpLocation = 'us-east5',
    gcpCredentials,
    userPrompt,
    systemPrompt,
    model,
    timeout,
    maxOutputTokens,
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

  const response = await client.messages.create({
    model,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: maxOutputTokens,
    tools: [
      {
        name: 'submit_review',
        description: 'Submit the structured PR review result',
        input_schema: buildClaudeInputSchema() as any,
      },
    ],
    tool_choice: { type: 'tool' as const, name: 'submit_review' },
  });

  const toolUseBlock = response.content.find(
    (c): c is Extract<typeof c, { type: 'tool_use' }> => c.type === 'tool_use',
  );

  if (!toolUseBlock) {
    throw new Error('Claude did not return a tool_use block');
  }

  const result = toolUseBlock.input as ReviewResult;

  // T3.3: tokensUsed を usage から取得
  const usage = response.usage;
  if (usage) {
    result.stats.tokensUsed = usage.input_tokens + usage.output_tokens;
  }

  return result;
};
