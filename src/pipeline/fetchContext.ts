import { GitHubClient } from '../github/client';
import { getPullRequest, listFiles } from '../github/pulls';

type PullFile = {
  filename: string;
  patch?: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
};

export type FetchContextResult = {
  headSha: string;
  files: PullFile[];
  totalSize: number;
};

/**
 * PR の基本情報と変更ファイル一覧を取得する。
 */
export const fetchContext = async (
  client: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<FetchContextResult> => {
  const { data: pr } = await getPullRequest(client, owner, repo, pullNumber);
  const files = await listFiles(client, owner, repo, pullNumber);

  const totalSize = files.reduce(
    (sum, f) => sum + (f.patch?.length ?? 0),
    0,
  );

  return {
    headSha: pr.head.sha,
    files: files as PullFile[],
    totalSize,
  };
};
