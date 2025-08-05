import { RealSystemApi } from './implementations/RealSystemApi';

// Direct API instance - MSW handles mocking transparently
export const systemApi = new RealSystemApi();