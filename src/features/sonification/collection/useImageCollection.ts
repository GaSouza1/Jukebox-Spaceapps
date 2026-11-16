/**
 * React state for the image collection: the ordered images, the one shown,
 * the object URLs of uploads and one analysis per image and reading direction.
 *
 * Every image is analysed from its own off-screen <img>, so the sequence can
 * play images that are not on screen. Analyses are cached per direction.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import demoImage from "@/assets/refence.png";
import { analyzeImage, type ImageAnalysis, type ReadingDirection } from "../engine/imageAnalyzer";
import {
  createIdFactory,
  moveImage,
  partitionImageFiles,
  removeImage,
  type CollectionImage,
} from "./imageCollection";

/**
 * Human-written description of the demo image. It is kept apart from the
 * computed text profile: the app measures brightness and colour, it does not
 * recognise objects or places.
 */
export const DEMO_IMAGE: CollectionImage = {
  id: "demo",
  name: "Demo image: global false-colour map",
  src: demoImage,
  objectUrl: null,
  isDemo: true,
  description: {
    alt: "Demo image, a global map in false colour. Description below.",
    humanText:
      "A global map. High temperature in the northern half, intermediate in the tropics, low in the southern oceans and along the bottom. The image has no legend or scale, so this is an interpretation.",
    userText: null,
  },
};

export type AnalysisState =
  | { status: "loading" }
  | { status: "ready"; analysis: ImageAnalysis }
  | { status: "error"; message: string };

const analysisKey = (id: string, direction: ReadingDirection) => `${id}|${direction}`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the file could not be decoded as an image"));
    img.src = src;
  });
}

/** Two uploads with the same file name get distinct accessible names. */
function uniqueName(name: string, taken: Set<string>) {
  let candidate = name;
  for (let n = 2; taken.has(candidate); n++) candidate = `${name} (${n})`;
  taken.add(candidate);
  return candidate;
}

export function useImageCollection(direction: ReadingDirection) {
  const [images, setImages] = useState<CollectionImage[]>([DEMO_IMAGE]);
  const [selectedId, setSelectedId] = useState(DEMO_IMAGE.id);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const requested = useRef(new Set<string>());
  const objectUrls = useRef(new Set<string>());
  const nextId = useRef(createIdFactory());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  useEffect(() => {
    for (const image of images) {
      const key = analysisKey(image.id, direction);
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      setAnalyses((prev) => ({ ...prev, [key]: { status: "loading" } }));
      loadImage(image.src)
        .then((img): AnalysisState => ({ status: "ready", analysis: analyzeImage(img, direction) }))
        .catch((error): AnalysisState => ({ status: "error", message: (error as Error).message }))
        // A result for an image removed in the meantime is dropped.
        .then((state) => setAnalyses((prev) => (key in prev ? { ...prev, [key]: state } : prev)));
    }
  }, [images, direction]);

  /** Adds the image files in order; returns the names of rejected (non-image) files. */
  const add = useCallback(
    (files: File[]) => {
      const { images: accepted, rejected } = partitionImageFiles(files);
      const taken = new Set(images.map((image) => image.name));
      const added: CollectionImage[] = accepted.map((file) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);
        const name = uniqueName(file.name, taken);
        return {
          id: nextId.current(),
          name,
          src: url,
          objectUrl: url,
          isDemo: false,
          description: {
            alt: `Uploaded image “${name}”. Description below.`,
            humanText: null,
            userText: null,
          },
        };
      });
      if (added.length) setImages((prev) => [...prev, ...added]);
      return { added, rejected };
    },
    [images],
  );

  const remove = useCallback(
    (id: string) => {
      const result = removeImage(images, id);
      const { removed } = result;
      if (!removed) return result;
      // Applied to the latest list, so a move queued in the same tick is kept.
      setImages((prev) => removeImage(prev, id).list);
      if (removed.objectUrl) {
        URL.revokeObjectURL(removed.objectUrl);
        objectUrls.current.delete(removed.objectUrl);
      }
      const prefix = `${id}|`;
      for (const key of requested.current)
        if (key.startsWith(prefix)) requested.current.delete(key);
      setAnalyses((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([key]) => !key.startsWith(prefix))),
      );
      if (selectedId === id) setSelectedId(result.neighbourId ?? DEMO_IMAGE.id);
      return result;
    },
    [images, selectedId],
  );

  const move = useCallback((id: string, delta: -1 | 1) => {
    setImages((prev) => moveImage(prev, id, delta));
  }, []);

  const setUserDescription = useCallback((id: string, text: string) => {
    setImages((prev) =>
      prev.map((image) =>
        image.id === id
          ? { ...image, description: { ...image.description, userText: text } }
          : image,
      ),
    );
  }, []);

  const analysisFor = useCallback(
    (id: string): AnalysisState | undefined => analyses[analysisKey(id, direction)],
    [analyses, direction],
  );

  return {
    images,
    selectedId,
    selected: images.find((image) => image.id === selectedId) ?? images[0],
    select: setSelectedId,
    add,
    remove,
    move,
    setUserDescription,
    analysisFor,
  };
}
