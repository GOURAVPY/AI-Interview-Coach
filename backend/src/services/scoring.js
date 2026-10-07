import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { REPORT_JSON_SCHEMA, SCORING_RULES, buildScoringInput } from '../prompts/scoring.js';

const client = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

const reportSchema = z.object({
  answers: z
    .array(
      z.object({
        question: z.string().min(1),
        answerExcerpt: z.string(),
        score: z.number().int().min(1).max(10),
        feedback: z.string().min(1),
        betterAnswer: z.string().min(1),
      }),
    )
    .max(8),
  summary: z.string().min(1),
  strengths: z.array(z.string()).max(5),
  improvements: z.array(z.string()).max(5),
});

export class NotEnoughAnswersError extends Error {}

async function askModel(input) {
  const response = await client.models.generateContent({
    model: env.geminiScoringModel,
    contents: input,
    config: {
      systemInstruction: SCORING_RULES,
      responseMimeType: 'application/json',
      responseJsonSchema: REPORT_JSON_SCHEMA,
      temperature: 0,
    },
  });
  return reportSchema.parse(JSON.parse(response.text));
}

// Scores the interview. Retries once if the model returns something that fails validation.
export async function scoreInterview(interview) {
  const input = buildScoringInput(interview);

  let result;
  try {
    result = await askModel(input);
  } catch (err) {
    console.warn('Scoring attempt failed, retrying once:', err.message);
    result = await askModel(input);
  }

  if (result.answers.length === 0) throw new NotEnoughAnswersError('No answers to score');

  const mean = result.answers.reduce((sum, a) => sum + a.score, 0) / result.answers.length;
  return { ...result, overallScore: Math.round(mean * 10) };
}
