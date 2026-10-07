export interface InterviewSummaryItem {
  id: string;
  role: string;
  level: string;
  language: string;
  status: 'in_progress' | 'completed';
  overallScore: number | null;
  durationSec: number;
  createdAt: string;
}

export interface TranscriptTurn {
  speaker: 'interviewer' | 'candidate';
  text: string;
}

export interface ReportAnswer {
  question: string;
  answerExcerpt: string;
  score: number;
  feedback: string;
  betterAnswer: string;
}

export interface SpeechMetrics {
  paceUnit: string;
  pace: number | null;
  totalUnits: number;
  speakingSec: number;
  fillers: { label: string; count: number }[];
  totalFillers: number;
}

export interface Report {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  answers: ReportAnswer[];
  metrics: SpeechMetrics;
}

export interface InterviewDetail extends InterviewSummaryItem {
  jobPost: string;
  transcript: TranscriptTurn[];
  report: Report | null;
}

export interface DashboardSummary {
  stats: {
    interviews: number;
    averageScore: number | null;
    practiceMinutes: number;
    streakDays: number;
  };
  recent: InterviewSummaryItem[];
}
