import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function RegisterPage() {
  const [, setLocation] = useLocation();

  // Immediately redirect to login page (Google login only)
  useEffect(() => {
    setLocation('/login');
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="text-center">
        <p>Redirecting to sign in page...</p>
      </div>
    </div>
  );
}