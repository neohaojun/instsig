import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import { InstsigApp } from "@/components/instsig/instsig-app";
import LoginPage from "./login/page";
import type { ProfileRecord, RequestRecord } from "@/lib/types";

function buildProfilesMap(profiles: ProfileRecord[] | null | undefined) {
  return Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
}

export default async function HomePage() {
  let supabase;

  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return <LoginPage />;
    }

    throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <LoginPage />;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: allRequests } = await supabase
    .from("requests")
    .select("*")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  const requests = (allRequests ?? []) as RequestRecord[];
  const relevantRequests = profile?.role === "admin" ? requests : requests.filter((request) => request.requester_id === user.id);
  const profileIds = Array.from(
    new Set(
      [
        profile?.id,
        ...relevantRequests.map((request) => request.requester_id),
        ...relevantRequests.map((request) => request.approved_by),
        ...relevantRequests.map((request) => request.rejected_by),
        ...relevantRequests.map((request) => request.finalized_by),
      ].filter(Boolean) as string[],
    ),
  );
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("*").in("id", profileIds)
    : { data: [] as ProfileRecord[] };

  return (
    <InstsigApp
      userEmail={user.email ?? null}
      profile={(profile as ProfileRecord | null) ?? null}
      initialRequests={relevantRequests}
      profilesById={buildProfilesMap(profiles)}
    />
  );
}
