# Image sonification — design and mappings

The image sonification plays a **collection** of images, one after the other.
Each image becomes a short (≈29 s at 1×) composition, preceded by a spoken
description. There are three independent layers:

- **Scientific layer**: one note per image slice, with values that can be audited.
- **Cinematic layer**: an evolving background composition underneath. It sets
  the mood only and receives no data from the image.
- **Narration layer**: a spoken description of the image, played before its
  composition. It uses the browser's speech synthesis and carries no data notes.

## Interpretation status

No legend, colour scale or calibration metadata is available for the images
used here, including the demo image `src/assets/refence.png`. The engine
therefore runs as **exploratory visual sonification**:

- It sonifies _visual_ properties: luminance, contrast, hue family and position.
- Colours are **never** read as CO₂ or any other physical quantity, and the sound
  never depends on a temperature reading.
- The text profile and the narration add a **visual temperature** (the narration only names regions of high and low temperature), following the
  usual convention of thermal maps: warm or strong colours read as high
  temperature, cool or weak colours as low. It is a description of colour and
  brightness, not a measured temperature, and the text says so.
- The UI says this explicitly above the image.

If a calibrated colour scale becomes available, the right place to use it is a
new step between `imageAnalyzer` and `dataMapper`. That step would map pixel
colour to the physical value through the legend, and `mapScientific` would then
sonify that value instead of luma.

## Pipeline

| Module                           | File                                                                                       | Responsibility                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| ImageAnalyzer                    | `engine/imageAnalyzer.ts`                                                                  | Downscale (≤ 480 px), cut into 96 slices, compute raw features                              |
| DataMapper                       | `engine/dataMapper.ts`                                                                     | The only place data becomes sound parameters                                                |
| ScientificLayer / CinematicLayer | `engine/layers.ts`                                                                         | Turn mapped parameters into notes; play the cinematic plan on the Transport clock           |
| CinematicComposer                | `engine/cinematicComposer.ts`                                                              | Plans the cinematic music from the duration and seeds only (no image data)                  |
| InstrumentManager                | `engine/instrumentManager.ts`                                                              | Tone.js nodes, buses, samples, fallback, disposal                                           |
| SynchronizationManager           | `engine/synchronization.ts`                                                                | Step index from the Transport clock, UI updates via `Tone.Draw`                             |
| PlaybackController               | `engine/playbackController.ts`                                                             | Play / pause / resume / stop, speed, volume, layer toggles                                  |
| SequencePlayer                   | `engine/sequencePlayer.ts`                                                                 | Runs the collection: narration, then composition, per image; loop, next / previous, removal |
| NarrationLayer                   | `engine/narrationLayer.ts`                                                                 | Web Speech API: voice choice, sentence-by-sentence speech, pause / resume / cancel          |
| Text                             | `describeImage.ts`                                                                         | Text profile, whole-image summary and narration script                                      |
| Narration language               | `engine/narrationLanguage.ts`                                                              | Reads each sentence from the page and resolves its language (follows page translation)      |
| ImageCollection                  | `collection/imageCollection.ts`, `collection/useImageCollection.ts`                        | Ordered images, object URLs, one analysis per image and direction                           |
| Engine wiring                    | `hooks/useImageSequence.ts`                                                                | Creates and disposes the controller, narrator and sequence                                  |
| UI                               | `components/ImageAnalyzer.tsx` (`ImageSonification`), `components/ImageCollectionList.tsx` | Controls, collection strip, scan cursor, data strip, live readout                           |

## Feature extraction (per slice)

Slices follow the reading direction:

- **North → South** (default): rows, top to bottom.
- **West → East**: columns, left to right.

North → south is the default because the demo image varies mostly with
latitude. Averaging columns would flatten that structure.

