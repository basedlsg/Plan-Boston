/**
 * Centralized access to environment variables for the client-side application
 * 
 * This helps provide type safety and consistent access pattern to environment variables.
 * Any environment variable used in the client must be prefixed with VITE_ to be exposed.
 */

// Google Client ID for authentication
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// Base URL for API requests
export const BASE_URL = import.meta.env.VITE_BASE_URL || '';