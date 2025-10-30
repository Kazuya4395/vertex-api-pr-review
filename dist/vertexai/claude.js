"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClaudeReview = void 0;
const vertex_sdk_1 = require("@anthropic-ai/vertex-sdk");
/**
 * Claudeを使用してPRのレビューを取得します。
 * @param params - レビュー取得に必要なパラメータ
 * @returns Claudeによるレビューコメント
 */
const getClaudeReview = async (params) => {
    const { gcpProjectId, gcpLocation, gcpCredentials, userPrompt, systemPrompt, model, } = params;
    const client = new vertex_sdk_1.AnthropicVertex({
        projectId: gcpProjectId,
        region: gcpLocation,
        googleAuth: gcpCredentials,
    });
    try {
        const response = await client.messages.create({
            model,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            max_tokens: 4096,
        });
        if (response.content.length > 0 &&
            response.content[0].type === 'text' &&
            response.content[0].text) {
            return response.content[0].text;
        }
        else {
            return '';
        }
    }
    catch (error) {
        console.error('Claude API Error:', error);
        throw error;
    }
};
exports.getClaudeReview = getClaudeReview;