| Feature              | Definition                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `luma`               | Mean Rec. 709 luma Y′ = 0.2126 R′ + 0.7152 G′ + 0.0722 B′, computed on gamma-encoded values in 0..1 |
| `contrast`           | Standard deviation of Y′ inside the slice                                                           |
| `saturation`         | Mean HSV chroma (max − min of R′G′B′)                                                               |
| `hueFamily`          | Majority class per pixel: chroma < 0.15 → neutral; hue in [300°, 90°) → warm; otherwise → cool      |
| `horizontalCentroid` | Luma-weighted mean x position, 0 (left) … 1 (right)                                                 |
| `variation`          | \|Y′ᵢ − Y′ᵢ₋₁\|                                                                                     |

The raw values are kept unchanged in `ScientificEvent.source` and shown in the
UI readout next to the sound parameter derived from each one.

## Scientific mappings (unquantised)

| Data                | Sound         | Transformation                                                 | Why                                                                                                                                                  |
| ------------------- | ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Luma Y′             | Frequency     | f = 261.63 Hz × 2^(2·Y′) (C4 → C6)                             | Linear in octaves, so equal luma differences give equal perceived pitch intervals. Uses absolute luma, so images can be compared. No scale snapping. |
| Contrast            | Note velocity | 0.3 + 0.6 × contrast / max contrast in the image               | Linear, so proportions within the image are preserved. The 0.3 floor keeps flat slices audible.                                                      |
| Hue family          | Timbre        | warm → sampled piano, cool → soft FM bell, neutral → sine tone | Encodes the visual colour category only. It is a category, so a categorical sound property (timbre) is used.                                         |
| Horizontal centroid | Stereo pan    | (x − 0.5) × 1.2 → −0.6 … +0.6                                  | Pan always means horizontal position in the image. The ±0.6 limit keeps spatialisation moderate.                                                     |
| Slice order         | Time          | 1 slice = 1 eighth note (0.3 s at 1×)                          | Reading position along the chosen axis.                                                                                                              |

Each note lasts 90 % of a step, so consecutive data events never blur together.
Polyphony is capped at 12 per instrument. That covers the 2× worst case, so no
data note is dropped.

## Cinematic layer (mood only)

### What reaches the cinematic layer from the image

