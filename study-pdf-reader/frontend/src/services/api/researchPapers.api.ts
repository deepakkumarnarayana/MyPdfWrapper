import { RealResearchPapersApi } from './implementations/RealResearchPapersApi';

// Direct API instance - MSW handles mocking transparently
export const researchPapersApi = new RealResearchPapersApi();