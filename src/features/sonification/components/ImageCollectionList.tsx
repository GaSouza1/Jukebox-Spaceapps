import { useLayoutEffect, useRef } from "react";
import { StableText } from "@/components/StableText";
import type { CollectionImage } from "../collection/imageCollection";
import type { AnalysisState } from "../collection/useImageCollection";
import type { PlaybackStatus } from "../engine/playbackController";
import type { SequencePhase } from "../engine/sequencePlayer";

type Action = "select" | "earlier" | "later" | "remove";

interface Props {
  images: CollectionImage[];
  selectedId: string;
  playingId: string | null;
  phase: SequencePhase | null;
  status: PlaybackStatus;
  analysisFor(id: string): AnalysisState | undefined;
  onSelect(id: string): void;
  onMove(id: string, delta: -1 | 1): void;
  /** Returns the id of the image that should receive focus afterwards. */
  onRemove(id: string): string | null;
}

const PHASE_LABEL: Record<SequencePhase, string> = { narration: "narration", composition: "sound" };

/**
 * Compact, ordered list of the images in the collection. Order is changed
 * with buttons (no drag and drop needed), and focus stays on the moved image
 * so keyboard users can press the same button again.
 */
export function ImageCollectionList({
  images,
  selectedId,
  playingId,
  phase,
  status,
  analysisFor,
  onSelect,
  onMove,
  onRemove,
}: Props) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<{ id: string; actions: Action[] } | null>(null);
  const count = images.length;

  // Reordering moves DOM nodes, which drops focus in some browsers: restore it.
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    if (!pending) return;
    for (const action of pending.actions) {
      const button = buttons.current.get(`${pending.id}:${action}`);
      if (button && !button.disabled) {
        button.focus();
        return;
      }
    }
  }, [images]);

  const register = (id: string, action: Action) => (button: HTMLButtonElement | null) => {
    if (button) buttons.current.set(`${id}:${action}`, button);
    else buttons.current.delete(`${id}:${action}`);
  };

  const move = (id: string, delta: -1 | 1) => {
    const same: Action = delta < 0 ? "earlier" : "later";
    const other: Action = delta < 0 ? "later" : "earlier";
    pendingFocus.current = { id, actions: [same, other, "select"] };
    onMove(id, delta);
  };

  const remove = (id: string) => {
    const focusId = onRemove(id);
    if (focusId) pendingFocus.current = { id: focusId, actions: ["select"] };
  };

  return (
    <section className="image-collection" aria-labelledby="image-collection-title">
      <div className="collection-heading">
        <h3 id="image-collection-title">Image collection</h3>
        <StableText>{`${count} ${count === 1 ? "image" : "images"} · played in this order`}</StableText>
      </div>
      <p id="image-collection-hint" className="collection-hint">
        Select an image to view it. The arrow buttons change the playback order.
      </p>
      <ol className="collection-list" aria-describedby="image-collection-hint">
        {images.map((image, index) => {
          const selected = image.id === selectedId;
          const playing = image.id === playingId;
          const analysis = analysisFor(image.id);
          const badge = playing
            ? status === "paused"
              ? "paused"
              : phase
                ? `playing ${PHASE_LABEL[phase]}`
                : "up next"
            : analysis?.status === "error"
              ? "could not be read"
              : analysis?.status === "loading"
                ? "analysing"
                : null;
          const className = ["collection-item", selected && "selected", playing && "playing"]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={image.id} className={className}>
              <button
                ref={register(image.id, "select")}
                type="button"
                className="collection-thumb"
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(image.id)}
              >
                <img src={image.src} alt="" />
                {/* The position prefix is re-keyed on every reorder, so React inserts its new
                    element before the next sibling. That sibling must be an element: page
                    translation replaces bare text nodes, and inserting before a replaced
                    (detached) text node throws NotFoundError. File names are not translated. */}
                <span className="collection-name">
                  <StableText className="sr-only">{`Image ${index + 1} of ${count}: `}</StableText>
                  <StableText aria-hidden="true">{`${index + 1}. `}</StableText>
                  <span translate="no">{image.name}</span>
                </span>
                {badge && (
                  <StableText className={playing ? "collection-badge active" : "collection-badge"}>
                    {`(${badge})`}
                  </StableText>
                )}
              </button>
              <div className="collection-actions">
                <button
                  ref={register(image.id, "earlier")}
                  type="button"
                  aria-label={`Move ${image.name} earlier`}
                  title="Move earlier"
                  disabled={index === 0}
                  onClick={() => move(image.id, -1)}
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  ref={register(image.id, "later")}
                  type="button"
                  aria-label={`Move ${image.name} later`}
                  title="Move later"
                  disabled={index === count - 1}
                  onClick={() => move(image.id, 1)}
                >
                  <span aria-hidden="true">→</span>
                </button>
                {image.isDemo ? (
                  <span className="collection-keep">Demo, always kept</span>
                ) : (
                  <button
                    ref={register(image.id, "remove")}
                    type="button"
                    aria-label={`Remove ${image.name}`}
                    title="Remove"
                    onClick={() => remove(image.id)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
