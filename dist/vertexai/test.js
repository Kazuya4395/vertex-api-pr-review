"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const test_getVertexAIReview = async () => {
    // --- START OF TEST CONFIGURATION ---
    // Please replace the placeholder values below with your actual
    // GCP project ID and location for local testing.
    const gcpProjectId = 'YOUR_GCP_PROJECT_ID'; // 👈 Replace with your GCP Project ID
    const gcpLocation = 'YOUR_GCP_LOCATION'; // 👈 Replace with your GCP Location (e.g., 'us-central1')
    // --- END OF TEST CONFIGURATION ---
    if (gcpProjectId === 'YOUR_GCP_PROJECT_ID' ||
        gcpLocation === 'YOUR_GCP_LOCATION') {
        console.error('Please configure your GCP_PROJECT_ID and GCP_LOCATION in src/vertexai/test.ts for local testing.');
        return;
    }
    const params = {
        gcpProjectId,
        gcpLocation,
        gcpCredentials: null, // Use Application Default Credentials
        userPrompt: 'Please review this code.',
        systemPrompt: 'You are a helpful code reviewer.',
        model: 'gemini-1.5-flash-001', // or 'claude-3-5-sonnet@20240620'
        timeout: 30000,
    };
    try {
        const review = await (0, index_1.getVertexAIReview)(params);
        console.log('Review:', review);
    }
    catch (error) {
        console.error('Error getting review:', error);
    }
};
test_getVertexAIReview();
