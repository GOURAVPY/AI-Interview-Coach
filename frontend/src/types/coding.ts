export interface CodingTest {
  args: unknown[];
  expected: unknown;
  hidden: boolean;
}

export interface CodingProblem {
  title: string;
  statement: string;
  topics: string[];
  examples: { input: string; output: string; explanation: string }[];
  starterCode: string;
  tests: CodingTest[];
}

export interface Annotation {
  line: number;
  message: string;
  severity: 'bug' | 'improve' | 'good' | 'hint';
}

export interface CodingReview {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  timeComplexity: string;
  spaceComplexity: string;
  annotations: Annotation[];
  idealSolution: string;
}

export interface CodingSession {
  id: string;
  role: string;
  level: string;
  status: 'in_progress' | 'submitted';
  problem: CodingProblem;
  hints: { text: string; line: number }[];
  code: string;
  passed: number;
  total: number;
  review: CodingReview | null;
  createdAt: string;
}

export interface CodingListItem {
  id: string;
  title: string;
  role: string;
  level: string;
  status: 'in_progress' | 'submitted';
  passed: number;
  total: number;
  score: number | null;
  createdAt: string;
}
