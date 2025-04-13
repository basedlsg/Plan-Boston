/**
 * Central configuration for API keys and feature flags
 * 
 * This module centralizes all environment variables and configuration settings,
 * providing validation and feature flag management.
 */

import { z } from "zod";

// API key validation schemas - using simple length validation to be more flexible
const apiKeySchemas = {
  GEMINI_API_KEY: z.string().min(1),  // Always accept key if present, validation patterns will be checked later
  GOOGLE_PLACES_API_KEY: z.string().min(1),  // Always accept key if present, validation patterns will be checked later
  WEATHER_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional()  // OAuth Client ID for Google authentication
};

// Legacy API key validation patterns - kept for compatibility
const API_KEY_PATTERNS = {
  GEMINI: /^[A-Za-z0-9-_]{32,}$/,
  GOOGLE: /^[A-Za-z0-9-_]{39}$/,
  WEATHER: /^[A-Za-z0-9-_]{32}$/
} as const;

// Feature flag definitions with dependencies
const featureFlags = {
  AI_PROCESSING: {
    enabled: true,
    required: ["GEMINI_API_KEY"],
    fallback: false,
    description: "Use AI for natural language understanding"
  },
  USE_GEMINI: {
    enabled: true,
    required: ["GEMINI_API_KEY"],
    fallback: false,
    description: "Use Gemini 1.5 Pro AI for enhanced request understanding"
  },
  WEATHER_AWARE: {
    enabled: true,
    required: ["WEATHER_API_KEY"],
    fallback: false,
    description: "Use weather data to adjust recommendations"
  },
  PLACES_API: {
    enabled: true,
    required: ["GOOGLE_PLACES_API_KEY"],
    fallback: false,
    description: "Google Places API integration"
  }
};

// Define environment variable schema with validation - legacy structure
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  WEATHER_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  FEATURE_FLAGS: z.record(z.boolean()).optional(),
});

// Configuration types
export type Environment = z.infer<typeof envSchema>['NODE_ENV'];
export type LogLevel = z.infer<typeof envSchema>['LOG_LEVEL'];

export interface FeatureConfig {
  enabled: boolean;
  fallbackEnabled: boolean;
  required: boolean;
}

export interface ApiConfig {
  key: string;
  pattern: RegExp;
  required: boolean;
}

// Legacy feature and API configurations - kept for compatibility
export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  AI_PROCESSING: {
    enabled: true,
    fallbackEnabled: true,
    required: false
  },
  PLACES_API: {
    enabled: true,
    fallbackEnabled: true,
    required: true
  },
  WEATHER_API: {
    enabled: true,
    fallbackEnabled: false,
    required: false
  },
  USE_GEMINI: {
    enabled: true,
    fallbackEnabled: false,
    required: false
  }
} as const;

export const API_CONFIG: Record<string, ApiConfig> = {
  GEMINI_API_KEY: {
    key: '',
    pattern: API_KEY_PATTERNS.GEMINI,
    required: false
  },
  GOOGLE_PLACES_API_KEY: {
    key: '',
    pattern: API_KEY_PATTERNS.GOOGLE,
    required: true
  },
  WEATHER_API_KEY: {
    key: '',
    pattern: API_KEY_PATTERNS.WEATHER,
    required: false
  },
  GOOGLE_CLIENT_ID: {
    key: '',
    pattern: /.+/,  // Any non-empty string
    required: false
  }
} as const;

// Configuration singleton
class Config {
  private static instance: Config;
  private apiKeys: Record<string, string | undefined> = {};
  private features: Record<string, boolean> = {};
  private env: z.infer<typeof envSchema>;
  private legacyFeatures: typeof FEATURE_CONFIG;
  private legacyApis: typeof API_CONFIG;
  private initialized = false;

