// Live debugging script to inject into PDF viewer console
console.log('🔬 [LIVE_DEBUG] Starting live annotation debugging...');

// Test 1: Check if flashcard detector is loaded
setTimeout(() => {
    if (window.flashcardDetector) {
        console.log('✅ [LIVE_DEBUG] Flashcard detector found:', {
            initialized: window.flashcardDetector.isInitialized,
            debugMode: window.flashcardDetector.debugMode,
            useEditorSystem: window.flashcardDetector.useEditorSystem
        });
        
        // Enable debug mode if not already enabled
        if (!window.flashcardDetector.debugMode) {
            window.flashcardDetector.debugMode = true;
            console.log('🔧 [LIVE_DEBUG] Debug mode enabled');
        }
        
        // Test current text selection
        if (window.flashcardDetector.currentTextSelection) {
            console.log('📝 [LIVE_DEBUG] Current text selection:', window.flashcardDetector.currentTextSelection);
        } else {
            console.log('📭 [LIVE_DEBUG] No current text selection');
        }
        
    } else {
        console.error('❌ [LIVE_DEBUG] Flashcard detector not found!');
    }
}, 1000);

// Test 2: Monitor text selection events
let selectionMonitor = null;

function startSelectionMonitor() {
    if (selectionMonitor) return;
    
    console.log('🎧 [LIVE_DEBUG] Starting selection monitor...');
    
    selectionMonitor = setInterval(() => {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';
        
        if (text && text.length > 0) {
            console.log('📋 [LIVE_DEBUG] Current selection detected:', text);
            
            if (window.flashcardDetector?.currentTextSelection) {
                const captured = window.flashcardDetector.currentTextSelection;
                const age = Date.now() - captured.timestamp;
                console.log('⏰ [LIVE_DEBUG] Captured text:', captured.text, `(${age}ms ago)`);
            }
        }
    }, 500);
}

function stopSelectionMonitor() {
    if (selectionMonitor) {
        clearInterval(selectionMonitor);
        selectionMonitor = null;
        console.log('🛑 [LIVE_DEBUG] Selection monitor stopped');
    }
}

// Test 3: Monitor postMessage events
let messageCount = 0;
const originalPostMessage = window.parent.postMessage;

window.parent.postMessage = function(message, origin) {
    messageCount++;
    
    if (message.type === 'flashcard-annotations-changed') {
        console.log(`📤 [LIVE_DEBUG] Message ${messageCount}: flashcard-annotations-changed`);
        console.log('📋 [LIVE_DEBUG] Annotations text content:', 
            message.annotations?.map(a => ({
                id: a.id?.substring(0, 20) + '...',
                text: a.text || '(EMPTY)',
                textLength: (a.text || '').length
            }))
        );
    } else {
        console.log(`📤 [LIVE_DEBUG] Message ${messageCount}: ${message.type}`);
    }
    
    // Call original function
    return originalPostMessage.call(this, message, origin);
};

// Test 4: Test functions for manual testing
window.testLiveDebug = {
    startMonitor: startSelectionMonitor,
    stopMonitor: stopSelectionMonitor,
    
    checkTextCapture: () => {
        console.log('🔍 [LIVE_DEBUG] Current text capture state:');
        const selection = window.getSelection();
        console.log('- Browser selection:', selection?.toString() || '(none)');
        console.log('- Detector selection:', window.flashcardDetector?.currentTextSelection || '(none)');
        
        if (window.debugFlashcardAnnotations) {
            console.log('🔧 [LIVE_DEBUG] Running detector debug...');
            window.debugFlashcardAnnotations();
        }
    },
    
    simulateHighlight: () => {
        console.log('🎯 [LIVE_DEBUG] Simulating highlight creation...');
        const selection = window.getSelection();
        if (selection?.toString()) {
            console.log('💡 [LIVE_DEBUG] Text selected, triggering mouseup...');
            window.dispatchEvent(new Event('mouseup'));
            
            setTimeout(() => {
                console.log('📝 [LIVE_DEBUG] Checking annotations after mouseup...');
                if (window.flashcardDetector) {
                    window.flashcardDetector.checkEditorAnnotations();
                }
            }, 200);
        } else {
            console.log('⚠️ [LIVE_DEBUG] No text selected. Please select text first.');
        }
    }
};

console.log('🔬 [LIVE_DEBUG] Ready! Use these commands:');
console.log('- testLiveDebug.startMonitor() - Start monitoring selections');
console.log('- testLiveDebug.stopMonitor() - Stop monitoring');
console.log('- testLiveDebug.checkTextCapture() - Check current state');
console.log('- testLiveDebug.simulateHighlight() - Test highlight workflow');