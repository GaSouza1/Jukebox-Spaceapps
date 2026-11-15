import { useEffect, useMemo, useRef, useState } from "react";
import { StableText } from "@/components/StableText";
import demoImage from "@/assets/refence.png";
import {
  lumaToFrequency,
  mapAnalysis,
  TIMBRE_BY_HUE,
  type ScientificTimbre,
} from "../engine/dataMapper";
import {
  analyzeImage,
  STEP_COUNT,
  type HueFamily,
  type ImageAnalysis,
  type ReadingDirection,
} from "../engine/imageAnalyzer";
import type { LayerName } from "../engine/instrumentManager";
import { BASE_BPM, PlaybackController, type PlaybackStatus } from "../engine/playbackController";

const STATUS_LABEL: Record<PlaybackStatus, string> = {
  idle: "READY",
  loading: "LOADING",
  playing: "PLAYING",
  paused: "PAUSED",
};
const HUE_LABEL: Record<HueFamily, string> = { warm: "warm", cool: "cool", neutral: "neutral" };
const TIMBRE_LABEL: Record<ScientificTimbre, string> = {
  piano: "sampled piano",
  bell: "soft bell",
  glass: "pure sine tone",
};
const HUE_COLOR: Record<HueFamily, string> = {
  warm: "#ff9b55",
  cool: "#47a9ff",
  neutral: "#c9d3de",
};
const DIRECTION_LABEL: Record<ReadingDirection, string> = {
  vertical: "North → South (rows)",
  horizontal: "West → East (columns)",
};
const DIRECTION_SPOKEN: Record<ReadingDirection, string> = {
  vertical: "from the top of the image to the bottom (north to south)",
  horizontal: "from the left edge of the image to the right (west to east)",
};
/**
 * Human-written description of the demo image. It is kept apart from the
 * computed text profile: the app measures brightness and colour, it does not
 * recognise objects or places.
 */
interface ImageDescription {
  alt: string;
  /** Written by a person (project team), or null when none exists. */
  humanText: string | null;
}
const DEMO_DESCRIPTION: ImageDescription = {
  alt: "Demo image, a global map in false colour. Description below.",
  humanText:
    "A global map in false colour. Swirling reds and oranges cover the northern half, yellow and cyan bands cross the tropics, deep blue covers the southern oceans, and white Antarctic ice runs along the bottom. The image has no legend or colour scale.",
};
const PROFILE_SECTIONS = 6;
const STEP_SECONDS = 60 / BASE_BPM / 2;

/** Plain-text profile of the image, computed from the analysis only. */
function describeProfile(analysis: ImageAnalysis) {
  const size = Math.ceil(analysis.steps.length / PROFILE_SECTIONS);
  const edge = analysis.direction === "vertical" ? ["top", "bottom"] : ["left edge", "right edge"];
  return Array.from({ length: PROFILE_SECTIONS }, (_, s) => {
    const slice = analysis.steps.slice(s * size, (s + 1) * size);
    const luma = slice.reduce((a, step) => a + step.luma, 0) / slice.length;
    const shares = { warm: 0, cool: 0, neutral: 0 };
    for (const step of slice) {
      for (const hue of Object.keys(shares) as HueFamily[]) shares[hue] += step.hueShares[hue];
    }
    const dominant = (Object.keys(shares) as HueFamily[]).reduce((a, b) =>
      shares[b] > shares[a] ? b : a,
    );
    const where = s === 0 ? ` (${edge[0]})` : s === PROFILE_SECTIONS - 1 ? ` (${edge[1]})` : "";
    return `Slices ${s * size + 1}–${s * size + slice.length}${where}: mostly ${HUE_LABEL[dominant]} hues (${Math.round((shares[dominant] / slice.length) * 100)}%, ${TIMBRE_LABEL[TIMBRE_BY_HUE[dominant]]}), mean brightness ${luma.toFixed(2)}, pitch around ${Math.round(lumaToFrequency(luma))} Hz.`;
  });
}

