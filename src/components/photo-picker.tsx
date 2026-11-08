"use client";

import { useMutation } from "convex/react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LIMITS } from "../../convex/lib/validators";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { prepareImage } from "@/lib/image";

export type PhotoItem = { id: Id<"_storage">; url: string };

/**
 * Up to four photos; the first is the cover. Files are resized and stripped
 * of metadata in the browser, uploaded straight to Convex storage, then
 * registered (validated) server-side before the form can attach them.
 */
export function PhotoPicker({
  photos,
  onChange,
  onBusyChange,
}: {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const registerUpload = useMutation(api.photos.registerUpload);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [dragging, setDragging] = useState(false);
  const room = LIMITS.photos.max - photos.length - pending;

  async function add(files: File[]) {
    const batch = files.filter((f) => f.type.startsWith("image/")).slice(0, Math.max(room, 0));
    if (files.length > batch.length) toast.message(`Up to ${LIMITS.photos.max} photos per listing.`);
    if (!batch.length) return;
    setPending((n) => n + batch.length);
    onBusyChange?.(true);
    const added: PhotoItem[] = [];
    for (const file of batch) {
      try {
        const blob = await prepareImage(file);
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
        if (!res.ok) throw new Error("Upload failed. Please try again.");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        const check = await registerUpload({ storageId });
        if (!check.ok) throw new Error(check.error);
        added.push({ id: storageId, url: URL.createObjectURL(blob) });
      } catch (err) {
        toast.error(err instanceof Error && !("data" in err) ? err.message : errorMessage(err));
      } finally {
        setPending((n) => n - 1);
      }
    }
    onBusyChange?.(false);
    if (added.length) onChange([...photos, ...added]);
  }

  const remove = (id: string) => onChange(photos.filter((p) => p.id !== id));
  const makeCover = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) onChange([p, ...photos.filter((x) => x.id !== id)]);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2.5">
        {photos.map((p, i) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: or Convex storage URL */}
            <img src={p.url} alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`} className="size-full object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-md bg-ink/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
                Cover
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(p.id)}
                className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <Star className="size-3" aria-hidden /> Cover
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(p.id)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-ink shadow-sm hover:bg-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <div key={`p${i}`} className="flex aspect-square items-center justify-center rounded-lg border border-line bg-sunken">
            <Loader2 className="size-5 animate-spin text-ink-faint" aria-label="Uploading" />
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void add([...e.dataTransfer.files]);
            }}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs font-medium transition-colors",
              dragging ? "border-brand bg-brand-soft text-brand-strong" : "border-line-strong text-ink-faint hover:border-brand hover:text-brand-strong",
              photos.length + pending === 0 && "col-span-2 aspect-auto py-6",
            )}
          >
            <ImagePlus className="size-5" aria-hidden />
            {photos.length + pending === 0 ? "Add photos (drag & drop)" : "Add"}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-xs text-ink-faint">
        Up to {LIMITS.photos.max}. Location data is removed before upload, and only signed-in neighbors can see photos.
      </p>
    </div>
  );
}
