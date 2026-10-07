import { GoogleGenAI, Modality } from '@google/genai';
import { env } from '../config/env.js';
import { buildSystemInstruction } from '../prompts/interviewer.js';

// Ephemeral tokens live on the v1alpha API.
const client = env.geminiApiKey
  ? new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { apiVersion: 'v1alpha' } })
  : null;

const TOKEN_LIFETIME_MIN = 12;
const START_WINDOW_MIN = 2;

export function geminiConfigured() {
  return client !== null;
}

// Creates a single-use token locked to this interview's instructions.
// The real API key never leaves the server.
export async function createLiveToken(interview) {
  const now = Date.now();
  const expiresAt = new Date(now + TOKEN_LIFETIME_MIN * 60 * 1000);

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime: expiresAt.toISOString(),
      newSessionExpireTime: new Date(now + START_WINDOW_MIN * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: env.geminiLiveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildSystemInstruction(interview),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
    },
  });

  return { token: token.name, model: env.geminiLiveModel, expiresAt: expiresAt.toISOString() };
}