export function ImageSonification() {
  const imgRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const controllerRef = useRef<PlaybackController | null>(null);
  const previousStatus = useRef<PlaybackStatus>("idle");
  const stoppedByUser = useRef(false);
  const currentStepRef = useRef(-1);

  const [image, setImage] = useState(demoImage);
  const [imageDescription, setImageDescription] = useState<ImageDescription>(DEMO_DESCRIPTION);
  const [imageLoads, setImageLoads] = useState(0);
  const [direction, setDirection] = useState<ReadingDirection>("vertical");
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [currentStep, setCurrentStep] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.7);
  const [layers, setLayers] = useState<Record<LayerName, boolean>>({
    scientific: true,
    cinematic: true,
  });
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const controller = new PlaybackController({
      onStatus: setStatus,
      onStep: (index) => {
        currentStepRef.current = index;
        setCurrentStep(index);
      },
      onWarning: setWarning,
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => controllerRef.current?.setSpeed(speed), [speed]);
  useEffect(() => controllerRef.current?.setVolume(volume), [volume]);
  useEffect(() => {
    for (const layer of Object.keys(layers) as LayerName[]) {
      controllerRef.current?.setLayerEnabled(layer, layers[layer]);
    }
  }, [layers]);

  // One short message per playback state change; per-slice values are never announced.
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = status;
    if (status === previous) return;
    if (status === "loading") setAnnouncement("Loading sounds…");
    else if (status === "playing") {
      setAnnouncement(previous === "paused" ? "Resumed." : "Playing image sonification.");
    } else if (status === "paused") {
      setAnnouncement(
        currentStepRef.current >= 0
          ? `Paused at slice ${currentStepRef.current + 1} of ${STEP_COUNT}.`
          : "Paused at the start.",
      );
    } else if (previous === "playing" || previous === "paused" || previous === "loading") {
      setAnnouncement(stoppedByUser.current ? "Stopped. Back to the start." : "Playback finished.");
      stoppedByUser.current = false;
    }
  }, [status]);

  useEffect(() => {
    const img = imgRef.current;
    if (!imageLoads || !img) return;
    try {
      setAnalysis(analyzeImage(img, direction));
      setError(null);
    } catch (e) {
      setAnalysis(null);
      setError(`Could not analyse the image: ${(e as Error).message}`);
    }
  }, [imageLoads, direction]);

  const events = useMemo(() => (analysis ? mapAnalysis(analysis) : []), [analysis]);
  const profile = useMemo(() => (analysis ? describeProfile(analysis) : []), [analysis]);
  const current = currentStep >= 0 ? events[currentStep] : undefined;
  const progress = currentStep >= 0 && events.length ? (currentStep + 1) / events.length : 0;
  const durationSeconds = Math.round((STEP_COUNT * STEP_SECONDS) / speed);

  const stop = () => {
    if (status !== "idle") stoppedByUser.current = true;
    controllerRef.current?.stop();
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("The selected file is not an image.");
      return;
    }
    stop();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setAnalysis(null);
    setImageDescription({
      alt: `Uploaded image “${file.name}”. Description below.`,
      humanText: null,
    });
    setImage(objectUrlRef.current);
  };

  const handleDirection = (value: ReadingDirection) => {
    stop();
    setDirection(value);
  };

  const handlePlayPause = async () => {
    const controller = controllerRef.current;
    if (!controller || !analysis) return;
    if (status === "playing") {
      controller.pause();
      return;
    }
    try {
      setError(null);
      await controller.play(analysis);
    } catch (e) {
      setError(`Could not start audio: ${(e as Error).message}`);
    }
  };

  const cursorStyle: React.CSSProperties | undefined = current
    ? direction === "horizontal"
      ? {
          left: `${(currentStep / STEP_COUNT) * 100}%`,
          width: `${100 / STEP_COUNT}%`,
          top: 0,
          bottom: 0,
        }
      : {
          top: `${(currentStep / STEP_COUNT) * 100}%`,
          height: `${100 / STEP_COUNT}%`,
          left: 0,
          right: 0,
        }
    : undefined;

  return (
    <section className="player-card image-sonification" aria-labelledby="image-sonification-title">
      <div className="player-heading">
        <div>
          <span className="eyebrow">00 / IMAGE SONIFICATION</span>
          <h2 id="image-sonification-title">Listen to an image</h2>
        </div>
        <span className={status === "playing" ? "status playing" : "status"}>
          <i aria-hidden="true" /> <StableText>{STATUS_LABEL[status]}</StableText>
        </span>
      </div>

      <p className="exploratory-note">
        <strong>Exploratory visual sonification.</strong> This image has no legend, colour scale or
        calibrated metadata, so its colours are <em>not</em> interpreted as CO₂, temperature or any
        other physical quantity. The sound represents visual features: brightness, contrast, colour
        family and position.
      </p>

      <p id="image-sonification-description" className="sr-only">
        <StableText>
          {`About this sound: a sound representation of the image shown in this section. It is an exploratory reading of the picture, not a measurement of a scientific variable, because the image has no colour scale. The image is read in ${STEP_COUNT} slices ${DIRECTION_SPOKEN[direction]}, one short note per slice, about ${durationSeconds} seconds at the current speed. Pitch follows brightness: darker slices play lower notes, brighter slices higher notes, on a continuous scale from 262 to 1047 hertz. Louder notes mean more contrast inside the slice. The instrument tells the colour family: warm colours such as red, orange and yellow play a piano; cool colours such as green, cyan and blue play a soft bell; grey, white or black areas play a pure sine tone. Notes move left or right in the stereo field with the position of the bright areas. A quiet background of slow chords sets the mood but carries no data; it can be switched off with the Cinematic layer checkbox. A text profile of the image is available below the controls.`}
        </StableText>
      </p>

      <figure className="image-figure">
        <div className="image-stage">
          <img
            ref={imgRef}
            src={image}
            alt={imageDescription.alt}
            onLoad={() => setImageLoads((n) => n + 1)}
            onError={() => setError("The image could not be loaded.")}
          />
          {cursorStyle && <span className="scan-cursor" style={cursorStyle} aria-hidden="true" />}
        </div>
        <figcaption className="image-caption">
          {/* Each branch is its own keyed element: swapping bare text siblings would break
              once page translation has replaced them (see StableText). */}
          {imageDescription.humanText ? (
            <span key="human">
              <strong>Description written by the project team</strong> (not generated by the app):{" "}
              {imageDescription.humanText}
            </span>
          ) : (
            <span key="none">
              <strong>No human-written description is available for this image.</strong> The app
              does not recognise objects such as forests, cities or rivers; it only measures
              brightness and colour (see the text profile below).
            </span>
          )}
        </figcaption>
      </figure>

      {/* Visual brightness profile; the same information is in the text profile below. */}
      <div className="waveform data-strip" aria-hidden="true">
        {analysis?.steps.map((step) => (
          <i
            key={step.index}
            style={{
              height: `${Math.max(2, step.luma * 100)}%`,
              background: HUE_COLOR[step.hueFamily],
              opacity: step.index <= currentStep ? 1 : 0.32,
            }}
          />
        ))}
        {currentStep >= 0 && <span style={{ left: `${progress * 100}%` }} />}
      </div>

      <div className="timeline-readout">
        <StableText as="strong">
          {currentStep >= 0 ? `Slice ${currentStep + 1} / ${events.length}` : "Start"}
        </StableText>
        <StableText>{DIRECTION_LABEL[direction]}</StableText>
      </div>
      <span id="image-progress-label" className="sr-only">
        Image playback progress
      </span>
      <progress
        className="image-progress"
        value={progress}
        max={1}
        aria-labelledby="image-progress-label"
        aria-valuetext={
          currentStep >= 0 ? `Slice ${currentStep + 1} of ${events.length}` : "Not started"
        }
      />

      <div className="player-controls">
        <div className="transport">
          <button type="button" className="stop-button" onClick={stop} disabled={status === "idle"}>
            <span aria-hidden="true">■</span>
            <span className="sr-only">Stop the image sonification and return to the start</span>
          </button>
          <button
            type="button"
            className="play-button"
            onClick={handlePlayPause}
            disabled={!analysis || status === "loading"}
            aria-describedby="image-sonification-description"
          >
            <span aria-hidden="true">
              {status === "playing" ? "Ⅱ" : status === "loading" ? "…" : "▶"}
            </span>
            <StableText className="sr-only">
              {status === "playing"
                ? "Pause the image sonification"
                : status === "paused"
                  ? "Resume the image sonification"
                  : status === "loading"
                    ? "Loading sounds"
                    : "Play the image sonification"}
            </StableText>
          </button>
        </div>
        <label>
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
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

      <div className="image-options">
        <label>
          Reading direction
          <select
            value={direction}
            onChange={(e) => handleDirection(e.target.value as ReadingDirection)}
          >
            {(Object.keys(DIRECTION_LABEL) as ReadingDirection[]).map((value) => (
              <option key={value} value={value}>
                {DIRECTION_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Image file
          <input type="file" accept="image/*" onChange={handleUpload} />
        </label>
        <fieldset>
          <legend>Layers</legend>
          {(["scientific", "cinematic"] as LayerName[]).map((layer) => (
            <label key={layer} className="layer-toggle">
              <input
                type="checkbox"
                checked={layers[layer]}
                onChange={(e) => setLayers((prev) => ({ ...prev, [layer]: e.target.checked }))}
              />
              {layer === "scientific" ? "Scientific (data notes)" : "Cinematic (background)"}
            </label>
          ))}
        </fieldset>
      </div>

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

      {/* Updates several times per second, so it is deliberately not a live region. */}
      <dl className="step-readout">
        <div>
          <dt>Brightness</dt>
          <StableText as="dd">{current ? current.source.luma.toFixed(3) : "—"}</StableText>
        </div>
        <div>
          <dt>
            <span aria-hidden="true">→ </span>Frequency
          </dt>
          <StableText as="dd">{current ? `${current.frequency.toFixed(1)} Hz` : "—"}</StableText>
        </div>
        <div>
          <dt>Contrast</dt>
          <StableText as="dd">{current ? current.source.contrast.toFixed(3) : "—"}</StableText>
        </div>
        <div>
          <dt>
            <span aria-hidden="true">→ </span>Loudness
          </dt>
          <StableText as="dd">{current ? current.velocity.toFixed(2) : "—"}</StableText>
        </div>
        <div>
          <dt>Colour family</dt>
          <StableText as="dd">
            {current
              ? `${HUE_LABEL[current.source.hueFamily]} (sat. ${current.source.saturation.toFixed(2)})`
              : "—"}
          </StableText>
        </div>
        <div>
          <dt>
            <span aria-hidden="true">→ </span>Instrument
          </dt>
          <StableText as="dd">{current ? TIMBRE_LABEL[current.timbre] : "—"}</StableText>
        </div>
        <div>
          <dt>Horizontal position</dt>
          <StableText as="dd">
            {current ? current.source.horizontalCentroid.toFixed(2) : "—"}
          </StableText>
        </div>
        <div>
          <dt>
            <span aria-hidden="true">→ </span>Stereo pan
          </dt>
          <StableText as="dd">{current ? current.pan.toFixed(2) : "—"}</StableText>
        </div>
      </dl>

      {profile.length > 0 && (
        <details className="mapping-doc">
          <summary>Text profile of the image: measured visual features</summary>
          <p>
            Computed by the app from pixel brightness and colour only; it does not identify objects
            or places. Read {DIRECTION_SPOKEN[direction]} in {PROFILE_SECTIONS} parts. Brightness
            goes from 0 (black) to 1 (white).
          </p>
          <ul className="image-profile">
            {profile.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="mapping-doc">
        <summary>Mappings and transformations</summary>
        <table>
          <caption className="sr-only">How each visual feature becomes sound</caption>
          <thead>
            <tr>
              <th scope="col">Visual data</th>
              <th scope="col">Sound parameter</th>
              <th scope="col">Transformation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                Brightness (<span translate="no">Rec. 709</span> luma <span translate="no">Y′</span>
                ), slice mean
              </th>
              <td>Pitch (scientific layer)</td>
              <td>
                <span translate="no">261.6 Hz × 2^(2·Y′)</span>: continuous, not snapped to a scale
                (<span translate="no">C4</span> to <span translate="no">C6</span>)
              </td>
            </tr>
            <tr>
              <th scope="row">Contrast (standard deviation of Y′ in the slice)</th>
              <td>Note loudness</td>
              <td>0.3 + 0.6 × contrast ÷ the image's highest contrast</td>
            </tr>
            <tr>
              <th scope="row">Majority colour family</th>
              <td>Instrument</td>
              <td>
                {(Object.keys(TIMBRE_BY_HUE) as HueFamily[])
                  .map((hue) => `${HUE_LABEL[hue]} → ${TIMBRE_LABEL[TIMBRE_BY_HUE[hue]]}`)
                  .join("; ")}
                . Neutral means chroma below 0.15. A visual category, not a physical one.
              </td>
            </tr>
            <tr>
              <th scope="row">Horizontal centre of brightness</th>
              <td>Stereo pan</td>
              <td>(x − 0.5) × 1.2, from −0.6 (left) to +0.6 (right)</td>
            </tr>
            <tr>
              <th scope="row">Position along the reading direction</th>
              <td>Time</td>
              <td>
                {STEP_COUNT} slices, one eighth note each ({STEP_SECONDS} s at 1×)
              </td>
            </tr>
            <tr>
              <th scope="row">Mean brightness of every 16 slices</th>
              <td>Chord (cinematic layer)</td>
              <td>
                {/* Chord symbols are notation: translation would turn "Am" into a word. */}
                Relative order picks the chord <span translate="no">Am, Em, Dm, F, C</span> or{" "}
                <span translate="no">G</span> (dark to bright). Mood only.
              </td>
            </tr>
            <tr>
              <th scope="row">Mean change between slices</th>
              <td>Strings brightness and level</td>
              <td>Filter 450 to 1550 Hz, proportional. Mood only.</td>
            </tr>
          </tbody>
        </table>
      </details>
    </section>
  );
}
