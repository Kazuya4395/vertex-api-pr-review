import { getPullRequest, listFiles, createReview, listReviewComments, deleteReviewComment } from '../../src/github/pulls';

// octokit のモック型
const mockGet = jest.fn();
const mockListFiles = jest.fn();
const mockCreateReview = jest.fn();
const mockListReviewComments = jest.fn();
const mockDeleteReviewComment = jest.fn();

const mockClient = {
  rest: {
    pulls: {
      get: mockGet,
      listFiles: mockListFiles,
      createReview: mockCreateReview,
      listReviewComments: mockListReviewComments,
      deleteReviewComment: mockDeleteReviewComment,
    },
  },
} as any;

beforeEach(() => jest.clearAllMocks());

describe('getPullRequest', () => {
  test('pulls.get を正しいパラメータで呼ぶ', async () => {
    mockGet.mockResolvedValue({ data: { number: 1 } });
    await getPullRequest(mockClient, 'owner', 'repo', 1);
    expect(mockGet).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 1,
    });
  });
});

describe('listFiles', () => {
  test('1 ページ分(100件未満)の場合 1 回で完了', async () => {
    mockListFiles.mockResolvedValue({ data: Array(50).fill({ filename: 'f' }) });
    const result = await listFiles(mockClient, 'o', 'r', 1);
    expect(result).toHaveLength(50);
    expect(mockListFiles).toHaveBeenCalledTimes(1);
    expect(mockListFiles).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      pull_number: 1,
      per_page: 100,
      page: 1,
    });
  });

  test('複数ページをページングして全件取得する', async () => {
    mockListFiles
      .mockResolvedValueOnce({ data: Array(100).fill({ filename: 'f' }) })
      .mockResolvedValueOnce({ data: Array(30).fill({ filename: 'f' }) });
    const result = await listFiles(mockClient, 'o', 'r', 1);
    expect(result).toHaveLength(130);
    expect(mockListFiles).toHaveBeenCalledTimes(2);
  });
});

describe('createReview', () => {
  test('event: COMMENT 固定で Review を作成する', async () => {
    mockCreateReview.mockResolvedValue({ data: { id: 123 } });
    await createReview(mockClient, {
      owner: 'o',
      repo: 'r',
      pullNumber: 1,
      commitId: 'abc',
      body: 'review body',
      comments: [
        { path: 'a.ts', line: 10, side: 'RIGHT', body: 'comment' },
      ],
    });
    expect(mockCreateReview).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'COMMENT' }),
    );
  });
});

describe('listReviewComments', () => {
  test('ページングして全件取得する', async () => {
    mockListReviewComments
      .mockResolvedValueOnce({ data: Array(100).fill({ id: 1 }) })
      .mockResolvedValueOnce({ data: Array(20).fill({ id: 2 }) });
    const result = await listReviewComments(mockClient, 'o', 'r', 1);
    expect(result).toHaveLength(120);
    expect(mockListReviewComments).toHaveBeenCalledTimes(2);
  });
});

describe('deleteReviewComment', () => {
  test('正しいパラメータで削除を呼ぶ', async () => {
    mockDeleteReviewComment.mockResolvedValue({ data: {} });
    await deleteReviewComment(mockClient, 'o', 'r', 42);
    expect(mockDeleteReviewComment).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      comment_id: 42,
    });
  });
});