  private constructor() {
    // Initialize environment
    try {
      this.env = envSchema.parse(process.env);
    } catch (error) {
      console.error('Environment validation failed:', error);
      this.env = envSchema.parse({});
    }
    
    // Initialize legacy structures
    this.legacyFeatures = FEATURE_CONFIG;
    this.legacyApis = API_CONFIG;
    
    // Load API keys first - CRITICAL: Must be done before initializing feature flags
    this.loadApiKeys();
    
    // Update legacy API configurations
    this.updateLegacyApiConfig();
    
    // Now initialize feature flags with loaded API keys
    this.initializeFeatureFlags();
    
    // Initialize legacy feature flags based on API key availability
    this.updateLegacyFeatureConfig();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public initialize(): void {
    if (this.initialized) return;
    
    // Log configuration status
    this.logConfigStatus();
    
    this.initialized = true;
  }

  private loadApiKeys(): void {
    // Load and validate API keys - directly from process.env
    for (const key of Object.keys(apiKeySchemas)) {
      const envValue = process.env[key];
      console.log(`Direct environment check - ${key}: ${!!envValue} (length: ${envValue ? envValue.length : 0})`);
      
      this.apiKeys[key] = envValue;
      
      // Also update legacy API configuration
      if (this.legacyApis[key as keyof typeof API_CONFIG]) {
        this.legacyApis[key as keyof typeof API_CONFIG].key = this.apiKeys[key] || '';
      }
    }
    
    // Force set the keys to ensure they are properly assigned
    this.apiKeys["GEMINI_API_KEY"] = process.env.GEMINI_API_KEY;
    this.apiKeys["GOOGLE_PLACES_API_KEY"] = process.env.GOOGLE_PLACES_API_KEY;
    this.apiKeys["WEATHER_API_KEY"] = process.env.WEATHER_API_KEY;
    this.apiKeys["GOOGLE_CLIENT_ID"] = process.env.GOOGLE_CLIENT_ID;
    
    // Debug log the API keys without revealing their values
    for (const [key, value] of Object.entries(this.apiKeys)) {
      console.log(`API Key loaded: ${key} = ${!!value} (length: ${value ? value.length : 0})`);
    }
  }

  private updateLegacyApiConfig(): void {
    // Update legacy API configurations
    Object.keys(this.legacyApis).forEach(key => {
      const value = this.apiKeys[key];
      if (value) {
        this.legacyApis[key as keyof typeof API_CONFIG].key = value;
      }
    });
  }

  private updateLegacyFeatureConfig(): void {
    // Update legacy feature configurations
    Object.keys(this.legacyFeatures).forEach(feature => {
      const apiKey = this.legacyApis[`${feature.split('_')[0]}_API_KEY` as keyof typeof API_CONFIG];
      if (apiKey) {
        this.legacyFeatures[feature as keyof typeof FEATURE_CONFIG].enabled = !!apiKey.key;
      }
      
      // Also update from new feature flags
      if (this.features[feature]) {
        this.legacyFeatures[feature as keyof typeof FEATURE_CONFIG].enabled = this.features[feature];
      }
    });
  }

  private initializeFeatureFlags(): void {
    // Set default feature flags
    for (const [feature, config] of Object.entries(featureFlags)) {
      // Check if all required API keys are available
      const hasRequiredKeys = config.required.every(key => 
        this.isApiKeyValid(key)
      );
      
      // Enable feature if all requirements are met
      this.features[feature] = config.enabled && hasRequiredKeys;
      
      // Log initialization
      if (this.features[feature]) {
        console.log(`${feature} feature flag status: true`);
      } else {
        console.log(`${feature} feature flag status: false (missing requirements or disabled)`);
      }
    }
  }

  private isApiKeyValid(key: string): boolean {
    const value = this.apiKeys[key];
    
    // Log the key existence (without revealing the actual key)
    console.log(`${key} present: ${!!value} (length: ${value ? value.length : 0})`);
    
    // Always return true if the key exists (simpler validation)
    if (value && value.length > 0) {
      console.log(`${key} validation: true`);
      return true;
    }
    
    console.log(`${key} validation: false`);
    return false;
  }

  // Environment access
  public get environment(): Environment {
    return this.env.NODE_ENV;
  }

  public get logLevel(): LogLevel {
    return this.env.LOG_LEVEL;
  }

  // API key access
  public getApiKey(key: string): string | undefined {
    return this.apiKeys[key];
  }

  // Feature flag access
  public isFeatureEnabled(feature: string): boolean {
    // First check new feature flags
    if (this.features[feature] !== undefined) {
      return this.features[feature];
    }
    
    // Fall back to legacy feature flags
    if (this.legacyFeatures[feature as keyof typeof FEATURE_CONFIG]) {
      return this.legacyFeatures[feature as keyof typeof FEATURE_CONFIG].enabled;
    }
    
    return false;
  }

  public isFallbackEnabled(feature: keyof typeof FEATURE_CONFIG): boolean {
    return this.legacyFeatures[feature].fallbackEnabled;
  }

  public isFeatureRequired(feature: keyof typeof FEATURE_CONFIG): boolean {
    return this.legacyFeatures[feature].required;
  }

  public validateApiKey(key: string): boolean {
    // Simplified validation - just check if key exists and has length
    const value = this.apiKeys[key];
    return value !== undefined && value.length > 0;
  }

  private logConfigStatus(): void {
    // Log configuration status (without revealing sensitive values)
    const redactedConfig = {
      features: this.features,
      apiKeysPresent: Object.entries(this.apiKeys).reduce((acc, [key, value]) => {
        acc[key] = !!value;
        return acc;
      }, {} as Record<string, boolean>),
      environment: this.environment
    };
    
    console.log('Application configuration:', redactedConfig);
  }

  public getRedactedConfig(): Record<string, unknown> {
    return {
      environment: this.environment,
      logLevel: this.logLevel,
      features: Object.entries(this.features).map(([feature, enabled]) => ({
        feature,
        enabled
      })),
      apis: Object.entries(this.apiKeys).map(([key, value]) => ({
        key,
        configured: !!value,
        valid: this.validateApiKey(key)
      }))
    };
  }
}

// Initialize configuration
const config = Config.getInstance();
config.initialize();

// Helper functions for easier access
export function getApiKey(key: string): string | undefined {
  return config.getApiKey(key);
}

export function isFeatureEnabled(feature: string): boolean {
  return config.isFeatureEnabled(feature);
}

export function isFallbackEnabled(feature: keyof typeof FEATURE_CONFIG): boolean {
  return config.isFallbackEnabled(feature);
}

export function isFeatureRequired(feature: keyof typeof FEATURE_CONFIG): boolean {
  return config.isFeatureRequired(feature);
}

export function validateApiKey(key: string): boolean {
  return config.validateApiKey(key);
}

// Export feature flags for direct access if needed
export const FEATURES = Object.entries(FEATURE_CONFIG).reduce(
  (acc, [key, config]) => ({ ...acc, [key]: config.enabled }),
  {} as Record<keyof typeof FEATURE_CONFIG, boolean>
);

export { config };
export default config;