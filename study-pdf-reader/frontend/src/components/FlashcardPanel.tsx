import { useState } from 'react'
import { PDF, Flashcard } from '../types'
import { usePDFStore } from '../stores/pdfStore'

interface FlashcardPanelProps {
  pdf: PDF
}

export function FlashcardPanel({ pdf }: FlashcardPanelProps) {
  const { flashcards, loading, generateFlashcards } = usePDFStore()
  const [currentFlashcard, setCurrentFlashcard] = useState<Flashcard | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [studyMode, setStudyMode] = useState(false)

  const handleGenerateFlashcards = async () => {
    await generateFlashcards(pdf.id)
  }

  const startStudyMode = () => {
    if (flashcards.length > 0) {
      setCurrentFlashcard(flashcards[0])
      setShowAnswer(false)
      setStudyMode(true)
    }
  }

  const nextFlashcard = () => {
    if (!currentFlashcard || flashcards.length === 0) return
    
    const currentIndex = flashcards.findIndex(f => f.id === currentFlashcard.id)
    const nextIndex = (currentIndex + 1) % flashcards.length
    
    setCurrentFlashcard(flashcards[nextIndex])
    setShowAnswer(false)
  }

  const exitStudyMode = () => {
    setStudyMode(false)
    setCurrentFlashcard(null)
    setShowAnswer(false)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-surface-100 text-surface-800'
    }
  }

  if (studyMode && currentFlashcard) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-surface-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-surface-900">Study Mode</h2>
            <button
              onClick={exitStudyMode}
              className="text-surface-500 hover:text-surface-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-surface-600">
            Card {flashcards.findIndex(f => f.id === currentFlashcard.id) + 1} of {flashcards.length}
          </p>
        </div>

        <div className="flex-1 p-4">
          <div className="h-full flex flex-col">
            <div className="flex-1 bg-white rounded-lg border border-surface-200 p-6 mb-4">
              <div className="mb-4">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentFlashcard.difficulty)}`}>
                  {currentFlashcard.difficulty}
                </span>
                {currentFlashcard.category && (
                  <span className="ml-2 text-xs text-surface-500">
                    {currentFlashcard.category}
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-surface-900 mb-2">Question:</h3>
                  <p className="text-surface-700">{currentFlashcard.question}</p>
                </div>
                
                {showAnswer && (
                  <div className="border-t border-surface-200 pt-4">
                    <h3 className="font-medium text-surface-900 mb-2">Answer:</h3>
                    <p className="text-surface-700">{currentFlashcard.answer}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-2">
              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="flex-1 btn btn-primary"
                >
                  Show Answer
                </button>
              ) : (
                <button
                  onClick={nextFlashcard}
                  className="flex-1 btn btn-primary"
                >
                  Next Card
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-surface-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-surface-900">Flashcards</h2>
          <span className="text-sm text-surface-500">
            {flashcards.length} cards
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {flashcards.length === 0 ? (
          <div className="p-4 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-surface-900 mb-2">
                No flashcards yet
              </h3>
              <p className="text-surface-600 text-sm mb-4">
                Generate AI-powered flashcards from your PDF content
              </p>
              <button
                onClick={handleGenerateFlashcards}
                disabled={loading}
                className={`btn btn-primary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Generating...</span>
                  </div>
                ) : (
                  'Generate Flashcards'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-4">
              <button
                onClick={startStudyMode}
                className="w-full btn btn-primary mb-4"
              >
                Start Study Session
              </button>
              
              <button
                onClick={handleGenerateFlashcards}
                disabled={loading}
                className={`w-full btn btn-secondary ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Generating...' : 'Generate More'}
              </button>
            </div>

            <div className="space-y-3">
              {flashcards.map((flashcard) => (
                <div
                  key={flashcard.id}
                  className="bg-white rounded-lg border border-surface-200 p-4 hover:border-surface-300 transition-colors"
                >
                  <div className="mb-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(flashcard.difficulty)}`}>
                      {flashcard.difficulty}
                    </span>
                    {flashcard.category && (
                      <span className="ml-2 text-xs text-surface-500">
                        {flashcard.category}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-surface-900">
                        {flashcard.question}
                      </p>
                    </div>
                    
                    <div className="text-xs text-surface-500">
                      <p className="truncate">
                        {flashcard.answer}
                      </p>
                    </div>
                  </div>
                  
                  {flashcard.times_reviewed > 0 && (
                    <div className="mt-2 text-xs text-surface-400">
                      Reviewed {flashcard.times_reviewed} times
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}