import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseConfigError } from "@/lib/supabase/env";
import DashboardPage from "./dashboard/page";
import LoginPage from "./login/page";

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

  return user ? <DashboardPage /> : <LoginPage />;
}
