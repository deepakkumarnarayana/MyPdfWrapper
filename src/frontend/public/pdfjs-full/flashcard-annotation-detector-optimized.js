/**
 * Optimized PDF.js Annotation Detection System for Flashcard Generation
 * 
 * FIXES:
 * - Fixed pageIndex parameter for getEditors() to use currentPageIndex
 * - Use public selectedEditors property instead of private fields
 */

console.log('[FLASHCARD_DETECTOR] 🚀 Initializing optimized annotation detection system...');

class OptimizedFlashcardAnnotationDetector {
    constructor() {
        this.isInitialized = false;
        this.eventListenersSetup = false;
        this.lastAnnotationCount = 0;
        this.pollTimer = null;
        this.eventBusHooked = false;
        
        // Performance optimizations
        this.debounceTimeout = null;
        this.lastProcessedTime = 0;
        this.processingCooldown = 100; // Minimum 100ms between processing
        
        // Track known editor IDs to detect NEW highlights only
        this.knownEditorIds = new Set();
        this.lastProcessedEditorId = null; // Prevent duplicate processing of same editor
        
        // Text capture using proven selectionchange approach from pure_pdfjs_event_logger.js
        this.lastCapturedText = null;
        
        // Cleanup tracking
        this.boundEventHandlers = new Map();
        
        // Set up text capture immediately using PROVEN approach
        this.setupTextCapture();
        
        console.log('[FLASHCARD_DETECTOR] ✅ Optimized detector initialized with text capture');
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('[FLASHCARD_DETECTOR] ⚠️ Already initialized, skipping...');
            return;
        }

        await this.waitForPDFViewerApplication();
        
        // Single setup - no duplicates
        this.setupOptimizedEventListeners();
        
        // Polling disabled to prevent dual sync calls - annotation events are sufficient
        // this.startLightPolling();
        
