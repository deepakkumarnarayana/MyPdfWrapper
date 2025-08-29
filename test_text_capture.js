// Simple test script to validate text capture system
console.log('🧪 Testing text capture system...');

// Wait for system to load
setTimeout(() => {
    console.log('🔍 Checking if flashcard detector is loaded...');
    
    if (typeof window.flashcardDetector !== 'undefined') {
        console.log('✅ Flashcard detector found!');
        console.log('📊 Current status:', {
            initialized: window.flashcardDetector.isInitialized,
            currentSelection: window.flashcardDetector.currentTextSelection,
            debugMode: window.flashcardDetector.debugMode
        });
        
        // Test the debug function
        if (typeof window.debugFlashcardAnnotations === 'function') {
            console.log('🔧 Running debug check...');
            window.debugFlashcardAnnotations();
        }
        
        // Test current text selection
        if (typeof window.debugTextCaptureState === 'function') {
            console.log('📝 Checking text capture state...');
            window.debugTextCaptureState();
        }
        
    } else {
        console.error('❌ Flashcard detector not found! The script may not have loaded.');
    }
    
    // Test basic selection functionality
    const selection = window.getSelection();
    console.log('📋 Current selection:', selection?.toString() || 'none');
    
}, 2000);

console.log('🚀 Test script loaded. Results will appear in 2 seconds...');