// Text Capture Verification Script
// Paste this into the PDF viewer console to test if text capture is working
console.log('🧪 [TEXT_CAPTURE_TEST] Starting verification...');

// Test 1: Check if flashcard detector is loaded and text capture is working
function verifyTextCapture() {
    console.log('🔍 [TEXT_CAPTURE_TEST] Checking flashcard detector...');
    
    if (window.flashcardDetector) {
        console.log('✅ [TEXT_CAPTURE_TEST] Flashcard detector found');
        console.log('📊 [TEXT_CAPTURE_TEST] Current state:', {
            initialized: window.flashcardDetector.isInitialized,
            debugMode: window.flashcardDetector.debugMode,
            currentSelection: window.flashcardDetector.currentTextSelection
        });
        
        // Enable debug mode
        window.flashcardDetector.debugMode = true;
        console.log('🔧 [TEXT_CAPTURE_TEST] Debug mode enabled');
        
    } else {
        console.error('❌ [TEXT_CAPTURE_TEST] Flashcard detector not found!');
        return;
    }
    
    // Test current browser selection
    const selection = window.getSelection();
    const currentText = selection ? selection.toString().trim() : '';
    console.log('🖱️ [TEXT_CAPTURE_TEST] Current browser selection:', currentText || '(none)');
    
    // Test PDF.js EventBus
    if (window.PDFViewerApplication && window.PDFViewerApplication.eventBus) {
        console.log('✅ [TEXT_CAPTURE_TEST] PDF.js EventBus available');
        
        // Check if our event hook is working
        const eventBus = window.PDFViewerApplication.eventBus;
        console.log('📡 [TEXT_CAPTURE_TEST] EventBus methods:', 
            Object.getOwnPropertyNames(eventBus).filter(name => typeof eventBus[name] === 'function')
        );
    } else {
        console.error('❌ [TEXT_CAPTURE_TEST] PDF.js EventBus not found!');
    }
}

// Test 2: Monitor next annotation event
function monitorNextAnnotation() {
    console.log('🎧 [TEXT_CAPTURE_TEST] Monitoring for next annotation event...');
    
    let eventCount = 0;
    const maxEvents = 10;
    
    const originalPostMessage = window.parent.postMessage;
    window.parent.postMessage = function(message, origin) {
        eventCount++;
        
        if (message.type === 'flashcard-annotations-changed') {
            console.log('🎯 [TEXT_CAPTURE_TEST] Annotation event detected!');
            console.log('📊 [TEXT_CAPTURE_TEST] Event details:', {
                changeType: message.changeType,
                count: message.count,
                annotations: message.annotations?.map(a => ({
                    id: a.id?.substring(0, 20) + '...',
                    text: a.text,
                    textLength: (a.text || '').length,
                    hasText: !!(a.text && a.text.trim())
                }))
            });
            
            // Restore original after capturing one event
            window.parent.postMessage = originalPostMessage;
            console.log('✅ [TEXT_CAPTURE_TEST] Test complete - original postMessage restored');
        }
        
        if (eventCount > maxEvents) {
            window.parent.postMessage = originalPostMessage;
            console.log('🛑 [TEXT_CAPTURE_TEST] Max events reached - restoring original postMessage');
        }
        
        return originalPostMessage.call(this, message, origin);
    };
    
    console.log('✅ [TEXT_CAPTURE_TEST] Monitoring active - create a highlight now!');
}

// Test 3: Direct EventBus listener test
function testEventBusDirectly() {
    console.log('🔬 [TEXT_CAPTURE_TEST] Adding direct EventBus listener...');
    
    if (window.PDFViewerApplication && window.PDFViewerApplication.eventBus) {
        const eventBus = window.PDFViewerApplication.eventBus;
        
        eventBus._on('annotationeditorstateschanged', (evt) => {
            console.log('🔥 [TEXT_CAPTURE_TEST] DIRECT EventBus annotationeditorstateschanged:', evt);
            
            // Test window selection at event time
            const selection = window.getSelection();
            const selectionText = selection ? selection.toString().trim() : '';
            console.log('📝 [TEXT_CAPTURE_TEST] Window selection during event:', selectionText);
            
            // Test source.selectedEditors
            if (evt && evt.source && evt.source.selectedEditors) {
                console.log('📋 [TEXT_CAPTURE_TEST] selectedEditors found:', evt.source.selectedEditors);
                
                for (const [id, editor] of evt.source.selectedEditors) {
                    console.log('📄 [TEXT_CAPTURE_TEST] Editor:', id, editor);
                    
                    // Try to extract text from editor
                    if (editor && typeof editor === 'object') {
                        console.log('🔍 [TEXT_CAPTURE_TEST] Editor properties:', Object.keys(editor));
                        
                        // Look for text properties
                        ['text', 'content', 'value', '_text', 'textContent'].forEach(prop => {
                            if (editor[prop]) {
                                console.log(`✅ [TEXT_CAPTURE_TEST] Found text in ${prop}:`, editor[prop]);
                            }
                        });
                    }
                }
            }
        });
        
        console.log('✅ [TEXT_CAPTURE_TEST] Direct EventBus listener added');
    }
}

// Run all tests
verifyTextCapture();
monitorNextAnnotation();
testEventBusDirectly();

console.log('🧪 [TEXT_CAPTURE_TEST] Verification script loaded');
console.log('📋 [TEXT_CAPTURE_TEST] Instructions:');
console.log('1. Select some text in the PDF');
console.log('2. Use the highlight tool to create a highlight');
console.log('3. Watch the console for capture events');
console.log('4. If text shows as empty, we know the issue persists');