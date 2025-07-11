import { http, HttpResponse } from 'msw';
import { Book } from '../types/dashboard';

const mockBooks: Book[] = [
  {
    id: 'book-1',
    title: "Operating Systems",
    fileName: "operating-systems-book.pdf",
    fileUrl: "/api/files/operating-systems-book.pdf",
    pages: 'Pages 1-350',
    progress: 65,
    status: 'In Progress',
    totalPages: 350,
    currentPage: 78,
    uploadDate: '2025-01-15',
    fileSize: '2.5 MB',
    lastReadPage: 78,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'book-2',
    title: "Cloud Native Spring in Action",
    fileName: "CNSIA.pdf",
    fileUrl: "/api/files/CNSIA.pdf",
    pages: 'Pages 1-500',
    progress: 30,
    status: 'Started',
    totalPages: 500,
    currentPage: 145,
    uploadDate: '2025-01-10',
    fileSize: '3.2 MB',
    lastReadPage: 145,
    createdAt: '2025-01-10T10:00:00Z',
    updatedAt: '2025-01-10T10:00:00Z',
  },
  {
    id: 'book-3',
    title: "Advanced React Patterns",
    fileName: "react-patterns.pdf",
    fileUrl: "/api/files/react-patterns.pdf",
    pages: 'Pages 1-280',
    progress: 85,
    status: 'In Progress',
    totalPages: 280,
    currentPage: 238,
    uploadDate: '2025-01-05',
    fileSize: '1.8 MB',
    lastReadPage: 238,
    createdAt: '2025-01-05T10:00:00Z',
    updatedAt: '2025-01-05T10:00:00Z',
  },
  {
    id: 'book-4',
    title: "Database Systems Design",
    fileName: "database-systems.pdf",
    fileUrl: "/api/files/database-systems.pdf",
    pages: 'Pages 1-600',
    progress: 100,
    status: 'Completed',
    totalPages: 600,
    currentPage: 600,
    uploadDate: '2024-12-20',
    fileSize: '4.1 MB',
    lastReadPage: 600,
    createdAt: '2024-12-20T10:00:00Z',
    updatedAt: '2024-12-20T10:00:00Z',
  },
];

const mockResearchPapers = [
  {
    id: 'paper-1',
    title: 'Deep Learning for Natural Language Processing',
    pages: 'Pages 1-25',
    progress: 40,
    status: 'Started',
    authors: ['John Smith', 'Jane Doe'],
    publishedDate: '2024-03-15',
    journal: 'AI Research Journal',
    citations: 127,
  },
  {
    id: 'paper-2',
    title: 'Quantum Computing Applications',
    pages: 'Pages 1-18',
    progress: 75,
    status: 'In Progress',
    authors: ['Alice Johnson', 'Bob Williams'],
    publishedDate: '2024-02-28',
    journal: 'Quantum Computing Today',
    citations: 89,
  },
];

const mockSessions = [
  {
    id: 'session-1',
    title: 'ML Study Session',
    duration: '45 min',
    date: '2025-01-20',
    progress: 75,
    flashcardsCompleted: 25,
    totalFlashcards: 33,
  },
  {
    id: 'session-2',
    title: 'React Deep Dive',
    duration: '60 min',
    date: '2025-01-18',
    progress: 100,
    flashcardsCompleted: 20,
    totalFlashcards: 20,
  },
];

const mockAIProviders = [
  {
    id: 'claude',
    name: 'Claude',
    isActive: true,
    status: 'Connected',
    lastUsed: '2025-01-20T10:30:00Z',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    isActive: false,
    status: 'Disconnected',
    lastUsed: '2025-01-15T14:20:00Z',
  },
];

const simulateDelay = (ms: number = 300) => 
  new Promise(resolve => setTimeout(resolve, Math.random() * ms + 200));

