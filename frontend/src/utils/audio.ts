export const INPUT_SAMPLE_RATE = 16000;
export const OUTPUT_SAMPLE_RATE = 24000;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const length = binary.length >> 1;
  const view = new DataView(new ArrayBuffer(length * 2));
  for (let i = 0; i < length * 2; i++) view.setUint8(i, binary.charCodeAt(i));

  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = view.getInt16(i * 2, true) / 0x8000;
  return out;
}

// Plays streamed PCM chunks back to back, and can drop everything instantly
// when the candidate interrupts the interviewer.
export class AudioPlayer {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private levelData: Uint8Array<ArrayBuffer>;

  constructor() {
    this.ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(this.ctx.destination);
    this.levelData = new Uint8Array(this.analyser.fftSize);
  }

  resume() {
    return this.ctx.resume();
  }

  get playing() {
    return this.sources.size > 0;
  }

  enqueue(samples: Float32Array) {
    const buffer = this.ctx.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(new Float32Array(samples), 0);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    source.onended = () => this.sources.delete(source);

    const startAt = Math.max(this.ctx.currentTime + 0.02, this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    this.sources.add(source);
  }

  stop() {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextStart = 0;
  }

  // Loudness of what is playing right now, 0 to 1. Drives the avatar's mouth in any language.
  level(): number {
    this.analyser.getByteTimeDomainData(this.levelData);
    let sum = 0;
    for (let i = 0; i < this.levelData.length; i++) {
      const v = (this.levelData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.levelData.length) * 4);
  }

  close() {
    this.stop();
    void this.ctx.close();
  }
}
