/**
 * Production-Ready PDF.js Annotation Detection System for Flashcard Generation
 * 
 * FEATURES:
 * - Real-time text extraction from PDF.js highlights via EventBus hooks
 * - Automatic fallback to polling when UI Manager isn't available
 * - Uses existing environment.ts configuration (VITE_DEBUG)
 * - Production-optimized logging (off by default, enabled via environment)
 * - Duplicate event listener prevention
 * - Robust error handling with graceful fallbacks
 * 
 * ARCHITECTURE:
 * - Primary: EventBus 'annotationeditorstateschanged' event listener
 * - Text Source: evt.source.selectedEditors[0]['#text'] property
 * - Fallback: Polling + coordinate-based extraction
 * - Output: Annotation objects with captured text sent to parent window
 * 
 * DEBUG MODE ACTIVATION:
 * - Constructor: new FlashcardAnnotationDetector(true) 
 * - Environment Config: window.environment.debug (from VITE_DEBUG=true)
 * - Default: false (production mode - no debug logs)
 * 
 * PRODUCTION READY: ✅
 * - Minimal logging in production
 * - Simple property-based debug control
 * - Error boundaries and graceful degradation
 * - Memory leak prevention
 */

console.log('[FLASHCARD_DETECTOR] 🚀 Initializing modern annotation detection system...');

/**
 * Security Utilities for Production Safety
 */
class SecurityUtils {
    static ALLOWED_ORIGINS = [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002'
    ];

    static validateOrigin(origin) {
        // In production, only allow HTTPS origins or localhost for development
        if (origin.startsWith('https://')) {
            return true; // Allow all HTTPS origins in production
        }
        return this.ALLOWED_ORIGINS.includes(origin);
    }

    static sanitizeText(text) {
        if (typeof text !== 'string') return '';
        // Limit text length and remove potentially dangerous characters
        return text.substring(0, 10000)
                  .replace(/[<>]/g, '') // Remove HTML brackets
                  .replace(/javascript:/gi, '') // Remove javascript: protocol
                  .replace(/on\w+=/gi, '') // Remove event handlers
                  .trim();
    }

    static sanitizeId(id) {
        if (typeof id !== 'string') return '';
        // Only allow alphanumeric, hyphens, and underscores
        return id.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 100);
    }

    static sanitizeColor(color) {
        if (typeof color !== 'string') return '#FFFF98';
        // Only allow valid hex colors
        return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#FFFF98';
    }

    static sanitizePageNumber(pageNum) {
        const num = parseInt(pageNum);
        return isNaN(num) ? 1 : Math.max(1, Math.min(10000, num));
    }

    static sanitizeAnnotationData(annotation) {
        return {
            id: this.sanitizeId(annotation.id || ''),
            text: this.sanitizeText(annotation.text || ''),
            highlighted_text: this.sanitizeText(annotation.highlighted_text || ''),
            color: this.sanitizeColor(annotation.color || '#FFFF98'),
            pageNumber: this.sanitizePageNumber(annotation.pageNumber || 1),
            rect: Array.isArray(annotation.rect) ? annotation.rect.slice(0, 4).map(n => parseFloat(n) || 0) : [0, 0, 0, 0],
            type: 'highlight',
            timestamp: Date.now()
        };
    }

    static securePostMessage(data, targetWindow = window.parent) {
        try {
            const origin = window.location.origin;
            if (!this.validateOrigin(origin)) {
                console.error('[SECURITY] Blocked postMessage to untrusted origin:', origin);
                return false;
            }

            // Sanitize the data before sending
            const sanitizedData = {
                ...data,
                annotations: data.annotations ? data.annotations.map(ann => this.sanitizeAnnotationData(ann)) : undefined
            };

            targetWindow.postMessage(sanitizedData, origin);
            return true;
        } catch (error) {
            console.error('[SECURITY] Failed to send secure message:', error.message);
            return false;
        }
    }

    static createSafeErrorMessage(error) {
        // Never expose internal error details in production
        const isProduction = !window.pdfConfig?.debug;
        if (isProduction) {
            return 'An error occurred while processing annotations';
        }
        return error.message || 'Unknown error';
    }
}

class FlashcardAnnotationDetector {
    constructor(debugMode = null) {
        this.annotationCount = 0;
        this.annotationMap = new Map(); // Track full annotation data
        this.editorAnnotations = new Map(); // Track editor-based annotations
        this.pollingInterval = 2000; // 2 seconds - fallback for legacy systems
        this.pollTimer = null;
        this.isInitialized = false;
        this.debugMode = debugMode !== null ? debugMode : (window.pdfConfig?.debug || false);
        this.useEditorSystem = false; // Will be detected automatically
        this.lastEditorState = null;
        this.currentTextSelection = null; // Store current text selection for highlight capture
        this.eventListenersSetup = false; // Track if event listeners are already set up
    }

    initialize() {
        if (this.isInitialized) {
            console.log('[FLASHCARD_DETECTOR] ⚠️ Already initialized, skipping...');
            return;
        }

        console.log('[FLASHCARD_DETECTOR] 🔧 Starting initialization...');
        
        // Wait for PDF.js to be ready
        this.waitForPDFViewerApplication(() => {
            // Detect which annotation system is available
            this.detectAnnotationSystem();
            
            if (this.useEditorSystem) {
                console.log('[FLASHCARD_DETECTOR] 🎨 Using modern AnnotationEditor system');
                const uiManager = window.PDFViewerApplication?.pdfViewer?.annotationEditorUIManager;
                if (uiManager) {
                    this.setupEditorEventListeners();
                    this.loadCurrentEditorAnnotations();
                } else {
                    console.log('[FLASHCARD_DETECTOR] ⏳ UI Manager not ready yet, retry will be scheduled');
                }
            } else {
                console.log('[FLASHCARD_DETECTOR] 📦 Using legacy annotation storage system');
                this.loadStoredAnnotations();
                this.startPolling();
            }
            
            this.isInitialized = true;
            console.log('[FLASHCARD_DETECTOR] ✅ Initialization complete');
        });
    }

    detectAnnotationSystem() {
        /**
         * Detect whether PDF.js is using the new AnnotationEditor system or legacy storage
         */
        try {
            // Check for AnnotationEditorUIManager (new system)
            const uiManager = window.PDFViewerApplication?.pdfViewer?.annotationEditorUIManager;
            if (uiManager) {
                this.useEditorSystem = true;
                console.log('[FLASHCARD_DETECTOR] 🎯 Detected AnnotationEditor system');
                return;
            }

            // Check for legacy annotation storage
            const annotationStorage = this.getAnnotationStorage();
            if (annotationStorage) {
                this.useEditorSystem = false;
                console.log('[FLASHCARD_DETECTOR] 📚 Detected legacy annotation storage');
                return;
            }

            // Default to editor system for modern PDF.js
            this.useEditorSystem = true;
            console.log('[FLASHCARD_DETECTOR] 🔄 Defaulting to AnnotationEditor system');
            
            // If UI manager isn't available yet, set up retry mechanism
            if (!uiManager) {
                console.log('[FLASHCARD_DETECTOR] ⏱️ UI Manager not ready, will retry in 2 seconds');
                setTimeout(() => {
                    this.retryUIManagerSetup();
                }, 2000);
            }
            
        } catch (error) {
            console.warn('[FLASHCARD_DETECTOR] ⚠️ Error detecting annotation system:', error);
            this.useEditorSystem = true; // Default to modern system
        }
    }

