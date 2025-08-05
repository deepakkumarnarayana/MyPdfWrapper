import { RealSessionsApi } from './implementations/RealSessionsApi';

// Direct API instance - MSW handles mocking transparently
export const sessionsApi = new RealSessionsApi();