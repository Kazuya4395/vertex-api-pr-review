import { getVertexAIReview } from './index';

type GetVertexAIReviewParams = {
  gcpProjectId: string;
  gcpLocation: string;
  gcpCredentials: any;
  userPrompt: string;
  systemPrompt: string;
  model: string;
  timeout: number;
};

const main = async (): Promise<void> => {
  const gcpProjectId = '';
  const gcpLocation = 'us-east5';
  const gcpCredentials = {};

  const params: GetVertexAIReviewParams = {
    gcpProjectId,
    gcpLocation,
    gcpCredentials,
    userPrompt: `diff --git a/src/main.ts b/src/main.ts
index f2269a9..9d1a632 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,6 +1,6 @@
 import * as core from '@actions/core';
 
-const main = async (): Promise<void> => {
+const main = async (): Promise<boolean> => {
   try {
     core.debug('Hello, world!');
   } catch (error) {
`,
    systemPrompt: '日本語でレビューしてください。',
    model: 'claude-sonnet-4-5@20250929',
    timeout: 30000,
  };

  try {
    const review = await getVertexAIReview(params);
    console.log('Review:', review);
  } catch (error) {
    console.error('Error getting review:', error);
  }
};

main();
