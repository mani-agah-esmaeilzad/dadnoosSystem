import { z } from 'zod'

import { isBuildTime } from '@/lib/runtime/build'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ISSUER: z.string().min(1).default('dadnoos.local'),
  JWT_AUDIENCE: z.string().min(1).default('dadnoos.app'),
  TOKEN_DEFAULT_TTL_HOURS: z.coerce.number().int().positive().default(24),
  APP_NAME: z.string().min(1).default('Dadnoos'),
  PUBLIC_BASE_URL: z.string().min(1).default('http://localhost:3052'),
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(20_000_000),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(180),
  OTP_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_BYPASS_IN_DEV: z.coerce.boolean().default(false),
  OTP_FIXED_CODE: z.string().min(4).default('111111'),
  OTP_ACCEPT_MASTER_CODE: z.coerce.boolean().default(false),
  OTP_STATIC_LOGIN_PHONE: z.string().optional(),
  OTP_STATIC_LOGIN_CODE: z.string().optional(),
  OTP_DEV_MODE: z.coerce.boolean().default(false),
  MELIPAYAMAK_OTP_BASE_URL: z.string().optional(),
  MELIPAYAMAK_OTP_TOKEN: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  TOKEN_ISSUER_API_KEY: z.string().optional(),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  BILLING_REQUIRE_SUBSCRIPTION: z.coerce.boolean().default(true),
  DEFAULT_PLAN_TOKEN_QUOTA: z.coerce.number().int().positive().default(100000),
  DEFAULT_PLAN_DURATION_DAYS: z.coerce.number().int().positive().default(30),
  DEFAULT_PLAN_CODE: z.string().default('FREE'),
  DEFAULT_PLAN_TITLE: z.string().default('پلن رایگان'),
  LLM_PROVIDER: z.string().min(1).default('openai'),
  LLM_API_KEY: z.string().min(1, 'LLM_API_KEY is required'),
  LLM_MODEL: z.string().min(1, 'LLM_MODEL is required'),
  LLM_BASE_URL: z.string().optional(),
  TRANSCRIPTION_MODEL: z.string().optional(),
  TRANSCRIPTION_LANGUAGE: z.string().optional(),
  TTS_MODEL: z.string().optional(),
  TTS_DEFAULT_VOICE: z.string().optional(),
  AUDIO_STUB_MODE: z.coerce.boolean().default(false),
})

export type AppEnv = z.infer<typeof envSchema>

const rawEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ISSUER: process.env.JWT_ISSUER,
  JWT_AUDIENCE: process.env.JWT_AUDIENCE,
  TOKEN_DEFAULT_TTL_HOURS: process.env.TOKEN_DEFAULT_TTL_HOURS,
  APP_NAME: process.env.APP_NAME,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  UPLOADS_DIR: process.env.UPLOADS_DIR,
  MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
  OTP_TTL_SECONDS: process.env.OTP_TTL_SECONDS,
  OTP_COOLDOWN_SECONDS: process.env.OTP_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS: process.env.OTP_MAX_ATTEMPTS,
  OTP_BYPASS_IN_DEV: process.env.OTP_BYPASS_IN_DEV,
  OTP_FIXED_CODE: process.env.OTP_FIXED_CODE,
  OTP_ACCEPT_MASTER_CODE: process.env.OTP_ACCEPT_MASTER_CODE,
  OTP_STATIC_LOGIN_PHONE: process.env.OTP_STATIC_LOGIN_PHONE,
  OTP_STATIC_LOGIN_CODE: process.env.OTP_STATIC_LOGIN_CODE,
  OTP_DEV_MODE: process.env.OTP_DEV_MODE,
  MELIPAYAMAK_OTP_BASE_URL: process.env.MELIPAYAMAK_OTP_BASE_URL,
  MELIPAYAMAK_OTP_TOKEN: process.env.MELIPAYAMAK_OTP_TOKEN,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY,
  TOKEN_ISSUER_API_KEY: process.env.TOKEN_ISSUER_API_KEY,
  RATE_LIMIT_WINDOW_SEC: process.env.RATE_LIMIT_WINDOW_SEC,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
  BILLING_REQUIRE_SUBSCRIPTION: process.env.BILLING_REQUIRE_SUBSCRIPTION,
  DEFAULT_PLAN_TOKEN_QUOTA: process.env.DEFAULT_PLAN_TOKEN_QUOTA,
  DEFAULT_PLAN_DURATION_DAYS: process.env.DEFAULT_PLAN_DURATION_DAYS,
  DEFAULT_PLAN_CODE: process.env.DEFAULT_PLAN_CODE,
  DEFAULT_PLAN_TITLE: process.env.DEFAULT_PLAN_TITLE,
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_MODEL: process.env.LLM_MODEL,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  TRANSCRIPTION_MODEL: process.env.TRANSCRIPTION_MODEL,
  TRANSCRIPTION_LANGUAGE: process.env.TRANSCRIPTION_LANGUAGE,
  TTS_MODEL: process.env.TTS_MODEL,
  TTS_DEFAULT_VOICE: process.env.TTS_DEFAULT_VOICE,
  AUDIO_STUB_MODE: process.env.AUDIO_STUB_MODE,
}

