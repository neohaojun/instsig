export type SupabasePublicConfig = {
  url: string;
  key: string;
};

export class SupabaseConfigError extends Error {
  constructor(message = "Supabase is not configured.") {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

function readPublicSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url;
}

function readClientKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return key;
}

export function getOptionalSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = readPublicSupabaseUrl();
  const key = readClientKey();

  if (!url || !key) {
    return null;
  }

  return {
    url,
    key,
  };
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const config = getOptionalSupabasePublicConfig();

  if (!config) {
    console.error(
      "Supabase public config is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    throw new SupabaseConfigError();
  }

  return config;
}
