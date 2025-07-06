import axios from 'axios'
import { PDF, Flashcard, FlashcardGenerationResponse, APIError } from '../types'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail)
    }
    throw new Error(error.message || 'An unexpected error occurred')
  }
)

export const pdfService = {
  async getAllPDFs(): Promise<PDF[]> {
    const response = await api.get<PDF[]>('/pdfs')
    return response.data
  },

  async getPDF(id: number): Promise<PDF> {
    const response = await api.get<PDF>(`/pdfs/${id}`)
    return response.data
  },

  async uploadPDF(file: File): Promise<PDF> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post<PDF>('/pdfs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  async deletePDF(id: number): Promise<void> {
    await api.delete(`/pdfs/${id}`)
  },

  async getFlashcards(pdfId: number): Promise<Flashcard[]> {
    const response = await api.get<Flashcard[]>(`/pdfs/${pdfId}/flashcards`)
    return response.data
  },

  async generateFlashcards(pdfId: number): Promise<FlashcardGenerationResponse> {
    const response = await api.post<FlashcardGenerationResponse>(
      `/pdfs/${pdfId}/flashcards/generate`
    )
    return response.data
  },

  async updateFlashcard(id: number, data: Partial<Flashcard>): Promise<Flashcard> {
    const response = await api.put<Flashcard>(`/flashcards/${id}`, data)
    return response.data
  },

  async deleteFlashcard(id: number): Promise<void> {
    await api.delete(`/flashcards/${id}`)
  },

  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    const response = await api.get('/health')
    return response.data
  },
}