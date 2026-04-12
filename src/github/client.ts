import { getOctokit } from '@actions/github';

export const createClient = (token: string) => getOctokit(token);

export type GitHubClient = ReturnType<typeof createClient>;
