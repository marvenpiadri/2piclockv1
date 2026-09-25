import { Injectable, signal } from '@angular/core';

export type ASMRSoundType = 'none' | 'rain' | 'breeze' | 'night' | 'custom';

@Injectable({
  providedIn: 'root'
})
export class AtmosphereAudioService {
  readonly isPlaying = signal<boolean>(false);
  readonly soundType = signal<ASMRSoundType>('rain');
  readonly volume = signal<number>(40); // 0-100
  readonly isMuted = signal<boolean>(false);
  readonly customSoundName = signal<string>('Custom Rain ASMR');

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private lfoNode: OscillatorNode | null = null;

  togglePlay(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  setSoundType(type: ASMRSoundType): void {
    this.soundType.set(type);
    if (this.isPlaying()) {
      this.stopNodes();
      this.startNodes();
    }
  }

  setVolume(vol: number): void {
    this.volume.set(Math.max(0, Math.min(100, vol)));
    if (this.masterGain && this.audioCtx) {
      const targetGain = (this.volume() / 100) * 0.25;
      this.masterGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.1);
    }
  }

  toggleMute(): void {
    this.isMuted.update(v => !v);
    if (this.masterGain && this.audioCtx) {
      const targetGain = this.isMuted() ? 0 : (this.volume() / 100) * 0.25;
      this.masterGain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.1);
    }
  }

  play(): void {
    if (this.soundType() === 'none') {
      this.soundType.set('rain');
    }
    this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.startNodes();
    this.isPlaying.set(true);
  }

  pause(): void {
    this.stopNodes();
    this.isPlaying.set(false);
  }

  private initAudioContext(): void {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        const initialGain = this.isMuted() ? 0 : (this.volume() / 100) * 0.25;
        this.masterGain.gain.setValueAtTime(initialGain, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }
  }

  private startNodes(): void {
    if (!this.audioCtx || !this.masterGain) return;

    const bufferSize = this.audioCtx.sampleRate * 3;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    const currentType = this.soundType();

    if (currentType === 'rain' || currentType === 'breeze' || currentType === 'custom') {
      // Generate Pink Noise for soothing Rain / Wind ASMR
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      this.noiseSource = this.audioCtx.createBufferSource();
      this.noiseSource.buffer = buffer;
      this.noiseSource.loop = true;

      this.filterNode = this.audioCtx.createBiquadFilter();
      if (currentType === 'rain') {
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      } else {
        this.filterNode.type = 'bandpass';
        this.filterNode.frequency.setValueAtTime(400, this.audioCtx.currentTime);
        this.filterNode.Q.setValueAtTime(3, this.audioCtx.currentTime);
      }

      this.noiseSource.connect(this.filterNode);
      this.filterNode.connect(this.masterGain);
      this.noiseSource.start();
    } else if (currentType === 'night') {
      // Gentle night drone oscillator
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, this.audioCtx.currentTime);

      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(300, this.audioCtx.currentTime);

      osc.connect(this.filterNode);
      this.filterNode.connect(this.masterGain);
      osc.start();
    }
  }

  private stopNodes(): void {
    try {
      if (this.noiseSource) {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
        this.noiseSource = null;
      }
      if (this.lfoNode) {
        this.lfoNode.stop();
        this.lfoNode.disconnect();
        this.lfoNode = null;
      }
      if (this.filterNode) {
        this.filterNode.disconnect();
        this.filterNode = null;
      }
    } catch {
      // ignore clean up error
    }
  }
}