Exactly **one number per image**: `energy` (0..1), from
`cinematicProfile(analysis)` (`engine/cinematicProfile.ts`). It picks the
**mood** of the music: an artistic choice of atmosphere, never a reading of
the data. A bright image does not mean warmer, drier or anything physical,
and the UI says so ("Cinematic mood for this image… not a measurement of
anything physical" in the text profile; a row in the mappings table).

- **Inputs:** global features only, never colour alone. Weights: mean luma
  0.55, soft share of bright slices 0.30 (each slice counts gradually between
  luma 0.35 and 0.65, so no hard cut makes the score jump), mean in-slice
  contrast 0.15 (normalised by 0.25).
- **Thresholds** (`PROFILE_THRESHOLDS`, configurable): score ≤ 0.10 is fully
  contemplative and score ≥ 0.80 fully energetic. In between, a smoothstep
  blend: about 20 % of the brightness range is labelled "blended" (energy
  0.15–0.85), with no jump.
- **What the composer gets:** `composeCinematic` receives the duration, the
  seeds and `energy`. It never sees the analysis, and no chord or note
  depends on slice values. The Scientific layer (mapping, instruments, timing)
  is untouched; `PlaybackController` reads the profile from the same analysis
  but changes nothing in the scientific events.

_History:_

- **First version:** chords chosen by section brightness and strings by
  brightness variation (a coarse second data channel).
- **Previous round:** no image input at all. Every image then sounded alike,
  because tempo, register and timbre were constant and only the chord order
  changed.

### Two profiles

All parameters are interpolated continuously by `energy`
(`profileParameters`), so a mid image is a real blend:

|                 | Contemplative (0)                       | Energetic (1)                                    |
| --------------- | --------------------------------------- | ------------------------------------------------ |
| Harmonic rhythm | 24–32 steps per chord                   | 6–10 steps per chord                             |
| Motion          | sustained notes, ~1 low piano per chord | arpeggio pulse (≈55 % of steps), sixteenth pairs |
| Register        | pad A1–E3, low drone, bass E1–D♯2       | pad C3–B3, light bass, glints D6–A6              |
| Harmony         | minor chords: i, iv, v; minor 7ths      | major chords: III, VI, VII; add9 colours         |
| Strings         | slow attack, sustained                  | quick attack, re-articulated every 4–8 steps     |
| Timbre          | bus low-pass ≈ 800 Hz, pad attack 3.2 s | bus low-pass ≈ 4.2 kHz, pad attack 0.5 s         |
| Space           | reverb send 0.75                        | reverb send 0.35                                 |

- **Tempo:** the `Transport` is the data clock (one slice per eighth note),
  so changing its BPM would change the scientific timing. "Tempo" here is
  the density of events on that clock: chord rate, pulse, sixteenth notes.
- **Register:** the scientific band (C4–C6, MIDI 60–84) stays free in both
  profiles. Low voices end at B3; the energetic "high" notes are the
  **glints**, a short triangle pluck (a timbre unlike the scientific piano,
  bell and sine) at D6–A6, above the data.
- **Within a profile, the music still evolves:** the five phases, the
  intensity curve, the non-repeating progression, smooth voice leading and
  textures entering and leaving all still apply. The unit tests check them in
  both profiles.

### Moving from one image to the next

- **Key:** stays for the whole session (`identitySeed`).
- **Energy glide:** a new image starts from the previous image's energy and
  glides to its own over the first 25 % of the image (smoothstep). Similar
  images therefore keep a steady profile, with no artificial change.
- **Harmony continues:** the first chord moves on from the previous image's
  last chord and voicing (`continuationOf`), rather than restarting on the
  tonic.
- **Timbre glides:** at each chord, the bus filter, the reverb send and the
  strings filter ramp to the chord's values over the chord. The audio nodes
  keep their state between images, so the change is gradual.
- **Measured** in Chrome, dark → bright: the spectral centroid stays near the
  dark value for the first seconds of the new image, then rises (≈ 100 Hz →
  ≈ 230 Hz). There is no level spike at the change.

### Procedural variation

- **Seeded:** a seeded PRNG (mulberry32) makes every choice. Same seeds and
  duration give the same plan.
- **Session seed:** `identitySeed` is drawn when Play starts a sequence from
  idle (`PlaybackController.newSession()`, called by `SequencePlayer.play`).
  Stop then Play gives a new identity.
- **Profile:** `energy` comes from the image, so the same image always gets
  the same mood; seeds vary the material inside that mood.
- **Per image:** `movement` counts the images composed in the session. Each
  image of a sequence or loop gets a different progression, texture plan and
  rhythm in the same key.
- **Pause / resume:** the plan is computed once per image, before it plays, and
  driven by the Transport step index. Pause and resume keep the plan and the
  position. On resume, the sustained textures of the chord in progress are
  re-voiced for its remaining steps.

### Timing

Everything is expressed in steps and played from the existing
`Transport.scheduleRepeat` tick (`CinematicLayer.play`). There is no second
clock and nothing is scheduled ahead, so speed changes, pause, stop, next and
loop need no extra cleanup. Durations are converted with the tempo at the
moment they are played.

### How the cinematic layer avoids masking the scientific layer

- **Register:** every cinematic note (pad, strings, drone, bass, figures) stays
  at or below B3, under C4, the lowest scientific pitch. A unit test checks it.
- **Level:** the cinematic bus runs 10 dB below the scientific bus, and the
  dynamics stage adds up to 9 dB of reduction. Measured in Chrome: the
  cinematic layer alone averages about 15 dB below the full mix.
- **Filtering:** the cinematic bus is low-passed at 1.8 kHz. The scientific bus
  passes up to 5 kHz.
- **Reverb:** the shared reverb (6 s) gets a 0.55 send from the cinematic bus
  and only 0.15 from the scientific bus, so data notes stay dry and readable.
- **Separate parameters:** the cinematic layer never changes any scientific
  pitch, timing, velocity or pan.
- **Toggles:** each layer can be muted independently in the UI to check by ear
  that the data is unchanged.

## Collection and sequence

### Collection

- **Initial state:** the demo image (`src/assets/refence.png`) is the first and
  only item, and it is selected. It can be moved but not removed, so the
  collection is never empty.
- **Adding:** the file input accepts several files (`accept="image/*"`, the same
  formats as before). Files whose MIME type is not `image/*` are rejected and
  named in an alert. Each accepted file gets one object URL
  (`URL.createObjectURL`). Two files with the same name get distinct names
  (`photo.png`, `photo.png (2)`), so screen readers can tell them apart.
- **Analysis:** every image is analysed from its own off-screen `<img>`, so the
  sequence can play images that are not on screen. Results are cached per image
  and reading direction. A file that cannot be decoded is marked "could not be
  read", stays in the list so it can be removed, and is skipped by the sequence.
- **Order:** "Move earlier" / "Move later" buttons on each item. Drag and drop is
  not used. After a move, focus stays on the moved item (the same button, or the
  other one when the item reaches an end).
- **Removal:** revokes the object URL immediately and drops the image's cached
  analyses. A late analysis result for a removed image is discarded. Focus moves
  to the item that took its place.
- **Unmount:** every remaining object URL is revoked.
- **Selection vs playback:** selecting an item only changes the image shown. It
  never starts, restarts or stops playback. When the sequence starts a new
  image, the view follows it. While another image is shown, the scan cursor,
  slice readout and progress bar stay idle.

### Sequence

```text
Play (starts at the selected image)
  └─ for each image, in collection order
       ├─ Narration   (if on and available)
       ├─ Composition (Scientific + Cinematic, if at least one is on)
       └─ 1.2 s gap, then the next image
            └─ after the last one: loop on → first image; loop off → finished
```

- **Per image:** each image goes through the existing engine unchanged
  (`PlaybackController.play(analysis)`): same 96 slices, same duration, same
  synchronisation.
- **Gap:** a 1.2 s gap between images lets the cinematic tail fade before the
  next narration starts.
- **Order changes:** the next image is read from the current collection order
  when the current one ends, so a reorder during playback is respected.
- **Previous / Next:** jump at once and keep the play / pause state. Without
  loop, they are disabled at the first / last image. With loop they wrap.
- **Loop:** a toggle button with `aria-pressed`. It repeats the whole
  collection, not single notes or slices. With one image, that image repeats.
  It can be changed at any time; it takes effect at the next image boundary.
- **Removing the playing image:** its sound and speech stop at once, and playback
  moves on to the image that took its place (keeping a pause). If it was the
  last image and loop is off, playback ends.
- **Stale callbacks:** every run of an image carries a token. Stop, Next,
  Previous and removal bump it, so a late narration end, composition end or
  timer from an earlier run is ignored and can never start a removed image.
- **Unplayable collections:** if every image in a row produced no sound (for
  example all failed to load and narration is off), the loop ends with a
  warning instead of spinning.

## Narration layer

### Sources of the description

The narration script (`narrationScript` in `describeImage.ts`) uses, in order:

1. **Team-written description:** the human-written, checked description of the
   demo image. Spoken as "Team description: …".
2. **Uploader's description:** typed in the optional "Your description of this
   image" field. Spoken as "Description by the uploader, not verified: …".
3. **No description:** "No description is available. The app does not identify
   objects or places."

The script is deliberately short (at most six lines). It always starts with the
image's position and name ("Image 2 of 3: photo.png"), then the description (if
any), then only the **regions of high and low temperature**, then the reading
direction. It never names colours, brightness or contrast:

