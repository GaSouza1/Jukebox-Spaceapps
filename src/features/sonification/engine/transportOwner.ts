/**
 * TransportOwner — Tone.Transport is a single global clock, and the image
 * sonification and the region comparison both play on it. Only one of them
 * may own it: claiming it stops the previous owner, so the two can never
 * sound at the same time.
 *
 * Owners are the experiences (the image sequence, the comparison player),
 * not the PlaybackControllers, so the whole experience stops (narration
 * included) and its UI is told why.
 */
export interface TransportOwner {
  readonly name: string;
  /** Another experience took the Transport: stop everything now. */
  onTransportLost(): void;
}

let current: TransportOwner | null = null;

export function claimTransport(owner: TransportOwner) {
  const previous = current;
  // Set first, so a previous owner that releases while stopping cannot clear the new one.
  current = owner;
  if (previous && previous !== owner) previous.onTransportLost();
}

export function releaseTransport(owner: TransportOwner) {
  if (current === owner) current = null;
}

export function transportOwner(): TransportOwner | null {
  return current;
}
