import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Link } from 'wouter';
import { useAuth } from '../../hooks/useAuth';
import { initializeGoogleAuth, renderGoogleButton } from '../../lib/googleAuth';
import { GOOGLE_CLIENT_ID } from '../../lib/env';

// Create the form schema with validation
const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'], 
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { register, loginWithGoogle, error, clearError, isLoading } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Initialize Google Sign-In when component mounts
  useEffect(() => {
    // Set up Google Auth - this needs to be done before loading the script
    initializeGoogleAuth('GOOGLE_CLIENT_ID', async (credential) => {
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
            renderGoogleButton('google-register-button');
          }, 100);
        }
      };
      document.body.appendChild(script);
    } else if (window.google && googleButtonRef.current) {
      // Script already loaded, just render the button
      renderGoogleButton('google-register-button');
    }
    
    return () => {
      // We don't remove the script on unmount as it might be used by other components
    };
  }, [loginWithGoogle]);

  // Initialize the form with react-hook-form
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Submit handler
  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await register(
        values.email, 
        values.password, 
        values.confirmPassword,
        values.name
      );
    } catch (err) {
      // Error is handled in the auth context
      console.error('Registration submission error:', err);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Enter your details to create a new account
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your name"
                      type="text"
                      autoComplete="name"
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
                      placeholder="Create a password"
                      type="password"
                      autoComplete="new-password"
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
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Confirm your password"
                      type="password"
                      autoComplete="new-password"
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
              {isLoading ? 'Creating account...' : 'Create Account'}
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
          id="google-register-button" 
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
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}