> High temperature: top third. Low temperature: bottom third. Estimated from the
> image, not measured.

The temperature and direction sentences come from `describeGenerated`, which the
narration speaks and the image caption shows right after the description, in the
same paragraph, so the spoken and the written text always match.

Regions are the thirds along the reading direction. A third at or above 0.65 is
high and one below 0.35 is low (`HIGH_HEAT`, `LOW_HEAT`); thirds in between are
not mentioned. With three high (or low) thirds the text says "the whole image",
and when none qualifies, "No region stands out as high or low temperature."

**Visual temperature** (`visualHeat` in `describeImage.ts`). Score from 0
(coldest-looking) to 1 (hottest-looking), the mean of two equally weighted
readings, so that both push the same way:

- _hue_: the share of warm pixels among the coloured ones (warm → high, cool →
  low; 0.5 when every pixel is neutral);
- _strength_: the mean of colour vividness (mean chroma, saturating at 0.5) and
  brightness (strong → high, weak → low).

The text profile (not the narration) also gives a band for each of its six
parts: below 0.2 low, 0.2–0.4 moderately low, 0.4–0.6 intermediate, 0.6–0.8
moderately high, 0.8 and above high. The score is computed from the same
measurements as the sound but **never feeds back into it**. Because the images
have no colour scale, the narration says it is estimated, not measured. A vivid
blue lands in the middle on purpose: cool pulls it down, strong pulls it up.

