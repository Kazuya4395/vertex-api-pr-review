import { ReviewComment } from '../types/review';

/**
 * 各 inline コメントに紐付く Prompt To Fix With AI details セクションを
 * 機械的に生成する純粋関数 (FR-009)。LLM には依頼しない。
 * テンプレは requirements.md §4.3 を正とする。
 */
export const renderPromptToFixWithAI = (c: ReviewComment): string => {
  const range = c.startLine ? `${c.startLine}-${c.line}` : String(c.line);

  const suggestionBlock = c.suggestion
    ? `\n\n\`\`\`suggestion\n${c.suggestion}\n\`\`\``
    : '';

  return [
    '<details><summary>Prompt To Fix With AI</summary>',
    '',
    '`````markdown',
    'This is a comment left during a code review.',
    `Path: ${c.path}`,
    `Line: ${range}`,
    '',
    'Comment:',
    `**${c.title}**`,
    '',
    c.body,
    suggestionBlock,
    '',
    'How can I resolve this? If you propose a fix, please make it concise.',
    '`````',
    '',
    '</details>',
  ].join('\n');
};
