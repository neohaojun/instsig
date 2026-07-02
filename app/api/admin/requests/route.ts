import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const deleteRequestSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Please sign in again." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "You do not have permission to delete requests." }, { status: 403 });
  }

  const parsed = deleteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "This request could not be deleted." }, { status: 400 });

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Could not create the admin client for request deletion", error);
    return NextResponse.json({ message: "This request could not be deleted." }, { status: 500 });
  }

  const { data: deletedRequest, error } = await admin
    .from("requests")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Could not delete request", error);
    return NextResponse.json({ message: "This request could not be deleted." }, { status: 500 });
  }
  if (!deletedRequest) return NextResponse.json({ message: "This request no longer exists." }, { status: 404 });

  return NextResponse.json({ id: deletedRequest.id });
}