**Scientific constraint:** the engine does not recognise objects. Nothing in the
generated text names a forest, city, river, ocean, fire or any other feature.
Such words can only come from a person's description, and that text is always
attributed to whoever wrote it. A unit test checks the generated text against a
list of such words.

### Speech

- **API:** Web Speech API (`speechSynthesis`, `SpeechSynthesisUtterance`). It is
  native, so no dependency is added.
- **Voice:** chosen per sentence from the language of that sentence (see
  "Page translation" below). Preference order: a voice for the exact language
  and region, then the same language in another region (the browser's default
  voice first, then a local one). The list is refreshed on `voiceschanged`.
  Without a voice for the language, `utterance.lang` is still set and the
  browser picks one. The status line under the layers says which language and
  voice are used, and where the language came from.
- **Manual voice:** the "Narration voice" select offers "Automatic (follows the
  page language)" and every voice installed in the browser. A chosen voice is
  used for every sentence, whatever the language; Automatic restores the
  per-sentence choice. Changes apply from the next sentence.
- **One utterance per sentence:** pause cancels the current sentence and resume
  speaks it again from its start. `speechSynthesis.pause()` is not used, because
  some browsers ignore it, and Chrome cuts long utterances.
- **Volume and rate:** the main Volume slider also sets the narration volume.
  "Narration voice speed" (0.8×–1.5×) sets the speech rate. The playback Speed
  only affects the composition. A change applies from the next sentence: an
  utterance cannot be changed once spoken.
- **Failure handling:** without speech synthesis, the Narration checkbox and the
  voice speed are disabled and the reason is shown. Playback still works. A
  speech error, or an engine that never answers (watchdog), shows a warning, and
  the sequence goes on with the composition.
- **User action:** narration only runs from the Play button, never on load.
- **Toggle:** turning Narration off while it speaks skips the rest of the
  sentence; the composition of the same image follows. Turning it on applies
  from the next image.
- **Overlap:** narration and composition never play at the same time for an
  image.

### Page translation (e.g. Chrome's "Translate this page")

Browser translation only rewrites the DOM: it replaces text nodes with
translated `<font>` elements. Strings kept in JavaScript, like the narration
script, are not translated. So:

- **Rendered source:** the script of **every** image in the collection is
  rendered in a hidden `.narration-source` block (`data-narration-for` = image
  id, `aria-hidden`, clipped like `.sr-only` so it stays in the layout and is
  translated). The visible "Narration script for this image" stays the readable
  copy.
- **Read before each sentence:** `resolveRenderedSentence`
  (`engine/narrationLanguage.ts`) reads the sentence from that block right
  before it is spoken. The voice therefore says what the page shows, in the
  page's current language. A translation switched on or off during a narration
  applies from the next sentence; the narration is not restarted.
