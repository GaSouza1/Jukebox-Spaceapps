# Image sonification — design and mappings

The image sonification plays a **collection** of images, one after the other.
Each image becomes a short (≈29 s at 1×) composition, preceded by a spoken
description. There are three independent layers:

- **Scientific layer**: one note per image slice, with values that can be audited.
- **Cinematic layer**: slow, consonant harmony underneath. It sets the mood only.
- **Narration layer**: a spoken description of the image, played before its
  composition. It uses the browser's speech synthesis and carries no data notes.

## Interpretation status

No legend, colour scale or calibration metadata is available for the images
used here, including the demo image `src/assets/refence.png`. The engine
therefore runs as **exploratory visual sonification**:

- It sonifies _visual_ properties: luminance, contrast, hue family and position.
- Colours are **never** read as CO₂, temperature or any other physical quantity.
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
| ScientificLayer / CinematicLayer | `engine/layers.ts`                                                                         | Turn mapped parameters into notes                                                           |
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

- **Chords:** one chord per 16 slices.
  - The chord is chosen from Am, Em, Dm, F, C, G (darkest to brightest) by the
    section's _relative_ mean luma.
  - The progression stays inside one key and uses close voicings that share
    tones.
- **Instruments:**
  - Pad: `PolySynth`, fat triangle, 2.2 s attack, 3.5 s release.
  - Strings: fat sawtooth through a low-pass filter.
  - Sampled piano: a soft low root at each section start and the fifth halfway
    through the section.
- **Variation:** the section's mean slice-to-slice variation opens the strings
  filter (450 → 1550 Hz) and raises their level. Calm data gives a bare pad;
  changing data brings the strings in.

### How the cinematic layer avoids masking the scientific layer

- **Register:** all pad and string notes stay below C4, the lowest scientific
  pitch. The cinematic piano stays in octaves 2–3.
- **Level:** the cinematic bus runs 10 dB below the scientific bus.
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
   demo image. Spoken as "Description written by the project team: …".
2. **Uploader's description:** typed in the optional "Your description of this
   image" field. Spoken as "Description provided by the person who added this
   image. The app has not verified it." followed by the text.
3. **No description:** the narration says the image has no validated
   description, explains that brightness, contrast, colour families and
   horizontal distribution are converted into sound, and that the analysis does
   not identify objects or geographical features.

The script always starts with the image's position and name ("Image 2 of 3:
photo.png"). Then it gives the **measured** features of that image, computed by
`summarizeAnalysis` from the analysis:

- mean brightness;
- the share of warm, cool and neutral pixels;
- the brightest and darkest third along the reading direction;
- the contrast level and where it is highest;
- whether bright areas lean left, right or sit near the centre.

When a description was given, the script adds that the sound comes from the
measurements, not from the description.

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
- **Voices depend on the browser and system:** quality, language coverage and
  timing vary. Some engines report no voices at all; narration is then skipped
  with a warning.
- **Narration settings apply per sentence:** a volume or voice-speed change takes
  effect at the next sentence.
- **Long narration:** with the team description, the demo narration lasts about
  40 s at 1.5× voice speed. Narration can be turned off or sped up.
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
- `collection/imageCollection.test.ts`: move, remove (the demo is protected),
  file filtering.

`scripts/test-hooks.mjs` resolves extensionless imports and the `@/` alias, so
no test dependency is needed. `pnpm typecheck` runs TypeScript.
