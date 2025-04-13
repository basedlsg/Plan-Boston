import React, { useEffect } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'wouter';

export default function LoginPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">London Day Planner</h1>
          <p className="text-muted-foreground">
            Welcome back! Log in to access your itineraries
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}