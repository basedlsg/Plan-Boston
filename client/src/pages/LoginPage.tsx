import React, { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'wouter';
import { useConfig } from '../lib/env';
import { initializeGoogleAuth, renderGoogleButton } from '../lib/googleAuth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'wouter';

export default function LoginPage() {
  const { user, loginWithGoogle, error } = useAuth();
  const [, setLocation] = useLocation();
  const { config, loading: configLoading } = useConfig();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  // Initialize Google Sign-In when component mounts
  useEffect(() => {
    // Wait for config to be loaded or if user is already logged in
    if (configLoading || !config || user) {
      return;
    }
    
    // Set up Google Auth with the client ID from server config
    initializeGoogleAuth(config.googleClientId, async (credential) => {
      try {
        await loginWithGoogle(credential);
        setLocation('/');
      } catch (err) {
        console.error('Google authentication error:', err);
      }
    });
    
    // Load the Google Identity Services script if it's not already loaded
    const scriptId = 'google-identity-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (googleButtonRef.current) {
          // Small timeout to ensure Google API is fully initialized
          setTimeout(() => {
            renderGoogleButton('google-signin-button');
          }, 100);
        }
      };
      document.body.appendChild(script);
    } else if (window.google && googleButtonRef.current) {
      // Script already loaded, just render the button
      renderGoogleButton('google-signin-button');
    }
    
    return () => {
      // We don't remove the script on unmount as it might be used by other components
    };
  }, [loginWithGoogle, config, configLoading, user, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* Removed "London Day Planner" header */}
          <p className="text-muted-foreground">
            Sign in to save your itineraries
          </p>
        </div>

        <Card className="w-full shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Sign in with Google</CardTitle>
            <CardDescription className="text-center">
              Use your Google account to sign in
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Main container for all Google Sign-In related elements */}
            <div id="google-signin-container">
              {/* Button container */}
              <div 
                id="google-signin-button" 
                ref={googleButtonRef} 
                className="mt-2"
                style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  width: '100%', 
                  minHeight: '40px' 
                }}
              ></div>
              
              {/* Prompt container */}
              <div id="google-signin-prompt-container"></div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              <Link href="/" className="text-blue-600 font-medium hover:underline">
                Continue without signing in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}