// Clean API exports - single point of access
export { booksApi } from './books.api';
export { researchPapersApi } from './researchPapers.api';
export { sessionsApi } from './sessions.api';
export { aiProvidersApi } from './aiProviders.api';
export { systemApi } from './system.api';

export type { 
  Book, 
  ResearchPaper, 
  Session, 
  AIProvider, 
  SystemService, 
  DashboardStats 
} from '../../types/dashboard';