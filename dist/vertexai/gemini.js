"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeminiReview = void 0;
const vertexai_1 = require("@google-cloud/vertexai");
/**
 * Vertex AIを使用してPRのレビューを取得します。
 * @param params - レビュー取得に必要なパラメータ
 * @returns Vertex AIによるレビューコメント
 */
const getGeminiReview = async (params) => {
    const { gcpProjectId, gcpLocation, gcpCredentials, userPrompt, systemPrompt, model, } = params;
    const vertexAI = new vertexai_1.VertexAI({
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
        return (response.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No feedback.');
    }
    catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
};
exports.getGeminiReview = getGeminiReview;
