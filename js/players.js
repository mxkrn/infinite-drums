const eq = new Tone.EQ3(1.0, 1.4, 0.8);
const gain = new Tone.Gain(2.5);
const reverb = new Tone.Reverb(0.2);
const crush = new Tone.BitCrusher(9);

export const sampleMap = {
  'Kick Drum': '../samples/808/kick.wav',
  'Snare Drum': '../samples/808/snare.wav',
  'Hi-Hat Closed': '../samples/808/hh.wav',
  'Hi-Hat Open': '../samples/808/oh.wav',
  'High Tom': '../samples/808/ht.wav', 
  'High-Mid Tom': '../samples/808/mt.wav',
  'Low Tom': '../samples/808/lt.wav',
  'Crash Cymbal': '../samples/808/cym.wav',
  'Ride Cymbal': '../samples/808/rim.wav',
}; 

export const players = new Tone.Players (sampleMap).chain(eq, crush, gain, reverb, Tone.Destination);

// export const getAudioSamplesLoaded = players.loaded;