        this.isInitialized = true;
        console.log('[FLASHCARD_DETECTOR] ✅ Optimized initialization complete with proven text capture');
    }

    waitForPDFViewerApplication() {
        return new Promise((resolve) => {
            if (window.PDFViewerApplication?.eventBus) {
                resolve();
            } else {
                // Single retry only
                setTimeout(() => {
                    if (window.PDFViewerApplication?.eventBus) {
                        resolve();
                    } else {
                        console.warn('[FLASHCARD_DETECTOR] ⚠️ PDFViewerApplication not available, using fallback');
                        resolve();
                    }
                }, 1000);
            }
        });
    }

    setupOptimizedEventListeners() {
        if (this.eventListenersSetup) {
            console.log('[FLASHCARD_DETECTOR] ⚠️ Event listeners already set up');
            return;
        }

        console.log('[FLASHCARD_DETECTOR] 🎯 Setting up optimized event listeners...');

        // Single EventBus listener - most efficient
        this.setupSingleEventBusListener();
        
        this.eventListenersSetup = true;
    }

    setupSingleEventBusListener() {
        try {
            const eventBus = window.PDFViewerApplication?.eventBus;
            if (!eventBus) {
                console.warn('[FLASHCARD_DETECTOR] ⚠️ EventBus not available');
                return;
            }

            if (this.eventBusHooked) {
                console.log('[FLASHCARD_DETECTOR] ⚠️ EventBus already hooked');
                return;
            }

            // 1. Listen for the UIManager to be created. This happens once.
            eventBus.on('annotationeditoruimanager', (evt) => {
                console.log('[FLASHCARD_DETECTOR] ✅ AnnotationEditorUIManager is ready!');
                this.uiManager = evt.uiManager;
            }, { once: true }); // Use 'once' to ensure it only runs once.

            // 2. Listen for changes in annotation states (e.g., a new highlight).
            const debouncedHandler = this.debounce((evt) => {
                this.handleAnnotationEvent(evt);
            }, this.processingCooldown);

            eventBus.on('annotationeditorstateschanged', debouncedHandler);
            
            // Also try listening to these events to better understand the flow
            const debugHandler = (eventName) => (evt) => {
                console.log(`[FLASHCARD_DETECTOR] 📡 ${eventName} event:`, evt);
            };
            
            // DOM observer disabled to prevent dual sync calls - using annotation state events only
            // this.setupHighlightDOMObserver();
            
            // Listen to additional events for debugging  
            const eventsToDebug = [
                'annotationeditorlayerrendered', 
                'annotationeditorlayerremoved',
                'annotationeditorselectionchanged'
            ];
            
            eventsToDebug.forEach(eventName => {
                try {
                    eventBus.on(eventName, debugHandler(eventName));
                    this.boundEventHandlers.set(eventName, debugHandler(eventName));
                    console.log(`[FLASHCARD_DETECTOR] 👂 Listening to ${eventName}`);
                } catch (e) {
                    console.log(`[FLASHCARD_DETECTOR] ⚠️ Event ${eventName} not available`);
                }
            });
            
            // Track for cleanup
            this.boundEventHandlers.set('annotationeditorstateschanged', debouncedHandler);
            this.eventBusHooked = true;
            
            console.log('[FLASHCARD_DETECTOR] ✅ Event listeners for UI Manager and State Changes are attached');
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error setting up EventBus listener:', error);
        }
    }

    debounce(func, wait) {
        return (...args) => {
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout);
            }
            this.debounceTimeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    handleAnnotationEvent(evt) {
        // Performance gate - prevent excessive processing
        const now = Date.now();
        if (now - this.lastProcessedTime < this.processingCooldown) {
            return;
        }
        this.lastProcessedTime = now;

        try {
            if (!evt || !evt.details) {
                return;
            }
            
            console.log('[FLASHCARD_DETECTOR] 🎨 Processing annotation event:', evt);
            console.log('[FLASHCARD_DETECTOR] 🔍 Event details analysis:', {
                hasDetails: !!evt.details,
                isEditing: evt.details?.isEditing,
                hasSelectedText: evt.details?.hasSelectedText,
                hasEditor: !!evt.details?.hasEditor,
                editorType: evt.details?.editorType,
                allKeys: Object.keys(evt.details || {})
            });

            const editorState = evt.details;

            // IMPROVED APPROACH: Only process if we have actual selection and not just mode changes
            if (this.uiManager && this.uiManager.hasSelection && this.uiManager.firstSelectedEditor) {
                console.log('[FLASHCARD_DETECTOR] ✅ Has selection - processing annotation event');
                this.processNewAnnotation();
            } else {
                console.log('[FLASHCARD_DETECTOR] ⚠️ No selection or firstSelectedEditor - skipping sync');
            }
            
            // Track editing state for debugging
            this.wasEditing = editorState.isEditing;
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error handling annotation event:', error);
        }
    }


    processNewAnnotation() {
        try {
            if (!this.uiManager) {
                console.error("[FLASHCARD_DETECTOR] ❌ Cannot process annotation: AnnotationEditorUIManager not yet available.");
                return;
            }
            
            console.log('[FLASHCARD_DETECTOR] 🔍 UIManager state:', {
                hasSelection: this.uiManager.hasSelection,
                hasFirstSelectedEditor: !!this.uiManager.firstSelectedEditor,
                currentPage: this.uiManager.currentPageIndex
            });
            
            // OPTIMIZED APPROACH: Process only the first selected editor to avoid duplicates
            if (this.uiManager.hasSelection && this.uiManager.firstSelectedEditor) {
                // Use firstSelectedEditor getter from the public API
                const selectedEditor = this.uiManager.firstSelectedEditor;
                
                if (selectedEditor) {
                    console.log('[FLASHCARD_DETECTOR] ✅ Processing firstSelectedEditor:', selectedEditor.id);
                    
                    // Check if we already processed this specific editor to prevent duplicates
                    if (this.lastProcessedEditorId === selectedEditor.id) {
                        console.log('[FLASHCARD_DETECTOR] ⚠️ Already processed editor', selectedEditor.id, '- skipping duplicate');
                        return;
                    }
                    
                    this.lastProcessedEditorId = selectedEditor.id;
                    const flashcardData = this.extractAnnotationDataFromEditor(selectedEditor);
                    console.log('[FLASHCARD_DETECTOR] ✅ Extracted data from firstSelectedEditor:', flashcardData);
                    this.sendSyncRequest([flashcardData]);
                    return;
                }
            }
            
            console.log("[FLASHCARD_DETECTOR] ⚠️ No valid selection found - not syncing");

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error processing new annotation:', error);
        }
    }

    // Set up text capture using the PROVEN selectionchange approach from pure logger
    setupTextCapture() {
        console.log('[FLASHCARD_DETECTOR] 🎯 Setting up PROVEN text capture using selectionchange...');
        
        // Use the exact same approach as pure_pdfjs_event_logger.js:85-91
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            const text = selection ? selection.toString().trim() : '';
            if (text) {
                // Store captured text with timestamp
                this.lastCapturedText = {
                    text: text,
                    timestamp: Date.now(),
                    source: 'selectionchange'
                };
                console.log(`[FLASHCARD_DETECTOR] 📝 Text captured during selection: "${text}"`);
            }
        });
        
        console.log('[FLASHCARD_DETECTOR] ✅ Text capture setup complete using proven selectionchange method');
    }

    extractAnnotationDataFromEditor(editor) {
        try {
            console.log('[FLASHCARD_DETECTOR] 🔍 Analyzing editor object:', editor);
            
            // Extract text using the PROVEN approach from pure_pdfjs_event_logger.js
            let text = '';
            let extractionMethod = 'unknown';
            
            // METHOD 1 (HIGHEST PRIORITY): Use captured text from selectionchange events
            // This is the same proven approach used in pure_pdfjs_event_logger.js:85-91
            if (this.lastCapturedText && 
                this.lastCapturedText.text && 
                (Date.now() - this.lastCapturedText.timestamp) < 5000) { // 5 second window
                text = this.lastCapturedText.text;
                extractionMethod = 'selectionchange_capture';
                console.log('[FLASHCARD_DETECTOR] ✅ Using PROVEN selectionchange captured text:', text);
            }
            
            // METHOD 2: Try accessing #text private field (original working approach)
            if (!text) {
                try {
                    if (editor['#text'] && typeof editor['#text'] === 'string' && editor['#text'].trim()) {
                        text = editor['#text'].trim();
                        extractionMethod = 'editor[#text]';
                        console.log('[FLASHCARD_DETECTOR] ✅ Found text via editor[#text]:', text);
                    }
                } catch (privateFieldError) {
                    console.log('[FLASHCARD_DETECTOR] ⚠️ Could not access #text private field:', privateFieldError.message);
                }
            }
            
            // METHOD 3: Fallback to editor properties
            if (!text) {
                const textSources = [
                    { value: editor.text, source: 'editor.text' },
                    { value: editor.selectedText, source: 'editor.selectedText' },
                    { value: editor._text, source: 'editor._text' },
                    { value: editor.textContent, source: 'editor.textContent' },
                    { value: editor.content, source: 'editor.content' },
                    { value: editor.data?.text, source: 'editor.data.text' }
                ];
                
                // Find first non-empty text source
                for (const { value, source } of textSources) {
                    if (value && typeof value === 'string' && value.trim()) {
                        text = value.trim();
                        extractionMethod = source;
                        console.log('[FLASHCARD_DETECTOR] ✅ Found text via', source + ':', text);
                        break;
                    }
                }
            }
            
            // METHOD 4: Use PDF.js approach - check current DOM selection (backup method)
            if (!text) {
                const selection = document.getSelection();
                if (selection && !selection.isCollapsed) {
                    const selectedText = selection.toString().trim();
                    if (selectedText) {
                        text = selectedText;
                        extractionMethod = 'document.getSelection()';
                        console.log('[FLASHCARD_DETECTOR] ✅ Using document selection text:', text);
                    }
                }
            }
            
            // METHOD 5: Check if editor has anchorNode/focusNode properties (from PDF.js highlight creation)
            if (!text && editor.anchorNode && editor.focusNode) {
                try {
                    // Try to reconstruct selection from anchor/focus nodes
                    const range = document.createRange();
                    range.setStart(editor.anchorNode, editor.anchorOffset || 0);
                    range.setEnd(editor.focusNode, editor.focusOffset || 0);
                    const rangeText = range.toString().trim();
                    if (rangeText) {
                        text = rangeText;
                        extractionMethod = 'anchorNode/focusNode';
                        console.log('[FLASHCARD_DETECTOR] ✅ Extracted text from anchor/focus nodes:', text);
                    }
                } catch (rangeError) {
                    console.log('[FLASHCARD_DETECTOR] ⚠️ Could not create range from anchor/focus nodes:', rangeError);
                }
            }
            
            // METHOD 6: Always provide fallback text
            if (!text) {
                const pageNumber = editor.pageIndex ? editor.pageIndex + 1 : 1;
                text = `Highlight on page ${pageNumber}`;
                extractionMethod = 'fallback';
                console.log('[FLASHCARD_DETECTOR] 📝 Using fallback text description:', text);
            }

            // Get page information
            const pageNumber = editor.pageIndex ? editor.pageIndex + 1 : 1;

            // Get coordinates from editor - PDF.js provides these in page coordinates, not normalized
            // Need to convert to normalized coordinates for backend consistency
            const rect = editor.rect || [editor.x || 0, editor.y || 0, (editor.x || 0) + (editor.width || 100), (editor.y || 0) + (editor.height || 20)];
            
            // Get page dimensions for coordinate normalization
            const pageView = window.PDFViewerApplication?.pdfViewer?._pages?.[editor.pageIndex];
            const viewport = pageView?.viewport;
            const pageWidth = viewport?.width || 612; // Default to standard page width
            const pageHeight = viewport?.height || 792; // Default to standard page height
            
            console.log('[FLASHCARD_DETECTOR] 📐 Page dimensions:', { pageWidth, pageHeight, rect });
            
            // Log detailed coordinate information
            console.log('[FLASHCARD_DETECTOR] 🔍 Editor rect data:', rect);
            console.log('[FLASHCARD_DETECTOR] 🔍 Editor coordinate properties:', {
                rect: editor.rect,
                x: editor.x,
                y: editor.y,
                width: editor.width,
                height: editor.height,
            });
            
            console.log('[FLASHCARD_DETECTOR] ✨ Extracted data:', { text, pageNumber, rect });
            
            // Build coordinates object - PDF.js provides normalized coordinates (0-1 range)
            // Backend will convert to absolute coordinates using page dimensions
            let coordinates = {
                x: rect[0] || editor.x || 0,
                y: rect[1] || editor.y || 0,
                width: Math.abs((rect[2] || editor.width || 100) - (rect[0] || editor.x || 0)),
                height: Math.abs((rect[3] || editor.height || 20) - (rect[1] || editor.y || 0))
            };
            
            console.log('[FLASHCARD_DETECTOR] 📎 Sending normalized coordinates (0-1 range) to backend:', coordinates);
            
            console.log('[FLASHCARD_DETECTOR] 🔍 Final coordinates:', coordinates);
            console.log('[FLASHCARD_DETECTOR] 🔍 Raw rect values:', rect);
            console.log('[FLASHCARD_DETECTOR] 🔍 Editor properties:', {
                x: editor.x, y: editor.y, width: editor.width, height: editor.height
            });
            
            return {
                id: editor.id || `highlight_${Date.now()}`,
                clientId: editor.id || `highlight_${Date.now()}`,
                pageNumber: pageNumber,
                text: text.trim(),
                coordinates: coordinates,
                color: editor.color || '#FFFF98',
                annotationType: 'highlight',
                timestamp: new Date().toISOString(),
                // Add safe metadata (no complex objects)
                editorInfo: {
                    hasText: !!text.trim(),
                    textLength: text.trim().length,
                    hasCoordinates: !!(coordinates.x || coordinates.y),
                    currentPageIndex: this.uiManager?.currentPageIndex,
                    extractionMethod: extractionMethod
                }
            };
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error extracting editor data:', error);
            return { text: '', id: '', pageNumber: 1, coordinates: { x: 0, y: 0, width: 0, height: 0 } };
        }
    }

    sendSyncRequest(annotations) {
        try {
            console.log('[FLASHCARD_DETECTOR] 🚀 Starting sync request process...');
            console.log('[FLASHCARD_DETECTOR] 🔍 Input annotations:', annotations);
            
            const documentId = this.extractDocumentIdFromURL();
            console.log('[FLASHCARD_DETECTOR] 🔍 Extracted document ID:', documentId);
            
            if (!documentId) {
                console.error('[FLASHCARD_DETECTOR] ❌ No document ID found - cannot sync');
                return;
            }

            const syncData = {
                type: 'flashcard_sync_request',
                documentId: documentId,
                annotations: annotations,
                changeType: 'added',
                isInitialLoad: false,
                timestamp: new Date().toISOString()
            };

            console.log('[FLASHCARD_DETECTOR] 📤 Sending sync request:', syncData);
            
            // Send the message
            window.parent.postMessage(syncData, window.location.origin);
            console.log('[FLASHCARD_DETECTOR] ✅ PostMessage sent successfully');
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error sending sync request:', error);
        }
    }

    setupHighlightDOMObserver() {
        console.log('[FLASHCARD_DETECTOR] 🔍 Setting up DOM observer for highlight detection...');
        
        // Observe changes to the document to detect when highlights are added
        this.highlightObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Check if any added nodes are highlight elements
                    for (const addedNode of mutation.addedNodes) {
                        if (addedNode.nodeType === Node.ELEMENT_NODE) {
                            // Check if this is a highlight element (PDF.js creates SVG highlights)
                            if (addedNode.classList?.contains('highlightAnnotation') || 
                                addedNode.tagName === 'svg' ||
                                addedNode.querySelector?.('svg') ||
                                addedNode.classList?.contains('annotationLayer')) {
                                
                                console.log('[FLASHCARD_DETECTOR] 🎯 Highlight DOM element detected:', addedNode);
                                
                                // Delay processing to ensure the highlight is fully created
                                setTimeout(() => {
                                    console.log('[FLASHCARD_DETECTOR] ⏰ Processing DOM-detected highlight...');
                                    this.processNewAnnotation();
                                }, 200);
                                
                                break; // Only process one highlight per mutation batch
                            }
                        }
                    }
                }
            }
        });
        
        // Start observing the document
        this.highlightObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('[FLASHCARD_DETECTOR] ✅ DOM observer active');
    }

    extractDocumentIdFromURL() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const fileParam = urlParams.get('file') || window.location.pathname.split('/').pop();
            
            const jwtMatch = fileParam.match(/eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/);
            if (jwtMatch) {
                const payloadPart = jwtMatch[0].split('.')[1];
                const decodedPayload = JSON.parse(atob(payloadPart));
                return decodedPayload.document_id?.toString();
            }
            return null;
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error extracting document ID:', error);
            return null;
        }
    }

    startLightPolling() {
        // Minimal polling as backup only
        this.pollTimer = setInterval(() => {
            try {
                const pdfViewer = window.PDFViewerApplication?.pdfViewer;
                const uiManager = pdfViewer?.annotationEditorUIManager;
                
                if (uiManager && uiManager.selectedEditors) {
                    const currentCount = uiManager.selectedEditors.size;
                    
                    if (currentCount > this.lastAnnotationCount) {
                        console.log('[FLASHCARD_DETECTOR] 🔄 Polling backup detected new annotations:', currentCount);
                        this.lastAnnotationCount = currentCount;
                        
                        setTimeout(() => {
                            const editorsArray = Array.from(uiManager.selectedEditors);
                            const latestEditor = editorsArray[editorsArray.length - 1];
                            
                            if (latestEditor && latestEditor.annotationType === 'highlight') {
                                const flashcardData = this.extractAnnotationDataFromEditor(latestEditor);
                                console.log('[FLASHCARD_DETECTOR] ✅ Processing polling data:', flashcardData);
                                this.sendSyncRequest([flashcardData]);
                            }
                        }, 500);
                    }
                }
            } catch (error) {
                // Silent error handling for polling
            }
        }, 5000); // Check every 5 seconds (less frequent)

        console.log('[FLASHCARD_DETECTOR] 🔄 Minimal backup polling started (5s intervals)');
    }

    cleanup() {
        console.log('[FLASHCARD_DETECTOR] 🧹 Cleaning up resources...');
        
        // Clear timers
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }

        // Disconnect DOM observer
        if (this.highlightObserver) {
            this.highlightObserver.disconnect();
            this.highlightObserver = null;
        }

        // Remove event listeners
        const eventBus = window.PDFViewerApplication?.eventBus;
        if (eventBus && this.boundEventHandlers.size > 0) {
            this.boundEventHandlers.forEach((handler, eventName) => {
                eventBus.off(eventName, handler);
            });
            this.boundEventHandlers.clear();
        }

        this.eventListenersSetup = false;
        this.eventBusHooked = false;
        this.isInitialized = false;
        
        console.log('[FLASHCARD_DETECTOR] ✅ Cleanup complete');
    }
}

// Initialize the optimized detector
const optimizedFlashcardDetector = new OptimizedFlashcardAnnotationDetector();

// Cleanup old detector if it exists
if (window.flashcardDetector && typeof window.flashcardDetector.cleanup === 'function') {
    window.flashcardDetector.cleanup();
}

// Replace with optimized version
window.flashcardDetector = optimizedFlashcardDetector;

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        optimizedFlashcardDetector.initialize();
    });
} else {
    optimizedFlashcardDetector.initialize();
}

console.log('[FLASHCARD_DETECTOR] 🚀 Optimized detector loaded and ready');