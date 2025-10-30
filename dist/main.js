"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const github_2 = require("./github");
const vertexai_1 = require("./vertexai");
/**
 * メインの実行関数
 */
const main = async () => {
    try {
        // action.ymlからの入力を取得
        const githubToken = core.getInput('github-token', { required: true });
        const gcpProjectId = core.getInput('gcp-project-id', { required: true });
        const gcpLocation = core.getInput('gcp-location');
        const gcpCredentials = JSON.parse(core.getInput('gcp-credentials', { required: true }));
        const model = core.getInput('model');
        let systemPromptPath = core.getInput('system-prompt-path');
        if (!systemPromptPath) {
            // アクションの実行ディレクトリからの相対パスでデフォルトプロンプトを指定
            systemPromptPath = path_1.default.join(__dirname, '../prompts/system-prompt.md');
        }
        const diffSizeLimit = parseInt(core.getInput('diff-size-limit'), 10);
        const timeout = parseInt(core.getInput('timeout'), 10);
        // PR情報を取得
        if (!github_1.context.payload.pull_request) {
            throw new Error('This action can only be run on pull requests.');
        }
        const prNumber = github_1.context.payload.pull_request.number;
        const { owner, repo: repoName } = github_1.context.repo;
        console.log(`Fetching diff for PR #${prNumber} in ${owner}/${repoName}...`);
        const diff = await (0, github_2.getPullRequestDiff)(owner, repoName, prNumber, githubToken);
        console.log('Diff fetched successfully. Length:', diff.length);
        if (diff.length > diffSizeLimit) {
            console.log('Diff is too large, skipping AI review.');
            const commentBody = '🤖 **Vertex AI Review**\n\nDiffが大きすぎるため、AIによるレビューをスキップしました。';
            await (0, github_2.postCommentToGitHub)(owner, repoName, prNumber, githubToken, commentBody);
            return;
        }
        console.log(`Using model: ${model}`);
        console.log('Requesting review from Vertex AI...');
        const systemPrompt = (0, fs_1.readFileSync)(systemPromptPath, 'utf8');
        const reviewComment = await (0, vertexai_1.getVertexAIReview)({
            gcpProjectId,
            gcpLocation,
            gcpCredentials,
            userPrompt: diff,
            systemPrompt,
            model,
            timeout,
        });
        console.log('Review received from Vertex AI.');
        const finalComment = `🤖 **Vertex AI Review**\n\n${reviewComment}`;
        await (0, github_2.postCommentToGitHub)(owner, repoName, prNumber, githubToken, finalComment);
        console.log('Successfully posted review comment to GitHub.');
    }
    catch (error) {
        console.error('An unexpected error occurred:', error);
        process.exit(1);
    }
};
main();
