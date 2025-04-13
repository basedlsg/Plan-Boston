/**
 * Centralized access to environment variables for the client-side application
 * 
 * This module helps provide type safety and consistent access to both
 * environment variables and server-provided configuration.
 */
import { useState, useEffect } from 'react';

// Directly available environment variables
export const BASE_URL = import.meta.env.VITE_BASE_URL || '';

// Remote configuration values that must be fetched from server
interface ServerConfig {
  googleClientId: string;
  // Add other remote configuration values here
}

// Initialization state
let config: ServerConfig | null = null;
let isLoading = false;
let loadError: Error | null = null;
let loadPromise: Promise<ServerConfig> | null = null;

/**
 * Fetch configuration from the server
 */
export async function fetchConfig(): Promise<ServerConfig> {
  // If we already have the config, return it
  if (config) {
    return config;
  }
  
  // If we're already loading, return the existing promise
  if (loadPromise) {
    return loadPromise;
  }
  
  // Start a new load
  isLoading = true;
  loadError = null;
  
  loadPromise = fetch('/api/config/public')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      config = data;
      isLoading = false;
      return data;
    })
    .catch(error => {
      loadError = error;
      isLoading = false;
      console.error('Error loading configuration:', error);
      throw error;
    });
  
  return loadPromise;
}

/**
 * Hook to access configuration values
 */
export function useConfig() {
  const [localConfig, setLocalConfig] = useState<ServerConfig | null>(config);
  const [loading, setLoading] = useState(!config && isLoading);
  const [error, setError] = useState<Error | null>(loadError);
  
  useEffect(() => {
    // If we already have the config, no need to fetch
    if (config) {
      setLocalConfig(config);
      return;
    }
    
    // Start loading
    setLoading(true);
    
    fetchConfig()
      .then(data => {
        setLocalConfig(data);
        setError(null);
      })
      .catch(err => {
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  
  return { config: localConfig, loading, error };
}

// Pre-fetch config on module load to speed up first access
fetchConfig().catch(err => console.warn('Failed to prefetch config:', err));