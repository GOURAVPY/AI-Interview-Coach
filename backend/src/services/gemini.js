import { GoogleGenAI, Modality } from '@google/genai';
import { env } from '../config/env.js';
import { buildSystemInstruction } from '../prompts/interviewer.js';
import { TOKEN_GRACE_SEC } from './usage.js';

// Ephemeral tokens live on the v1alpha API.
const client = env.geminiApiKey
  ? new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { apiVersion: 'v1alpha' } })
  : null;

const START_WINDOW_MIN = 2;

export function geminiConfigured() {
  return client !== null;
}

// Creates a single-use token locked to this interview's instructions.
// It expires when the reserved voice time runs out, so a session cannot outlive its budget.
// The real API key never leaves the server.
export async function createLiveToken(interview, seconds) {
  const now = Date.now();
  const expiresAt = new Date(now + (seconds + TOKEN_GRACE_SEC) * 1000);

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime: expiresAt.toISOString(),
      newSessionExpireTime: new Date(now + START_WINDOW_MIN * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: env.geminiLiveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildSystemInstruction(interview, Math.max(1, Math.round(seconds / 60))),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      },
    },
  });

  return { token: token.name, model: env.geminiLiveModel, expiresAt: expiresAt.toISOString() };
}
