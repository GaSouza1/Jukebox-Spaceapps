import { useCallback, useEffect, useRef, useState } from "react";
import { formatMonth } from "../../data/demoData";
import { useComparisonStore, type PlaybackMode } from "../../../stores/comparisonStore";
import type { RegionSeries } from "../../../types/data";
import { guidedText } from "../../guided-experience/i18n/en";
import { StableText } from "../../../components/StableText";
import {
  COMPARISON_MAPPING,
  describeComparisonSonification,
  formatLongMonth,
  modeLabel,
  REGION_SOUND,
} from "../describeSonification";

interface Props {
  seriesA: RegionSeries;
  seriesB: RegionSeries;
}

const { lowHz, highHz, stepMs, pan } = COMPARISON_MAPPING;

interface Voice {
  triggerAttackRelease: (note: number, duration: string) => void;
  volume: { value: number };
  dispose: () => void;
}
interface PannerNode {
  pan: { value: number };
  dispose: () => void;
}

export function SonificationPlayer({ seriesA, seriesB }: Props) {
  const {
    isPlaying,
    currentIndex,
    playbackSpeed,
    volume,
    playbackMode,
    lastAction,
    setCurrentIndex,
    setPlaybackSpeed,
    setVolume,
    setPlaybackMode,
    play,
    pause,
    resume,
    stop,
    finish,
  } = useComparisonStore();
  const synths = useRef<{ a: Voice; b: Voice; panA: PannerNode; panB: PannerNode } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Actions that happened before this player mounted are not announced again.
  const announcedId = useRef(lastAction?.id ?? 0);

  const all = [...seriesA.data, ...seriesB.data].map((point) => point.value);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const firstDate = seriesA.data[0]?.date;
  const lastDate = seriesA.data.at(-1)?.date;
  const months = seriesA.data.length;
  const description = describeComparisonSonification(seriesA, seriesB, playbackSpeed, playbackMode);

  const disposeSynths = useCallback(() => {
    if (!synths.current) return;
    const { a, b, panA, panB } = synths.current;
    [a, b, panA, panB].forEach((node) => node.dispose());
    synths.current = null;
  }, []);

  const playNotes = useCallback(
    async (index: number) => {
      const Tone = await import("tone");
      await Tone.start();
      if (!synths.current) {
        const panA = new Tone.Panner(0).toDestination();
        const panB = new Tone.Panner(0).toDestination();
        synths.current = {
          a: new Tone.Synth({ oscillator: { type: "sine" } }).connect(panA),
          b: new Tone.Synth({ oscillator: { type: "triangle" } }).connect(panB),
          panA,
          panB,
        };
      }
      const { a, b, panA, panB } = synths.current;
      // Left/right only when comparing; a region on its own is centred so any speaker works.
      panA.pan.value = playbackMode === "both" ? -pan : 0;
      panB.pan.value = playbackMode === "both" ? pan : 0;
      const frequency = (value: number) =>
        lowHz + ((value - min) / Math.max(max - min, 1)) * (highHz - lowHz);
      const level = volume === 0 ? -Infinity : -28 + volume * 24;
      a.volume.value = level;
      b.volume.value = level;
      if (playbackMode !== "b") a.triggerAttackRelease(frequency(seriesA.data[index].value), "16n");
      if (playbackMode !== "a") b.triggerAttackRelease(frequency(seriesB.data[index].value), "16n");
    },
    [seriesA, seriesB, volume, min, max, playbackMode],
  );

  useEffect(() => {
    if (!isPlaying) return;
    playNotes(currentIndex);
    const timer = window.setTimeout(() => {
      if (currentIndex >= seriesA.data.length - 1) finish();
      else setCurrentIndex(currentIndex + 1);
    }, stepMs / playbackSpeed);
    return () => window.clearTimeout(timer);
  }, [
    isPlaying,
    currentIndex,
    playbackSpeed,
    playNotes,
    finish,
    seriesA.data.length,
    setCurrentIndex,
  ]);

  // One short status message per playback transition, whichever control caused it
  // (this player or the guided experience).
  useEffect(() => {
    if (!lastAction || lastAction.id === announcedId.current) return;
    announcedId.current = lastAction.id;
    const state = useComparisonStore.getState();
    const mode = modeLabel(state.playbackMode, seriesA, seriesB);
    const date = seriesA.data[state.currentIndex]?.date;
    const month = date ? formatLongMonth(date) : "";
    const start = firstDate ? formatLongMonth(firstDate) : "";
    const messages = {
      play: `Playing ${mode}, from ${start}.`,
      resume: `Resumed at ${month}.`,
      pause: `Paused at ${month}.`,
      stop: `Stopped. Position reset to ${start}.`,
      finish: `Finished playing ${mode}.`,
    };
    setAnnouncement(messages[lastAction.type]);
  }, [lastAction, seriesA, seriesB, firstDate]);

  // Never resume on its own: leaving the page stops playback and frees the synths.
  useEffect(
    () => () => {
      useComparisonStore.getState().resetPlayback();
      disposeSynths();
    },
    [disposeSynths],
  );

  const currentDate = seriesA.data[currentIndex]?.date;
  const togglePlay = () => {
    if (isPlaying) pause();
    else if (currentIndex > 0) resume();
    else play();
  };
  const handleStop = () => {
    stop();
    disposeSynths();
  };
  const progress = months > 1 ? (currentIndex / (months - 1)) * 100 : 0;
  const valueText = (index: number) => {
    const date = seriesA.data[index]?.date;
    if (!date) return "";
    return `${formatLongMonth(date)}: ${seriesA.region.name} ${seriesA.data[index].value} ${seriesA.unit}, ${seriesB.region.name} ${seriesB.data[index].value} ${seriesB.unit}`;
  };

  return (
    <section className="player-card" aria-labelledby="player-title">
      <div className="player-heading">
        <div>
          <span className="eyebrow">04 / SONIFICATION</span>
          <h2 id="player-title">Listen to the data</h2>
        </div>
        <span className={isPlaying ? "status playing" : "status"}>
          <i aria-hidden="true" /> <StableText>{isPlaying ? "PLAYING" : "READY"}</StableText>
        </span>
      </div>
      <p id="player-description" className="sr-only">
        <StableText>
          {`About this sound: ${description.facts.map((fact) => fact.text).join(" ")} Use Play, Pause and Stop, the Listen to menu to hear one region at a time, and the playback position slider to move through the months.`}
        </StableText>
      </p>
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
        <StableText as="strong">{currentDate ? formatMonth(currentDate) : ""}</StableText>
        <StableText>{`${firstDate?.slice(0, 4)} — ${lastDate?.slice(0, 4)}`}</StableText>
      </div>
      {/* Real label text (not aria-label) so page translation sees it in context. */}
      <label htmlFor="playback-position" className="sr-only">
        Playback position
      </label>
      <input
        id="playback-position"
        className="progress-range"
        aria-valuetext={valueText(currentIndex)}
        type="range"
        min="0"
        max={Math.max(0, months - 1)}
        value={currentIndex}
        onChange={(e) => setCurrentIndex(Number(e.target.value))}
      />
      <div className="player-controls">
        <div className="transport">
          <button type="button" className="stop-button" onClick={handleStop}>
            <span aria-hidden="true">■</span>
            <span className="sr-only">Stop and return to start</span>
          </button>
          <button
            type="button"
            className="play-button"
            onClick={togglePlay}
            aria-describedby="player-description"
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
            <option key={`a-${seriesA.region.id}`} value="a">
              {`Region A only · ${seriesA.region.name}`}
            </option>
            <option key={`b-${seriesB.region.id}`} value="b">
              {`Region B only · ${seriesB.region.name}`}
            </option>
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
          <StableText>{`Region A · ${seriesA.region.name}: ${REGION_SOUND.a.timbre}, ${REGION_SOUND.a.channel}`}</StableText>
        </li>
        <li className="orange">
          <i aria-hidden="true" className="dashed" />{" "}
          <StableText>{`Region B · ${seriesB.region.name}: ${REGION_SOUND.b.timbre}, ${REGION_SOUND.b.channel}`}</StableText>
        </li>
      </ul>
      <p id="listen-to-hint" className="sr-only">
        {guidedText.hints.stereo}
      </p>
      <p className="sr-only" role="status">
        {announcement && <StableText>{announcement}</StableText>}
      </p>
    </section>
  );
}
