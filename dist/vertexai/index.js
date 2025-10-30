"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVertexAIReview = void 0;
const claude_1 = require("./claude");
const gemini_1 = require("./gemini");
/**
 * Vertex AIを使用してPRのレビューを取得します。
 * @param params - レビュー取得に必要なパラメータ
 * @returns Vertex AIによるレビューコメント
 */
const getVertexAIReview = async (params) => {
    const { model } = params;
    if (model.includes('claude')) {
        return (0, claude_1.getClaudeReview)(params);
    }
    return (0, gemini_1.getGeminiReview)(params);
};
exports.getVertexAIReview = getVertexAIReview;
