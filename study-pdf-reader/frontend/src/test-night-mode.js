// Simple test script to validate night mode toggle behavior
// Run this in browser console to test the state synchronization

console.log('🧪 Night Mode Toggle Test Starting...');

// Test 1: Initial state consistency
const testInitialState = () => {
  console.log('\n📋 Test 1: Initial State Consistency');
  
  const storeState = window.__ZUSTAND_STORE__?.getState?.()?.pdfNightMode;
  const localStorageValue = localStorage.getItem('pdfNightMode');
  const parsedLocalStorage = localStorageValue ? JSON.parse(localStorageValue) : null;
  
  console.log({
    storeState,
    localStorageValue,
    parsedLocalStorage,
    consistent: storeState === parsedLocalStorage
  });
  
  return storeState === parsedLocalStorage;
};

// Test 2: Toggle behavior
const testToggleBehavior = () => {
  console.log('\n🔄 Test 2: Toggle Behavior');
  
  const initialState = window.__ZUSTAND_STORE__?.getState?.()?.pdfNightMode;
  console.log('Initial state:', initialState);
  
  // Simulate toggle
  const toggleButton = document.querySelector('[data-testid="night-mode-toggle"]') || 
                      document.querySelector('[title*="Night Mode"]') ||
                      document.querySelector('[title*="Light Mode"]');
  
  if (toggleButton) {
    console.log('Found toggle button, clicking...');
    toggleButton.click();
    
    setTimeout(() => {
      const newState = window.__ZUSTAND_STORE__?.getState?.()?.pdfNightMode;
      const newLocalStorage = JSON.parse(localStorage.getItem('pdfNightMode') || 'null');
      
      console.log({
        initialState,
        newState,
        newLocalStorage,
        toggleWorked: newState === !initialState,
        storageConsistent: newState === newLocalStorage
      });
    }, 100);
  } else {
    console.log('Toggle button not found');
  }
};

// Test 3: Multiple rapid toggles
const testRapidToggles = () => {
  console.log('\n⚡ Test 3: Rapid Toggle Test');
  
  const initialState = window.__ZUSTAND_STORE__?.getState?.()?.pdfNightMode;
  const toggleButton = document.querySelector('[data-testid="night-mode-toggle"]') || 
                      document.querySelector('[title*="Night Mode"]') ||
                      document.querySelector('[title*="Light Mode"]');
  
  if (toggleButton) {
    // Click 5 times rapidly
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        console.log(`Rapid click ${i + 1}`);
        toggleButton.click();
      }, i * 50);
    }
    
    setTimeout(() => {
      const finalState = window.__ZUSTAND_STORE__?.getState?.()?.pdfNightMode;
      const finalLocalStorage = JSON.parse(localStorage.getItem('pdfNightMode') || 'null');
      
      console.log({
        initialState,
        finalState,
        finalLocalStorage,
        expectedFinalState: initialState, // Should be back to initial after odd number of toggles
        consistent: finalState === finalLocalStorage
      });
    }, 500);
  }
};

// Run tests
setTimeout(() => {
  testInitialState();
  setTimeout(testToggleBehavior, 1000);
  setTimeout(testRapidToggles, 3000);
}, 1000);

console.log('🧪 Test script loaded. Tests will run automatically.');