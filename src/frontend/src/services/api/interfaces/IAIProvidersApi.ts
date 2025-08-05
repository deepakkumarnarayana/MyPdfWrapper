import { AIProvider } from '../../../types/dashboard';

export interface IAIProvidersApi {
  getAIProviders(): Promise<AIProvider[]>;
  selectAIProvider(providerId: string): Promise<{ success: boolean }>;
}