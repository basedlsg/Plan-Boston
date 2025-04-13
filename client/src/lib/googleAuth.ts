// Define the type for global window object with Google authentication
declare global {
  interface Window {
    google?: any;
    handleGoogleCredentialResponse?: (response: { credential: string }) => void;
  }
}

/**
 * Initialize Google OAuth
 * 
 * @param clientId Google OAuth client ID
 * @param callback Function to handle the credential response
 */
export function initializeGoogleAuth(clientId: string, callback: (credential: string) => void) {
  // Set up the global callback function that Google will call
  window.handleGoogleCredentialResponse = (response) => {
    if (response && response.credential) {
      callback(response.credential);
    }
  };
  
  // We don't need to check for window.google here since we're dynamically loading the script
  // The initialization will happen after the script is loaded
}

/**
 * Render the Google Sign-In button
 * 
 * @param elementId ID of the HTML element to render the button in
 */
export function renderGoogleButton(elementId: string) {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    console.error('Google Identity Services not available yet');
    return;
  }

  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    // Initialize Google Identity Services
    window.google.accounts.id.initialize({
      client_id: 'GOOGLE_CLIENT_ID', // This would be replaced with a real client ID in production
      callback: window.handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Render the button
    window.google.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 300, // This is a numeric value as required
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
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    console.error('Google Identity Services not available');
    return;
  }

  try {
    window.google.accounts.id.prompt();
  } catch (error) {
    console.error('Error prompting Google Sign-In:', error);
  }
}