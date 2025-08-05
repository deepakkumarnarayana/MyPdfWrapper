import { ResearchPaper } from '../../../types/dashboard';

export interface IResearchPapersApi {
  getResearchPapers(): Promise<ResearchPaper[]>;
  uploadResearchPaper(file: File): Promise<ResearchPaper>;
}