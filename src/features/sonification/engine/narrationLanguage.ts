/**
 * Narration language — makes the narration speak what the page actually shows.
 *
 * The narration script is written in English. Every script is also rendered
 * in the page (see `NarrationSource` in ImageAnalyzer.tsx), so a browser page
 * translation (e.g. Chrome's "Translate to Portuguese") translates it like any
 * other text. Each sentence is read back from the page right before it is
 * spoken, and its language is resolved from signals, most reliable first:
 *
 * 1. "original": the rendered sentence is identical to the script → English.
 * 2. "page": it differs, and <html lang> no longer says English. Chrome
 *    usually sets it to the target language, but nothing guarantees it.
 * 3. "detector": the browser's own language detector (Chrome's built-in
 *    LanguageDetector API), only when it is already available on the device.
 * 4. "browser": none of the above. Page translation targets the browser's
 *    language by default, so that language is used, and the UI says it is an
 *    assumption and offers a manual voice.
 *
 * No browser exposes "the language this page was translated into", so (2)–(4)
 * are best effort; that limitation is documented in SONIFICATION.md.
 */

/** Language the narration script is written in. */
export const SCRIPT_LANG = "en";
const MIN_DETECTOR_CONFIDENCE = 0.7;

export type LanguageOrigin = "original" | "page" | "detector" | "browser";

export interface ResolvedSentence {
  /** Text to speak: the rendered (possibly translated) sentence. */
  text: string;
  /** BCP 47 language of `text`. */
  lang: string;
  origin: LanguageOrigin;
}

/** The subset of Chrome's built-in LanguageDetector API used here. */
interface LanguageDetectorApi {
  availability(): Promise<string>;
  create(): Promise<{
    detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
  }>;
}

export function sameText(a: string, b: string) {
  return a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
}

export function isScriptLanguage(lang: string | null | undefined) {
  return !!lang && lang.toLowerCase().split(/[-_]/)[0] === SCRIPT_LANG;
}

/** Language of the narration source element: its own lang, else the nearest ancestor's. */
function pageLanguage(element: Element | null): string | null {
  const owner = element?.closest("[lang]") ?? document.documentElement;
  return owner.getAttribute("lang")?.trim() || null;
}

function browserLanguage() {
  return navigator.languages?.[0] ?? navigator.language ?? SCRIPT_LANG;
}

let detector: Promise<Awaited<ReturnType<LanguageDetectorApi["create"]>> | null> | null = null;

/** The built-in detector, or null when the browser has none or it is not on the device yet. */
function languageDetector() {
  const api = (globalThis as { LanguageDetector?: LanguageDetectorApi }).LanguageDetector;
  if (!api) return Promise.resolve(null);
  // Never triggers a model download: only a detector that is already "available" is used.
  detector ??= api
    .availability()
    .then((state) => (state === "available" ? api.create() : null))
    .catch(() => null);
  return detector;
}

async function detectLanguage(text: string): Promise<string | null> {
  const instance = await languageDetector();
  if (!instance) return null;
  const [best] = await instance.detect(text).catch(() => []);
  return best && best.detectedLanguage !== "und" && best.confidence >= MIN_DETECTOR_CONFIDENCE
    ? best.detectedLanguage
    : null;
}

/**
 * Resolves the text and language of one sentence. `rendered` is the
 * sentence as currently shown in the page (null when it is not rendered).
 */
export async function resolveSentence(
  original: string,
  rendered: string | null,
  element: Element | null = null,
): Promise<ResolvedSentence> {
  if (!rendered?.trim() || sameText(original, rendered)) {
    return { text: original, lang: SCRIPT_LANG, origin: "original" };
  }
  const page = pageLanguage(element);
  if (page && !isScriptLanguage(page)) return { text: rendered, lang: page, origin: "page" };
  const detected = await detectLanguage(rendered);
  if (detected) return { text: rendered, lang: detected, origin: "detector" };
  return { text: rendered, lang: browserLanguage(), origin: "browser" };
}

/** Attribute that marks the rendered narration script of one image. */
export const NARRATION_SOURCE_ATTR = "data-narration-for";

/** Reads sentence `index` of image `id` from the page and resolves its language. */
export function resolveRenderedSentence(id: string, index: number, original: string) {
  const list = document.querySelector(`[${NARRATION_SOURCE_ATTR}="${CSS.escape(id)}"]`);
  const element = list?.children[index] ?? null;
  return resolveSentence(original, element?.textContent ?? null, list);
}
