import { useEffect, useRef, useState } from "react";
import { StableText } from "../../../components/StableText";
import type { ComparisonDataState } from "../../data/useComparisonData";
import { describeIssue } from "../../data/comparison";
import { announcementFor, errorText, loadingText, readyText } from "../dataStatus";

/**
 * Loading, result and error of the NASA POWER requests.
 *
 * - One polite message when loading starts and one when it ends; errors use
 *   role="alert". Nothing is announced for a region already in memory.
 * - "Try again" stays in place (aria-disabled) while retrying, so focus is
 *   never dropped to <body>; when the data arrives and the button goes, focus
 *   moves to the status line.
 */
export function DataStatus({ state }: { state: ComparisonDataState }) {
  const [announcement, setAnnouncement] = useState("");
  const [retrying, setRetrying] = useState(false);
  const previous = useRef<ComparisonDataState["status"] | null>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const message = announcementFor(previous.current, state);

  useEffect(() => {
    previous.current = state.status;
    if (message) setAnnouncement(message);
    if (state.status !== "loading") setRetrying(false);
  }, [state.status, message]);

  const showRetry = state.status === "error" || retrying;
  useEffect(() => {
    if (!showRetry && document.activeElement === document.body && lineRef.current) {
      lineRef.current.focus({ preventScroll: true });
    }
  }, [showRetry]);

  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    state.retry();
  };

  const line =
    state.status === "loading"
      ? loadingText(state.loading)
      : state.status === "ready"
        ? readyText(state.data)
        : null;
  const issues = state.status === "ready" ? state.data.issues : [];

  return (
    <div className="data-status">
      {line && (
        <p ref={lineRef} tabIndex={-1} className={`data-status-line ${state.status}`}>
          <i aria-hidden="true" /> <StableText>{line}</StableText>
        </p>
      )}
      {state.status === "error" && (
        <p className="sonification-alert" role="alert">
          <StableText>{errorText(state)}</StableText>
        </p>
      )}
      {issues.length > 0 && state.status === "ready" && (
        <ul className="sonification-alert" role="alert">
          {issues.map((issue) => (
            <StableText as="li" key={issue.kind}>
              {describeIssue(issue, state.data)}
            </StableText>
          ))}
        </ul>
      )}
      {showRetry && (
        <button type="button" className="retry-button" aria-disabled={retrying} onClick={retry}>
          <StableText>{retrying ? "Trying again…" : "Try again"}</StableText>
        </button>
      )}
      <p className="sr-only" role="status">
        {announcement && <StableText>{announcement}</StableText>}
      </p>
    </div>
  );
}
