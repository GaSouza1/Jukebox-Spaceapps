import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { isScriptLanguage, resolveSentence, sameText } from "./narrationLanguage";

const g = globalThis as Record<string, unknown>;
let htmlLang: string | null = "en";
/** Mutable result of the fake built-in detector. */
let detected: { detectedLanguage: string; confidence: number }[] = [];

beforeEach(() => {
  htmlLang = "en";
  detected = [];
  g.document = { documentElement: { getAttribute: () => htmlLang } };
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: ["pt-BR", "en"], language: "pt-BR" },
    configurable: true,
  });
});
afterEach(() => {
  delete g.document;
  delete g.LanguageDetector;
});

describe("sameText and isScriptLanguage", () => {
  it("ignores whitespace differences only", () => {
    assert.ok(sameText(" Image 1 of 2:\n demo. ", "Image 1 of 2: demo."));
    assert.ok(!sameText("Image 1 of 2", "Imagem 1 de 2"));
  });
  it("recognises English tags", () => {
    assert.ok(isScriptLanguage("en"));
    assert.ok(isScriptLanguage("en-GB"));
    assert.ok(!isScriptLanguage("pt-BR"));
    assert.ok(!isScriptLanguage(null));
  });
});

describe("resolveSentence", () => {
  it("keeps the English script when the page shows it unchanged (even if <html lang> changed)", async () => {
    htmlLang = "pt";
    assert.deepEqual(await resolveSentence("Image 1 of 2.", "Image 1 of 2."), {
      text: "Image 1 of 2.",
      lang: "en",
      origin: "original",
    });
  });

  it("keeps the script when the sentence is not rendered", async () => {
    assert.equal((await resolveSentence("One.", null)).origin, "original");
  });

  it("uses the translated text and <html lang> when the page language changed", async () => {
    htmlLang = "pt-BR";
    assert.deepEqual(await resolveSentence("Image 1 of 2.", "Imagem 1 de 2."), {
      text: "Imagem 1 de 2.",
      lang: "pt-BR",
      origin: "page",
    });
  });

  it("without a browser detector, falls back to the browser language and says so", async () => {
    // <html lang> still says English, so it cannot tell the target language.
    assert.deepEqual(await resolveSentence("Image 1 of 2.", "Imagem 1 de 2."), {
      text: "Imagem 1 de 2.",
      lang: "pt-BR",
      origin: "browser",
    });
  });

  it("uses the browser's detector when it is available and confident", async () => {
    g.LanguageDetector = {
      availability: async () => "available",
      create: async () => ({ detect: async () => detected }),
    };
    detected = [{ detectedLanguage: "es", confidence: 0.95 }];
    assert.deepEqual(await resolveSentence("Image 1 of 2.", "Imagen 1 de 2."), {
      text: "Imagen 1 de 2.",
      lang: "es",
      origin: "detector",
    });
    // A weak or undetermined answer is not trusted.
    detected = [{ detectedLanguage: "es", confidence: 0.4 }];
    assert.equal((await resolveSentence("One.", "Uno.")).origin, "browser");
    detected = [{ detectedLanguage: "und", confidence: 0.99 }];
    assert.equal((await resolveSentence("One.", "Uno.")).origin, "browser");
  });
});
