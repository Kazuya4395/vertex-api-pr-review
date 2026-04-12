import { listIssueComments, createIssueComment, updateIssueComment } from '../../src/github/comments';

const mockListComments = jest.fn();
const mockCreateComment = jest.fn();
const mockUpdateComment = jest.fn();

const mockClient = {
  rest: {
    issues: {
      listComments: mockListComments,
      createComment: mockCreateComment,
      updateComment: mockUpdateComment,
    },
  },
} as any;

beforeEach(() => jest.clearAllMocks());

describe('listIssueComments', () => {
  test('1 ページ分(100件未満)の場合 1 回で完了', async () => {
    mockListComments.mockResolvedValue({ data: Array(30).fill({ id: 1 }) });
    const result = await listIssueComments(mockClient, 'o', 'r', 1);
    expect(result).toHaveLength(30);
    expect(mockListComments).toHaveBeenCalledTimes(1);
    expect(mockListComments).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      issue_number: 1,
      per_page: 100,
      page: 1,
    });
  });

  test('複数ページをページングして全件取得する', async () => {
    mockListComments
      .mockResolvedValueOnce({ data: Array(100).fill({ id: 1 }) })
      .mockResolvedValueOnce({ data: Array(40).fill({ id: 2 }) });
    const result = await listIssueComments(mockClient, 'o', 'r', 1);
    expect(result).toHaveLength(140);
    expect(mockListComments).toHaveBeenCalledTimes(2);
  });
});

describe('createIssueComment', () => {
  test('正しいパラメータで Issue コメントを作成する', async () => {
    mockCreateComment.mockResolvedValue({ data: { id: 99 } });
    await createIssueComment(mockClient, 'o', 'r', 1, 'hello');
    expect(mockCreateComment).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      issue_number: 1,
      body: 'hello',
    });
  });
});

describe('updateIssueComment', () => {
  test('正しいパラメータで Issue コメントを更新する', async () => {
    mockUpdateComment.mockResolvedValue({ data: { id: 99 } });
    await updateIssueComment(mockClient, 'o', 'r', 99, 'updated');
    expect(mockUpdateComment).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      comment_id: 99,
      body: 'updated',
    });
  });
});
