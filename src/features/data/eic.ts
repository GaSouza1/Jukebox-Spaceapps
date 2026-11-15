export type EicItemType = "gallery_page" | "details_page" | "media_group";

export interface EicImage {
  url: string;
}

export interface EicInstance {
  id: number;
  url?: string;
  title?: string;
  description?: string;
  main_image?: EicImage;
}

export interface EicItem {
  id: number;
  type: EicItemType;
  caption?: string;
  instance?: EicInstance;
}

export interface EicMediaGroup {
  id: number;
  title: string;
  items: EicItem[];
}

export interface EicPage {
  id: number;
  title: string;
  description?: string;
  main_image?: EicImage;
  media_groups?: EicMediaGroup[];
}

export interface EicEntry {
  id: number;
  image: string;
  description: string;
}
