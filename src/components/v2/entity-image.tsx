"use client";

import { useEffect, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const bucket = "entity-images";
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function signedImage(path: string) {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await createClient()
    .storage.from(bucket)
    .createSignedUrl(path, 3600);
  if (error) throw error;
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

async function prepareImage(file: File) {
  if (file.size <= 1_800_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Das Bild konnte nicht verarbeitet werden.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Bildkomprimierung fehlgeschlagen.")),
      "image/jpeg",
      0.82,
    );
  });
  return new File([blob], "everwell-bild.jpg", { type: "image/jpeg" });
}

export function StorageImage({
  path,
  alt,
  className,
}: {
  path?: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl("");
      return;
    }
    void signedImage(path).then((value) => {
      if (alive) setUrl(value);
    }).catch(() => {
      if (alive) setUrl("");
    });
    return () => { alive = false; };
  }, [path]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

export function EntityImageField({
  path,
  onChange,
  label = "Bild hinzufügen",
}: {
  path?: string | null;
  onChange: (path: string | null) => void;
  label?: string;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl("");
      return;
    }
    void signedImage(path).then((value) => {
      if (alive) setUrl(value);
    }).catch(() => {
      if (alive) setError("Bild konnte nicht geladen werden.");
    });
    return () => { alive = false; };
  }, [path]);

  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Bitte JPG, PNG oder WebP auswählen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Das Bild darf höchstens 5 MB groß sein.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uploadFile = await prepareImage(file);
      if (uploadFile.size > 5 * 1024 * 1024)
        throw new Error("Das Bild ist nach der Komprimierung noch zu groß.");
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Bitte erneut anmelden.");
      const extension = uploadFile.type === "image/jpeg" ? "jpg" : uploadFile.type.split("/")[1];
      const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, uploadFile, {
        contentType: uploadFile.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const preview = await signedImage(storagePath);
      setUrl(preview);
      onChange(storagePath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="entity-image-field">
      <div className="entity-image-preview">
        {url ? <img src={url} alt="Vorschau des ausgewählten Bildes" /> : <ImagePlus size={23} />}
      </div>
      <div className="entity-image-controls">
        <label className="btn btn-secondary btn-small">
          {busy ? <LoaderCircle size={15} className="spin" /> : <ImagePlus size={15} />}
          {busy ? "Lädt …" : label}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={busy}
            onChange={(event) => {
              void upload(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {path && (
          <button type="button" className="text-btn" onClick={() => { onChange(null); setUrl(""); }}>
            <Trash2 size={14} /> Entfernen
          </button>
        )}
        <small>JPG, PNG oder WebP · max. 5 MB · nur für dich sichtbar</small>
        {error && <small className="field-error" role="alert">{error}</small>}
      </div>
    </div>
  );
}
