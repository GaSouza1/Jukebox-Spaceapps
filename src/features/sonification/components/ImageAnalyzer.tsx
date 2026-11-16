import { useEffect, useMemo, useRef, useState } from "react";
import { StableText } from "@/components/StableText";
import { useImageCollection } from "../collection/useImageCollection";
import {
  describeGenerated,
  describeProfile,
  DIRECTION_SPOKEN,
  HUE_LABEL,
  narrationScript,
  PROFILE_SECTIONS,
  TIMBRE_LABEL,
} from "../describeImage";
import { mapAnalysis, TIMBRE_BY_HUE } from "../engine/dataMapper";
import { STEP_COUNT, type HueFamily, type ReadingDirection } from "../engine/imageAnalyzer";
import { cinematicProfile, type CinematicProfile } from "../engine/cinematicProfile";
import { NARRATION_SOURCE_ATTR } from "../engine/narrationLanguage";
import type { VoiceState } from "../engine/narrationLayer";
import { BASE_BPM, type PlaybackStatus } from "../engine/playbackController";
import { neighbourId, type SequenceItem, type SoundLayer } from "../engine/sequencePlayer";
import { useImageSequence } from "../hooks/useImageSequence";
import { ImageCollectionList } from "./ImageCollectionList";

const STATUS_LABEL: Record<PlaybackStatus, string> = {
  idle: "READY",
  loading: "LOADING",
  playing: "PLAYING",
  paused: "PAUSED",
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
const LAYER_LABEL: Record<SoundLayer, string> = {
  scientific: "Scientific (data notes)",
  cinematic: "Cinematic (background)",
  narration: "Narration (spoken description)",
};
const STEP_SECONDS = 60 / BASE_BPM / 2;
const ORIGIN_TEXT: Record<VoiceState["origin"], string> = {
  original: "the narration text is not translated",
  page: "the language the page was translated into",
  detector: "detected by the browser from the translated text",
  browser:
    "assumed from your browser language, because the language of the translated page could not be identified. If it is wrong, choose a voice",
  manual: "voice chosen manually",
};

/** The cinematic mood of an image, stated as an artistic choice. */
function describeMood(mood: CinematicProfile) {
  const name =
    mood.label === "blended"
      ? `a blend of energetic and contemplative (${Math.round(mood.energy * 100)} % energetic)`
      : mood.label;
  return `Cinematic mood for this image: ${name}. An artistic choice from its overall brightness and contrast (score ${mood.score.toFixed(2)}), not a measurement of anything physical.`;
}

function languageName(lang: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
  } catch {
    return lang; // Not a valid BCP 47 tag: show it as given.
  }
}

/** Status of the narration voice, in plain words. */
function describeVoice(available: boolean, state: VoiceState | null, manualName: string | null) {
  if (!available) return "Narration is not available: this browser has no speech synthesis.";
  const tail = "It uses the browser's speech synthesis, not your screen reader.";
  if (!state) {
    return manualName
      ? `Narration voice: ${manualName}, chosen manually. ${tail}`
      : `Narration language: automatic. It follows the narration text shown on the page: English, or the language the page is translated into. ${tail}`;
  }
  const voice = state.voice ?? "chosen by the browser (no installed voice for this language)";
  return `Narration language: ${languageName(state.lang)} (${state.lang}), ${ORIGIN_TEXT[state.origin]}. Voice: ${voice}. ${tail}`;
}

