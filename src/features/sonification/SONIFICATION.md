# Image sonification — design and mappings

The image sonification turns an image into a short (≈29 s at 1×) composition
made of two independent layers:

- **Scientific layer**: one note per image slice, with values that can be audited.
- **Cinematic layer**: slow, consonant harmony underneath. It sets the mood only.

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

| Module                           | File                                                 | Responsibility                                                  |
| -------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| ImageAnalyzer                    | `engine/imageAnalyzer.ts`                            | Downscale (≤ 480 px), cut into 96 slices, compute raw features  |
| DataMapper                       | `engine/dataMapper.ts`                               | The only place data becomes sound parameters                    |
| ScientificLayer / CinematicLayer | `engine/layers.ts`                                   | Turn mapped parameters into notes                               |
| InstrumentManager                | `engine/instrumentManager.ts`                        | Tone.js nodes, buses, samples, fallback, disposal               |
| SynchronizationManager           | `engine/synchronization.ts`                          | Step index from the Transport clock, UI updates via `Tone.Draw` |
| PlaybackController               | `engine/playbackController.ts`                       | Play / pause / resume / stop, speed, volume, layer toggles      |
| UI                               | `components/ImageAnalyzer.tsx` (`ImageSonification`) | Controls, scan cursor, data strip, live readout                 |

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
  cinematic tail ring out.
- **Cleanup on unmount:** `PlaybackController.dispose()` stops the Transport,
  clears its events, cancels Draw callbacks, and disposes every node and sample
  buffer. Object URLs of uploaded images are revoked.

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
