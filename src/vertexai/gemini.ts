import * as core from '@actions/core';
import { VertexAI } from '@google-cloud/vertexai';
import { ReviewResult } from '../types/review';
import { buildGeminiResponseSchema } from './schema';
import { RunLLMParams } from './index';

/**
 * Gemini を使用してPRレビューを取得する。
 * responseMimeType + responseSchema で構造化 JSON 出力を強制する。
 */
export const getGeminiReview = async (
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

  const vertexAI = new VertexAI({
    project: gcpProjectId,
    location: gcpLocation,
    googleAuthOptions: {
      credentials: gcpCredentials,
    },
  });

  const generativeModel = vertexAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildGeminiResponseSchema() as any,
      maxOutputTokens,
    },
  });

  const request = {
    contents: [{ role: 'user' as const, parts: [{ text: userPrompt }] }],
    timeout,
  };

  const resp = await generativeModel.generateContent(request);
  const response = resp.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  let result: ReviewResult;
  try {
    result = JSON.parse(text) as ReviewResult;
  } catch (e) {
    core.error(`Failed to parse Gemini JSON response: ${text.slice(0, 500)}`);
    throw new Error(`Gemini JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // T3.3: tokensUsed を usageMetadata から取得
  const totalTokens = response.usageMetadata?.totalTokenCount;
  if (totalTokens != null) {
    result.stats.tokensUsed = totalTokens;
  }

  return result;
};
