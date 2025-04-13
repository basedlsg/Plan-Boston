// Define the type for global window object with Google authentication
declare global {
  interface Window {
    google?: any;
    handleGoogleCredentialResponse?: (response: { credential: string }) => void;
  }
}

// Keep track of initialization status
let isInitialized = false;

/**
 * Initialize Google OAuth
 * 
 * @param clientId Google OAuth client ID
 * @param callback Function to handle the credential response
 */
export function initializeGoogleAuth(clientId: string, callback: (credential: string) => void) {
  if (!clientId) {
    console.error('No Google Client ID provided');
    return;
  }

  // Set up the global callback function that Google will call
  window.handleGoogleCredentialResponse = (response) => {
    if (response && response.credential) {
      callback(response.credential);
    }
  };
  
  // We'll initialize in the loadGoogleScript function
  loadGoogleScript(clientId);
}

/**
 * Load the Google Identity Services script
 * 
 * @param clientId The Google Client ID to use for authentication
 */
function loadGoogleScript(clientId: string): void {
  const scriptId = 'google-identity-script';
  
  // Don't load the script multiple times
  if (document.getElementById(scriptId)) {
    if (window.google && window.google.accounts) {
      initializeGoogleIdentity(clientId);
    }
    return;
  }
  
  const script = document.createElement('script');
  script.id = scriptId;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    // Initialize once the script is loaded
    initializeGoogleIdentity(clientId);
  };
  
  document.body.appendChild(script);
}

/**
 * Initialize the Google Identity Services
 * 
 * @param clientId The Google Client ID to use for authentication
 */
function initializeGoogleIdentity(clientId: string): void {
  if (!window.google || !window.google.accounts) {
    console.error('Google Identity Services not loaded properly');
    return;
  }
  
  try {
    // Log the client ID for debugging
    console.log('Initializing Google Identity Services with client ID:', clientId);
    
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: window.handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      // Use popup mode to avoid redirect URI issues
      ux_mode: 'popup', 
      // Additional configuration for handling redirect
      prompt_parent_id: 'google-signin-prompt-container'
    });
    
    isInitialized = true;
    console.log('Google Identity Services initialized successfully');
    
    // Render any pending buttons
    renderPendingButtons();
  } catch (error) {
    console.error('Error initializing Google Identity Services:', error);
  }
}

// Store buttons to render after initialization
const pendingButtons: string[] = [];

/**
 * Render the Google Sign-In button
 * 
 * @param elementId ID of the HTML element to render the button in
 */
export function renderGoogleButton(elementId: string) {
  if (!window.google || !window.google.accounts || !isInitialized) {
    // Add to pending buttons to render later when initialized
    if (!pendingButtons.includes(elementId)) {
      pendingButtons.push(elementId);
    }
    return;
  }

  renderButton(elementId);
}

/**
 * Render all pending buttons
 */
function renderPendingButtons() {
  while (pendingButtons.length > 0) {
    const elementId = pendingButtons.pop();
    if (elementId) {
      renderButton(elementId);
    }
  }
}

/**
 * Helper function to render a single button
 * 
 * @param elementId ID of the HTML element to render the button in
 */
function renderButton(elementId: string) {
  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    // Get the current origin to help with debugging
    const currentOrigin = window.location.origin;
    console.log('Current origin for Google Sign-In:', currentOrigin);
    
    // Render the button with popup mode to avoid redirect issues
    window.google.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: 250,
      ux_mode: 'popup', // Using popup mode to avoid redirect URI issues
    });
    
    console.log('Google Sign-In button rendered successfully');
  } catch (error) {
    console.error('Error rendering Google Sign-In button:', error);
  }
}

/**
 * Display the One Tap UI
 */
export function promptGoogleSignIn() {
  if (!window.google || !window.google.accounts || !isInitialized) {
    console.error('Google Identity Services not available or not initialized');
    return;
  }

  try {
    window.google.accounts.id.prompt();
  } catch (error) {
    console.error('Error prompting Google Sign-In:', error);
  }
}