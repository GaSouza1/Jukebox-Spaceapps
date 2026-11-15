/** Steps of the guided experience, in order. */
export const GUIDED_STEP_IDS = ["welcome", "regions", "spatial", "prepare", "explore"] as const;

export type GuidedStepId = (typeof GUIDED_STEP_IDS)[number];

export interface GuidedExperienceState {
  active: boolean;
  stepIndex: number;
  /** Increments each time the guide starts. */
  session: number;
}

export interface GuidedExperienceControls extends GuidedExperienceState {
  stepId: GuidedStepId;
  stepCount: number;
  isFirst: boolean;
  isLast: boolean;
  /** Opens the guide at the first step. */
  start: () => void;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
  /** Ends the guide (skip, close or finish) and returns focus to the entry button. */
  close: () => void;
}