- **Language of each sentence**, most reliable signal first:
  1. _Original:_ the rendered text equals the script, so it is English. This
     holds even if `<html lang>` changed (Chrome may not have translated that
     node yet).
  2. _Page:_ the text differs and `<html lang>` no longer says English. Chrome
     usually sets it to the target language, but this is not guaranteed and is
     not relied on alone.
  3. _Detector:_ Chrome's built-in `LanguageDetector` API, only when it is
     already `"available"` on the device (it never triggers a model download)
     and its confidence is at least 0.7.
  4. _Browser:_ none of the above. Translation targets the browser language by
     default, so `navigator.languages[0]` is used. The status line says this is
     an assumption and suggests choosing a voice.

No browser exposes "the language this page was translated into", so steps 2–4
are best effort. When they are wrong, the manual voice is the fallback.

The same translation concern shaped the collection list: an element whose text
changes is re-keyed (`StableText`), and React inserts the new element before
its next sibling. That sibling must be an element, never a bare text node:
translation replaces text nodes, and inserting before a replaced (detached) one
throws `NotFoundError: Failed to execute 'insertBefore'`. That is what broke
reordering on a translated page. File names are wrapped in
`<span translate="no">`.

### Accessibility

- **Separate from screen readers:** the Narration layer is the app's own voice,
  independent of the screen reader. Its text is never sent to a live region, so
  the screen reader does not read the same text at the same time.
- **Live region:** it only gets short messages:
  - the image now playing ("Now playing image 2 of 3, photo.png.");
  - pause, resume, stop and finish;
  - collection changes.
- **Three kinds of text, kept apart:**
  - _Image description:_ the figure caption (team, uploader or none).
  - _Sound transformation:_ the hidden paragraph that Play references with
    `aria-describedby`, read before any sound. It now also gives the collection
    size, the start image, the loop state and whether narration comes first.
  - _Narration script:_ a "Narration script for this image" disclosure with the
    exact sentences that will be spoken.
- **Onboarding:** the Screen Reader First onboarding does not use this voice; it
  still relies only on the user's screen reader.

## Shared engine: scores (image and region comparison)

Since 15/11/2026 the engine plays a neutral **score**, so the image and the
region comparison use the same PlaybackController, InstrumentManager,
ScientificLayer and Transport. There is no second audio engine.

```text
ImageAnalysis ── imageToScore() ──────┐
                                      ├─► SonificationScore ─► PlaybackController.playScore(score, fromIndex)
ComparisonData ─ comparisonToScore() ─┘        └─ ScientificLayer: one note per voice per step
                                                    └─ InstrumentManager: one channel (panner) per voice
```

- **Contract (`engine/score.ts`):** `stepCount`, `stepSeconds` (seconds per
  step at 1×), `voices` (id, timbre, pan, one note or `null` per step) and
  `cinematic` (`{ energy }` or `null`). A note has a continuous frequency, a
  velocity and, optionally, its own pan and timbre. `null` is a silence.
- **Image (`engine/imageScore.ts`):** one voice, `"main"`, whose pan and
  timbre change per note, exactly as `mapAnalysis` produces them; 0.3 s per
  step; cinematic energy from `cinematicProfile`. `play(analysis)` still
  exists and delegates to `playScore`, so SequencePlayer is unchanged. A unit
  test checks that the score equals `mapAnalysis` note for note.
- **Comparison (`engine/comparisonScore.ts`):** two voices, `"a"` (soft sine,
  `glass`, pan −0.7) and `"b"` (triangle, pan +0.7), one step per month,
  0.5 s per step, no cinematic layer. Pitch uses the same
  `normToFrequency` as the image (C4 → C6, linear in octaves, unquantised) on
  a domain shared by both regions: the lowest value present in either region
  is C4, the highest C6. Velocity is constant (0.7): loudness carries no data.
  A missing month is `null` (silence). Modes "a" and "b" silence the other
  voice and centre the one heard; the scale does not change with the mode.
  If every value is (almost) equal, all notes play at the middle of the range.
- **Tempo:** `bpm = 60 / (2 × stepSeconds) × speed`; the image keeps 100 BPM.
- **Channels (`InstrumentManager.prepareChannel`):** each voice has its own
  panner feeding the existing scientific filter, bus, reverb send, master and
  limiter. Channel `"main"` is the original `sciPanner` with the original
  instruments. Instruments are created before playback, never in the Transport
  callback. A `triangle` timbre was added (−7 dB, it sounds louder than the
  sine at the same level).
