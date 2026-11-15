/**
 * Plays the region comparison on the shared engine: one PlaybackController
 * (Tone.Transport, InstrumentManager, ScientificLayer), the same one the image
 * uses, created on mount and disposed on unmount.
 *
 * The comparison store stays the source of commands (play, pause, resume,
 * stop come in as `lastAction`, so every control and its announcement keep
 * working) and the controller is the source of time: the current month is
 * written to the store from `onStep`, which Tone.Draw fires when the note is
 * heard. No React timer drives playback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useComparisonStore } from "../../../stores/comparisonStore";
import { PlaybackController, type PlaybackStatus } from "../engine/playbackController";
import type { SonificationScore } from "../engine/score";
import { claimTransport, releaseTransport, type TransportOwner } from "../engine/transportOwner";

export function useComparisonPlayback(score: SonificationScore | null) {
  const controllerRef = useRef<PlaybackController | null>(null);
  const ownerRef = useRef<TransportOwner | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const [engineStatus, setEngineStatus] = useState<PlaybackStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const speed = useComparisonStore((s) => s.playbackSpeed);
  const volume = useComparisonStore((s) => s.volume);
  const lastAction = useComparisonStore((s) => s.lastAction);
  // Actions from before this player mounted are not replayed.
  const handled = useRef(lastAction?.id ?? 0);

  useEffect(() => {
    const store = () => useComparisonStore.getState();
    const controller = new PlaybackController(
      {
        onStatus: (status) => {
          setEngineStatus(status);
          // Paused or stopped while the instruments were loading: hold it.
          if (status === "playing" && !store().isPlaying) controller.pause();
        },
        onStep: (index) => {
          if (index >= 0) store().setCurrentIndex(index);
        },
        onWarning: setWarning,
        onEnded: () => {
          releaseTransport(owner);
          store().finish();
        },
      },
      // Sine and triangle only: the sampled piano is not downloaded.
      { loadSamples: false },
    );
    const owner: TransportOwner = {
      name: "data sonification",
      onTransportLost: () => {
        controller.stop();
        store().interrupt();
      },
    };
    controllerRef.current = controller;
    ownerRef.current = owner;
    return () => {
      releaseTransport(owner);
      controller.dispose();
      controllerRef.current = null;
      // Never resume on its own: leaving the page stops playback.
      store().resetPlayback();
    };
  }, []);

  const start = useCallback((fromIndex: number) => {
    const controller = controllerRef.current;
    const owner = ownerRef.current;
    const current = scoreRef.current;
    if (!controller || !owner) return;
    if (!current) {
      useComparisonStore.getState().resetPlayback();
      return;
    }
    claimTransport(owner);
    setError(null);
    controller.stop();
    controller.playScore(current, fromIndex).catch((reason: unknown) => {
      setError(`Could not start audio: ${(reason as Error).message}`);
      releaseTransport(owner);
      useComparisonStore.getState().stop();
    });
  }, []);

  // Commands from the store.
  useEffect(() => {
    const controller = controllerRef.current;
    const owner = ownerRef.current;
    if (!controller || !owner || !lastAction || lastAction.id === handled.current) return;
    handled.current = lastAction.id;
    switch (lastAction.type) {
      case "play":
        start(0);
        break;
      case "resume":
        if (controller.state === "paused") {
          claimTransport(owner);
          void controller.resume();
        } else {
          // After moving the position slider while stopped: start from there.
          start(useComparisonStore.getState().currentIndex);
        }
        break;
      case "pause":
        controller.pause();
        break;
      case "stop":
        controller.stop();
        releaseTransport(owner);
        break;
      case "interrupt":
      case "finish":
        break;
    }
  }, [lastAction, start]);

  // A new comparison (regions, indicator, period, mode or data) ends the old
  // playback, paused or not: it would no longer match what is shown.
  const previousScore = useRef(score);
  useEffect(() => {
    if (previousScore.current === score) return;
    previousScore.current = score;
    const controller = controllerRef.current;
    if (controller && controller.state !== "idle") {
      controller.stop();
      if (ownerRef.current) releaseTransport(ownerRef.current);
      useComparisonStore.getState().resetPlayback();
    }
  }, [score]);

  useEffect(() => controllerRef.current?.setSpeed(speed), [speed]);
  useEffect(() => controllerRef.current?.setVolume(volume), [volume]);

  /** Moves to a month; the sound follows at once when playing or paused. */
  const seek = useCallback((index: number) => {
    useComparisonStore.getState().setCurrentIndex(index);
    controllerRef.current?.seek(index);
  }, []);

  return { engineStatus, error, warning, seek };
}
