import { ReviewResult } from '../types/review';
import { renderPromptToFixWithAI } from './promptToFixWithAi';

type HeadInfo = {
  sha: string;
  commitTitle: string;
  commitUrl: string;
};

/**
 * AI Review Summary コメント (Issue コメント) を生成する純粋関数。
 * テンプレは requirements.md §4.4 のフルテンプレを正とする。
 */
export const renderIssueSummary = (
  r: ReviewResult,
  historyCount: number,
  head: HeadInfo,
): string => {
  const lines: string[] = [];

  // 開始マーカー
  lines.push('<!-- ai-review-summary -->');
  lines.push(`<!-- ai-review-count=${historyCount} -->`);
  lines.push('');

  // Summary
  lines.push('<h3>AI Review Summary</h3>');
  lines.push('');
  lines.push(r.summary);
  lines.push('');

  // Confidence Score
  lines.push(`<h3>Confidence Score: ${r.confidence}/5</h3>`);
  lines.push('');

  // Important Files Changed
  if (r.importantFiles.length > 0) {
    lines.push('<h3>Important Files Changed</h3>');
    lines.push('');
    lines.push('| Filename | Overview |');
    lines.push('|----------|----------|');
    for (const f of r.importantFiles) {
      lines.push(`| ${f.path} | ${f.overview} |`);
    }
    lines.push('');
  }

  // Mermaid (optional)
  if (r.mermaid) {
    lines.push(`<h3>${r.mermaid.kind === 'sequenceDiagram' ? 'Sequence Diagram' : 'Flowchart'}</h3>`);
    lines.push('');
    lines.push('```mermaid');
    lines.push(r.mermaid.source);
    lines.push('```');
    lines.push('');
  }

  // Prompt To Fix All With AI
  if (r.comments.length > 0) {
    lines.push('<details><summary>Prompt To Fix All With AI</summary>');
    lines.push('');
    lines.push('`````markdown');
    const prompts = r.comments.map((c) => {
      const range = c.startLine ? `${c.startLine}-${c.line}` : String(c.line);
      const suggestionBlock = c.suggestion
        ? `\n\n\`\`\`suggestion\n${c.suggestion}\n\`\`\``
        : '';
      return [
        `Path: ${c.path}`,
        `Line: ${range}`,
        '',
        `**${c.title}**`,
        '',
        c.body,
        suggestionBlock,
      ].join('\n');
    });
    lines.push(prompts.join('\n\n---\n\n'));
    lines.push('');
    lines.push('How can I resolve this? If you propose a fix, please make it concise.');
    lines.push('`````');
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // Footer
  const tokensSuffix = r.stats.tokensUsed != null ? ` | tokens: ${r.stats.tokensUsed}` : '';
  lines.push(`<sub>Reviews (${historyCount}): Last reviewed commit: ["${head.commitTitle}"](${head.commitUrl})${tokensSuffix}</sub>`);
  lines.push('');
  if (r.comments.length > 0) {
    lines.push(`> AI Review also left **${r.comments.length} inline comments** on this PR.`);
    lines.push('');
  }

  // 終了マーカー
  lines.push('<!-- /ai-review-summary -->');

  return lines.join('\n');
};
