/**
 * Prepares a photo for upload, entirely in the browser:
 *  - honours the camera's orientation, then downsizes to MAX_EDGE px
 *  - re-encodes to WebP via canvas, which drops ALL metadata. Phone photos
 *    carry EXIF GPS coordinates; on a neighborhood app that's someone's
 *    home address, so it never leaves the device.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("Couldn't read that image. Try a JPEG or PNG.");
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  // Safari < 17 can't encode WebP and silently returns PNG; fall back to JPEG.
  if (blob && blob.type === "image/webp") return blob;
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!jpeg) throw new Error("Your browser couldn't process that image.");
  return jpeg;
}
