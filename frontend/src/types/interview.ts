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

export interface InterviewDetail extends InterviewSummaryItem {
  jobPost: string;
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
