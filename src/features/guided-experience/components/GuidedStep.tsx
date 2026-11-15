import { useEffect, useRef, type ReactNode } from "react";
import { guidedText } from "../i18n/en";

interface Props {
  number: number;
  total: number;
  title: string;
  children: ReactNode;
}

/**
 * One step of the guide. Only its heading receives focus, so a screen reader
 * announces "Step N of M: title" and nothing more; the user reads the step's
 * text at their own pace.
 */
export function GuidedStep({ number, total, title, children }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // The guide box is fixed on screen when focused, so the page must not scroll.
    headingRef.current?.focus({ preventScroll: true });
  }, [number]);

  return (
    <div className="sr-guide-step">
      <h2 ref={headingRef} tabIndex={-1}>
        {guidedText.stepOf(number, total)}: {title}
      </h2>
      {children}
    </div>
  );
}