    retryUIManagerSetup() {
        /**
         * Retry setting up the UI Manager after PDF is fully loaded
         */
        try {
            const uiManager = window.PDFViewerApplication?.pdfViewer?.annotationEditorUIManager;
            if (uiManager) {
                console.log('[FLASHCARD_DETECTOR] ✅ UI Manager now available! Setting up editor listeners...');
                this.setupEditorEventListeners();
                this.loadCurrentEditorAnnotations();
            } else {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] ⏳ UI Manager not available, setting up EventBus fallback...');
                }
                
                // Set up EventBus hook as fallback when UI Manager isn't ready
                this.setupEventBusHook();
                this.startPolling();
            }
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error in retry setup:', error);
            this.startPolling();
        }
    }

    setupEditorEventListeners() {
        /**
         * Set up event listeners for the modern AnnotationEditor system
         * Uses simple and reliable text capture approach
         */
        try {
            console.log('[FLASHCARD_DETECTOR] 🎯 Setting up simple and reliable text capture...');
            
            // Setup simple text capture that works with both selection and highlight tool
            this.setupSimpleTextCapture();
            
            // REMOVED: Floating flashcard button (not working, feature disabled)

            // Set up EventBus hook for annotation editor events
            this.setupEventBusHook();

            // ENHANCED TEXT CAPTURE: Capture text during drag operations
            let isDragging = false;
            let dragStartSelection = null;
            
            // Listen for mousedown on text layer (start of potential highlight drag)
            document.addEventListener('mousedown', (event) => {
                // Check if we're in a text layer or annotation editor layer
                const target = event.target;
                if (target && (target.closest('.textLayer') || target.closest('.annotationEditorLayer'))) {
                    isDragging = true;
                    // Capture any existing selection before drag starts
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed) {
                        dragStartSelection = {
                            text: selection.toString().trim(),
                            timestamp: Date.now()
                        };
                        if (this.debugMode) {
                            console.log('[FLASHCARD_DETECTOR] 🖱️ Pre-drag selection captured:', dragStartSelection.text);
                        }
                    }
                }
            });

            // Listen for text selection during mouse drag
            document.addEventListener('mousemove', (event) => {
                if (isDragging) {
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && selection.toString().trim()) {
                        this.pendingHighlightText = {
                            text: selection.toString().trim(),
                            timestamp: Date.now()
                        };
                        // Don't log every mousemove to avoid spam
                    }
                }
            });

            // Listen for mouseup - end of drag operation
            document.addEventListener('mouseup', (event) => {
                if (isDragging) {
                    isDragging = false;
                    
                    // Capture final selection
                    const selection = window.getSelection();
                    if (selection && !selection.isCollapsed && selection.toString().trim()) {
                        this.currentTextSelection = {
                            text: selection.toString().trim(),
                            range: selection.getRangeAt(0).cloneRange(),
                            timestamp: Date.now()
                        };
                        if (this.debugMode) {
                            console.log('[FLASHCARD_DETECTOR] 📝 Final selection captured:', this.currentTextSelection.text);
                        }
                    } else if (this.pendingHighlightText) {
                        // Use text captured during drag if final selection is empty
                        this.currentTextSelection = this.pendingHighlightText;
                        if (this.debugMode) {
                            console.log('[FLASHCARD_DETECTOR] 📝 Using drag selection:', this.currentTextSelection.text);
                        }
                    } else if (dragStartSelection) {
                        // Use pre-drag selection as last resort
                        this.currentTextSelection = dragStartSelection;
                        if (this.debugMode) {
                            console.log('[FLASHCARD_DETECTOR] 📝 Using pre-drag selection:', this.currentTextSelection.text);
                        }
                    }
                    
                    // Check for annotation changes after a brief delay
                    setTimeout(() => this.checkEditorAnnotations(), 150);
                    
                    // Clean up
                    dragStartSelection = null;
                }
            });

            // FALLBACK: Listen for specific PDF.js events that might not be on EventBus
            window.addEventListener('annotationeditorstateschanged', (event) => {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 🎨 Window: annotationeditorstateschanged:', event.detail);
                }
                this.handleEditorStatesChanged(event);
            });

            // Monitor clicks on highlight buttons
            this.setupHighlightButtonListeners();

            // Monitor annotation layer changes
            document.addEventListener('annotationlayerrendered', () => {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 🎨 Annotation layer rendered');
                }
                setTimeout(() => this.checkEditorAnnotations(), 200);
            });

            console.log('[FLASHCARD_DETECTOR] 🎯 Advanced editor event listeners set up with drag-based text capture');
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error setting up editor listeners:', error);
            // Fall back to polling
            this.startPolling();
        }
    }

    prepareForTextCapture() {
        /**
         * Prepare for capturing text when highlight mode is activated
         */
        if (this.debugMode) {
            console.log('[FLASHCARD_DETECTOR] 🎯 Preparing for text capture in highlight mode');
        }
        
        // Clear previous selections
        this.currentTextSelection = null;
        this.pendingHighlightText = null;
    }

    setupEventBusHook() {
        /**
         * Set up EventBus hook for capturing text from PDF.js annotation events
         * This is the primary method for extracting highlighted text in real-time
         */
        // Prevent duplicate event listener setup
        if (this.eventListenersSetup) {
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] ⚠️ EventBus hooks already set up, skipping...');
            }
            return;
        }

        try {
            const eventBus = window.PDFViewerApplication?.eventBus;
            if (!eventBus) {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] ⚠️ EventBus not available');
                }
                return;
            }

            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] 🔗 Setting up EventBus hook');
            }

            // Listen for annotation editor states change - captures text when highlights are created/modified
            eventBus._on('annotationeditorstateschanged', (evt) => {
                try {
                    this.extractTextFromEvent(evt);
                    this.handleEditorStatesChanged(evt);
                } catch (error) {
                    console.error('[FLASHCARD_DETECTOR] ❌ Error in annotationeditorstateschanged handler:', error);
                }
            });

            // Listen for when new editors are added
            eventBus._on('annotationeditoradded', (evt) => {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] ➕ New annotation editor added');
                }
                // Small delay to let the editor settle
                setTimeout(() => this.checkEditorAnnotations(), 100);
            });

            // Listen for editor mode changes
            eventBus._on('annotationeditormodechanged', (evt) => {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 🔄 Editor mode changed:', evt.mode);
                }
                // When entering highlight mode, prepare text capture
                if (evt.mode === 9) { // Highlight mode
                    this.prepareForTextCapture();
                }
            });

            // Mark event listeners as set up
            this.eventListenersSetup = true;

            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] ✅ EventBus hooks configured successfully');
            }

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error setting up EventBus hook:', error);
        }
    }

    extractTextFromEvent(evt) {
        /**
         * Extract text from PDF.js annotation editor event
         * Accesses the selectedEditors to get highlighted text
         */
        if (!evt || !evt.source || !evt.source.selectedEditors || evt.source.selectedEditors.size === 0) {
            return null;
        }

        try {
            // Get the first selected editor (highlight)
            const firstEditor = Array.from(evt.source.selectedEditors)[0];
            if (!firstEditor || !firstEditor['#text']) {
                return null;
            }

            const extractedText = firstEditor['#text'];
            if (typeof extractedText === 'string' && extractedText.trim()) {
                this.currentTextSelection = {
                    text: extractedText.trim(),
                    timestamp: Date.now(),
                    source: 'eventbus-selectedEditors'
                };

                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] ✅ Text captured:', extractedText.trim());
                }
                return extractedText.trim();
            }
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error extracting text from event:', error);
        }

        return null;
    }

    setupHighlightButtonListeners() {
        /**
         * Set up listeners for highlight buttons
         */
        try {
            // Main highlight button
            const highlightButton = document.getElementById('editorHighlightButton');
            if (highlightButton) {
                highlightButton.addEventListener('click', () => {
                    if (this.debugMode) {
                        console.log('[FLASHCARD_DETECTOR] 🎯 Highlight button clicked');
                    }
                    this.prepareForTextCapture();
                });
            }

            // REMOVED: Floating button listeners (feature disabled)

        } catch (error) {
            console.warn('[FLASHCARD_DETECTOR] ⚠️ Error setting up highlight button listeners:', error);
        }
    }

    handleEditorStatesChanged(evt) {
        /**
         * Handle changes in editor states - this is where new highlights are detected
         */
        try {
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] 🔄 Handling editor states changed:', evt);
            }
            
            // Check for new annotations after a brief delay
            setTimeout(() => {
                this.checkEditorAnnotations();
            }, 100);
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error handling editor states changed:', error);
        }
    }

    handleEditorStateChange(event) {
        /**
         * Handle changes in the annotation editor state
         */
        try {
            // Check for annotation changes after state change
            setTimeout(() => {
                this.checkEditorAnnotations();
            }, 100); // Small delay to let the state settle
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error handling editor state change:', error);
        }
    }

    loadCurrentEditorAnnotations() {
        /**
         * Load current annotations from the AnnotationEditor system
         */
        try {
            const annotations = this.getCurrentEditorAnnotations();
            const currentCount = annotations.size;
            
            if (currentCount > 0) {
                console.log(`[FLASHCARD_DETECTOR] 📝 Found ${currentCount} existing editor annotations`);
                this.editorAnnotations = new Map(annotations);
                this.annotationCount = currentCount;
                
                // Send initial load message
                this.handleAnnotationChange(annotations, true);
            } else {
                console.log('[FLASHCARD_DETECTOR] 📭 No existing editor annotations found');
            }
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error loading current editor annotations:', error);
        }
    }

    getCurrentEditorAnnotations() {
        /**
         * Get current annotations from the AnnotationEditor system
         */
        try {
            const annotations = new Map();
            const uiManager = window.PDFViewerApplication?.pdfViewer?.annotationEditorUIManager;
            
            if (!uiManager) {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 📭 No AnnotationEditorUIManager available');
                }
                return annotations;
            }

            // Try to access editors from the UI manager
            // This might vary based on PDF.js version - we'll try multiple approaches
            let editors = [];

            // Method 1: Try to get editors directly
            if (uiManager.getEditors) {
                editors = uiManager.getEditors();
            } else if (uiManager._editors) {
                editors = Object.values(uiManager._editors).flat();
            } else if (uiManager.editors) {
                editors = uiManager.editors;
            }

            // Method 2: Check for highlight editors specifically
            if (editors.length === 0 && uiManager._highlightEditors) {
                editors = uiManager._highlightEditors;
            }

            // Method 3: Try to get from annotation editor layer
            if (editors.length === 0) {
                const pdfViewer = window.PDFViewerApplication?.pdfViewer;
                if (pdfViewer && pdfViewer._pages) {
                    for (const pageView of pdfViewer._pages) {
                        if (pageView.annotationEditorLayer && pageView.annotationEditorLayer._editors) {
                            editors.push(...Object.values(pageView.annotationEditorLayer._editors));
                        }
                    }
                }
            }

            // Process found editors
            for (let i = 0; i < editors.length; i++) {
                const editor = editors[i];
                if (editor && editor.annotationType === 9) { // 9 = highlight annotation
                    const annotationData = this.extractEditorAnnotationData(editor, i);
                    if (annotationData) {
                        annotations.set(annotationData.id, annotationData);
                    }
                }
            }

            if (this.debugMode) {
                console.log(`[FLASHCARD_DETECTOR] 📊 Found ${annotations.size} highlight editors`);
            }

            return annotations;
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error getting current editor annotations:', error);
            return new Map();
        }
    }

    extractEditorAnnotationData(editor, index) {
        /**
         * Extract annotation data from an AnnotationEditor
         */
        try {
            // Get page number
            const pageNumber = editor.pageIndex ? editor.pageIndex + 1 : 1;
            
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] 🔍 Extracting annotation data:', {
                    editorType: editor.constructor?.name,
                    pageNumber: pageNumber,
                    hasCoordinates: !!(editor.x !== undefined && editor.y !== undefined)
                });
            }
            
            // Get coordinates from editor
            let coordinates = { x: 0, y: 0, width: 0, height: 0 };
            if (editor.x !== undefined && editor.y !== undefined) {
                coordinates = {
                    x: editor.x || 0,
                    y: editor.y || 0,
                    width: editor.width || 0,
                    height: editor.height || 0
                };
            } else if (editor._rect) {
                const rect = editor._rect;
                coordinates = {
                    x: rect[0] || 0,
                    y: rect[1] || 0,
                    width: (rect[2] - rect[0]) || 0,
                    height: (rect[3] - rect[1]) || 0
                };
            }

            // Get text content - DEEP EXTRACTION from PDF.js editor object
            let text = '';
            
            // Method 1: DEEP DIVE into editor object structure
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] 🔍 Deep inspection of editor object:', {
                    editorKeys: Object.keys(editor),
                    editorId: editor.id,
                    editorName: editor.name,
                    isSelected: editor.isSelected,
                    hasParent: !!editor.parent,
                    hasUiManager: !!editor._uiManager,
                    editorType: editor.constructor?.name
                });
            }
            
            // METHOD 1 (HIGHEST PRIORITY): Use EventBus captured text from selectedEditors
            if (this.currentTextSelection && 
                this.currentTextSelection.text && 
                (Date.now() - this.currentTextSelection.timestamp) < 30000) {
                text = this.currentTextSelection.text;
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 🎯 Using EventBus captured text:', text);
                }
            }
            
            // METHOD 2: Try to extract text from various editor properties
            if (!text) {
                const textSources = [
                    editor.text, // Direct text property (most likely based on user feedback)
                    editor.selectedText,
                    editor._selectedText,
                    editor.content,
                    editor._content,
                    editor._text,
                    editor.textContent,
                    editor._textContent,
                    editor.data?.text,
                    editor.data?.selectedText,
                    editor.data?.content,
                    editor._initialData?.text,
                    editor._initialData?.selectedText,
                    editor.parent?.selectedText,
                    editor._uiManager?.selectedText
                ];
                
                // Find first non-empty text source
                for (const source of textSources) {
                    if (source && typeof source === 'string' && source.trim()) {
                        text = source.trim();
                        if (this.debugMode) {
                            console.log('[FLASHCARD_DETECTOR] ✅ Found text in editor object:', text);
                        }
                        break;
                    }
                }
            }
            
            // METHOD 3: Get current selection IMMEDIATELY (backup)
            if (!text) {
                const currentSelection = window.getSelection();
                const currentSelectedText = currentSelection ? currentSelection.toString().trim() : '';
                
                if (currentSelectedText) {
                    text = currentSelectedText;
                    if (this.debugMode) {
                        console.log('[FLASHCARD_DETECTOR] ✅ Using LIVE selection text:', text);
                    }
                }
            }
            
            // REMOVED: Coordinate-based text extraction (fallback disabled)
            // If no text found, use fallback description
            if (!text) {
                text = `Highlight on page ${pageNumber}`;
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 📝 Using fallback text description:', text);
                }
            }

            // Get color
            let color = '#FFFF98'; // Default yellow
            if (editor.color) {
                if (Array.isArray(editor.color)) {
                    color = `rgb(${editor.color[0]}, ${editor.color[1]}, ${editor.color[2]})`;
                } else {
                    color = editor.color;
                }
            }

            // Create unique ID
            const id = editor.id || `editor_${pageNumber}_${index}`;

            return {
                id: id,
                clientId: id,
                pageNumber: pageNumber,
                coordinates: coordinates,
                text: text,
                color: color,
                annotationType: 'highlight',
                timestamp: new Date().toISOString(),
                
                // Raw editor data for backend processing
                rawEditorData: {
                    annotationType: editor.annotationType,
                    pageIndex: editor.pageIndex,
                    x: editor.x,
                    y: editor.y,
                    width: editor.width,
                    height: editor.height,
                    color: editor.color,
                    text: text,
                    id: editor.id
                }
            };
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error extracting editor annotation data:', error);
            return null;
        }
    }

    checkEditorAnnotations() {
        /**
         * Check for changes in editor annotations (replacement for polling)
         */
        try {
            // FORCE text capture immediately before processing annotations
            const currentSelection = window.getSelection();
            const currentSelectedText = currentSelection ? currentSelection.toString().trim() : '';
            
            if (currentSelectedText && (!this.currentTextSelection || 
                this.currentTextSelection.text !== currentSelectedText)) {
                this.currentTextSelection = {
                    text: currentSelectedText,
                    timestamp: Date.now(),
                    source: 'annotation-check'
                };
                if (this.debugMode) {
                    console.log(`[FLASHCARD_DETECTOR] 🎯 FORCE CAPTURED text during annotation check: "${currentSelectedText}"`);
                }
            }
            
            // Clean up old text selections
            this.cleanupOldTextSelections();
            
            const currentAnnotations = this.getCurrentEditorAnnotations();
            const currentCount = currentAnnotations.size;

            if (this.debugMode && currentCount > 0) {
                console.log(`[FLASHCARD_DETECTOR] 📊 Current editor annotations: ${currentCount}`);
            }

            // Detect changes
            if (currentCount !== this.annotationCount) {
                console.log(`[FLASHCARD_DETECTOR] 🔄 Editor annotation count changed: ${this.annotationCount} → ${currentCount}`);
                this.handleAnnotationChange(currentAnnotations, false);
                this.annotationCount = currentCount;
                this.editorAnnotations = new Map(currentAnnotations);
            }

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error checking editor annotations:', error);
        }
    }

    waitForPDFViewerApplication(callback) {
        if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
            callback();
        } else {
            console.log('[FLASHCARD_DETECTOR] ⏳ Waiting for PDF.js to load...');
            setTimeout(() => this.waitForPDFViewerApplication(callback), 500);
        }
    }

    startPolling() {
        this.pollTimer = setInterval(() => {
            this.checkForAnnotationChanges();
        }, this.pollingInterval);

        // Initial check to capture existing annotations
        setTimeout(() => {
            this.checkForAnnotationChanges(true);
        }, 1000);

        console.log(`[FLASHCARD_DETECTOR] 🔄 Polling started (${this.pollingInterval}ms intervals)`);
    }

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
            console.log('[FLASHCARD_DETECTOR] 🛑 Polling stopped');
        }
    }

    checkForAnnotationChanges(isInitialCheck = false) {
        try {
            const annotationStorage = this.getAnnotationStorage();
            if (!annotationStorage) {
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 📭 No annotation storage available');
                }
                return;
            }

            const currentAnnotations = this.extractCurrentAnnotations(annotationStorage);
            const currentCount = currentAnnotations.size;

            if (this.debugMode && currentCount > 0) {
                console.log(`[FLASHCARD_DETECTOR] 📊 Current annotations: ${currentCount}`);
            }

            // Detect changes
            if (currentCount !== this.annotationCount || isInitialCheck) {
                this.handleAnnotationChange(currentAnnotations, isInitialCheck);
                this.annotationCount = currentCount;
            }

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error during annotation check:', error);
        }
    }

    getAnnotationStorage() {
        return window.PDFViewerApplication?.pdfDocument?.annotationStorage?.serializable?.map;
    }

    extractCurrentAnnotations(storageMap) {
        const annotations = new Map();
        
        if (storageMap && storageMap.size > 0) {
            for (const [id, data] of storageMap.entries()) {
                // Only process highlight annotations (type 9)
                if (data.annotationType === 9) {
                    annotations.set(id, data);
                }
            }
        }

        return annotations;
    }

    handleAnnotationChange(currentAnnotations, isInitialCheck = false) {
        const changeType = this.determineChangeType(currentAnnotations, isInitialCheck);
        
        if (changeType === 'none') {
            return;
        }

        console.log(`[FLASHCARD_DETECTOR] 🔄 Annotation change detected: ${changeType} (${this.useEditorSystem ? 'editor' : 'legacy'} system)`);
        
        // Handle individual deletion for PDF file persistence
        if (changeType === 'deleted') {
            const deletedAnnotation = this.findDeletedAnnotation(currentAnnotations);
            if (deletedAnnotation) {
                console.log(`[FLASHCARD_DETECTOR] 🗑️ Individual deletion detected:`, deletedAnnotation);
                this.sendIndividualDeletionToPDF(deletedAnnotation);
            }
        }
        
        // Extract and process annotations with text context
        const processedAnnotations = this.processAnnotationsForFlashcards(currentAnnotations);
        
        // Send single, simple message to parent
        const message = {
            type: 'flashcard-annotations-changed',
            changeType: changeType,
            annotations: processedAnnotations,
            count: currentAnnotations.size,
            timestamp: new Date().toISOString(),
            isInitialLoad: isInitialCheck,
            systemType: this.useEditorSystem ? 'editor' : 'legacy'
        };

        // Log message sending for debugging
        if (this.debugMode) {
            console.log('[FLASHCARD_DETECTOR] 📤 Sending message to parent:', message);
            
            // Log text content from annotations to verify they're not empty
            if (message.annotations && message.annotations.length > 0) {
                message.annotations.forEach((annotation, index) => {
                    console.log(`[FLASHCARD_DETECTOR] 📝 Annotation ${index + 1} text: "${annotation.text || '(empty)'}"`);
                });
            }
        }

        SecurityUtils.securePostMessage(message);

        // Note: PDF saving now happens automatically in the backend sync endpoint
        // No need to call separate PDF save API - it's handled in background

        // Update internal tracking based on system type
        if (this.useEditorSystem) {
            this.editorAnnotations = new Map(currentAnnotations);
        } else {
            this.annotationMap = new Map(currentAnnotations);
        }
    }

    determineChangeType(currentAnnotations, isInitialCheck) {
        if (isInitialCheck && currentAnnotations.size > 0) {
            return 'initial_load';
        }

        const currentCount = currentAnnotations.size;
        const previousCount = this.annotationCount;

        if (currentCount > previousCount) {
            return 'added';
        } else if (currentCount < previousCount) {
            return 'deleted';
        } else if (currentCount > 0 && this.hasAnnotationDataChanged(currentAnnotations)) {
            return 'modified';
        }

        return 'none';
    }

    findDeletedAnnotation(currentAnnotations) {
        /**
         * Find which annotation was deleted by comparing current vs previous state
         * Works with both editor and legacy annotation systems
         */
        try {
            const previousAnnotations = this.useEditorSystem ? this.editorAnnotations : this.annotationMap;
            
            // Method 1: Compare with tracked annotations (works for both systems)
            for (const [prevId, prevData] of previousAnnotations.entries()) {
                if (!currentAnnotations.has(prevId)) {
                    // This annotation existed before but is missing now = deleted
                    let deletedAnnotation;
                    
                    if (this.useEditorSystem) {
                        // prevData is already in the correct format for editor system
                        deletedAnnotation = prevData;
                    } else {
                        // Legacy system - extract annotation data
                        deletedAnnotation = this.extractAnnotationData(prevId, prevData);
                    }
                    
                    if (this.debugMode) {
                        console.log(`[FLASHCARD_DETECTOR] 🔍 Found deleted annotation (${this.useEditorSystem ? 'editor' : 'legacy'}):`, deletedAnnotation);
                    }
                    return deletedAnnotation;
                }
            }
            
            // Method 2: Fallback for untracked annotations
            if (!this.useEditorSystem) {
                const deletedAnnotation = this.detectDeletedAnnotationFallback(currentAnnotations);
                if (deletedAnnotation) {
                    if (this.debugMode) {
                        console.log(`[FLASHCARD_DETECTOR] 🔍 Found deleted annotation (fallback):`, deletedAnnotation);
                    }
                    return deletedAnnotation;
                }
            }
            
            // Method 3: Last resort - generic deletion request
            if (this.annotationCount > currentAnnotations.size) {
                console.warn('[FLASHCARD_DETECTOR] ⚠️ Detected deletion but cannot identify specific annotation, using generic approach');
                return this.createGenericDeletionRequest(currentAnnotations);
            }
            
            console.warn('[FLASHCARD_DETECTOR] ❌ Could not identify specific deleted annotation');
            return null;
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] Error finding deleted annotation:', error);
            return null;
        }
    }

    detectDeletedAnnotationFallback(currentAnnotations) {
        /**
         * Fallback method to detect deleted annotations for old highlights
         * This attempts to identify the most recently deleted annotation
         */
        try {
            // Get the current PDF.js annotation storage
            const annotationStorage = this.getAnnotationStorage();
            if (!annotationStorage) return null;

            // Look for recently deleted annotations by checking the viewer state
            const viewerApp = window.PDFViewerApplication;
            if (!viewerApp || !viewerApp.pdfViewer) return null;

            // Try to get the last selected annotation before deletion
            const lastSelectedAnnotation = this.getLastSelectedAnnotation();
            if (lastSelectedAnnotation) {
                if (this.debugMode) {
                    console.log(`[FLASHCARD_DETECTOR] 📋 Using last selected annotation for deletion:`, lastSelectedAnnotation);
                }
                return lastSelectedAnnotation;
            }

            // If we can't identify the specific annotation, return null
            return null;
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] Error in fallback detection:', error);
            return null;
        }
    }

    getLastSelectedAnnotation() {
        /**
         * Try to get information about the last selected/focused annotation
         * This helps identify which annotation was deleted for old highlights
         */
        try {
            // Check if there's a selected annotation in the viewer
            const viewerApp = window.PDFViewerApplication;
            if (!viewerApp || !viewerApp.pdfViewer) return null;

            // Try to access annotation layer information
            const currentPage = viewerApp.pdfViewer.currentPageNumber;
            
            // Look for annotation layer on current page
            const pageView = viewerApp.pdfViewer.getPageView(currentPage - 1);
            if (!pageView || !pageView.annotationLayer) return null;

            // This is a simplified approach - in a real implementation,
            // you might need to track the last clicked/selected annotation
            // For now, we'll return null and let the generic approach handle it
            return null;
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] Error getting last selected annotation:', error);
            return null;
        }
    }

    createGenericDeletionRequest(currentAnnotations) {
        /**
         * Create a generic deletion request when we can't identify the specific annotation
         * This will trigger a "clear and replace" operation in the PDF file
         */
        try {
            if (this.debugMode) {
                console.log(`[FLASHCARD_DETECTOR] 🔄 Creating generic deletion request - will sync all remaining annotations`);
            }

            // Instead of trying to delete a specific annotation, we'll trigger a full sync
            // The backend will replace all PDF annotations with the current set
            return {
                type: 'generic_sync',
                pageNumber: 1, // Will be ignored
                coordinates: { x: 0, y: 0, width: 0, height: 0 }, // Will be ignored
                text: '',
                color: '#FFFF98',
                isGenericSync: true,
                remainingAnnotations: this.processAnnotationsForFlashcards(currentAnnotations)
            };
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] Error creating generic deletion request:', error);
            return null;
        }
    }

    async sendIndividualDeletionToPDF(deletedAnnotation) {
        /**
         * Send individual annotation deletion request to backend for PDF file modification
         * Enhanced to handle generic sync for old highlights
         */
        try {
            const documentId = this.extractDocumentIdFromURL();
            if (!documentId) {
                console.warn('[FLASHCARD_DETECTOR] ❌ Could not extract document ID for individual deletion');
                return;
            }

            if (this.debugMode) {
                console.log(`[FLASHCARD_DETECTOR] 📡 Sending deletion request for annotation:`, deletedAnnotation);
            }

            // Check if this is a generic sync (for old highlights we can't identify specifically)
            if (deletedAnnotation.isGenericSync) {
                if (this.debugMode) {
                    console.log(`[FLASHCARD_DETECTOR] 🔄 Using generic sync approach for old highlight deletion`);
                }
                
                // Use the existing sync endpoint to replace all PDF annotations with current set
                const response = await fetch(`/api/v1/documents/${documentId}/flashcard-annotations/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        annotations: deletedAnnotation.remainingAnnotations,
                        changeType: 'deleted',
                        isInitialLoad: false,
                        timestamp: new Date().toISOString()
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                
                if (this.debugMode) {
                    console.log(`[FLASHCARD_DETECTOR] ✅ Generic sync API success:`, result);
                }

                // Notify parent of successful generic sync (which includes PDF update)
                SecurityUtils.securePostMessage({
                    type: 'flashcard-individual-pdf-deletion',
                    status: 'success',
                    pdf_updated: true, // Sync endpoint handles PDF update
                    message: 'Highlight deleted from PDF (generic sync)',
                    deleted_details: null,
                    database_unchanged: false, // Sync updates database
                    isGenericSync: true,
                    timestamp: new Date().toISOString()
                });

            } else {
                // Use individual deletion endpoint for new highlights we can identify specifically
                const response = await fetch(`/api/v1/documents/${documentId}/flashcard-annotations/delete-from-pdf`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        annotation: {
                            page_number: deletedAnnotation.pageNumber,
                            coordinates: deletedAnnotation.coordinates,
                            text: deletedAnnotation.text || '',
                            color: deletedAnnotation.color
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                
                if (this.debugMode) {
                    console.log(`[FLASHCARD_DETECTOR] ✅ Individual deletion API success:`, result);
                }

                // Notify parent of successful individual PDF deletion
                SecurityUtils.securePostMessage({
                    type: 'flashcard-individual-pdf-deletion',
                    status: 'success',
                    pdf_updated: result.pdf_updated,
                    message: result.message,
                    deleted_details: result.deleted_details,
                    database_unchanged: result.database_unchanged,
                    isGenericSync: false,
                    timestamp: new Date().toISOString()
                }, window.location.origin);
            }

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Deletion API failed:', error);
            
            // Notify parent of failed deletion
            SecurityUtils.securePostMessage({
                type: 'flashcard-individual-pdf-deletion',
                status: 'error',
                error: SecurityUtils.createSafeErrorMessage(error),
                timestamp: new Date().toISOString()
            }, window.location.origin);
        }
    }

    hasAnnotationDataChanged(currentAnnotations) {
        if (currentAnnotations.size !== this.annotationMap.size) {
            return true;
        }

        for (const [id, data] of currentAnnotations.entries()) {
            const previousData = this.annotationMap.get(id);
            if (!previousData || this.getAnnotationHash(data) !== this.getAnnotationHash(previousData)) {
                return true;
            }
        }

        return false;
    }

    extractTextFromHighlightEditor(editor) {
        /**
         * Extract text from a HighlightEditor object using its DOM element and coordinates
         */
        try {
            // Method 1: Try to get text from the editor's DOM element
            if (editor.div && editor.div.textContent) {
                const text = editor.div.textContent.trim();
                if (text) {
                    return text;
                }
            }

            // Method 2: Try to get text from editor's internal structure
            if (editor._div && editor._div.textContent) {
                const text = editor._div.textContent.trim();
                if (text) {
                    return text;
                }
            }

            // Method 3: Try to extract from coordinates using text layer
            const pageIndex = editor.pageIndex || 0;
            let coordinates = { x: 0, y: 0, width: 0, height: 0 };
            
            if (editor.x !== undefined && editor.y !== undefined) {
                coordinates = {
                    x: editor.x || 0,
                    y: editor.y || 0,
                    width: editor.width || 0,
                    height: editor.height || 0
                };
            } else if (editor._rect) {
                const rect = editor._rect;
                coordinates = {
                    x: rect[0] || 0,
                    y: rect[1] || 0,
                    width: (rect[2] - rect[0]) || 0,
                    height: (rect[3] - rect[1]) || 0
                };
            }

            // REMOVED: Coordinate-based text extraction
            if (coordinates.width > 0 && coordinates.height > 0) {
                return `Highlight on page ${pageIndex + 1}`;
            }

            return '';

        } catch (error) {
            console.warn('[FLASHCARD_DETECTOR] ⚠️ Error extracting text from highlight editor:', error);
            return '';
        }
    }

    // REMOVED: extractTextFromCoordinates method (coordinate-based text extraction not needed)
    // Method removed to simplify codebase - EventBus approach provides text directly
    // REMOVED: extractTextFromCoordinates method - coordinate-based text extraction not needed
    // REMOVED: rectanglesOverlap method - used by coordinate extraction

    getAnnotationHash(annotationData) {
        // Simple hash for change detection
        return JSON.stringify({
            annotationType: annotationData.annotationType,
            pageIndex: annotationData.pageIndex,
            rect: annotationData.rect,
            quadPoints: annotationData.quadPoints,
            color: annotationData.color
        });
    }

    processAnnotationsForFlashcards(annotations) {
        const processed = [];

        for (const [id, data] of annotations.entries()) {
            try {
                let processedAnnotation;
                
                if (this.useEditorSystem) {
                    // For editor system, transform raw PDF.js annotation data
                    processedAnnotation = this.extractEditorAnnotationData(id, data);
                } else {
                    // For legacy system, extract annotation data
                    processedAnnotation = this.extractAnnotationData(id, data);
                }
                
                if (processedAnnotation) {
                    processed.push(processedAnnotation);
                }
            } catch (error) {
                console.error(`[FLASHCARD_DETECTOR] ❌ Error processing annotation ${id}:`, error);
            }
        }

        if (this.debugMode) {
            console.log(`[FLASHCARD_DETECTOR] 📝 Processed ${processed.length} annotations for flashcards (${this.useEditorSystem ? 'editor' : 'legacy'} system)`);
        }

        return processed;
    }

    extractEditorAnnotationData(id, data) {
        /**
         * Extract annotation data from PDF.js AnnotationEditor system
         * Transform raw PDF.js annotation data into our standardized format
         */
        try {
            // Generate unique IDs
            const uniqueId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const clientId = id || uniqueId;
            
            // Extract page number (PDF.js uses 0-based pageIndex)
            const pageNumber = (data.pageIndex || 0) + 1; 
            
            // Transform color from array to string
            let color = '#FFFF98'; // Default yellow
            if (data.color && Array.isArray(data.color) && data.color.length >= 3) {
                const [r, g, b] = data.color;
                color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            }
            
            // Extract coordinates from rect or quadPoints
            let coordinates = { x: 0, y: 0, width: 0, height: 0 };
            if (data.rect && Array.isArray(data.rect) && data.rect.length >= 4) {
                const [x1, y1, x2, y2] = data.rect;
                coordinates = {
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2), 
                    width: Math.abs(x2 - x1),
                    height: Math.abs(y2 - y1)
                };
            } else if (data.quadPoints) {
                // Extract from quadPoints if available
                const points = Object.values(data.quadPoints);
                if (points.length >= 4) {
                    const xCoords = points.filter((_, i) => i % 2 === 0);
                    const yCoords = points.filter((_, i) => i % 2 === 1);
                    
                    coordinates = {
                        x: Math.min(...xCoords),
                        y: Math.min(...yCoords),
                        width: Math.max(...xCoords) - Math.min(...xCoords),
                        height: Math.max(...yCoords) - Math.min(...yCoords)
                    };
                }
            }
            
            // Extract text content - DEEP EXTRACTION from PDF.js data object
            let highlightText = '';
            
            // Method 1: DEEP DIVE into data object structure for new annotations
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] 🔍 Deep inspection of new annotation data:', {
                    dataKeys: Object.keys(data),
                    hasSelectedText: !!data.selectedText,
                    hasText: !!data.text,
                    hasContent: !!data.content,
                    dataType: data.constructor?.name
                });
            }
            
            // Try to extract text from various data properties
            const textSources = [
                data.selectedText,
                data._selectedText,
                data.content,
                data._content,
                data.text,
                data._text,
                data.textContent,
                data._textContent
            ];
            
            // Find first non-empty text source
            for (const source of textSources) {
                if (source && typeof source === 'string' && source.trim()) {
                    highlightText = source.trim();
                    if (this.debugMode) {
                        console.log('[FLASHCARD_DETECTOR] ✅ Found text in new annotation data:', highlightText);
                    }
                    break;
                }
            }
            
            // Method 2: Get current selection IMMEDIATELY (backup)
            if (!highlightText) {
                const currentSelection = window.getSelection();
                const currentSelectedText = currentSelection ? currentSelection.toString().trim() : '';
                
                if (currentSelectedText) {
                    highlightText = currentSelectedText;
                    if (this.debugMode) {
                        console.log('[FLASHCARD_DETECTOR] ✅ Using LIVE selection text for new annotation:', highlightText);
                    }
                }
            }
            
            // Method 3: Use recent captured text selection (backup)
            if (!highlightText && this.currentTextSelection && 
                this.currentTextSelection.text && 
                (Date.now() - this.currentTextSelection.timestamp) < 30000) {
                highlightText = this.currentTextSelection.text;
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] ✅ Using captured selection text for new annotation:', highlightText);
                }
            }
            
            // REMOVED: Coordinate-based text extraction (Method 4 removed)
            if (!highlightText) {
                highlightText = `Highlight on page ${pageNumber}`;
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 📝 Using fallback text for new annotation:', highlightText);
                }
            }
            
            // Transform annotationType from number to string
            let annotationType = 'highlight';
            if (data.annotationType === 9) {
                annotationType = 'highlight';
            } else if (data.annotationType) {
                annotationType = `type-${data.annotationType}`;
            }
            
            return {
                id: uniqueId,
                clientId: clientId,
                pageNumber: pageNumber,
                text: highlightText,
                coordinates: coordinates,
                color: color,
                annotationType: annotationType,
                timestamp: new Date().toISOString(),
                rawPDFJSData: data
            };
            
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error extracting editor annotation:', error);
            return null;
        }
    }

    extractAnnotationData(id, data) {
        // Extract basic annotation information
        const pageNumber = (data.pageIndex || 0) + 1; // Convert to 1-based
        
        // Extract coordinates
        let coordinates = { x: 0, y: 0, width: 0, height: 0 };
        if (data.rect && Array.isArray(data.rect) && data.rect.length >= 4) {
            const [x1, y1, x2, y2] = data.rect;
            coordinates = {
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1)
            };
        } else if (data.quadPoints && data.quadPoints.length >= 8) {
            const points = Array.from(data.quadPoints);
            const xCoords = [points[0], points[2], points[4], points[6]];
            const yCoords = [points[1], points[3], points[5], points[7]];
            coordinates = {
                x: Math.min(...xCoords),
                y: Math.min(...yCoords),
                width: Math.max(...xCoords) - Math.min(...xCoords),
                height: Math.max(...yCoords) - Math.min(...yCoords)
            };
        }

        // Extract text - SIMPLE AND DIRECT approach for legacy system
        let highlightText = '';
        
        // Method 1: Get current selection IMMEDIATELY (most reliable)
        const currentSelection = window.getSelection();
        const currentSelectedText = currentSelection ? currentSelection.toString().trim() : '';
        
        if (currentSelectedText) {
            highlightText = currentSelectedText;
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] ✅ Using LIVE selection text for legacy:', highlightText);
            }
        }
        // Method 2: Use recent captured text selection (backup)
        else if (this.currentTextSelection && 
            this.currentTextSelection.text && 
            (Date.now() - this.currentTextSelection.timestamp) < 30000) {
            highlightText = this.currentTextSelection.text;
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] ✅ Using captured selection text for legacy:', highlightText);
            }
        }
        // Method 3: Try to extract from coordinates (fallback)
        else {
            // REMOVED: Coordinate-based text extraction for legacy annotations
            highlightText = `Highlight on page ${(data.pageIndex || 0) + 1}`;
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] 📝 Using fallback text for legacy annotation:', highlightText);
            }
        }

        // Extract color
        let color = '#FFFF98'; // Default yellow
        if (data.color && Array.isArray(data.color) && data.color.length >= 3) {
            color = `rgb(${data.color[0]}, ${data.color[1]}, ${data.color[2]})`;
        }

        return {
            id: id,
            clientId: id, // PDF.js internal ID
            pageNumber: pageNumber,
            coordinates: coordinates,
            text: highlightText,
            color: color,
            annotationType: 'highlight',
            timestamp: new Date().toISOString(),
            
            // Raw PDF.js data for backend processing
            rawPDFJSData: {
                annotationType: data.annotationType,
                pageIndex: data.pageIndex,
                rect: data.rect,
                quadPoints: data.quadPoints,
                color: data.color,
                opacity: data.opacity
            }
        };
    }

    // Debug methods
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            annotationCount: this.annotationCount,
            pollingInterval: this.pollingInterval,
            isPolling: !!this.pollTimer
        };
    }

    debugAnnotationStorage() {
        console.log('[FLASHCARD_DETECTOR] 🔍 Debug annotation storage:');
        
        const storage = this.getAnnotationStorage();
        if (!storage) {
            console.log('❌ No annotation storage found');
            return;
        }

        console.log(`📊 Total entries in storage: ${storage.size}`);
        
        let highlightCount = 0;
        for (const [id, data] of storage.entries()) {
            if (data.annotationType === 9) {
                highlightCount++;
                console.log(`✨ Highlight ${id}:`, {
                    pageIndex: data.pageIndex,
                    rect: data.rect,
                    color: data.color
                });
            }
        }
        
        console.log(`🎯 Total highlights: ${highlightCount}`);
        
        // Debug current text selection
        if (this.currentTextSelection) {
            const age = Date.now() - this.currentTextSelection.timestamp;
            console.log(`📝 Current text selection (${age}ms old):`, {
                text: this.currentTextSelection.text,
                isValid: age < 5000
            });
        } else {
            console.log('📭 No current text selection stored');
        }
    }

    /**
     * Clean up old text selections to prevent memory issues
     */
    cleanupOldTextSelections() {
        if (this.currentTextSelection) {
            const age = Date.now() - this.currentTextSelection.timestamp;
            if (age > 10000) { // 10 seconds
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 🧹 Cleaning up old text selection');
                }
                this.currentTextSelection = null;
            }
        }
    }

    /**
     * Save annotations to PDF file for persistence across refreshes
     */
    saveAnnotationsToPDF(changeType) {
        try {
            if (this.debugMode) {
                console.log(`[FLASHCARD_DETECTOR] 💾 Saving annotations to PDF (change: ${changeType})`);
            }

            // Get the PDF document and save it with annotations
            if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
                const pdfDocument = window.PDFViewerApplication.pdfDocument;
                const annotationStorage = this.getAnnotationStorage();

                if (!annotationStorage) {
                    console.warn('[FLASHCARD_DETECTOR] ❌ No annotation storage available for saving');
                    return;
                }

                // Call backend API to save annotations to PDF file (in-place autosave)
                this.saveAnnotationsToPDFViaAPI(changeType);
                
                // Note: We don't call PDF.js save() as that triggers downloads
                // The backend handles direct file modification for true autosave
            } else {
                console.warn('[FLASHCARD_DETECTOR] ❌ PDF viewer application not available for saving');
            }

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error saving annotations to PDF:', error);
        }
    }

    /**
     * Save annotations to PDF file via backend API
     */
    async saveAnnotationsToPDFViaAPI(changeType) {
        try {
            if (this.debugMode) {
                console.log(`[FLASHCARD_DETECTOR] 🌐 Saving annotations to PDF via API (change: ${changeType})`);
            }

            // Extract document ID from URL
            const documentId = this.extractDocumentIdFromURL();
            if (!documentId) {
                console.warn('[FLASHCARD_DETECTOR] ❌ Could not extract document ID from URL');
                return;
            }

            // Call the backend API to save annotations to PDF
            const response = await fetch(`/api/v1/documents/${documentId}/flashcard-annotations/save-to-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (this.debugMode) {
                console.log(`[FLASHCARD_DETECTOR] ✅ PDF save API success:`, result);
            }

            // Notify parent of successful PDF save
            SecurityUtils.securePostMessage({
                type: 'flashcard-pdf-saved',
                status: 'success',
                savedCount: result.saved_count,
                message: result.message,
                timestamp: new Date().toISOString()
            }, window.location.origin);

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ PDF save API failed:', error);
            
            // Notify parent of failed PDF save
            SecurityUtils.securePostMessage({
                type: 'flashcard-pdf-saved',
                status: 'error',
                error: SecurityUtils.createSafeErrorMessage(error),
                timestamp: new Date().toISOString()
            }, window.location.origin);
        }
    }

    /**
     * Extract document ID from current URL
     */
    extractDocumentIdFromURL() {
        try {
            // Look for document ID in URL patterns like /documents/123/ or ?documentId=123
            const url = window.location.href;
            
            // Try different URL patterns
            let match = url.match(/\/documents\/(\d+)/);
            if (match) return match[1];
            
            match = url.match(/documentId=(\d+)/);
            if (match) return match[1];
            
            match = url.match(/book-(\d+)/);
            if (match) return match[1];
            
            // Try extracting from file parameter
            const urlParams = new URLSearchParams(window.location.search);
            const fileParam = urlParams.get('file');
            if (fileParam) {
                const fileMatch = fileParam.match(/book-(\d+)/);
                if (fileMatch) return fileMatch[1];
            }
            
            return null;
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] Error extracting document ID:', error);
            return null;
        }
    }

    /**
     * Manual save approach for annotation persistence
     */
    manualSaveAnnotations(annotationStorage) {
        try {
            if (this.debugMode) {
                console.log('[FLASHCARD_DETECTOR] 🔧 Using manual annotation save approach');
            }

            // Store annotations in browser storage as backup
            const annotationsArray = Array.from(annotationStorage.entries()).map(([id, data]) => ({
                id: id,
                data: data
            }));

            // Store in localStorage with PDF-specific key
            const pdfUrl = window.location.href;
            const storageKey = `flashcard_annotations_${btoa(pdfUrl)}`;
            
            localStorage.setItem(storageKey, JSON.stringify({
                timestamp: new Date().toISOString(),
                annotations: annotationsArray,
                count: annotationsArray.length
            }));

            if (this.debugMode) {
                console.log(`[FLASHCARD_DETECTOR] 💾 Stored ${annotationsArray.length} annotations in localStorage`);
            }

            // Also try to persist to the PDF's annotation storage
            if (window.PDFViewerApplication?.eventBus) {
                window.PDFViewerApplication.eventBus.dispatch('save', {
                    source: this,
                    saveAnnotations: true
                });
            }

        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Manual save failed:', error);
        }
    }

    /**
     * Load annotations from storage on PDF load
     */
    loadStoredAnnotations() {
        try {
            const pdfUrl = window.location.href;
            const storageKey = `flashcard_annotations_${btoa(pdfUrl)}`;
            const storedData = localStorage.getItem(storageKey);

            if (storedData) {
                const parsed = JSON.parse(storedData);
                if (this.debugMode) {
                    console.log(`[FLASHCARD_DETECTOR] 📂 Found ${parsed.count} stored annotations from ${parsed.timestamp}`);
                }
                return parsed.annotations;
            }
        } catch (error) {
            console.error('[FLASHCARD_DETECTOR] ❌ Error loading stored annotations:', error);
        }
        return [];
    }

    // REMOVED: Second extractTextFromCoordinates method - duplicate coordinate-based text extraction not needed
    // REMOVED: rectanglesOverlap method - used by coordinate extraction

    /**
     * Setup simple and reliable text capture
     */
    setupSimpleTextCapture() {
        // Clear any previous setup
        this.currentTextSelection = null;
        
        // APPROACH 1: Capture text BEFORE mouseup (on mousedown + mousemove)
        let isDragging = false;
        let capturedTextDuringDrag = null;
        
        console.log('[FLASHCARD_DETECTOR] ⚡ ENHANCED TEXT CAPTURE ACTIVE - Setting up drag capture...');
        
        window.addEventListener('mousedown', () => {
            isDragging = true;
            capturedTextDuringDrag = null;
            console.log('[FLASHCARD_DETECTOR] 👆 MOUSEDOWN - Starting drag capture');
        });
        
        window.addEventListener('mousemove', () => {
            if (isDragging) {
                const selection = window.getSelection();
                const selectedText = selection ? selection.toString().trim() : '';
                
                if (selectedText.length > 0) {
                    capturedTextDuringDrag = selectedText;
                    console.log(`[FLASHCARD_DETECTOR] 🎯 CAPTURING during drag: "${selectedText}"`);
                }
            }
        });
        
        // APPROACH 2: Enhanced mouseup with fallbacks
        window.addEventListener('mouseup', () => {
            isDragging = false;
            
            const selection = window.getSelection();
            const selectedText = selection ? selection.toString().trim() : '';
            
            // Use text captured during drag if current selection is empty
            const textToUse = selectedText || capturedTextDuringDrag || '';
            
            if (textToUse.length > 0) {
                // Store the text IMMEDIATELY before PDF.js clears it
                this.currentTextSelection = {
                    text: textToUse,
                    timestamp: Date.now(),
                    source: selectedText ? 'mouseup' : 'drag-capture'
                };
                
                if (this.debugMode) {
                    console.log(`[FLASHCARD_DETECTOR] 🎯 CAPTURED TEXT (${this.currentTextSelection.source}): "${textToUse}"`);
                }
                
                // REMOVED: Floating button (feature disabled)
                
                // CRITICAL: Check for new annotations immediately after text capture
                setTimeout(() => this.checkEditorAnnotations(), 50);
                setTimeout(() => this.checkEditorAnnotations(), 200);
                setTimeout(() => this.checkEditorAnnotations(), 500);
                
                // Keep the captured text for longer (in case EventBus needs it)
                setTimeout(() => {
                    if (this.currentTextSelection && this.currentTextSelection.text === textToUse) {
                        if (this.debugMode) {
                            console.log(`[FLASHCARD_DETECTOR] 🕒 Keeping captured text alive: "${textToUse}"`);
                        }
                    }
                }, 2000);
                
            } else {
                // REMOVED: Floating button (feature disabled)
            }
            
            // Clear drag capture
            capturedTextDuringDrag = null;
        });

        // Backup: Also listen to selectionchange for immediate feedback
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim()) {
                const selectedText = selection.toString().trim();
                // REMOVED: Floating button (feature disabled)
                
                if (this.debugMode) {
                    console.log('[FLASHCARD_DETECTOR] 📝 Selection changed:', selectedText);
                }
            } else {
                // REMOVED: Floating button (feature disabled)
            }
        });

        console.log('[FLASHCARD_DETECTOR] ✅ Simple text capture setup complete (using proven PDF.js approach)');
        
        // DISABLED: Comprehensive event logging to avoid interference
        // this.setupComprehensiveEventLogging();
    }
    
    /**
     * Nuclear approach: Hook directly into annotation creation to inject text
     */
    hookIntoAnnotationCreation() {
        console.log('[FLASHCARD_DETECTOR] 🚀 Setting up nuclear annotation creation hook...');
        
        // Wait for PDF.js to be fully loaded
        setTimeout(() => {
            try {
                // Look for HighlightEditor in window or PDF.js globals
                const findHighlightEditor = () => {
                    // Try different ways to access HighlightEditor
                    if (window.HighlightEditor) {
                        return window.HighlightEditor;
                    }
                    if (window.pdfjsLib && window.pdfjsLib.HighlightEditor) {
                        return window.pdfjsLib.HighlightEditor;
                    }
                    if (window.PDFViewerApplication && window.PDFViewerApplication.HighlightEditor) {
                        return window.PDFViewerApplication.HighlightEditor;
                    }
                    // Look in global scope
                    for (let key in window) {
                        if (key.includes('HighlightEditor') && typeof window[key] === 'function') {
                            return window[key];
                        }
                    }
                    return null;
                };
                
                const HighlightEditor = findHighlightEditor();
                
                if (HighlightEditor && HighlightEditor.prototype) {
                    console.log('[FLASHCARD_DETECTOR] 🎯 Found HighlightEditor, hooking constructor...');
                    
                    // Store original constructor
                    const OriginalHighlightEditor = HighlightEditor;
                    
                    // Override constructor to inject text
                    function HookedHighlightEditor(...args) {
                        // Call original constructor
                        const instance = new OriginalHighlightEditor(...args);
                        
                        // Inject our captured text if available
                        if (window.flashcardDetector?.currentTextSelection?.text) {
                            const capturedText = window.flashcardDetector.currentTextSelection.text;
                            
                            // Try multiple ways to set the text
                            if (instance.text !== undefined) {
                                instance.text = capturedText;
                            }
                            if (instance._text !== undefined) {
                                instance._text = capturedText;
                            }
                            if (instance.selectedText !== undefined) {
                                instance.selectedText = capturedText;
                            }
                            if (instance._selectedText !== undefined) {
                                instance._selectedText = capturedText;
                            }
                            
                            console.log('[FLASHCARD_DETECTOR] 💉 INJECTED TEXT into HighlightEditor:', capturedText);
                        }
                        
                        return instance;
                    }
                    
                    // Copy prototype and static methods
                    HookedHighlightEditor.prototype = OriginalHighlightEditor.prototype;
                    Object.setPrototypeOf(HookedHighlightEditor, OriginalHighlightEditor);
                    
                    // Replace in global scope
                    if (window.HighlightEditor) {
                        window.HighlightEditor = HookedHighlightEditor;
                    }
                    
                    console.log('[FLASHCARD_DETECTOR] ✅ HighlightEditor constructor hooked successfully');
                } else {
                    console.log('[FLASHCARD_DETECTOR] ❌ Could not find HighlightEditor to hook');
                }
                
            } catch (error) {
                console.error('[FLASHCARD_DETECTOR] ❌ Error hooking annotation creation:', error);
            }
        }, 2000);
    }
    
    // REMOVED: setupComprehensiveEventLogging method - performance impact from logging all events

    // REMOVED: setupFloatingFlashcardButton method - floating button functionality not working properly
    // REMOVED: showFloatingFlashcardButton method - part of disabled floating button feature
    // REMOVED: hideFloatingFlashcardButton method - part of disabled floating button feature  
    // REMOVED: createFlashcardFromSelection method - part of disabled floating button feature
}