- **Samples:** the comparison creates its controller with
  `{ loadSamples: false }`; it only uses synthesised voices, so the 1.2 MB of
  piano samples are not downloaded.
- **Seek (`PlaybackController.seek`):** while playing or paused, releases the
  voices, cancels pending Draw callbacks and sets `Transport.ticks` to the
  step; the UI is told at once. From idle, `playScore(score, fromIndex)`
  starts at a step.
- **One owner of the Transport (`engine/transportOwner.ts`):** the image
  sequence and the comparison player claim the Transport when they start;
  claiming it stops the previous owner (the whole experience, narration
  included), and each player announces why it stopped. `stop()` on an idle
  controller no longer touches the Transport, so it cannot stop the other
  experience.
- **Comparison wiring (`hooks/useComparisonPlayback.ts`):** the comparison
  store stays the source of commands (`lastAction`: play, pause, resume, stop),
  the controller the source of time: `onStep` (via Tone.Draw) writes the
  current month to the store, which moves the chart's reference line, the
  table row, the readout and the slider. No React timer drives playback.

## Playback and synchronisation

- **Start:** `Tone.start()` runs on the Play click. Instruments are built and
  samples loaded on first play.
- **Timing:** a single `Transport.scheduleRepeat` at "8n". The step index comes
  from `Transport.getTicksAtTime(time)`, so pause/resume and tempo changes can't
  desynchronise audio and UI.
- **UI updates:** cursor, data strip, progress and readout are updated through
  `Tone.Draw`, so they change when the sound is heard.
- **Speed:** ramps `Transport.bpm` (base 100 BPM; 0.5×–2×).
- **Volume:** a master `Tone.Volume` followed by a −1 dB `Limiter`.
- **Pause:** releases all voices (smooth envelope release). On resume, the
  current chord is voiced again for the rest of its section.
- **Stop and natural end:** reset the Transport. A natural end lets the
  cinematic tail ring out, then fires `onEnded`. The sequence uses it to move
  on to the next image.
- **End detection:** the natural end is detected with a timer, not `Tone.Draw`.
  Draw runs on animation frames, which pause in a background tab, and a
  sequence must keep moving there. Cursor and readout updates still use Draw.
- **Loading status:** "Loading" is shown only when the samples have not been
  loaded yet. Instruments start loading on the Play click, while the first
  narration is spoken.
- **Cleanup on unmount:** `SequencePlayer.dispose()` stops everything, then
  `NarrationLayer.dispose()` cancels speech. `PlaybackController.dispose()`
  stops the Transport, clears its events, cancels Draw callbacks, and disposes
  every node and sample buffer. Object URLs of uploaded images are revoked.

## Samples

`public/samples/piano/`:

- **Content:** 17 notes, C2–C6, one every minor third, from the Salamander Grand
  Piano V3.
- **License:** CC-BY 3.0, Alexander Holm.
- **Repitching:** `Tone.Sampler` repitches continuously, so unquantised
  frequencies keep their exact value.
- **Fallback:** if loading fails or exceeds 15 s, a triangle `PolySynth` takes
  over and the UI shows a warning.

## Known limitations

- **Microtonal pitches:** the scientific pitch is intentionally unquantised, so
  it can fall between the notes of the cinematic chords. The register
  separation and level gap keep the beating mild, but it is audible on
  sustained passages.
- **Visual features only:** luminance and hue family describe the image, not the
  phenomenon behind it. Different colour maps of the same data will sound
  different.
- **Coarse resolution:** 96 slices average the cross-axis. Features smaller than
  about 1 % of the image along the reading axis are smoothed away.
- **Synthesised strings:** there are no string samples. Only the
  piano uses recorded samples.
- **Cinematic arc per image:** each image is one composition with its own arc
  (≈29 s at 1×). Across a sequence the key stays and the material changes, but
  every image starts again from a quiet introduction.
