import { create } from 'zustand'
import { PDF, Flashcard } from '../types'
import { pdfService } from '../services/pdfService'

interface PDFStore {
  pdfs: PDF[]
  currentPDF: PDF | null
  flashcards: Flashcard[]
  loading: boolean
  error: string | null
  
  // Actions
  loadPDFs: () => Promise<void>
  selectPDF: (pdf: PDF) => void
  uploadPDF: (file: File) => Promise<void>
  deletePDF: (id: number) => Promise<void>
  loadFlashcards: (pdfId: number) => Promise<void>
  generateFlashcards: (pdfId: number) => Promise<void>
  clearError: () => void
}

export const usePDFStore = create<PDFStore>((set, get) => ({
  pdfs: [],
  currentPDF: null,
  flashcards: [],
  loading: false,
  error: null,

  loadPDFs: async () => {
    set({ loading: true, error: null })
    try {
      const pdfs = await pdfService.getAllPDFs()
      set({ pdfs, loading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load PDFs', 
        loading: false 
      })
    }
  },

  selectPDF: (pdf: PDF) => {
    set({ currentPDF: pdf })
    // Load flashcards for this PDF
    get().loadFlashcards(pdf.id)
  },

  uploadPDF: async (file: File) => {
    set({ loading: true, error: null })
    try {
      const pdf = await pdfService.uploadPDF(file)
      set(state => ({ 
        pdfs: [...state.pdfs, pdf], 
        loading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to upload PDF', 
        loading: false 
      })
    }
  },

  deletePDF: async (id: number) => {
    set({ loading: true, error: null })
    try {
      await pdfService.deletePDF(id)
      set(state => ({ 
        pdfs: state.pdfs.filter(pdf => pdf.id !== id),
        currentPDF: state.currentPDF?.id === id ? null : state.currentPDF,
        flashcards: state.currentPDF?.id === id ? [] : state.flashcards,
        loading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete PDF', 
        loading: false 
      })
    }
  },

  loadFlashcards: async (pdfId: number) => {
    set({ loading: true, error: null })
    try {
      const flashcards = await pdfService.getFlashcards(pdfId)
      set({ flashcards, loading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load flashcards', 
        loading: false 
      })
    }
  },

  generateFlashcards: async (pdfId: number) => {
    set({ loading: true, error: null })
    try {
      const response = await pdfService.generateFlashcards(pdfId)
      set({ flashcards: response.flashcards, loading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to generate flashcards', 
        loading: false 
      })
    }
  },

  clearError: () => set({ error: null })
}))