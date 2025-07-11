import { IResearchPapersApi } from '../interfaces/IResearchPapersApi';
import { ResearchPaper } from '../../../types/dashboard';
import { httpClient } from '../../http.client';

export class RealResearchPapersApi implements IResearchPapersApi {
  async getResearchPapers(): Promise<ResearchPaper[]> {
    const response = await httpClient.get('/research-papers');
    return response.data;
  }

  async uploadResearchPaper(file: File): Promise<ResearchPaper> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await httpClient.post('/research-papers', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }
}