- **Profile measured, not yet heard:** the two profiles were compared on the
  Chrome audio output (attacks per second, spectral centroid, low-frequency
  share; see Tests) and recorded, but the comparison by ear is pending.
- **Energetic is quieter:** the energetic profile averages about 5 dB below
  the contemplative one (lighter pad, little bass); the arpeggio and glints
  carry it. Worth checking by ear.
- **Brightness is not meaning:** the mood follows overall brightness, so two
  very different scenes with similar brightness get similar moods. That is
  acceptable for an artistic choice; it must never be read as information.
- **Musical quality is measured, not yet heard:** the structure is unit-tested
  and the dynamics were measured (RMS per phase), but nobody has listened to it
  yet.
- **Voices depend on the browser and system:** quality, language coverage and
  timing vary. Some engines report no voices at all; narration is then skipped
  with a warning.
- **Narration settings apply per sentence:** a volume or voice-speed change takes
  effect at the next sentence.
- **Narration length:** the script is short by design. Narration can be turned
  off or sped up.
- **Silent composition when both music layers are muted mid-image:** the
  Transport keeps running so the data timing is unchanged. Muting both before an
  image starts skips its composition.
- **Translation is best effort:** see "Page translation". The language of a
  translated page is inferred (page `lang`, browser detector, browser language),
  never read from a browser API, because none exists. The text the uploader
  typed is treated like the rest: if the page is not translated, it is spoken
  with the automatic (English) voice even if it was written in another
  language; choose a voice manually in that case.
- **Labels of icon buttons:** the `aria-label` of the move / remove buttons is
  set in JavaScript; whether a page translation translates it depends on the
  browser.

## Tests

`pnpm test` runs the unit tests with Node's built-in test runner:

- `engine/sequencePlayer.test.ts`: order, loop (including a single image), stop
  during the loop, pause / resume in each phase, next / previous, removal of the
  playing image, reorder during playback, each layer combination, failures.
- `engine/narrationLanguage.test.ts`: language resolution (original, page
  `lang`, detector, browser fallback).
- `engine/narrationLayer.test.ts`: voice choice by language, per-sentence
  re-resolution (translation mid-narration), manual voice, sentence order,
  pause / resume,
  cancel, speech errors, missing speech synthesis.
- `describeImage.test.ts`: the measured summary, the source order of the
  description, and the absence of semantic claims.
- `engine/cinematicProfile.test.ts`: dark → contemplative, bright →
  energetic, blend for mid images, monotonic and continuous (no jump), uses
  the distribution and not only the mean, configurable thresholds.
- `engine/cinematicComposer.test.ts`: contrast between the profiles (chord
  length, event density, sixteenths, register, drone and glints, major/minor
  share, filter, attack, reverb), mid image between the two, parameters
  continuous in energy, energy glide and harmonic continuation between
  images, and the earlier properties in both profiles: determinism, variation between sessions
  and images, one key per session, register below C4, tonic start and end,
  smooth voice leading, no looping 4-chord pattern, phases proportional to the
  duration, gradual intensity, density, string entries and exits, varied piano
  rhythm, and that the plan has no image input.
- `collection/imageCollection.test.ts`: move, remove (the demo is protected),
  file filtering.
- `engine/score.test.ts`: `normToFrequency` (C4–C6, equal ratios for equal
  steps, clamping, same function as the image), tempo, step clamping, and
  `imageToScore` equal to `mapAnalysis` note for note (frequency, velocity,
  pan, timbre).
- `engine/comparisonScore.test.ts`: shared domain, C4/C6 bounds, equal
  intervals, flat comparisons, voices and their identities, silence for
  missing months, constant velocity, modes A, B and both.
- `engine/transportOwner.test.ts`: the comparison stops the image and the
  other way round, re-claiming does not stop oneself, release rules.
- `describeSonification.test.ts`: the description quotes the hertz and values
  the score plays, explains silences, names the real source.

`scripts/test-hooks.mjs` resolves extensionless imports and the `@/` alias, so
no test dependency is needed. `pnpm typecheck` runs TypeScript.
