/**
 * Central configuration for API keys and feature flags
 * 
 * This module centralizes all environment variables and configuration settings,
 * providing validation and feature flag management.
 */

import { z } from "zod";

// Define API key validation patterns
const API_KEY_PATTERNS = {
  GEMINI: /^[A-Za-z0-9-_]{32,}$/,
  GOOGLE: /^[A-Za-z0-9-_]{39}$/,
  WEATHER: /^[A-Za-z0-9-_]{32}$/
} as const;

// Define environment variable schema with validation
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GEMINI_API_KEY: z.string()
    .regex(API_KEY_PATTERNS.GEMINI, 'Invalid Gemini API key format')
    .optional(),
  GOOGLE_PLACES_API_KEY: z.string()
    .regex(API_KEY_PATTERNS.GOOGLE, 'Invalid Google Places API key format')
    .optional(),
  WEATHER_API_KEY: z.string()
    .regex(API_KEY_PATTERNS.WEATHER, 'Invalid Weather API key format')
    .optional(),
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

// Feature definitions with metadata
export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  AI_PROCESSING: {
    enabled: true, // Enabling Gemini AI processing
    fallbackEnabled: true,
    required: false
  },
  PLACES_API: {
    enabled: true, // Enabling Google Places API
    fallbackEnabled: true,
    required: true
  },
  WEATHER_API: {
    enabled: true, // Enabling Weather API
    fallbackEnabled: false,
    required: false
  }
} as const;

// API configurations
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
  }
} as const;

// Parse and validate environment variables
let parsedEnv: z.infer<typeof envSchema>;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

// Initialize API configurations
Object.entries(API_CONFIG).forEach(([key, config]) => {
  const value = parsedEnv[key as keyof typeof parsedEnv];
  if (value) {
    config.key = value;
  }
});

// Initialize feature flags based on API key availability
Object.entries(FEATURE_CONFIG).forEach(([feature, config]) => {
  const apiKey = API_CONFIG[`${feature.split('_')[0]}_API_KEY` as keyof typeof API_CONFIG];
  if (apiKey) {
    config.enabled = !!apiKey.key;
  }
});

// Configuration class for type-safe access
class Config {
  private static instance: Config;
  private env: z.infer<typeof envSchema>;
  private features: typeof FEATURE_CONFIG;
  private apis: typeof API_CONFIG;

  private constructor() {
    this.env = parsedEnv;
    this.features = FEATURE_CONFIG;
    this.apis = API_CONFIG;
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  // Environment access
  public get environment(): Environment {
    return this.env.NODE_ENV;
  }

  public get logLevel(): LogLevel {
    return this.env.LOG_LEVEL;
  }

  // Feature flag access
  public isFeatureEnabled(feature: keyof typeof FEATURE_CONFIG): boolean {
    return this.features[feature].enabled;
  }

  public isFallbackEnabled(feature: keyof typeof FEATURE_CONFIG): boolean {
    return this.features[feature].fallbackEnabled;
  }

  public isFeatureRequired(feature: keyof typeof FEATURE_CONFIG): boolean {
    return this.features[feature].required;
  }

  // API key access
  public getApiKey(key: keyof typeof API_CONFIG): string {
    const config = this.apis[key];
    if (!config.key && config.required) {
      throw new Error(`Missing required API key: ${key}`);
    }
    return config.key;
  }

  public validateApiKey(key: keyof typeof API_CONFIG): boolean {
    const config = this.apis[key];
    return config.key ? config.pattern.test(config.key) : false;
  }

  // Logging utilities
  public logConfigStatus(): void {
    const status = {
      environment: this.environment,
      features: Object.entries(this.features).map(([feature, config]) => ({
        feature,
        enabled: config.enabled,
        fallbackEnabled: config.fallbackEnabled
      })),
      apis: Object.entries(this.apis).map(([key, config]) => ({
        key,
        configured: !!config.key,
        valid: this.validateApiKey(key as keyof typeof API_CONFIG)
      }))
    };

    console.log('Configuration Status:', JSON.stringify(status, null, 2));
  }

  public getRedactedConfig(): Record<string, unknown> {
    return {
      environment: this.environment,
      logLevel: this.logLevel,
      features: Object.entries(this.features).map(([feature, config]) => ({
        feature,
        enabled: config.enabled,
        fallbackEnabled: config.fallbackEnabled
      })),
      apis: Object.entries(this.apis).map(([key, config]) => ({
        key,
        configured: !!config.key,
        valid: this.validateApiKey(key as keyof typeof API_CONFIG)
      }))
    };
  }
}

// Export singleton instance
export const config = Config.getInstance();

// Export type-safe helper functions
export function isFeatureEnabled(feature: keyof typeof FEATURE_CONFIG): boolean {
  return config.isFeatureEnabled(feature);
}

export function isFallbackEnabled(feature: keyof typeof FEATURE_CONFIG): boolean {
  return config.isFallbackEnabled(feature);
}

export function isFeatureRequired(feature: keyof typeof FEATURE_CONFIG): boolean {
  return config.isFeatureRequired(feature);
}

export function getApiKey(key: keyof typeof API_CONFIG): string {
  return config.getApiKey(key);
}

export function validateApiKey(key: keyof typeof API_CONFIG): boolean {
  return config.validateApiKey(key);
}

// Export feature flags for direct access if needed
export const FEATURES = Object.entries(FEATURE_CONFIG).reduce(
  (acc, [key, config]) => ({ ...acc, [key]: config.enabled }),
  {} as Record<keyof typeof FEATURE_CONFIG, boolean>
);