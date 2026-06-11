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
