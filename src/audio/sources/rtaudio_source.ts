import { PassThrough } from 'stream';
import {
  RtAudio, RtAudioFormat, RtAudioStreamFlags, RtAudioStreamParameters,
} from 'audioworklet';

import { OPUS_ENCODER_RATE, OPUS_ENCODER_CHUNK_SAMPLES_COUNT } from '../../utils/constants';
import { AudioSource } from './audio_source';
import { RtAudioSourceDescriptor } from './source_type';
import { AudioSourcesSinksManager } from '../audio_sources_sinks_manager';
import { createAudioEncodedStream } from '../../utils/opus_streams';
import { getAudioDevices } from '../../utils/rtaudio';
import { AudioInstance } from '../utils';

export class RtAudioSource extends AudioSource {
  local = true;
  rate = 44800;
  channels = 2;

  deviceName: string;

  private rtaudio: RtAudio;
  private cleanStream: () => any;

  constructor(descriptor: RtAudioSourceDescriptor, manager: AudioSourcesSinksManager) {
    super(descriptor, manager);
    this.deviceName = descriptor.deviceName;
  }

  _getAudioEncodedStream() {
    const inputConfig: RtAudioStreamParameters = { nChannels: 2 };
    if (this.deviceName) {
      inputConfig.deviceId = getAudioDevices().map(({ name }) => name).indexOf(this.deviceName);
      if (inputConfig.deviceId === -1) {
        delete inputConfig.deviceId;
      }
    }
    this.log(`Creating loopback for ${this.deviceName}`);
    const inputStream = new PassThrough();

    this.rtaudio = new RtAudio();
    this.rtaudio.openStream(
      null, // input stream
      inputConfig, // output stream
      RtAudioFormat.RTAUDIO_SINT16, // format
      OPUS_ENCODER_RATE, // rate
      OPUS_ENCODER_CHUNK_SAMPLES_COUNT, // samples per frame
      `soundsync`, // name
      (input) => {
        inputStream.push(input[0]);
      }, // input callback
      RtAudioStreamFlags.RTAUDIO_MINIMIZE_LATENCY, // stream flags
    );
    this.rtaudio.start();

    this.cleanStream = () => {
      this.rtaudio.closeStream();
      delete this.rtaudio;
    };

    const stream = createAudioEncodedStream(inputStream, OPUS_ENCODER_RATE, 2);
    return stream;
    // TODO: handle closing source
  }

  toDescriptor: (() => AudioInstance<RtAudioSourceDescriptor>) = () => ({
    type: 'rtaudio',
    name: this.name,
    uuid: this.uuid,
    deviceName: this.deviceName,
    peerUuid: this.peerUuid,
    instanceUuid: this.instanceUuid,
    channels: this.channels,
    latency: this.latency,
    startedAt: this.startedAt,
  })
}
