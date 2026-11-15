import { useEffect, useMemo, useRef, useState } from "react";
import type { ComparisonData } from "../../data/comparison";
import { formatMonth } from "../../data/format";
import { useComparisonStore, type PlaybackMode } from "../../../stores/comparisonStore";
import { guidedText } from "../../guided-experience/i18n/en";
import { StableText } from "../../../components/StableText";
import { comparisonToScore } from "../engine/comparisonScore";
import { useComparisonPlayback } from "../hooks/useComparisonPlayback";
import {
  describeComparisonSonification,
  formatLongMonth,
  modeLabel,
  REGION_SOUND,
} from "../describeSonification";

interface Props {
  /** null while the data is loading or could not be loaded. */
  data: ComparisonData | null;
  /** Why Play is unavailable (loading, error, incompatible regions), or null. */
  unavailableReason: string | null;
}

export function SonificationPlayer({ data, unavailableReason }: Props) {
  const {
    isPlaying,
    currentIndex,
    playbackSpeed,
    volume,
    playbackMode,
    lastAction,
    setPlaybackSpeed,
    setVolume,
    setPlaybackMode,
    play,
    pause,
    resume,
    stop,
  } = useComparisonStore();
  const playable = data && !unavailableReason ? data : null;
  // Computed once per comparison and mode; playback only reads it.
  const score = useMemo(
    () => (playable ? comparisonToScore(playable, playbackMode) : null),
    [playable, playbackMode],
  );
  const { engineStatus, error, warning, seek } = useComparisonPlayback(score);
  const [announcement, setAnnouncement] = useState("");
  // Actions that happened before this player mounted are not announced again.
  const announcedId = useRef(lastAction?.id ?? 0);

  const rows = data?.rows ?? [];
  const months = rows.length;
  const firstDate = data?.period.start;
  const lastDate = data?.period.end;
  const description = useMemo(
    () => (data ? describeComparisonSonification(data, playbackSpeed, playbackMode) : null),
    [data, playbackSpeed, playbackMode],
  );

  // One short status message per playback transition, whichever control caused it.
  useEffect(() => {
    if (!lastAction || lastAction.id === announcedId.current || !data) return;
    announcedId.current = lastAction.id;
    const state = useComparisonStore.getState();
    const mode = modeLabel(state.playbackMode, data);
    const date = data.rows[state.currentIndex]?.date;
    const month = date ? formatLongMonth(date) : "";
    const start = formatLongMonth(data.period.start);
    const values = date ? valueText(state.currentIndex) : "";
    const messages = {
      play: `Playing ${mode}, from ${start}.`,
      resume: `Resumed at ${month}.`,
      pause: `Paused at ${values || month}.`,
      stop: `Stopped. Position reset to ${start}.`,
      finish: `Finished playing ${mode}.`,
      interrupt: `Data sonification stopped because the image sonification started. Position reset to ${start}.`,
    };
    setAnnouncement(messages[lastAction.type]);
  }, [lastAction, data]);

  const currentRow = rows[currentIndex];
  const togglePlay = () => {
    if (!score) return; // aria-disabled: focusable, explained, inert
    if (isPlaying) pause();
    else if (currentIndex > 0) resume();
    else play();
  };
  const progress = months > 1 ? (currentIndex / (months - 1)) * 100 : 0;
  const value = (v: number | null | undefined) =>
    v === null || v === undefined ? "no data" : `${v} ${data?.spokenUnit ?? ""}`;
  function valueText(index: number) {
    const row = data?.rows[index];
    if (!data || !row) return "No data loaded";
    return `${formatLongMonth(row.date)}: ${data.regionA.name} ${value(row.a)}, ${data.regionB.name} ${value(row.b)}`;
  }
  const statusLabel =
    engineStatus === "loading"
      ? "LOADING"
      : isPlaying
        ? "PLAYING"
        : engineStatus === "paused"
          ? "PAUSED"
          : "READY";
  const describedBy = unavailableReason
    ? "player-description player-unavailable"
    : "player-description";

  return (
    <section className="player-card" aria-labelledby="player-title">
      <div className="player-heading">
        <div>
          <span className="eyebrow">04 / SONIFICATION</span>
          <h2 id="player-title">Listen to the data</h2>
        </div>
        <span className={isPlaying ? "status playing" : "status"}>
          <i aria-hidden="true" /> <StableText>{statusLabel}</StableText>
        </span>
      </div>
      <p id="player-description" className="sr-only">
        <StableText>
          {description
            ? `About this sound: ${description.facts.map((fact) => fact.text).join(" ")} Use Play, Pause and Stop, the Listen to menu to hear one region at a time, and the playback position slider to move through the months.`
            : "About this sound: the description appears when the data has loaded."}
        </StableText>
      </p>
      {unavailableReason && (
        <p id="player-unavailable" className="player-unavailable">
          <StableText>{unavailableReason}</StableText>
        </p>
      )}
      <div className="waveform" aria-hidden="true">
        {Array.from({ length: 54 }, (_, i) => (
          <i
            key={i}
            style={{
              height: `${16 + ((i * 17) % 58)}%`,
              opacity: i / 54 <= progress / 100 ? 1 : 0.24,
            }}
          />
        ))}
        <span style={{ left: `${progress}%` }} />
      </div>
      <div className="timeline-readout">
        {/* Visible label (TA-05): voice-control users can name the slider. */}
        <label htmlFor="playback-position" className="position-label">
          Playback position
        </label>
        <StableText as="strong">{currentRow ? formatMonth(currentRow.date) : ""}</StableText>
        <StableText>
          {firstDate && lastDate ? `${firstDate.slice(0, 4)} — ${lastDate.slice(0, 4)}` : ""}
        </StableText>
      </div>
      <input
        id="playback-position"
        className="progress-range"
        aria-valuetext={valueText(currentIndex)}
        aria-disabled={months === 0 || undefined}
        type="range"
        min="0"
        max={Math.max(0, months - 1)}
        value={Math.min(currentIndex, Math.max(0, months - 1))}
        onChange={(e) => {
          if (months) seek(Number(e.target.value));
        }}
      />
      <div className="player-controls">
        <div className="transport">
          <button type="button" className="stop-button" onClick={stop}>
            <span aria-hidden="true">■</span>
            <span className="sr-only">Stop and return to start</span>
          </button>
          <button
            type="button"
            className="play-button"
            onClick={togglePlay}
            aria-disabled={!score || undefined}
            aria-describedby={describedBy}
          >
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            <StableText className="sr-only">
              {isPlaying
                ? "Pause the sonification"
                : currentIndex > 0
                  ? "Resume the sonification"
                  : "Play the sonification"}
            </StableText>
          </button>
        </div>
        <label>
          Listen to
          <select
            value={playbackMode}
            aria-describedby="listen-to-hint"
            onChange={(e) => setPlaybackMode(e.target.value as PlaybackMode)}
          >
            <option value="both">Both regions together</option>
            {data && (
              <>
                <option key={`a-${data.regionA.id}`} value="a">
                  {`Region A only · ${data.regionA.name}`}
                </option>
                <option key={`b-${data.regionB.id}`} value="b">
                  {`Region B only · ${data.regionB.name}`}
                </option>
              </>
            )}
          </select>
        </label>
        <label>
          Speed
          <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label>
        <label className="volume-label">
          Volume
          <input
            type="range"
            min="0"
            max="1"
            step=".05"
            value={volume}
            aria-valuetext={`${Math.round(volume * 100)}%`}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
          <StableText aria-hidden="true">{`${Math.round(volume * 100)}%`}</StableText>
        </label>
      </div>
      <span id="sound-key-label" className="sr-only">
        Sound identities
      </span>
      <ul className="sound-key" aria-labelledby="sound-key-label">
        <li className="blue">
          <i aria-hidden="true" />{" "}
          <StableText>{`Region A${data ? ` · ${data.regionA.name}` : ""}: ${REGION_SOUND.a.timbre}, ${REGION_SOUND.a.channel}`}</StableText>
        </li>
        <li className="orange">
          <i aria-hidden="true" className="dashed" />{" "}
          <StableText>{`Region B${data ? ` · ${data.regionB.name}` : ""}: ${REGION_SOUND.b.timbre}, ${REGION_SOUND.b.channel}`}</StableText>
        </li>
      </ul>
      <p id="listen-to-hint" className="sr-only">
        {guidedText.hints.stereo}
      </p>
      {error && (
        <p className="sonification-alert" role="alert">
          <StableText>{error}</StableText>
        </p>
      )}
      {warning && !error && (
        <p className="sonification-alert" role="status">
          <StableText>{warning}</StableText>
        </p>
      )}
      <p className="sr-only" role="status">
        {announcement && <StableText>{announcement}</StableText>}
      </p>
    </section>
  );
}
