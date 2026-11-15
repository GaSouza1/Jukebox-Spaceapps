import { useCallback, useRef, useState } from "react";
import { GUIDED_STEP_IDS, type GuidedExperienceControls } from "../types/guidedExperience";

/**
 * State and navigation of the guided experience. Focus handling lives in the
 * components; this hook only exposes the entry-button ref so `close` can
 * restore focus to it.
 */
export function useGuidedExperience() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // Incremented on every start so restarting re-focuses the first step.
  const [session, setSession] = useState(0);
  const entryButtonRef = useRef<HTMLButtonElement>(null);
  const stepCount = GUIDED_STEP_IDS.length;

  const goTo = useCallback(
    (index: number) => setStepIndex(Math.min(Math.max(index, 0), stepCount - 1)),
    [stepCount],
  );
  const start = useCallback(() => {
    setStepIndex(0);
    setSession((n) => n + 1);
    setActive(true);
  }, []);
  const close = useCallback(() => {
    setActive(false);
    // Wait for the panel to unmount, then return focus to where the guide began.
    requestAnimationFrame(() => entryButtonRef.current?.focus({ preventScroll: true }));
  }, []);

  const controls: GuidedExperienceControls = {
    active,
    stepIndex,
    session,
    stepId: GUIDED_STEP_IDS[stepIndex],
    stepCount,
    isFirst: stepIndex === 0,
    isLast: stepIndex === stepCount - 1,
    start,
    next: () => goTo(stepIndex + 1),
    back: () => goTo(stepIndex - 1),
    goTo,
    close,
  };
  return { controls, entryButtonRef };
}