export function ImageSonification() {
  const previous = useRef<{ status: PlaybackStatus; id: string | null }>({
    status: "idle",
    id: null,
  });
  const stoppedByUser = useRef(false);
  /** Context prepended to the next playback announcement (e.g. a removal). */
  const pendingNote = useRef<string | null>(null);

  const [direction, setDirection] = useState<ReadingDirection>("vertical");
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.7);
  const [voiceRate, setVoiceRate] = useState(1);
  const [manualVoice, setManualVoice] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [layers, setLayers] = useState<Record<SoundLayer, boolean>>({
    scientific: true,
    cinematic: true,
    narration: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const collection = useImageCollection(direction);
  const { images, selected, selectedId, analysisFor } = collection;

  const queue = useMemo<SequenceItem[]>(
    () =>
      images.map((image, index) => {
        const state = analysisFor(image.id);
        const analysis = state?.status === "ready" ? state.analysis : null;
        return {
          id: image.id,
          analysis,
          narration: narrationScript({
            position: index + 1,
            count: images.length,
            name: image.name,
            description: image.description,
            analysis,
            failed: state?.status === "error",
            direction,
          }),
        };
      }),
    [images, analysisFor, direction],
  );

  const player = useImageSequence({
    queue,
    layers,
    loop,
    speed,
    volume,
    voiceRate,
    manualVoice,
  });
  const voiceOptions = useMemo(
    () =>
      [...player.voices].sort(
        (a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name),
      ),
    [player.voices],
  );
  const manualVoiceName = voiceOptions.find((voice) => voice.id === manualVoice);
  const { status, currentId, phase } = player;
  const narrationOn = layers.narration && player.narrationAvailable;

  const positionLabel = (id: string | null) => {
    const index = images.findIndex((image) => image.id === id);
    return index < 0 ? "" : `image ${index + 1} of ${images.length}, ${images[index].name}`;
  };

  // One short message per playback change (state or image); per-slice values are never announced,
  // and the narration text itself is never sent to the live region.
  useEffect(() => {
    const prev = previous.current;
    previous.current = { status, id: currentId };
    if (prev.status === status && prev.id === currentId) return;
    const label = positionLabel(currentId);
    let message: string | null = null;
    if (status === "idle") {
      if (prev.status !== "idle") {
        message = player.interruptedRef.current
          ? "Image sonification stopped because the data sonification started."
          : stoppedByUser.current
            ? "Stopped. Back to the start."
            : "Playback finished.";
      }
      stoppedByUser.current = false;
    } else if (currentId && currentId !== prev.id) {
      message =
        status === "paused"
          ? `Paused at the start of ${label}.`
          : `${prev.id ? "Now playing" : "Playing"} ${label}.`;
    } else if (status === "loading") message = "Loading sounds…";
    else if (status === "paused") {
      const step = player.currentStepRef.current;
      message =
        phase === "composition" && step >= 0
          ? `Paused at slice ${step + 1} of ${STEP_COUNT}, ${label}.`
          : phase === "narration"
            ? `Paused during the narration of ${label}.`
            : `Paused before ${label}.`;
    } else if (status === "playing" && prev.status === "paused") message = "Resumed.";
    if (!message) return;
    setAnnouncement(pendingNote.current ? `${pendingNote.current} ${message}` : message);
    pendingNote.current = null;
  }, [status, currentId]);

  // The view follows the sequence: each image is shown when it starts playing.
  useEffect(() => {
    if (currentId) collection.select(currentId);
  }, [currentId]);

  const selectedState = analysisFor(selectedId);
  const analysis = selectedState?.status === "ready" ? selectedState.analysis : null;
  const selectedIndex = images.findIndex((image) => image.id === selectedId);
  const imageDescription = selected.description;
  // Cursor, strip, progress and readout follow playback only while the playing image is shown.
  const viewingPlaying = currentId === selectedId;
  const currentStep = viewingPlaying && phase === "composition" ? player.currentStep : -1;

  const events = useMemo(() => (analysis ? mapAnalysis(analysis) : []), [analysis]);
  const profile = useMemo(() => (analysis ? describeProfile(analysis) : []), [analysis]);
  const generated = useMemo(
    () => (analysis ? describeGenerated(analysis, direction).join(" ") : ""),
    [analysis, direction],
  );
  const mood = useMemo(() => (analysis ? cinematicProfile(analysis) : null), [analysis]);
  const script = queue[selectedIndex]?.narration ?? [];
  const current = currentStep >= 0 ? events[currentStep] : undefined;
  const progress = currentStep >= 0 && events.length ? (currentStep + 1) / events.length : 0;
  const durationSeconds = Math.round((STEP_COUNT * STEP_SECONDS) / speed);
  const ids = images.map((image) => image.id);
  const previousId = neighbourId(ids, currentId, -1, loop);
  const nextId = neighbourId(ids, currentId, 1, loop);
  const anyLayer = layers.scientific || layers.cinematic || narrationOn;
  const errorText = error ?? player.error;

  const stop = () => {
    if (status !== "idle") stoppedByUser.current = true;
    player.stop();
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Clearing the input lets the same file be picked again after a removal.
    event.target.value = "";
    if (!files.length) return;
    const { added, rejected } = collection.add(files);
    setError(
      rejected.length
        ? `${rejected.length === 1 ? "This file is" : "These files are"} not an image and ${rejected.length === 1 ? "was" : "were"} not added: ${rejected.join(", ")}.`
        : null,
    );
    if (!added.length) return;
    if (status === "idle") collection.select(added[0].id);
    const total = images.length + added.length;
    setAnnouncement(
      `Added ${added.length} ${added.length === 1 ? "image" : "images"}. The collection now has ${total} images.`,
    );
  };

  const handleRemove = (id: string) => {
    const image = images.find((item) => item.id === id);
    if (!image || image.isDemo) return null;
    const note = `Removed ${image.name}. ${images.length - 1} ${images.length - 1 === 1 ? "image" : "images"} left.`;
    if (status !== "idle" && id === currentId) {
      // The sequence moves on (or ends); its announcement carries this note.
      pendingNote.current = note;
      player.remove(id);
    } else setAnnouncement(note);
    return collection.remove(id).neighbourId;
  };

  const handleMove = (id: string, delta: -1 | 1) => {
    const from = images.findIndex((image) => image.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= images.length) return;
    collection.move(id, delta);
    setAnnouncement(`${images[from].name} moved to position ${to + 1} of ${images.length}.`);
  };

  const handleDirection = (value: ReadingDirection) => {
    stop();
    setDirection(value);
  };

  const handlePlayPause = () => {
    if (status === "playing") player.pause();
    else {
      setError(null);
      player.play(selectedId);
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
          {`About this sound: a sound representation of each image in the collection. The collection has ${images.length} ${images.length === 1 ? "image" : "images"}; Play starts at the image shown, number ${selectedIndex + 1}, and continues in order${loop ? ". Loop is on: after the last image, playback returns to the first" : ", ending after the last image"}. ${narrationOn ? "For each image, a spoken description (the Narration layer) comes first, then the sound." : "The Narration layer is off, so each image plays its sound only."} The sound is an exploratory reading of the picture, not a measurement of a scientific variable, because the images have no colour scale. Each image is read in ${STEP_COUNT} slices ${DIRECTION_SPOKEN[direction]}, one short note per slice, about ${durationSeconds} seconds at the current speed. Pitch follows brightness: darker slices play lower notes, brighter slices higher notes, on a continuous scale from 262 to 1047 hertz. Louder notes mean more contrast inside the slice. The instrument tells the colour family: warm colours such as red, orange and yellow play a piano; cool colours such as green, cyan and blue play a soft bell; grey, white or black areas play a pure sine tone. Notes move left or right in the stereo field with the position of the bright areas. A quiet, slowly evolving background of chords and textures sets the mood. Its character is an artistic choice from the overall brightness of each image: energetic for bright images, contemplative for dark ones; it carries no data. It can be switched off with the Cinematic layer checkbox. The narration names the regions of high and low temperature, estimated from warm or strong colours (high) and cool or weak colours (low). It is not a measured temperature and does not change the sound. A text profile of the image and the narration script are available below the controls.`}
        </StableText>
      </p>

      <ImageCollectionList
        images={images}
        selectedId={selectedId}
        playingId={currentId}
        phase={phase}
        status={status}
        analysisFor={analysisFor}
        onSelect={collection.select}
        onMove={handleMove}
        onRemove={handleRemove}
      />

      <figure className="image-figure">
        <div className="image-stage">
          <img
            src={selected.src}
            alt={imageDescription.alt}
            onError={() => setError(`“${selected.name}” could not be loaded.`)}
          />
          {cursorStyle && <span className="scan-cursor" style={cursorStyle} aria-hidden="true" />}
        </div>
        <figcaption className="image-caption">
          {/* Each branch is its own keyed element: swapping bare text siblings would break
              once page translation has replaced them (see StableText). */}
          {imageDescription.humanText ? (
            <span key="human">
              <strong>Description written by the project team:</strong> {imageDescription.humanText}{" "}
              {generated}
            </span>
          ) : imageDescription.userText?.trim() ? (
            <span key="user">
              <strong>Description provided by the person who added this image</strong> (not verified
              by the app): {imageDescription.userText} {generated}
            </span>
          ) : (
            <span key="none">
              <strong>No human-written description is available for this image.</strong> The app
              does not recognise objects or places. {generated}
            </span>
          )}
        </figcaption>
      </figure>
      {/* {!selected.isDemo && (
        <label className="user-description">
          Your description of this image (optional)
          <textarea
            rows={2}
            value={imageDescription.userText ?? ""}
            aria-describedby="user-description-hint"
            onChange={(e) => collection.setUserDescription(selected.id, e.target.value)}
          />
          <span id="user-description-hint">
            Shown above and spoken by the narration as written by you, not verified by the app. The
            sound never depends on it.
          </span>
        </label>
      )} */}
      {selectedState?.status === "error" && (
        <p className="sonification-alert">
          <StableText>{`“${selected.name}” could not be analysed (${selectedState.message}). It is skipped during playback; you can remove it from the collection.`}</StableText>
        </p>
      )}

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

      <div className="timeline-readout sequence-readout">
        <StableText as="strong">
          {currentId
            ? `Playing ${positionLabel(currentId)}`
            : `Starts at image ${selectedIndex + 1} of ${images.length}`}
        </StableText>
        <StableText>
          {currentId
            ? status === "paused"
              ? "Paused"
              : phase === "narration"
                ? "Narration"
                : phase === "composition"
                  ? "Sound"
                  : "Next image"
            : loop
              ? "Loop on"
              : "Loop off"}
        </StableText>
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
          currentStep >= 0
            ? `Image ${selectedIndex + 1} of ${images.length}, slice ${currentStep + 1} of ${events.length}`
            : viewingPlaying && phase === "narration"
              ? `Image ${selectedIndex + 1} of ${images.length}, narration`
              : currentId && !viewingPlaying
                ? `Not playing; ${positionLabel(currentId)} is playing`
                : "Not started"
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
            className="stop-button skip-button"
            onClick={player.previous}
            disabled={status === "idle" || !previousId}
            title="Previous image"
          >
            <span aria-hidden="true">←</span>
            <span className="sr-only">Play the previous image</span>
          </button>
          <button
            type="button"
            className="play-button"
            onClick={handlePlayPause}
            disabled={
              status === "loading" ||
              (status === "idle" &&
                (!anyLayer || !selectedState || selectedState.status === "loading"))
            }
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
          <button
            type="button"
            className="stop-button skip-button"
            onClick={player.next}
            disabled={status === "idle" || !nextId}
            title="Next image"
          >
            <span aria-hidden="true">→</span>
            <span className="sr-only">Play the next image</span>
          </button>
          <button
            type="button"
            className="stop-button skip-button loop-button"
            aria-pressed={loop}
            onClick={() => setLoop((value) => !value)}
            title="Loop the collection"
          >
            <span aria-hidden="true">⟳</span>
            <span className="sr-only">Loop the whole collection</span>
          </button>
        </div>
        {/* <label>
          Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value="0.5">0.5×</option>
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </label> */}
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
          Add image files
          <input type="file" accept="image/*" multiple onChange={handleUpload} />
        </label>
        <fieldset>
          <legend>Layers</legend>
          {(Object.keys(LAYER_LABEL) as SoundLayer[]).map((layer) => {
            const unavailable = layer === "narration" && !player.narrationAvailable;
            return (
              <label key={layer} className="layer-toggle">
                <input
                  type="checkbox"
                  checked={layers[layer] && !unavailable}
                  disabled={unavailable}
                  aria-describedby={layer === "narration" ? "narration-voice" : undefined}
                  onChange={(e) => setLayers((prev) => ({ ...prev, [layer]: e.target.checked }))}
                />
                {LAYER_LABEL[layer]}
              </label>
            );
          })}
        </fieldset>
        {/* <label>
          Narration voice speed
          <select
            value={voiceRate}
            disabled={!player.narrationAvailable}
            aria-describedby="narration-voice"
            onChange={(e) => setVoiceRate(Number(e.target.value))}
          >
            <option value="0.8">0.8×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
          </select>
        </label> */}
        <label>
          Narration voice
          <select
            value={manualVoice ?? "auto"}
            disabled={!player.narrationAvailable}
            aria-describedby="narration-voice"
            onChange={(e) => setManualVoice(e.target.value === "auto" ? null : e.target.value)}
          >
            <option value="auto">Automatic (follows the page language)</option>
            {voiceOptions.map((voice) => (
              <option key={voice.id} value={voice.id} translate="no">
                {`${voice.name} (${voice.lang})`}
              </option>
            ))}
          </select>
        </label>
        <StableText as="small" id="narration-voice" className="narration-voice">
          {describeVoice(
            player.narrationAvailable,
            player.voiceState,
            manualVoiceName ? `${manualVoiceName.name} (${manualVoiceName.lang})` : null,
          )}
        </StableText>
      </div>
      {!anyLayer && (
        <p className="collection-hint">All layers are off. Turn on at least one layer to play.</p>
      )}

      {errorText && (
        <p className="sonification-alert" role="alert">
          <StableText>{errorText}</StableText>
        </p>
      )}
      {player.warning && !errorText && (
        <p className="sonification-alert" role="status">
          <StableText>{player.warning}</StableText>
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
            goes from 0 (black) to 1 (white). Visual temperature goes from 0 (coldest-looking) to 1
            (hottest-looking): warm or strong colours read as high temperature, cool or weak colours
            as low. It is an interpretation of colour, not a measured temperature, and it does not
            change the sound.
          </p>
          <ul className="image-profile">
            {profile.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {mood && <StableText as="p">{describeMood(mood)}</StableText>}
        </details>
      )}

      {script.length > 0 && (
        <details className="mapping-doc">
          <summary>Narration script for this image</summary>
          <p>
            What the Narration layer speaks before the sound of this image. It names only what a
            person wrote or what the app measured; the app does not identify objects or places.
          </p>
          <ol className="image-profile">
            {script.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ol>
        </details>
      )}

      {/* The narration reads each sentence from here right before speaking it, so a page
          translation (which only changes the DOM) reaches the voice. Every image is rendered,
          not just the one shown. Hidden from view and from assistive technology: the visible
          script above is the readable copy. */}
      <div className="narration-source" aria-hidden="true">
        {queue.map((item) => (
          <ol key={item.id} {...{ [NARRATION_SOURCE_ATTR]: item.id }}>
            {item.narration.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ol>
        ))}
      </div>

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
              <th scope="row">Overall brightness, its spread and overall contrast</th>
              <td>Mood of the cinematic layer</td>
              <td>
                One artistic choice per image: brighter images get an energetic mood (busier rhythm,
                higher register, brighter tone), darker ones a contemplative mood (slow, low, dark),
                mid images a blend. The chords and notes themselves carry no data. Not a measurement
                of temperature, vegetation or any physical quantity.
              </td>
            </tr>
            <tr>
              <th scope="row">Image description and whole-image measurements</th>
              <td>Speech (narration layer)</td>
              <td>
                Spoken before each image's sound with the browser's speech synthesis. It carries no
                data notes and never changes the other layers.
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </section>
  );
}
