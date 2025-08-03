import { IAIProvidersApi } from '../interfaces/IAIProvidersApi';
import { AIProvider } from '../../../types/dashboard';
import { httpClient } from '../../http.client';

export class RealAIProvidersApi implements IAIProvidersApi {
  async getAIProviders(): Promise<AIProvider[]> {
    const response = await httpClient.get('/ai-providers');
    return response.data;
  }

  async selectAIProvider(providerId: string): Promise<{ success: boolean }> {
    const response = await httpClient.post(`/ai-providers/${providerId}/select`);
    return response.data;
  }
}