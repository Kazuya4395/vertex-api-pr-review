import { renderPromptToFixWithAI } from '../../src/renderer/promptToFixWithAi';
import { ReviewComment } from '../../src/types/review';

const baseComment: ReviewComment = {
  path: 'src/utils.ts',
  line: 25,
  side: 'RIGHT',
  severity: 'P2',
  category: 'perf',
  title: '不要なループ',
  body: 'このループは O(n^2) です。Set を使ってください。',
};

describe('renderPromptToFixWithAI', () => {
  test('details タグ構造が正しい', () => {
    const result = renderPromptToFixWithAI(baseComment);
    expect(result).toContain('<details><summary>Prompt To Fix With AI</summary>');
    expect(result).toContain('</details>');
  });

  test('5 重バッククォート構造がある', () => {
    const result = renderPromptToFixWithAI(baseComment);
    expect(result).toContain('`````markdown');
    expect(result).toContain('`````');
  });

  test('末尾に How can I resolve this? が含まれる', () => {
    const result = renderPromptToFixWithAI(baseComment);
    expect(result).toContain('How can I resolve this? If you propose a fix, please make it concise.');
  });

  test('path / line / title / body が正しく埋め込まれる', () => {
    const result = renderPromptToFixWithAI(baseComment);
    expect(result).toContain('Path: src/utils.ts');
    expect(result).toContain('Line: 25');
    expect(result).toContain('**不要なループ**');
    expect(result).toContain('このループは O(n^2) です。');
  });

  test('startLine がある場合 line range が含まれる', () => {
    const result = renderPromptToFixWithAI({ ...baseComment, startLine: 20, line: 25 });
    expect(result).toContain('Line: 20-25');
  });

  test('suggestion がある場合はブロックに含まれる', () => {
    const result = renderPromptToFixWithAI({
      ...baseComment,
      suggestion: 'const set = new Set(arr);',
    });
    expect(result).toContain('```suggestion');
    expect(result).toContain('const set = new Set(arr);');
  });

  test('suggestion がない場合は suggestion ブロックが含まれない', () => {
    const result = renderPromptToFixWithAI(baseComment);
    expect(result).not.toContain('```suggestion');
  });
});
