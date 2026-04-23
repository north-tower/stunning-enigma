export interface LeadDossier {
  name: string;
  company: string | null;
  role: string | null;
  recentNews: string | null;
  painPoint: string | null;
  toneMatch: string | null;
  rawSearchSnippets: string[];
}
