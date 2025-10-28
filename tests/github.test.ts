import fetch from 'node-fetch';
import { getPullRequestDiff, postCommentToGitHub } from '../src/github';

const { Response } = jest.requireActual('node-fetch');
jest.mock('node-fetch');

const fetchMock = fetch as jest.MockedFunction<typeof fetch>;

describe('GitHub API Functions', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getPullRequestDiff', () => {
    it('should fetch and return the diff text', async () => {
      const mockDiff = 'diff --git a/file.js b/file.js';
      fetchMock.mockResolvedValue(new Response(mockDiff, { status: 200 }));

      const diff = await getPullRequestDiff('owner', 'repo', 1, 'token');
      expect(diff).toBe(mockDiff);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/pulls/1',
        {
          headers: {
            Authorization: 'Bearer token',
            Accept: 'application/vnd.github.v3.diff',
          },
        },
      );
    });

    it('should throw an error if fetching the diff fails', async () => {
      fetchMock.mockResolvedValue(new Response('Not Found', { status: 404 }));
      await expect(
        getPullRequestDiff('owner', 'repo', 1, 'token'),
      ).rejects.toThrow('Failed to fetch diff: 404 Not Found');
    });
  });

  describe('postCommentToGitHub', () => {
    it('should post a comment successfully', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 201 }));

      await postCommentToGitHub('owner', 'repo', 1, 'token', 'comment');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/issues/1/comments',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body: 'comment' }),
        },
      );
    });

    it('should throw an error if posting a comment fails', async () => {
      fetchMock.mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );
      await expect(
        postCommentToGitHub('owner', 'repo', 1, 'token', 'comment'),
      ).rejects.toThrow(
        'Failed to post comment to GitHub: 500 Internal Server Error',
      );
    });
  });
});
