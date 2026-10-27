import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

const bucket = "food-photo-library";
const photoInput = z.object({
  image: z
    .string()
    .max(2_800_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/),
  label: z.string().trim().min(1).max(140).default("Essensfoto"),
});
const photoId = z.string().uuid();

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function authenticatedClient(request: Request) {
  if (!getPublicSupabaseConfig().configured)
    return { error: errorResponse("Supabase ist noch nicht verbunden.", 503) };
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return { error: errorResponse("Ungültiger Ursprung.", 403) };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return { error: errorResponse("Bitte erneut anmelden.", 401) };
  return { db, user };
}

export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if ("error" in auth) return auth.error;
  const requestedId = new URL(request.url).searchParams.get("id");
  if (requestedId) {
    const id = photoId.safeParse(requestedId);
    if (!id.success) return errorResponse("Foto nicht gefunden.", 400);
    const { data: photo, error } = await auth.db
      .from("food_photo_library")
      .select("storage_path")
      .eq("id", id.data)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error)
      return errorResponse(
        "Fotoarchiv noch nicht eingerichtet. Bitte supabase/setup.sql im SQL Editor ausführen.",
        503,
      );
    if (!photo) return errorResponse("Foto nicht gefunden.", 404);
    const { data: image, error: downloadError } = await auth.db.storage
      .from(bucket)
      .download(photo.storage_path);
    if (downloadError || !image)
      return errorResponse("Foto konnte nicht geladen werden.", 503);
    return new Response(image, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const { data, error } = await auth.db
    .from("food_photo_library")
    .select("id,label,storage_path,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error)
    return errorResponse(
      "Fotoarchiv noch nicht eingerichtet. Bitte supabase/setup.sql im SQL Editor ausführen.",
      503,
    );
  const photos = await Promise.all(
    (data ?? []).map(async (photo) => {
      const { data: signed, error: signError } = await auth.db.storage
        .from(bucket)
        .createSignedUrl(photo.storage_path, 60 * 60);
      return signError || !signed
        ? null
        : { id: photo.id, label: photo.label, created_at: photo.created_at, url: signed.signedUrl };
    }),
  );
  return Response.json(
    { photos: photos.filter(Boolean) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if ("error" in auth) return auth.error;
  if (Number(request.headers.get("content-length") ?? 0) > 3_000_000)
    return errorResponse("Das Foto ist zu groß.", 413);
  let parsed: z.infer<typeof photoInput>;
  try {
    parsed = photoInput.parse(await request.json());
  } catch {
    return errorResponse("Bitte ein verkleinertes JPG-Foto verwenden.", 400);
  }
  const bytes = Buffer.from(parsed.image.split(",")[1], "base64");
  if (
    bytes.length > 5_242_880 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8
  )
    return errorResponse("Das JPG-Foto ist ungültig oder zu groß.", 400);

  const storagePath = `${auth.user.id}/${randomUUID()}.jpg`;
  const { error: uploadError } = await auth.db.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError)
    return errorResponse(
      "Fotoarchiv noch nicht eingerichtet. Bitte supabase/setup.sql im SQL Editor ausführen.",
      503,
    );

  const { data: photo, error: insertError } = await auth.db
    .from("food_photo_library")
    .insert({ user_id: auth.user.id, storage_path: storagePath, label: parsed.label })
    .select("id,label,created_at")
    .single();
  if (insertError || !photo) {
    await auth.db.storage.from(bucket).remove([storagePath]);
    return errorResponse(
      "Foto konnte nicht im privaten Archiv gespeichert werden.",
      503,
    );
  }
  const { data: signed } = await auth.db.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60);
  return Response.json(
    { photo: signed ? { ...photo, url: signed.signedUrl } : photo },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const auth = await authenticatedClient(request);
  if ("error" in auth) return auth.error;
  let id: string;
  try {
    id = photoId.parse(new URL(request.url).searchParams.get("id"));
  } catch {
    return errorResponse("Foto nicht gefunden.", 400);
  }
  const { data: photo, error } = await auth.db
    .from("food_photo_library")
    .select("id,storage_path")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error)
    return errorResponse(
      "Fotoarchiv noch nicht eingerichtet. Bitte supabase/setup.sql im SQL Editor ausführen.",
      503,
    );
  if (!photo) return errorResponse("Foto nicht gefunden.", 404);
  const { error: removeError } = await auth.db.storage
    .from(bucket)
    .remove([photo.storage_path]);
  if (removeError) return errorResponse("Foto konnte nicht gelöscht werden.", 503);
  const { error: deleteError } = await auth.db
    .from("food_photo_library")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (deleteError) return errorResponse("Foto konnte nicht gelöscht werden.", 503);
  return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
}
