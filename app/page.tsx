import { createSupabaseServerClient } from "@/lib/supabase/server";
import DashboardPage from "./dashboard/page";
import LoginPage from "./login/page";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? <DashboardPage /> : <LoginPage />;
}
