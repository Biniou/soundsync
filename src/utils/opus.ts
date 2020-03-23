/// <reference types="emscripten" />

/* eslint-disable @typescript-eslint/camelcase */
import Opus from './opus_wasm';

interface EmscriptenModuleOpusEncoder extends EmscriptenModule {
  _opus_decoder_create(samplingRate: number, channels: number, error_ptr: number): number;
  _opus_decode(
    handle: number, data: number, len: number,
    pcm: number, frameSize: number, decodeFec: number): number;
  _opus_decode_float(
    handle: number, data: number, len: number,
    pcm: number, frameSize: number, decodeFec: number): number;
  _opus_decoder_destroy(handle: number): void;

  _opus_encoder_create(samplingRate: number, channels: number, application: number, error_ptr: number): number;
  _opus_encode(handle: number, pcm: number, frameSize: number, data: number, maxDataBytes: number): number;
  _opus_encoder_destroy(handle: number): void;

  _opus_strerror(err: number): number;

  getValue(ptr: number, type: string): any;
  AsciiToString(ptr: number): string;
}

/** Opus Coding Mode. */
export declare const enum OpusApplication {
  /** Best for most VoIP/videoconference applications where listening quality and intelligibility matter most. */
  OPUS_APPLICATION_VOIP = 2048,

  /** Best for broadcast/high-fidelity application where the decoded audio should be as close as possible to the input. */
  OPUS_APPLICATION_AUDIO = 2049,

  /** Only use when lowest-achievable latency is what matters most. Voice-optimized modes cannot be used. */
  OPUS_APPLICATION_RESTRICTED_LOWDELAY = 2051
}

export class OpusDecoder {
  handle: number;
  bufPtr: number;
  pcmPtr: number;
  buf: Uint8Array;
  pcm: Float32Array;
  frameSize: number;
  module: EmscriptenModuleOpusEncoder;

  // eslint-disable-next-line no-empty-function
  constructor(readonly sampleRate: number, readonly channels: number) {}

  // The promise decorator is necessarry because else the js engine will try to call .then in loop
  // and so will create an infinite loop
  setup = () => new Promise((resolve) => {
    Opus().then((Module: EmscriptenModuleOpusEncoder) => {
      this.module = Module;
      const err = this.module._malloc(4);
      this.handle = this.module._opus_decoder_create(this.sampleRate, this.channels, err);
      const errNum = this.module.getValue(err, 'i32');
      this.module._free(err);
      if (errNum !== 0) {
        throw new Error(this.module.AsciiToString(this.module._opus_strerror(errNum)));
      }

      this.frameSize = (this.sampleRate / 1000) * 120; /* max frame duration[ms] */
      const pcmSamples = this.frameSize * this.channels;
      const bufSize = this.frameSize * this.channels;
      this.pcmPtr = this.module._malloc(4 * pcmSamples);
      this.bufPtr = this.module._malloc(bufSize);
      this.buf = this.module.HEAPU8.subarray(this.bufPtr, this.bufPtr + bufSize);
      this.pcm = this.module.HEAPF32.subarray(this.pcmPtr / 4, this.pcmPtr / 4 + pcmSamples);
      resolve();
    });
  })

  async decodeFloat(data: Buffer) {
    if (!this.handle) {
      await this.setup();
    }
    this.buf.set(data);
    const decodedSamplesPerChannel = this.module._opus_decode_float(this.handle, this.bufPtr, data.length, this.pcmPtr, this.frameSize, 0);
    if (decodedSamplesPerChannel < 0) {
      throw new Error(this.module.AsciiToString(this.module._opus_strerror(decodedSamplesPerChannel)));
    }
    const decoded = this.pcm.slice(0, decodedSamplesPerChannel * this.channels).buffer;
    // TODO: do we need to use slice or subarray here ?
    return decoded;
  }
}

export class OpusEncoder {
  handle: number;
  bufPtr: number;
  pcmPtr: number;
  buf: Uint8Array;
  pcm: Uint8Array;
  frameSize: number;
  bufSize: number;
  module: EmscriptenModuleOpusEncoder;

  // eslint-disable-next-line no-empty-function
  constructor(readonly sampleRate: number, readonly channels: number, readonly application: number) {}

  // The promise decorator is necessarry because else the js engine will try to call .then in loop
  // and so will create an infinite loop
  setup = () => new Promise((resolve) => {
    Opus().then((Module: EmscriptenModuleOpusEncoder) => {
      this.module = Module;
      const err = this.module._malloc(4);
      this.handle = this.module._opus_encoder_create(this.sampleRate, this.channels, this.application, err);
      const errNum = this.module.getValue(err, 'i32');
      this.module._free(err);
      if (errNum !== 0) {
        throw new Error(this.module.AsciiToString(this.module._opus_strerror(errNum)));
      }

      this.frameSize = (this.sampleRate * 60) /* max frame duration[ms] */ / 1000;
      this.bufSize = this.frameSize * this.channels * 2; // 2 bytes per sample
      this.bufPtr = this.module._malloc(this.bufSize);
      this.pcmPtr = this.module._malloc(this.bufSize);
      this.buf = this.module.HEAPU8.subarray(this.bufPtr, this.bufPtr + this.bufSize);
      this.pcm = this.module.HEAPU8.subarray(this.pcmPtr, this.pcmPtr + this.bufSize);
      resolve();
    });
  })

  async encode(pcm: Buffer) {
    if (!this.handle) {
      await this.setup();
    }
    this.pcm.set(pcm);
    const frameSize = pcm.length / 2 / this.channels;
    const encodedLength = this.module._opus_encode(this.handle, this.pcmPtr, frameSize, this.bufPtr, this.bufSize);
    if (encodedLength < 0) {
      throw new Error(this.module.AsciiToString(this.module._opus_strerror(encodedLength)));
    }
    const encoded = Buffer.from(this.buf.slice(0, encodedLength).buffer);
    return encoded;
  }
}
