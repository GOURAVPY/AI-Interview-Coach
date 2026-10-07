import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  HINT_RULES,
  HINT_SCHEMA,
  PROBLEM_RULES,
  PROBLEM_SCHEMA,
  REVIEW_RULES,
  REVIEW_SCHEMA,
  buildProblemRequest,
} from '../prompts/coding.js';
import { runReference } from './sandbox.js';

const client = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

export class ProblemGenerationError extends Error {}

async function askJson({ system, prompt, schema, temperature, thinking = ThinkingLevel.LOW }) {
  const response = await client.models.generateContent({
    model: env.geminiScoringModel,
    contents: prompt,
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
      temperature,
      thinkingConfig: { thinkingLevel: thinking },
    },
  });
  return JSON.parse(response.text);
}

const problemSchema = z.object({
  title: z.string().min(1).max(120),
  statement: z.string().min(20).max(2500),
  topics: z.array(z.string()).max(6),
  examples: z.array(z.object({ input: z.string(), output: z.string(), explanation: z.string() })).min(1).max(4),
  starterCode: z.string().min(10).max(1500),
  referenceSolution: z.string().min(10).max(6000),
  tests: z.array(z.object({ argsJson: z.string(), expectedJson: z.string(), hidden: z.boolean() })).min(5).max(12),
});

function parseTests(tests) {
  return tests.map((t) => {
    const args = JSON.parse(t.argsJson);
    if (!Array.isArray(args)) throw new Error('args must be an array');
    return { args, expected: JSON.parse(t.expectedJson), hidden: t.hidden, argsJson: t.argsJson, expectedJson: t.expectedJson };
  });
}

// Generates a problem, then proves it is fair by running the AI's own reference solution against every test.
// Anything that does not pass is thrown away and regenerated.
export async function generateProblem({ role, level, avoidTitles = [] }) {
  const prompt = buildProblemRequest({ role, level, avoidTitles });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = problemSchema.parse(await askJson({ system: PROBLEM_RULES, prompt, schema: PROBLEM_SCHEMA, temperature: 0.9 }));
      const tests = parseTests(raw.tests);

      const verdict = await runReference(raw.referenceSolution, tests.map(({ argsJson, expectedJson }) => ({ argsJson, expectedJson })));
      if (!verdict.ok || !verdict.results.every((r) => r.passed)) {
        console.warn(`Problem "${raw.title}" rejected on attempt ${attempt}: reference solution did not pass its own tests`);
        continue;
      }

      return {
        problem: {
          title: raw.title,
          statement: raw.statement,
          topics: raw.topics,
          examples: raw.examples,
          starterCode: raw.starterCode,
          tests: tests.map(({ args, expected, hidden }) => ({ args, expected, hidden })),
        },
        referenceSolution: raw.referenceSolution,
      };
    } catch (err) {
      console.warn(`Problem generation attempt ${attempt} failed:`, err.message);
    }
  }
  throw new ProblemGenerationError('Could not generate a valid problem');
}

const hintSchema = z.object({ text: z.string().min(1).max(900), line: z.number().int().min(0).max(500) });

export async function giveHint({ problem, code, level, previousHints }) {
  const prompt = [
    `Hint level: ${level} of 3.`,
    `Problem title: ${problem.title}`,
    `Problem: ${problem.statement}`,
    previousHints.length ? `Hints already given:\n- ${previousHints.join('\n- ')}` : 'No hints given yet.',
    'Candidate code (numbered):',
    '<<<CODE',
    numbered(code),
    'CODE>>>',
  ].join('\n');

  const out = hintSchema.parse(await askJson({ system: HINT_RULES, prompt, schema: HINT_SCHEMA, temperature: 0.3 }));
  const lineCount = code.split('\n').length;
  return { text: out.text, line: out.line >= 1 && out.line <= lineCount ? out.line : 0 };
}

const reviewSchema = z.object({
  score: z.number().int().min(1).max(10),
  summary: z.string().min(1),
  strengths: z.array(z.string()).max(4),
  improvements: z.array(z.string()).max(5),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  annotations: z.array(z.object({ line: z.number().int(), message: z.string(), severity: z.string() })).max(8),
  idealSolution: z.string().min(1),
});

export async function reviewCode({ problem, code, passed, total, failures }) {
  const prompt = [
    `Problem title: ${problem.title}`,
    `Problem: ${problem.statement}`,
    `Test results: ${passed} of ${total} passed.`,
    failures.length ? `Failing cases:\n${failures.map((f) => `- ${f}`).join('\n')}` : 'All tests passed.',
    'Candidate code (numbered):',
    '<<<CODE',
    numbered(code),
    'CODE>>>',
  ].join('\n');

  const out = reviewSchema.parse(await askJson({ system: REVIEW_RULES, prompt, schema: REVIEW_SCHEMA, temperature: 0 }));
  const lineCount = code.split('\n').length;
  const severities = new Set(['bug', 'improve', 'good']);
  return {
    ...out,
    annotations: out.annotations
      .filter((a) => a.line >= 1 && a.line <= lineCount)
      .map((a) => ({ ...a, severity: severities.has(a.severity) ? a.severity : 'improve' })),
  };
}

function numbered(code) {
  return code
    .split('\n')
    .map((line, i) => `${i + 1}: ${line}`)
    .join('\n');
}
