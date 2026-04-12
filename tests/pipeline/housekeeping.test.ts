import {
  deleteOldInlineComments,
  upsertSummaryComment,
  parseReviewCount,
  incrementReviewCount,
} from '../../src/pipeline/housekeeping';
import * as core from '@actions/core';

// core モック
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
}));

const mockListReviewComments = jest.fn();
const mockDeleteReviewComment = jest.fn();
const mockListIssueComments = jest.fn();
const mockCreateIssueComment = jest.fn();
const mockUpdateIssueComment = jest.fn();

// pulls/comments モジュールモック
jest.mock('../../src/github/pulls', () => ({
  listReviewComments: (...args: any[]) => mockListReviewComments(...args),
  deleteReviewComment: (...args: any[]) => mockDeleteReviewComment(...args),
}));

jest.mock('../../src/github/comments', () => ({
  listIssueComments: (...args: any[]) => mockListIssueComments(...args),
  createIssueComment: (...args: any[]) => mockCreateIssueComment(...args),
  updateIssueComment: (...args: any[]) => mockUpdateIssueComment(...args),
}));

const mockClient = {} as any;

beforeEach(() => jest.clearAllMocks());

// ─── deleteOldInlineComments ────────────────────────────────────────

describe('deleteOldInlineComments', () => {
  test('<!-- ai-review-inline --> マーカー付きコメントのみ削除する', async () => {
    mockListReviewComments.mockResolvedValue([
      { id: 1, body: 'normal comment' },
      { id: 2, body: 'some text <!-- ai-review-inline -->' },
      { id: 3, body: '<!-- ai-review-inline -->\nother' },
    ]);
    mockDeleteReviewComment.mockResolvedValue({});

    const deleted = await deleteOldInlineComments(mockClient, 'o', 'r', 1);
    expect(deleted).toBe(2);
    expect(mockDeleteReviewComment).toHaveBeenCalledTimes(2);
    expect(mockDeleteReviewComment).toHaveBeenCalledWith(mockClient, 'o', 'r', 2);
    expect(mockDeleteReviewComment).toHaveBeenCalledWith(mockClient, 'o', 'r', 3);
  });

  test('マーカー付きコメントがなければ何もしない', async () => {
    mockListReviewComments.mockResolvedValue([
      { id: 1, body: 'normal comment' },
    ]);

    const deleted = await deleteOldInlineComments(mockClient, 'o', 'r', 1);
    expect(deleted).toBe(0);
    expect(mockDeleteReviewComment).not.toHaveBeenCalled();
  });
});

// ─── parseReviewCount / incrementReviewCount ────────────────────────

describe('parseReviewCount', () => {
  test('count を正しくパースする', () => {
    expect(parseReviewCount('<!-- ai-review-count=3 -->')).toBe(3);
  });

  test('count マーカーがなければ 0 を返す', () => {
    expect(parseReviewCount('no marker here')).toBe(0);
  });

  test('count=1 をパースする', () => {
    expect(parseReviewCount('<!-- ai-review-summary -->\n<!-- ai-review-count=1 -->')).toBe(1);
  });
});

describe('incrementReviewCount', () => {
  test('count を +1 する', () => {
    const body = '<!-- ai-review-count=2 -->\ncontent';
    const result = incrementReviewCount(body, 2);
    expect(result).toContain('<!-- ai-review-count=3 -->');
    expect(result).not.toContain('<!-- ai-review-count=2 -->');
  });

  test('マーカーがなければそのまま返す', () => {
    const body = 'no marker';
    expect(incrementReviewCount(body, 0)).toBe('no marker');
  });
});

// ─── upsertSummaryComment ───────────────────────────────────────────

