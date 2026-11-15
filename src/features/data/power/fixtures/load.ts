/**
 * Recorded NASA POWER responses (15/11/2026, API v2.10.0), for tests only.
 * Each file is the unmodified JSON body of the request named in its file name.
 */
import { readFileSync } from "node:fs";

export type FixtureName =
  | "london-t2m-1981-2026"
  | "manaus-t2m-2024-2026"
  | "sao-paulo-t2m-2023-2024"
  | "sao-paulo-neighbour-t2m-2023-2024"
  | "sorocaba-t2m-2023-2024"
  | "error-422-bad-parameter"
  | "error-422-missing-community";

export function fixture(name: FixtureName): unknown {
  return JSON.parse(readFileSync(new URL(`./${name}.json`, import.meta.url), "utf8"));
}
