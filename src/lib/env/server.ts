import "server-only";

import { z } from "zod";

const supabaseAdminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.url().optional(),
});

const instagramEnvSchema = z.object({
  META_INSTAGRAM_APP_ID: z.string().min(1),
  META_INSTAGRAM_APP_SECRET: z.string().min(1),
  META_TOKEN_ENCRYPTION_KEY: z.string().min(1),
});

const publicationEngineEnvSchema = z.object({
  VOHA_CRON_SECRET: z.string().min(32),
});

export function getSupabaseAdminEnv() {
  return supabaseAdminEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}

export function getR2Env() {
  return r2EnvSchema.parse({
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL || undefined,
  });
}

export function getInstagramEnv() {
  return instagramEnvSchema.parse({
    META_INSTAGRAM_APP_ID: process.env.META_INSTAGRAM_APP_ID,
    META_INSTAGRAM_APP_SECRET: process.env.META_INSTAGRAM_APP_SECRET,
    META_TOKEN_ENCRYPTION_KEY: process.env.META_TOKEN_ENCRYPTION_KEY,
  });
}

export function getPublicationEngineEnv() {
  return publicationEngineEnvSchema.parse({
    VOHA_CRON_SECRET: process.env.VOHA_CRON_SECRET,
  });
}
