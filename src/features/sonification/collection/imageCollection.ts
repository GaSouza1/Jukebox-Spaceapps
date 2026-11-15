/**
 * ImageCollection — the ordered list of images the sonification plays. Pure
 * functions over an immutable array; the React hook in useImageCollection.ts
 * owns the state, the object URLs and the per-image analyses.
 */
import type { ImageDescription } from "../describeImage";

export interface CollectionImage {
  id: string;
  /** Accessible, visible name (file name for uploads). */
  name: string;
  src: string;
  /** Object URL created for an upload; revoked when the image is removed. */
  objectUrl: string | null;
  /** The demo image is always part of the collection and cannot be removed. */
  isDemo: boolean;
  description: ImageDescription;
}

/**
 * Id generator for uploads. Ids never depend on position or file name and are
 * never reused, so they are safe as React keys while images are reordered,
 * removed and added.
 */
export function createIdFactory(prefix = "upload") {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

/** Moves an image one place earlier (-1) or later (+1). Out-of-range moves are no-ops. */
export function moveImage<T extends { id: string }>(list: T[], id: string, delta: -1 | 1): T[] {
  const from = list.findIndex((item) => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/**
 * Removes an image unless it is the demo. `neighbourId` is the image that
 * takes its place in the list (or the new last one), for selection and focus.
 */
export function removeImage<T extends { id: string; isDemo: boolean }>(
  list: T[],
  id: string,
): { list: T[]; removed: T | null; neighbourId: string | null } {
  const index = list.findIndex((item) => item.id === id);
  const removed = list[index];
  if (!removed || removed.isDemo) return { list, removed: null, neighbourId: null };
  const next = list.filter((item) => item.id !== id);
  return { list: next, removed, neighbourId: (next[index] ?? next[next.length - 1])?.id ?? null };
}

/** Splits picked files into images and rejected names, keeping the original order. */
export function partitionImageFiles<T extends { name: string; type: string }>(files: T[]) {
  const images = files.filter((file) => file.type.startsWith("image/"));
  const rejected = files.filter((file) => !file.type.startsWith("image/")).map((f) => f.name);
  return { images, rejected };
}
