/**
 * User-facing text of the screen-reader guidance: the contextual hints read
 * during normal navigation and the on-demand guide. Keep every string here so
 * the feature can be translated by adding a sibling file with the same shape.
 * Sonification facts are NOT duplicated here: they come from
 * `describeComparisonSonification`, the same source the player uses.
 */
import type { GuidedStepId } from "../types/guidedExperience";

export const guidedText = {
  // ---- On-demand guide ----
  landmark: "Guided experience",
  startButton: "Start guided experience",
  restartButton: "Restart guided experience",
  startDescription:
    "Learn how to compare environmental data from different regions using visualizations and sound.",
  stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
  navLabel: "Guide navigation",
  back: "Previous step",
  next: "Next step",
  finish: "Finish guide",
  close: "Close guide",
  steps: {
    welcome: "Welcome",
    regions: "Choose two regions",
    spatial: "How sound is organised",
    prepare: "Before you listen",
    explore: "Ways to explore",
  } satisfies Record<GuidedStepId, string>,

  welcome: {
    intro:
      "Earth Information Jukebox compares an environmental variable, monthly mean air temperature from NASA POWER, between two places on Earth. You can read the comparison as a chart, a text summary or a data table, and you can listen to it as sound.",
    plan: "This guide has five short steps:",
    noAutoplay:
      "Nothing plays until you press a Play button. The guide never changes your regions or the player. Use Next step and Previous step to move, or Close guide to leave at any time.",
  },
  regions: {
    current: "Currently selected:",
    regionLine: (key: "A" | "B", name: string, country: string, coords: string, identity: string) =>
      `Region ${key}: ${name}, ${country}, at ${coords}. ${identity}.`,
    where:
      "To change them, use the Region A and Region B menus in the section “Choose two places to compare” on the Explore page.",
    available: "Available regions:",
    goTo: "Go to the region menus",
  },
  spatial: {
    cueChannel: (a: string, b: string) =>
      `Stereo channel: Region A, ${a}, on the left; Region B, ${b}, on the right.`,
    cueTimbre: (a: string, aTimbre: string, b: string, bTimbre: string) =>
      `Timbre: ${a} is a ${aTimbre}; ${b} is a ${bTimbre}.`,
    sequential:
      "Sequential alternative, in the section “Listen to the data”: set the Listen to menu to Region A only and press Play; then Region B only; then Both regions together to compare them.",
    goTo: "Go to the player",
  },
  prepare: {
    intro: "This is what the sound represents, using the data currently selected:",
    howToListen:
      "To listen, go to the section “Listen to the data”, choose what to hear in the Listen to menu and press Play. Stop ends playback at any time.",
    goTo: "Go to the player",
  },
  explore: {
    intro: "Everything stays available on the Explore page. You can:",
    items: [
      { hash: "chart-summary", text: "Read the text summary of the line chart." },
      { hash: "data-table", text: "Open the data table with every monthly value." },
      { hash: "map-title", text: "Check the map and the list of regions with their coordinates." },
      {
        hash: "player-title",
        text: "Play, pause, resume and stop the sonification, choose one region or both, and move through the months with the position slider.",
      },
      {
        hash: "image-sonification-title",
        text: "Listen to an image and read its text profile and how it is turned into sound.",
      },
    ],
    restart:
      "You can come back to this guide with the Start guided experience button before the main content.",
  },
  openExplore: "Open the Explore page",

  // ---- Contextual hints, read during normal navigation ----
  hints: {
    explorePage:
      "How this page works: pick two regions and a variable, then compare them as a chart, a text summary, a data table or sound. Sections, in order: Listen to an image; Choose two places to compare; A planetary view, with a text list of the regions; Monthly history, with a summary and a data table; Listen to the data, the sonification player. Nothing plays until you press Play.",
    regions:
      "Region A and Region B are compared month by month. In the player you can listen to each region on its own or to both together.",
    stereo:
      "Both regions together: Region A in the left channel, Region B in the right. Left and right need stereo headphones or speakers; on a phone speaker, with one earphone or with hearing that differs between ears, choose Region A only, then Region B only. A region played on its own is centred and announced when it starts and finishes.",
  },
};
