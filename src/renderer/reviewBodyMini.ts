import { ReviewResult, ReviewSeverity } from '../types/review';

/**
 * pulls.createReview の body に埋め込むミニサマリを生成する純粋関数。
 * テンプレは requirements.md §4.4「Review body ミニサマリ」を正とする。
 */
export const renderReviewBodyMini = (r: ReviewResult): string => {
  const counts = countBySeverity(r.comments);
  return [
    `\u{1F916} **AI Review** \u2014 Confidence ${r.confidence}/5 \u2014 \u{1F534}${counts.P0} \u{1F7E0}${counts.P1} \u{1F7E1}${counts.P2} \u{1F7E2}${counts.P3}`,
    '',
    '\u8A73\u7D30\u306F\u4E0B\u90E8\u306E AI Review Summary \u30B3\u30E1\u30F3\u30C8\u3092\u53C2\u7167\u3002',
  ].join('\n');
};

const countBySeverity = (
  comments: { severity: ReviewSeverity }[],
): Record<ReviewSeverity, number> => {
  const counts: Record<ReviewSeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const c of comments) {
    counts[c.severity]++;
  }
  return counts;
};
