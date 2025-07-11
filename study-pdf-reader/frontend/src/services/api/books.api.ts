import { RealBooksApi } from './implementations/RealBooksApi';

// Direct API instance - MSW handles mocking transparently
export const booksApi = new RealBooksApi();