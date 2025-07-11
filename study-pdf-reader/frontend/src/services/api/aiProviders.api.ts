import { RealAIProvidersApi } from './implementations/RealAIProvidersApi';

// Direct API instance - MSW handles mocking transparently
export const aiProvidersApi = new RealAIProvidersApi();