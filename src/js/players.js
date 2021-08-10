import * as Tone from 'tone';

const eq = new Tone.EQ3(0.8, 1.2, 0.8);
const gain = new Tone.Gain(2);
const reverb = new Tone.Reverb(0.15);
const crush = new Tone.BitCrusher(10);

export const sampleMap = {
  "Kick Drum": "./src/assets/samples/808/kick.wav",
  "Snare Drum": "./src/assets/samples/808/snare.wav",
  "Hi-Hat Closed": "./src/assets/samples/808/hh.wav",
  "Hi-Hat Open": "./src/assets/samples/808/oh.wav",
  "High Tom": "./src/assets/samples/808/ht.wav",
  "High-Mid Tom": "./src/assets/samples/808/mt.wav",
  "Low Tom": "./src/assets/samples/808/lt.wav",
  "Crash Cymbal": "./src/assets/samples/808/cym.wav",
  "Ride Cymbal": "./src/assets/samples/808/rim.wav",
};

export const players = new Tone.Players(sampleMap).chain(
  eq,
  crush,
  gain,
  reverb,
  Tone.Destination
);