const buildFallbacks: Record<string, string> = {
  DATABASE_URL: 'postgresql://build:build@localhost:5432/build',
  REDIS_URL: 'redis://127.0.0.1:6379',
  JWT_SECRET: 'build-secret-key-please-change',
  JWT_ISSUER: 'dadnoos.build',
  JWT_AUDIENCE: 'dadnoos.build.app',
  APP_NAME: 'Dadnoos',
  PUBLIC_BASE_URL: 'http://localhost:3052',
  UPLOADS_DIR: './public/uploads',
  MAX_UPLOAD_BYTES: '20000000',
  OTP_TTL_SECONDS: '180',
  OTP_COOLDOWN_SECONDS: '60',
  OTP_MAX_ATTEMPTS: '5',
  OTP_BYPASS_IN_DEV: 'true',
  OTP_FIXED_CODE: '111111',
  OTP_ACCEPT_MASTER_CODE: 'true',
  OTP_DEV_MODE: 'true',
  RATE_LIMIT_WINDOW_SEC: '60',
  RATE_LIMIT_MAX_REQUESTS: '60',
  BILLING_REQUIRE_SUBSCRIPTION: 'false',
  DEFAULT_PLAN_TOKEN_QUOTA: '100000',
  DEFAULT_PLAN_DURATION_DAYS: '30',
  DEFAULT_PLAN_CODE: 'FREE',
  DEFAULT_PLAN_TITLE: 'پلن رایگان',
  LLM_PROVIDER: 'openai',
  LLM_API_KEY: 'build-key',
  LLM_MODEL: 'gpt-4o-mini',
  TRANSCRIPTION_MODEL: 'gpt-4o-transcribe',
  TRANSCRIPTION_LANGUAGE: 'fa',
  TTS_MODEL: 'gpt-4o-mini-tts',
  TTS_DEFAULT_VOICE: 'alloy',
  AUDIO_STUB_MODE: 'true',
}

const shouldAllowFallback = isBuildTime || process.env.VERCEL === '1' || process.env.ALLOW_RUNTIME_ENV_FALLBACK === '1'

const mergeWithFallbacks = () => {
  const merged: Record<string, string | undefined> = { ...buildFallbacks }
  for (const [key, value] of Object.entries(rawEnv)) {
    if (value !== undefined && value !== '') {
      merged[key] = value
    }
  }
  return merged
}

export const env: AppEnv = (() => {
  try {
    return envSchema.parse(rawEnv)
  } catch (error) {
    if (shouldAllowFallback) {
      console.warn('Env validation failed, using fallback values.', error)
      return envSchema.parse(mergeWithFallbacks())
    }
    throw error
  }
})()
