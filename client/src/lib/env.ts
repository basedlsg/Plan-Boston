/**
 * Environment variables for the client side
 * This file provides typed access to environment variables
 */

// Google OAuth client ID used for authentication
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Function to check if required environment variables are available
export function validateEnv(): { valid: boolean; missing: string[] } {
  const required: { [key: string]: string } = {
    GOOGLE_CLIENT_ID
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  return {
    valid: missing.length === 0,
    missing
  };
}

export default {
  GOOGLE_CLIENT_ID,
  validateEnv
};