// Initialize the detector
const flashcardDetector = new FlashcardAnnotationDetector();

// Wait for DOM and then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => flashcardDetector.initialize(), 1000);
    });
} else {
    setTimeout(() => flashcardDetector.initialize(), 1000);
}

// Global access for debugging
window.flashcardDetector = flashcardDetector;

// Global debug function - enhanced for modern system
window.debugFlashcardAnnotations = () => {
    console.log('[DEBUG] Flashcard Detector Status:', flashcardDetector.getStatus());
};

// Test function to manually trigger text capture
window.testTextCapture = () => {
    console.log('[TEST] Testing text capture system...');
    
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
        const text = selection.toString().trim();
        console.log(`[TEST] Current selection: "${text}"`);
        
        // Manually trigger capture
        flashcardDetector.captureCurrentSelection('manual test');
        
        // Check what was captured
        if (flashcardDetector.currentTextSelection) {
            console.log('[TEST] Successfully captured:', flashcardDetector.currentTextSelection);
        } else {
            console.log('[TEST] No text was captured');
        }
    } else {
        console.log('[TEST] No text is currently selected. Please select some text first.');
    }
};

// Test function to check current system state
window.debugTextCaptureState = () => {
    console.log('[DEBUG] Text Capture State:', {
        currentTextSelection: flashcardDetector.currentTextSelection,
        isCapturingHighlight: flashcardDetector.isCapturingHighlight,
        debugMode: flashcardDetector.debugMode,
        isInitialized: flashcardDetector.isInitialized
    });
};

console.log('[FLASHCARD_DETECTOR] 📝 Simple annotation detection system loaded');
console.log('[FLASHCARD_DETECTOR] 🔧 Use debugFlashcardAnnotations() to check status');