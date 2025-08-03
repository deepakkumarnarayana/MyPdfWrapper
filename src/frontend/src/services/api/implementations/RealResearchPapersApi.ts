import { IResearchPapersApi } from '../interfaces/IResearchPapersApi';
import { ResearchPaper } from '../../../types/dashboard';
import { httpClient } from '../../http.client';

export class RealResearchPapersApi implements IResearchPapersApi {
  async getResearchPapers(): Promise<ResearchPaper[]> {
    const response = await httpClient.get('/documents?document_type=research_paper');
    return response.data;
  }

  async uploadResearchPaper(file: File): Promise<ResearchPaper> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', 'research_paper');  // Specify document type
    
    const response = await httpClient.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }
}