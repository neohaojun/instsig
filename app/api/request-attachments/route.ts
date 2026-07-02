import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, getSupabaseAdminKey } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bucket = "request-attachments";
const maxFileBytes = 10 * 1024 * 1024;
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const requestIdSchema = z.string().uuid();
const attachmentPathSchema = z.string().regex(
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/proof-of-status$/i,
);

async function getAccess() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ message: "Please sign in again." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { supabase, user, isAdmin: profile?.role === "admin" };
}

function getAdminClient() {
  try {
    return { admin: createSupabaseAdminClient() };
  } catch (error) {
    console.error("Could not create attachment storage client", error);
    return {
      error: NextResponse.json(
        { message: "Attachment storage is not configured on this server." },
        { status: 503 },
      ),
    };
  }
}

async function ensureBucket(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin.storage.getBucket(bucket);
  if (data && !error) return null;

  const missingBucket = error?.message.toLowerCase().includes("not found")
    || (error && "statusCode" in error && String(error.statusCode) === "404");

  if (!missingBucket) return error;

  const { error: createError } = await admin.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: maxFileBytes,
    allowedMimeTypes,
  });

  return createError;
}

export async function POST(request: Request) {
  if (!getSupabaseAdminKey()) {
    return NextResponse.json({ message: "Use inline attachment storage." }, { status: 503 });
  }

  const access = await getAccess();
  if (access.error || !access.user || !access.supabase) return access.error;

  const formData = await request.formData().catch(() => null);
  const requestId = requestIdSchema.safeParse(formData?.get("requestId"));
  const file = formData?.get("file");

  if (!requestId.success || !(file instanceof File)) {
    return NextResponse.json({ message: "Choose a valid proof of status photo." }, { status: 400 });
  }

  if (!allowedMimeTypes.includes(file.type) || file.size > maxFileBytes) {
    return NextResponse.json({ message: "Choose a supported photo no larger than 10 MB." }, { status: 400 });
  }

  const { data: reportSickRequest, error: requestError } = await access.supabase
    .from("requests")
    .select("id, kind, status, requester_id")
    .eq("id", requestId.data)
    .single();

  const editableStatuses = new Set(["approved", "submitted", "needs_changes"]);
  if (
    requestError
    || !reportSickRequest
    || reportSickRequest.requester_id !== access.user.id
    || reportSickRequest.kind !== "report_sick"
    || !editableStatuses.has(reportSickRequest.status)
  ) {
    console.warn("Rejected proof of status upload", requestError);
    return NextResponse.json({ message: "This request cannot accept an attachment." }, { status: 403 });
  }

  const client = getAdminClient();
  if (client.error || !client.admin) return client.error;

  const bucketError = await ensureBucket(client.admin);
  if (bucketError) {
    console.error("Could not prepare attachment bucket", bucketError);
    return NextResponse.json({ message: "Attachment storage is unavailable." }, { status: 503 });
  }

  const path = `${access.user.id}/${reportSickRequest.id}/proof-of-status`;
  const { error: uploadError } = await client.admin.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    console.error("Could not upload proof of status", uploadError);
    return NextResponse.json({ message: "The photo could not be uploaded." }, { status: 500 });
  }

  return NextResponse.json({ path, name: file.name });
}

export async function GET(request: Request) {
  const access = await getAccess();
  if (access.error || !access.user || !access.supabase) return access.error;

  const url = new URL(request.url);
  const parsedPath = attachmentPathSchema.safeParse(url.searchParams.get("path"));
  if (!parsedPath.success) {
    return NextResponse.json({ message: "Invalid attachment." }, { status: 400 });
  }

  const [ownerId, requestId] = parsedPath.data.split("/");
  const { data: reportSickRequest, error: requestError } = await access.supabase
    .from("requests")
    .select("id, requester_id")
    .eq("id", requestId)
    .single();

  if (
    requestError
    || !reportSickRequest
    || reportSickRequest.requester_id !== ownerId
    || (!access.isAdmin && ownerId !== access.user.id)
  ) {
    return NextResponse.json({ message: "Attachment not found." }, { status: 404 });
  }

  const client = getAdminClient();
  if (client.error || !client.admin) return client.error;

  const { data, error } = await client.admin.storage
    .from(bucket)
    .createSignedUrl(parsedPath.data, 60 * 10);

  if (error || !data?.signedUrl) {
    console.error("Could not create proof of status link", error);
    return NextResponse.json({ message: "Attachment is unavailable." }, { status: 404 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
