import { useCallback, useEffect, useRef } from "react";
import { formatMonth } from "../../data/demoData";
import { useComparisonStore } from "../../../stores/comparisonStore";
import type { RegionSeries } from "../../../types/data";

interface Props {
  seriesA: RegionSeries;
  seriesB: RegionSeries;
}

export function SonificationPlayer({ seriesA, seriesB }: Props) {
  const {
    isPlaying,
    currentIndex,
    playbackSpeed,
    volume,
    setPlaying,
    setCurrentIndex,
    setPlaybackSpeed,
    setVolume,
    resetPlayback,
  } = useComparisonStore();
  const synths = useRef<{
    a: { triggerAttackRelease: Function; volume: { value: number } };
    b: { triggerAttackRelease: Function; volume: { value: number } };
  } | null>(null);

  const playNotes = useCallback(
    async (index: number) => {
      const Tone = await import("tone");
      await Tone.start();
      if (!synths.current) {
        synths.current = {
          a: new Tone.Synth({ oscillator: { type: "sine" } }).toDestination(),
          b: new Tone.Synth({ oscillator: { type: "triangle" } }).toDestination(),
        };
      }
      const all = [...seriesA.data, ...seriesB.data].map((point) => point.value);
      const min = Math.min(...all);
      const max = Math.max(...all);
      const frequency = (value: number, low: number, high: number) =>
        low + ((value - min) / Math.max(max - min, 1)) * (high - low);
      synths.current.a.volume.value = volume === 0 ? -Infinity : -28 + volume * 24;
      synths.current.b.volume.value = volume === 0 ? -Infinity : -28 + volume * 24;
      synths.current.a.triggerAttackRelease(frequency(seriesA.data[index].value, 180, 620), "16n");
      synths.current.b.triggerAttackRelease(frequency(seriesB.data[index].value, 130, 480), "16n");
    },
    [seriesA, seriesB, volume],
  );

  useEffect(() => {
    if (!isPlaying) return;
    playNotes(currentIndex);
    const timer = window.setTimeout(() => {
      if (currentIndex >= seriesA.data.length - 1) resetPlayback();
      else setCurrentIndex(currentIndex + 1);
    }, 500 / playbackSpeed);
    return () => window.clearTimeout(timer);
  }, [
    isPlaying,
    currentIndex,
    playbackSpeed,
    playNotes,
    resetPlayback,
    seriesA.data.length,
    setCurrentIndex,
  ]);

  const stop = () => {
    resetPlayback();
    synths.current = null;
  };
  const currentDate = seriesA.data[currentIndex]?.date;
  const progress = seriesA.data.length > 1 ? (currentIndex / (seriesA.data.length - 1)) * 100 : 0;

  return (
    <section className="player-card" aria-labelledby="player-title">
      <div className="player-heading">
        <div>
          <span className="eyebrow">04 / SONIFICATION</span>
          <h2 id="player-title">Listen to the data</h2>
        </div>
        <span className={isPlaying ? "status playing" : "status"}>
          <i /> {isPlaying ? "PLAYING" : "READY"}
        </span>
      </div>
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
        <strong>{currentDate ? formatMonth(currentDate) : ""}</strong>
        <span>
          {seriesA.data[0]?.date.slice(0, 4)} — {seriesA.data.at(-1)?.date.slice(0, 4)}
        </span>
      </div>
      <input
        className="progress-range"
        aria-label="Playback position"
        type="range"
        min="0"
        max={Math.max(0, seriesA.data.length - 1)}
        value={currentIndex}
        onChange={(e) => setCurrentIndex(Number(e.target.value))}
      />
      <div className="player-controls">
        <div className="transport">
          <button className="stop-button" onClick={stop} aria-label="Stop and return to start">
            ■
          </button>
          <button
            className="play-button"
            onClick={() => setPlaying(!isPlaying)}
            aria-label={isPlaying ? "Pause sonification" : "Play sonification"}
          >
            {isPlaying ? "Ⅱ" : "▶"}
          </button>
        </div>
        <label>
          Speed
          <select value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))}>
            <option value=".5">0.5×</option>
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
            onChange={(e) => setVolume(Number(e.target.value))}
          />
          <span>{Math.round(volume * 100)}%</span>
        </label>
      </div>
      <div className="sound-key">
        <span className="blue">
          <i /> {seriesA.region.name}: clear sine tone
        </span>
        <span className="orange">
          <i /> {seriesB.region.name}: textured triangle tone
        </span>
      </div>
    </section>
  );
}