describe('upsertSummaryComment', () => {
  test('初回: 既存コメントがなければ createComment で新規作成 (count=1)', async () => {
    mockListIssueComments.mockResolvedValue([
      { id: 10, body: 'unrelated comment' },
    ]);
    mockCreateIssueComment.mockResolvedValue({ data: { id: 99 } });

    const result = await upsertSummaryComment(mockClient, 'o', 'r', 1, 'new summary');
    expect(result.action).toBe('created');
    expect(result.commentId).toBe(99);
    expect(result.historyCount).toBe(1);
    expect(mockCreateIssueComment).toHaveBeenCalledWith(mockClient, 'o', 'r', 1, 'new summary');
  });

  test('2 回目: count=1 の既存コメントを count=2 で updateComment する', async () => {
    mockListIssueComments.mockResolvedValue([
      {
        id: 20,
        body: '<!-- ai-review-summary -->\n<!-- ai-review-count=1 -->\nold summary\n<!-- /ai-review-summary -->',
      },
    ]);
    mockUpdateIssueComment.mockResolvedValue({});

    const newBody = '<!-- ai-review-summary -->\n<!-- ai-review-count=1 -->\nnew summary\n<!-- /ai-review-summary -->';
    const result = await upsertSummaryComment(mockClient, 'o', 'r', 1, newBody);

    expect(result.action).toBe('updated');
    expect(result.commentId).toBe(20);
    expect(result.historyCount).toBe(2);

    // updateComment に渡された body で count が 2 になっている
    const calledBody = mockUpdateIssueComment.mock.calls[0][4];
    expect(calledBody).toContain('<!-- ai-review-count=2 -->');
    expect(calledBody).not.toContain('<!-- ai-review-count=1 -->');
  });

  test('updateComment が 404 を返した場合 createComment にフォールバックする', async () => {
    mockListIssueComments.mockResolvedValue([
      { id: 30, body: '<!-- ai-review-summary -->\n<!-- ai-review-count=1 -->\nold' },
    ]);
    const error404 = Object.assign(new Error('Not Found'), { status: 404 });
    mockUpdateIssueComment.mockRejectedValue(error404);
    mockCreateIssueComment.mockResolvedValue({ data: { id: 77 } });

    const result = await upsertSummaryComment(mockClient, 'o', 'r', 1, 'body');
    expect(result.action).toBe('created');
    expect(result.commentId).toBe(77);
    expect(result.historyCount).toBe(1);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('404'),
    );
  });

  test('updateComment が 422 を返した場合 createComment にフォールバックする', async () => {
    mockListIssueComments.mockResolvedValue([
      { id: 40, body: '<!-- ai-review-summary -->\n<!-- ai-review-count=2 -->\nold' },
    ]);
    const error422 = Object.assign(new Error('Unprocessable'), { status: 422 });
    mockUpdateIssueComment.mockRejectedValue(error422);
    mockCreateIssueComment.mockResolvedValue({ data: { id: 88 } });

    const result = await upsertSummaryComment(mockClient, 'o', 'r', 1, 'body');
    expect(result.action).toBe('created');
    expect(result.commentId).toBe(88);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('422'),
    );
  });

  test('updateComment が 500 を返した場合は throw する', async () => {
    mockListIssueComments.mockResolvedValue([
      { id: 50, body: '<!-- ai-review-summary -->\n<!-- ai-review-count=1 -->\nold' },
    ]);
    const error500 = Object.assign(new Error('Server Error'), { status: 500 });
    mockUpdateIssueComment.mockRejectedValue(error500);

    await expect(
      upsertSummaryComment(mockClient, 'o', 'r', 1, 'body'),
    ).rejects.toThrow('Server Error');
  });

  test('空のコメント一覧で新規作成する', async () => {
    mockListIssueComments.mockResolvedValue([]);
    mockCreateIssueComment.mockResolvedValue({ data: { id: 55 } });

    const result = await upsertSummaryComment(mockClient, 'o', 'r', 1, 'body');
    expect(result.action).toBe('created');
    expect(result.commentId).toBe(55);
    expect(result.historyCount).toBe(1);
  });
});
