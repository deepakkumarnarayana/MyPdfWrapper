// Pure PDF.js Event Logger - No custom logic, just intercept and log
console.log('🔬 [PURE_LOGGER] Loading pure PDF.js event logger...');

// Wait for PDF.js to load
function waitForPDFJS() {
    if (window.PDFViewerApplication && window.PDFViewerApplication.eventBus) {
        console.log('✅ [PURE_LOGGER] PDF.js found, setting up event interception...');
        setupPureEventLogging();
    } else {
        console.log('⏳ [PURE_LOGGER] Waiting for PDF.js...');
        setTimeout(waitForPDFJS, 100);
    }
}

function setupPureEventLogging() {
    const eventBus = window.PDFViewerApplication.eventBus;
    
    // Log the EventBus structure first
    console.log('📊 [PURE_LOGGER] EventBus structure:', {
        type: eventBus.constructor.name,
        methods: Object.getOwnPropertyNames(eventBus).filter(name => typeof eventBus[name] === 'function'),
        properties: Object.getOwnPropertyNames(eventBus).filter(name => typeof eventBus[name] !== 'function'),
        prototype: Object.getOwnPropertyNames(Object.getPrototypeOf(eventBus))
    });
    
    // Method 1: Override _dispatch (most PDF.js versions)
    if (eventBus._dispatch && typeof eventBus._dispatch === 'function') {
        const originalDispatch = eventBus._dispatch;
        eventBus._dispatch = function(eventName, data) {
            console.log(`🔥 [PURE_LOGGER] PDF.js _dispatch: ${eventName}`, data);
            return originalDispatch.call(this, eventName, data);
        };
        console.log('✅ [PURE_LOGGER] Hooked _dispatch method');
    }
    
    // Method 2: Override dispatch (some PDF.js versions)
    if (eventBus.dispatch && typeof eventBus.dispatch === 'function') {
        const originalDispatch = eventBus.dispatch;
        eventBus.dispatch = function(eventName, data) {
            console.log(`🔥 [PURE_LOGGER] PDF.js dispatch: ${eventName}`, data);
            return originalDispatch.call(this, eventName, data);
        };
        console.log('✅ [PURE_LOGGER] Hooked dispatch method');
    }
    
    // Method 3: Override _on to see what listeners are registered
    if (eventBus._on && typeof eventBus._on === 'function') {
        const originalOn = eventBus._on;
        eventBus._on = function(eventName, listener) {
            console.log(`📡 [PURE_LOGGER] PDF.js listener registered: ${eventName}`);
            return originalOn.call(this, eventName, listener);
        };
        console.log('✅ [PURE_LOGGER] Hooked _on method');
    }
    
    // Method 4: Override on (public API)
    if (eventBus.on && typeof eventBus.on === 'function') {
        const originalOn = eventBus.on;
        eventBus.on = function(eventName, listener) {
            console.log(`📡 [PURE_LOGGER] PDF.js public listener: ${eventName}`);
            return originalOn.call(this, eventName, listener);
        };
        console.log('✅ [PURE_LOGGER] Hooked on method');
    }
    
    // Method 5: Try to access existing listeners
    if (eventBus._listeners) {
        console.log('📋 [PURE_LOGGER] Existing PDF.js listeners:', Object.keys(eventBus._listeners));
    }
    
    console.log('🎯 [PURE_LOGGER] Pure event logging setup complete');
}

// Also log basic DOM events for context
function logBasicEvents() {
    console.log('🖱️ [PURE_LOGGER] Setting up basic DOM event monitoring...');
    
    // Only log selection changes
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';
        if (text) {
            console.log(`📝 [PURE_LOGGER] Text selected: "${text}"`);
        }
    });
    
    // Only log clicks on buttons/interactive elements
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.role === 'button' || e.target.onclick) {
            console.log(`🖱️ [PURE_LOGGER] Button clicked:`, {
                id: e.target.id || 'no-id',
                class: e.target.className || 'no-class',
                text: e.target.textContent?.substring(0, 30) || 'no-text'
            });
        }
    });
}

// Start the logger
waitForPDFJS();
logBasicEvents();

console.log('🔬 [PURE_LOGGER] Pure PDF.js event logger loaded');