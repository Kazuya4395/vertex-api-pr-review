import { getVertexAIReview } from '../src/vertexai';
import aiplatform from '@google-cloud/aiplatform';

const mockGenerateContent = jest.fn();
jest.mock('@google-cloud/aiplatform', () => ({
  v1: {
    PredictionServiceClient: jest.fn().mockImplementation(() => ({
      generateContent: mockGenerateContent,
    })),
  },
}));

describe('getVertexAIReview', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return a review comment from Vertex AI', async () => {
    const mockResponse = {
      candidates: [{ content: { parts: [{ text: 'LGTM!' }] } }],
    };
    mockGenerateContent.mockResolvedValue([mockResponse]);

    const params = {
      gcpProjectId: 'test-project',
      gcpLocation: 'us-central1',
      gcpCredentials: { client_email: 'test@test.com', private_key: 'test' },
      diff: 'test diff',
      model: 'gemini-test',
      prompt: 'Review this: {{DIFF}}',
      timeout: 60000,
    };

    const review = await getVertexAIReview(params);

    expect(review).toBe('LGTM!');
    expect(mockGenerateContent).toHaveBeenCalledWith(
      {
        model:
          'projects/test-project/locations/us-central1/publishers/google/models/gemini-test',
        contents: [
          { role: 'user', parts: [{ text: 'Review this: test diff' }] },
        ],
      },
      { timeout: 60000 },
    );
  });

  it('should return "No feedback." if there are no candidates', async () => {
    mockGenerateContent.mockResolvedValue([{}]);
    const params = {
      gcpProjectId: 'test-project',
      gcpLocation: 'us-central1',
      gcpCredentials: { client_email: 'test@test.com', private_key: 'test' },
      diff: 'test diff',
      model: 'gemini-test',
      prompt: 'Review this: {{DIFF}}',
      timeout: 60000,
    };

    const review = await getVertexAIReview(params);
    expect(review).toBe('No feedback.');
  });
});
