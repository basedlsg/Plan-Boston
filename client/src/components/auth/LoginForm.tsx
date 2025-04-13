import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'wouter';
import { useAuth } from '../../hooks/useAuth';
import { initializeGoogleAuth, renderGoogleButton } from '../../lib/googleAuth';
import { useConfig } from '../../lib/env';

// Create the form schema with validation
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { login, loginWithGoogle, error, clearError, isLoading } = useAuth();
  const { config, loading: configLoading } = useConfig();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Initialize Google Sign-In when component mounts
  useEffect(() => {
    // Wait for config to be loaded
    if (configLoading || !config) {
      return;
    }
    
    // Set up Google Auth with the client ID from server config
    initializeGoogleAuth(config.googleClientId, async (credential) => {
      try {
        await loginWithGoogle(credential);
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
  }, [loginWithGoogle, config, configLoading]);

  // Initialize the form with react-hook-form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Submit handler
  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.email, values.password);
    } catch (err) {
      // Error is handled in the auth context
      console.error('Login submission error:', err);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Log In</CardTitle>
        <CardDescription className="text-center">
          Enter your email and password to access your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="email@example.com"
                      type="email"
                      autoComplete="email"
                      {...field}
                      onChange={(e) => {
                        clearError();
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your password"
                      type="password"
                      autoComplete="current-password"
                      {...field}
                      onChange={(e) => {
                        clearError();
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Form>

        <div className="mt-4 relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div 
          id="google-signin-button" 
          ref={googleButtonRef} 
          className="mt-4"
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            width: '100%', 
            minHeight: '40px' 
          }}
        ></div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}