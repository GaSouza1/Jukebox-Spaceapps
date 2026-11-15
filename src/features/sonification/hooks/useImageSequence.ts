/**
 * Wires the audio engine for the image collection: one PlaybackController
 * (Scientific + Cinematic, Tone.js), one NarrationLayer (Web Speech) and the
 * SequencePlayer that runs them image after image. Everything is created on
 * mount and disposed on unmount.
 *
 * Play claims the shared Transport (transportOwner.ts): the region comparison
 * stops if it was playing, and this sequence stops if the comparison starts.
 */
import { useEffect, useRef, useState } from "react";
import { resolveRenderedSentence } from "../engine/narrationLanguage";
import {
  NarrationLayer,
  speechSynthesisAvailable,
  type VoiceOption,
  type VoiceState,
} from "../engine/narrationLayer";
import { PlaybackController, type PlaybackStatus } from "../engine/playbackController";
import {
  SequencePlayer,
  type SequenceItem,
  type SequencePhase,
  type SoundLayer,
} from "../engine/sequencePlayer";
import { claimTransport, releaseTransport, type TransportOwner } from "../engine/transportOwner";

interface Settings {
  queue: SequenceItem[];
  layers: Record<SoundLayer, boolean>;
  loop: boolean;
  speed: number;
  volume: number;
  voiceRate: number;
  /** A voice id from `voices`, or null to follow the language of the page. */
  manualVoice: string | null;
}

export function useImageSequence({
  queue,
  layers,
  loop,
  speed,
  volume,
  voiceRate,
  manualVoice,
}: Settings) {
  const sequenceRef = useRef<SequencePlayer | null>(null);
  const controllerRef = useRef<PlaybackController | null>(null);
  const narratorRef = useRef<NarrationLayer | null>(null);
  const currentStepRef = useRef(-1);
  const ownerRef = useRef<TransportOwner | null>(null);
  /** True when the last stop came from the comparison taking the audio over. */
  const interruptedRef = useRef(false);

  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [current, setCurrent] = useState<{ id: string | null; phase: SequencePhase | null }>({
    id: null,
    phase: null,
  });
  const [currentStep, setCurrentStep] = useState(-1);
  const [sampleWarning, setSampleWarning] = useState<string | null>(null);
  const [narrationWarning, setNarrationWarning] = useState<string | null>(null);
  const [sequenceWarning, setSequenceWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState | null>(null);
  const [narrationAvailable] = useState(speechSynthesisAvailable);

  useEffect(() => {
    let sequence: SequencePlayer | null = null;
    const controller = new PlaybackController({
      onStatus: (value) => sequence?.compositionStatus(value),
      onStep: (index) => {
        currentStepRef.current = index;
        setCurrentStep(index);
      },
      onWarning: setSampleWarning,
      onEnded: () => sequence?.compositionEnded(),
    });
    const narrator = new NarrationLayer({
      onWarning: setNarrationWarning,
      onVoices: setVoices,
      onVoiceState: setVoiceState,
    });
    // Each sentence is read from the page right before it is spoken, so a page
    // translation reaches the narration.
    narrator.setResolver(resolveRenderedSentence);
    sequence = new SequencePlayer(
      { composition: controller, narrator },
      {
        onStatus: setStatus,
        onCurrent: (id, phase) => setCurrent({ id, phase }),
        onWarning: setSequenceWarning,
        onError: setError,
      },
    );
    const owner: TransportOwner = {
      name: "image sonification",
      onTransportLost: () => {
        if (sequence?.state.status === "idle") return;
        interruptedRef.current = true;
        sequence?.stop();
      },
    };
    sequenceRef.current = sequence;
    controllerRef.current = controller;
    narratorRef.current = narrator;
    ownerRef.current = owner;
    return () => {
      releaseTransport(owner);
      sequence.dispose();
      narrator.dispose();
      controller.dispose();
      sequenceRef.current = null;
      controllerRef.current = null;
      narratorRef.current = null;
    };
  }, []);

  useEffect(() => sequenceRef.current?.setQueue(queue), [queue]);
  useEffect(() => sequenceRef.current?.setLoop(loop), [loop]);
  useEffect(() => controllerRef.current?.setSpeed(speed), [speed]);
  useEffect(() => {
    controllerRef.current?.setVolume(volume);
    narratorRef.current?.setVolume(volume);
  }, [volume]);
  useEffect(() => narratorRef.current?.setRate(voiceRate), [voiceRate]);
  useEffect(() => narratorRef.current?.setManualVoice(manualVoice), [manualVoice]);
  useEffect(() => {
    controllerRef.current?.setLayerEnabled("scientific", layers.scientific);
    controllerRef.current?.setLayerEnabled("cinematic", layers.cinematic);
    sequenceRef.current?.setLayers(layers);
  }, [layers]);

  return {
    status,
    currentId: current.id,
    phase: current.phase,
    currentStep,
    currentStepRef,
    interruptedRef,
    warning: error ? null : (narrationWarning ?? sequenceWarning ?? sampleWarning),
    error,
    voices,
    voiceState,
    narrationAvailable,
    play(startId: string) {
      setError(null);
      setNarrationWarning(null);
      interruptedRef.current = false;
      if (ownerRef.current) claimTransport(ownerRef.current);
      sequenceRef.current?.play(startId);
    },
    pause: () => sequenceRef.current?.pause(),
    stop: () => sequenceRef.current?.stop(),
    next: () => sequenceRef.current?.next(),
    previous: () => sequenceRef.current?.previous(),
    /** Call before the image leaves the collection. */
    remove: (id: string) => sequenceRef.current?.remove(id),
  };
}
