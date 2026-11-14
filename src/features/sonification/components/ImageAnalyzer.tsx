
import { useState } from "react";
import * as Tone from "tone";

interface SoundFrame {
  pitch: number;
  brightness: number;
  saturation: number;
  contrast: number;
  warm: boolean;
}

export function ImageSonification() {
  const [frames, setFrames] = useState<SoundFrame[]>([]);
  const [image, setImage] = useState("");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);

  const analyzeImage = (
    event: React.SyntheticEvent<HTMLImageElement>
  ) => {
    const img = event.currentTarget;
    const canvas = document.createElement("canvas");

    const width = 160;
    const height = 66;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, width, height);

    const pixels = ctx.getImageData(
      0, 0, width, height
    ).data;

    const result: SoundFrame[] = [];

    for (let x = 0; x < width; x++) {
      let brightness = 0;
      let saturation = 0;
      let red = 0;
      let blue = 0;
      const luminances: number[] = [];

      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4;

        const r = pixels[i] / 255;
        const g = pixels[i + 1] / 255;
        const b = pixels[i + 2] / 255;

        const lum =
          0.2126 * r +
          0.7152 * g +
          0.0722 * b;

        brightness += lum;
        saturation += Math.max(r, g, b) -
          Math.min(r, g, b);

        red += r;
        blue += b;
        luminances.push(lum);
      }

      brightness /= height;
      saturation /= height;
      red /= height;
      blue /= height;

      const mean = brightness;

      const variance =
        luminances.reduce(
          (sum, value) =>
            sum + Math.pow(value - mean, 2),
          0
        ) / height;

      const contrast = Math.sqrt(variance);

      // Luminosidade controla a altura da nota.
      const midi = 45 + brightness * 27;

      result.push({
        pitch: midi,
        brightness,
        saturation,
        contrast,
        warm: red > blue + 0.12,
      });
    }

    setFrames(result);
  };

  const handleUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);

    setImage(url);
    setFrames([]);
    setProgress(0);
    stopAudio();
  };

  const stopAudio = () => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setPlaying(false);
    setProgress(0);
  };

  const playAudio = async () => {
    if (!frames.length || playing) return;

    await Tone.start();

    const choir = new Tone.PolySynth(
      Tone.Synth,
      {
        oscillator: { type: "sine" },
        envelope: {
          attack: 0.7,
          decay: 0.3,
          sustain: 0.45,
          release: 1.5,
        },
      }
    ).toDestination();

    const marimba = new Tone.PluckSynth({
      attackNoise: 1,
      dampening: 3500,
      resonance: 0.85,
    }).toDestination();

    choir.volume.value = -16;
    marimba.volume.value = -12;

    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.bpm.value = 90;

    let index = 0;

    const eventId = Tone.Transport.scheduleRepeat(
      (time) => {
        if (index >= frames.length) {
          Tone.Transport.stop();
          Tone.Transport.cancel();

          Tone.Draw.schedule(() => {
            setPlaying(false);
            setProgress(0);
          }, time);

          choir.dispose();
          marimba.dispose();
          return;
        }

        const frame = frames[index];

        const frequency = Tone.Frequency(
          frame.pitch,
          "midi"
        ).toFrequency();

        const velocity = Math.min(
          0.85,
          0.15 + frame.brightness * 0.5 +
            frame.contrast * 2
        );

        // Camada ambiente: coral sintético.
        if (index % 16 === 0) {
          choir.triggerAttackRelease(
            [
              frequency / 2,
              frequency * 0.75,
            ],
            "1n",
            time,
            0.09
          );
        }

        // Regiões quentes: timbre percussivo.
        if (frame.warm && frame.saturation > 0.15) {
          marimba.triggerAttack(
            frequency,
            time,
            velocity
          );
        } else {
          // Regiões neutras: notas suaves.
          choir.triggerAttackRelease(
            frequency,
            "16n",
            time,
            velocity * 0.45
          );
        }

        Tone.Draw.schedule(() => {
          setProgress(index / frames.length);
        }, time);

        index++;
      },
      "16n"
    );

    setPlaying(true);
    Tone.Transport.start();
  };

  return (
    <section>
      <h2>Image-to-Sound Engine</h2>

      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
      />

      {image && (
        <img
          src={image}
          alt="Imagem utilizada na sonificação"
          onLoad={analyzeImage}
          style={{ width: "100%" }}
        />
      )}

      <progress
        value={progress}
        max={1}
      />

      <div>
        <button
          onClick={playAudio}
          disabled={!frames.length || playing}
        >
          Reproduzir
        </button>

        <button
          onClick={stopAudio}
          disabled={!playing}
        >
          Parar
        </button>
      </div>

      <p>
        {frames.length
          ? `${frames.length} regiões analisadas`
          : "Aguardando imagem"}
      </p>
    </section>
  );
}
