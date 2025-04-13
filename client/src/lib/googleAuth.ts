// Define the Google authentication interface for TypeScript
interface GoogleAuthentication {
  accounts: {
    id: {
      initialize: (config: any) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          type: string;
          theme?: string;
          size?: string;
          text?: string;
          shape?: string;
          logo_alignment?: string;
          width?: string;
          locale?: string;
          click_listener?: () => void;
        }
      ) => void;
      prompt: (options?: any) => void;
    };
  };
}

// Declare the window interface with google property
declare global {
  interface Window {
    google?: GoogleAuthentication;
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
  if (!window.google) {
    console.error('Google Identity Services not available');
    return;
  }

  // Set up the global callback function
  window.handleGoogleCredentialResponse = (response) => {
    callback(response.credential);
  };

  // Initialize Google Identity Services
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: window.handleGoogleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });
}

/**
 * Render the Google Sign-In button
 * 
 * @param elementId ID of the HTML element to render the button in
 */
export function renderGoogleButton(elementId: string) {
  if (!window.google) {
    console.error('Google Identity Services not available');
    return;
  }

  const element = document.getElementById(elementId);
  
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  window.google.accounts.id.renderButton(element, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: '100%',
  });
}

/**
 * Display the One Tap UI
 */
export function promptGoogleSignIn() {
  if (!window.google) {
    console.error('Google Identity Services not available');
    return;
  }

  window.google.accounts.id.prompt();
}