export interface EmailDraft {
  subject: string;
  body: string;
  confidenceScore: number;
  framework: 'PAS' | 'BAB';
  reasoning: string;
}
