type ProfileLike = {
  full_name?: string | null;
  rank?: string | null;
  email?: string | null;
};

export function formatProfileName(profile: ProfileLike | null | undefined, fallback?: string | null) {
  const baseName = profile?.full_name || profile?.email || fallback || "Unknown";
  if (profile?.rank) {
    return `${profile.rank} ${baseName}`;
  }
  return baseName;
}

export function formatNr(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";

  const numericValue = Number(text);
  return Number.isInteger(numericValue) ? String(numericValue) : text;
}