export const handlers = [
  // Auth API
  http.post('/auth/login', async ({ request }) => {
    await simulateDelay();
    const { email, password } = await request.json() as { email: string; password: string };
    
    if (email === 'admin@example.com' && password === 'password') {
      return HttpResponse.json({
        data: {
          user: { id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin' },
          token: 'mock-jwt-token'
        },
        success: true,
        message: 'Login successful'
      });
    }
    
    return new HttpResponse(null, { status: 401 });
  }),

  http.post('/auth/logout', async () => {
    await simulateDelay();
    return HttpResponse.json({
      data: { success: true },
      success: true,
      message: 'Logout successful'
    });
  }),

  http.get('/auth/profile', async () => {
    await simulateDelay();
    return HttpResponse.json({
      data: { id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin' },
      success: true,
      message: 'Profile retrieved'
    });
  }),

  http.post('/auth/profile', async ({ request }) => {
    await simulateDelay();
    const updates = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      data: { id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin', ...updates },
      success: true,
      message: 'Profile updated'
    });
  }),

  http.get('*/api/auth/notifications', async () => {
    await simulateDelay();
    return HttpResponse.json({
      data: [
        { id: '1', message: 'Welcome to the platform', read: false, timestamp: new Date().toISOString() }
      ],
      success: true,
      message: 'Notifications retrieved'
    });
  }),

  http.post('*/api/auth/notifications/:id/read', async ({ params }) => {
    await simulateDelay();
    return HttpResponse.json({
      data: { id: params.id, message: 'Welcome to the platform', read: true, timestamp: new Date().toISOString() },
      success: true,
      message: 'Notification marked as read'
    });
  }),

  http.get('*/api/auth/check', async () => {
    await simulateDelay();
    return HttpResponse.json({
      data: { 
        authenticated: true, 
        user: { id: '1', email: 'admin@example.com', name: 'Admin User', role: 'admin' } 
      },
      success: true,
      message: 'Auth check successful'
    });
  }),

  // Books API
  http.get('*/api/books', async () => {
    await simulateDelay();
    return HttpResponse.json(mockBooks);
  }),

  http.get('*/api/books/:id', async ({ params }) => {
    await simulateDelay();
    const book = mockBooks.find(b => b.id === params.id);
    if (!book) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(book);
  }),

  http.post('*/api/books', async ({ request }) => {
    await simulateDelay(1500);
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    const newBook: Book = {
      id: `book-${Date.now()}`,
      title: file.name.replace('.pdf', ''),
      fileName: file.name,
      fileUrl: `/api/files/${file.name}`,
      pages: 'Pages 1-50',
      progress: 0,
      status: 'Started',
      totalPages: 50,
      currentPage: 1,
      uploadDate: new Date().toISOString().split('T')[0] || '',
      fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      lastReadPage: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockBooks.push(newBook);
    return HttpResponse.json(newBook);
  }),

  // Research Papers API
  http.get('*/api/research-papers', async () => {
    await simulateDelay();
    return HttpResponse.json(mockResearchPapers);
  }),

  http.post('*/api/research-papers', async ({ request }) => {
    await simulateDelay(1200);
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    const newPaper = {
      id: `paper-${Date.now()}`,
      title: file.name.replace('.pdf', ''),
      pages: 'Pages 1-20',
      progress: 0,
      status: 'Started',
      authors: ['Unknown Author'],
      publishedDate: new Date().toISOString().split('T')[0] || '',
      journal: 'Unknown Journal',
      citations: 0,
    };
    
    mockResearchPapers.push(newPaper);
    return HttpResponse.json(newPaper);
  }),

  // Sessions API
  http.get('*/api/sessions', async () => {
    await simulateDelay();
    return HttpResponse.json(mockSessions);
  }),

  http.post('*/api/sessions/:id/export-anki', async () => {
    await simulateDelay();
    return HttpResponse.json({ success: true, message: 'Session exported to Anki successfully' });
  }),

  // AI Providers API
  http.get('*/api/ai-providers', async () => {
    await simulateDelay();
    return HttpResponse.json(mockAIProviders);
  }),

  http.post('*/api/ai-providers/:id/select', async () => {
    await simulateDelay();
    return HttpResponse.json({ success: true });
  }),

  // System API
  http.get('*/api/system/services', async () => {
    await simulateDelay();
    return HttpResponse.json([
      { id: 'pdf-processor', name: 'PDF Processor', status: 'running' },
      { id: 'ai-service', name: 'AI Service', status: 'running' }
    ]);
  }),

  http.post('*/api/system/health-check', async () => {
    await simulateDelay();
    return HttpResponse.json({ success: true, message: 'System is healthy' });
  }),

  http.get('*/api/system/stats', async () => {
    await simulateDelay();
    return HttpResponse.json({
      totalTime: '12h 45m',
      cardsGenerated: '53',
      sessionsCompleted: '2',
      booksRead: '4',
    });
  }),

  http.post('*/api/system/learning-session', async () => {
    await simulateDelay();
    return HttpResponse.json({ sessionId: `session-${Date.now()}`, message: 'Learning session started' });
  }),

  // PDF file endpoints
  http.get('*/api/books/:id/pdf', async ({ params }) => {
    await simulateDelay();
    const book = mockBooks.find(b => b.id === params.id);
    if (!book) {
      return new HttpResponse(null, { status: 404 });
    }
    
    // Return the appropriate PDF file based on book ID
    let pdfPath = '/sample-pdfs/sample-ml-book.pdf';
    
    if (params.id === 'book-1') {
      pdfPath = '/sample-pdfs/operating-systems-book.pdf';
    } else if (params.id === 'book-2') {
      pdfPath = '/sample-pdfs/CNSIA.pdf';
    } else if (params.id === 'book-3') {
      pdfPath = '/sample-pdfs/multipage-sample.pdf';
    } else if (params.id === 'book-4') {
      pdfPath = '/sample-pdfs/sample-document.pdf';
    }
    
    try {
      // Fetch the PDF file from the public directory
      const response = await fetch(`${location.origin}${pdfPath}`);
      if (!response.ok) {
        return new HttpResponse(null, { status: 404 });
      }
      
      const pdfBuffer = await response.arrayBuffer();
      
      // Return the PDF file with proper headers
      return new HttpResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': pdfBuffer.byteLength.toString(),
        },
      });
    } catch (error) {
      console.error('Error loading PDF:', error);
      return new HttpResponse(null, { status: 500 });
    }
  }),

  // Mock JSON endpoints
  http.get('/mock/books.json', async () => {
    await simulateDelay();
    return HttpResponse.json(mockBooks);
  }),

  http.get('/mock/research-papers.json', async () => {
    await simulateDelay();
    return HttpResponse.json(mockResearchPapers);
  }),

  http.get('/mock/sessions.json', async () => {
    await simulateDelay();
    return HttpResponse.json(mockSessions);
  }),
];