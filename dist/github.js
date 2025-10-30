"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCommentToGitHub = exports.getPullRequestDiff = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
/**
 * GitHubからPull Requestの差分を取得します。
 * @param owner - リポジトリのオーナー
 * @param repo - リポジトリ名
 * @param prNumber - Pull Requestの番号
 * @param token - GitHubトークン
 * @returns PRの差分テキスト
 */
const getPullRequestDiff = async (owner, repo, prNumber, token) => {
    const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await (0, node_fetch_1.default)(diffUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3.diff',
        },
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch diff: ${response.status} ${errorBody}`);
    }
    return response.text();
};
exports.getPullRequestDiff = getPullRequestDiff;
/**
 * GitHubのPull Requestにコメントを投稿します。
 * @param owner - リポジトリのオーナー
 * @param repo - リポジトリ名
 * @param prNumber - Pull Requestの番号
 * @param token - GitHubトークン
 * @param body - コメントの本文
 */
const postCommentToGitHub = async (owner, repo, prNumber, token, body) => {
    const commentUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    const response = await (0, node_fetch_1.default)(commentUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to post comment to GitHub: ${response.status} ${errorBody}`);
    }
};
exports.postCommentToGitHub = postCommentToGitHub;
