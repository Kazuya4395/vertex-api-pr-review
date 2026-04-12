import { buildGeminiResponseSchema, buildClaudeInputSchema } from '../../src/vertexai/schema';

describe('buildGeminiResponseSchema', () => {
  const schema = buildGeminiResponseSchema();

  test('top-level type は object', () => {
    expect(schema.type).toBe('object');
  });

  test('required に summary, confidence, comments, stats が含まれる', () => {
    expect(schema.required).toEqual(
      expect.arrayContaining(['summary', 'confidence', 'comments', 'stats']),
    );
  });

  test('confidence に minimum/maximum がある', () => {
    expect(schema.properties.confidence.minimum).toBe(1);
    expect(schema.properties.confidence.maximum).toBe(5);
  });

  test('comments items に severity enum がある', () => {
    const items = schema.properties.comments.items;
    expect(items.properties.severity.enum).toEqual(['P0', 'P1', 'P2', 'P3']);
  });

  test('comments items に category enum がある', () => {
    const items = schema.properties.comments.items;
    expect(items.properties.category.enum).toEqual([
      'bug', 'security', 'perf', 'style', 'test', 'docs', 'a11y',
    ]);
  });

  test('mermaid.kind に sequenceDiagram と flowchart がある', () => {
    expect(schema.properties.mermaid.properties.kind.enum).toEqual([
      'sequenceDiagram', 'flowchart',
    ]);
  });
});

describe('buildClaudeInputSchema', () => {
  const schema = buildClaudeInputSchema();

  test('top-level type は object', () => {
    expect(schema.type).toBe('object');
  });

  test('required が Gemini 版と同じ', () => {
    const gemini = buildGeminiResponseSchema();
    expect(schema.required).toEqual(gemini.required);
  });

  test('description フィールドが存在する', () => {
    expect(schema.properties.summary.description).toBeDefined();
    expect(schema.properties.confidence.description).toBeDefined();
  });

  test('comments items の required に必須フィールドが含まれる', () => {
    const items = schema.properties.comments.items;
    expect(items.required).toEqual(
      expect.arrayContaining(['path', 'line', 'side', 'severity', 'category', 'title', 'body']),
    );
  });
});
