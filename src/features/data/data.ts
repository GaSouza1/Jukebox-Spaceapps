import type { EicEntry, EicItem, EicPage } from "./eic";

function getItemImage(item: EicItem) {
  const instance = item.instance;

  if (!instance) {
    return "";
  }

  if (instance.main_image?.url) {
    return instance.main_image.url;
  }

  // In "media_group" items the instance itself is the image.
  return item.type === "media_group" ? (instance.url ?? "") : "";
}

function getItemDescription(item: EicItem) {
  // In "media_group" items the description comes from the item caption.
  return item.instance?.description ?? item.caption ?? "";
}

export function cleanDescription(text: string) {
  return text
    .split("||")[0] // drops the file lists appended by the API
    .replace(/<[^>]*>/g, " ") // drops HTML tags
    .replace(/\s+/g, " ")
    .trim();
}

export function createEicEntries(page: EicPage): EicEntry[] {
  const entries: EicEntry[] = [
    {
      id: page.id,
      image: page.main_image?.url ?? "",
      description: cleanDescription(page.description ?? ""),
    },
  ];

  for (const group of page.media_groups ?? []) {
    for (const item of group.items ?? []) {
      if (!item.instance) {
        continue;
      }

      entries.push({
        id: item.instance.id,
        image: getItemImage(item),
        description: cleanDescription(getItemDescription(item)),
      });
    }
  }

  return entries;
}

export function createEicIndex(entries: EicEntry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.id, entry])) as Record<number, EicEntry>;
}

export function findEicEntry(entries: EicEntry[], id: number) {
  return entries.find((entry) => entry.id === id);
}
