import { CHANNELS, LOOP_DURATION, DRUM_PITCH_CLASSES } from "regroovejs/dist/constants";
import { PatternDataMatrix, applyOnsetThreshold } from "regroovejs/dist/generate";
import { ONNXModel, Pattern } from "regroovejs";

import "./audio-context.js";
import { players, sampleMap } from "./players.js";
import midiMap from './midi-map.js';
console.log(DRUM_PITCH_CLASSES);
// import modelMeta from "/regroove-models/staging/syncopate.json";


/* BrowserFS */
// BrowserFS.configure({
//   fs: "LocalStorage"
// }, function(e) {
//   if (e) {
//     throw e;
//   }
// });
/* ================================================================
 * Cables
 * ================================================================
 */
function onPatchError(errId, errMsg) {
  alert("An error occured: " + errId + ", " + errMsg);
}

function onPatchInitialized() {
  console.log("Patch initialized");
}

function onPatchLoaded() {
  console.log("Patch finished loading");
}

document.addEventListener("CABLES.jsLoaded", function (event) {
  CABLES.patch = new window.CABLES.Patch({
    patch: CABLES.exportedPatch,
    prefixAssetPath: "cables/",
    glCanvasId: "cables-canvas",
    glCanvasResizeToWindow: true,
    onError: onPatchError,
    onPatchLoaded: onPatchInitialized,
    onFinishedLoading: onPatchLoaded,
  });
});

/* ================================================================
 * Regroove Model
 * ================================================================
 */

const batchSize = 10;
const loopDuration = LOOP_DURATION;
const channels = CHANNELS;
const batchDims = [batchSize, loopDuration, channels]
const patternShape = [1, loopDuration, channels];
const numSamples = 100;
const iters = numSamples / batchSize;
const modelMeta = {
  "latentSize": 2,
  "channels": CHANNELS,
  "loopDuration": LOOP_DURATION
}

let model;
const modelPath = "/regroove-models/staging/syncopate.onnx"
let modelReady = false;
const onsetsDataMatrix = new PatternDataMatrix(patternShape, batchSize);
let dataMatrixReady = false;

let currentPart;
const noteDropout = 0.4;
const onsetThreshold = 0.4;


async function loadModel() {
  try {
    const session = await ort.InferenceSession.create(modelPath);
    model = await new ONNXModel(session, modelMeta);
  } catch (e) {
    console.error(e);
  }
}

const randomOnsets = () => {
  const random = Float32Array.from({ length: patternShape[0] * patternShape[1] * patternShape[2]}, () => Math.random());
  const data = random.map((v) => {
    if (v > 0.5) {
      return 1;
    } else {
      return 0;
    }
  })
  return new Pattern(data, patternShape);
}

const constructInputBatch = (onsets) => {
  const velocities = new Pattern(new Float32Array(onsets.data.length), patternShape);
  const offsets = new Pattern(new Float32Array(onsets.data.length), patternShape);

  let input = onsets.concatenate(velocities, 2);
  input = input.concatenate(offsets, 2);

  let batch = input;
  for (let i = 0; i < iters - 1; i++) {
    batch = batch.concatenate(input, 0);
  }
  return batch;
}

async function populateDataMatrix(inputBatch) {
  if (!modelReady) {
    console.error(`Model is not ready, check that the model loaded properly.`);
  }
  
  for (let i = 0; i < iters; i++) {
    const output = await model.forward(inputBatch, noteDropout);
    const outputOnsets = applyOnsetThreshold(
      output.onsets.data,
      batchDims,
      onsetThreshold,
    );
    const outputOnsetsTensor = outputOnsets.tensor();
    for (let j = 0; j < batchSize; j++) {
      const onsetsSample = new Pattern([outputOnsetsTensor[j]], patternShape);
      onsetsDataMatrix.append(onsetsSample.data, i, j);
    }
  }
}

async function run() {
  await loadModel();
  modelReady = true;
  console.debug(`Model loaded.`)
  const onsets = randomOnsets();
  const inputBatch = constructInputBatch(onsets);
  console.debug(`Populating data matrix.`)
  await populateDataMatrix(inputBatch);
  dataMatrixReady = true;
  console.debug(`Data matrix ready.`)
}

run();

/* ================================================================
 * window.syncopate
 * ================================================================
 */

window.syncopate = () => {
  if (dataMatrixReady) {
    syncopate();
  } else {
    console.warn(`Data has not finished generating yet.`)
  }
}

function syncopate() {
  // get samples notes from matrix
  const pattern = samplePattern();
  const notes = extractNotesFromPattern(pattern);

  // handle Tone.Part
  if (currentPart) {
    currentPart.stop();
  }
  const part = createPartFromNotes(notes);
  currentPart = part;
  currentPart.start(0);

  // fill cables matrix with note array
  const oneHot = createOneHotNoteArr(notes);
  CABLES.patch.setVariable("noteOnArr", oneHot);
}

function samplePattern() {
  /*
   * Sample Pattern from Generator matrix
   */
  if (dataMatrixReady) {
    const x = Math.floor(Math.random() * 10);
    const y = Math.floor(Math.random() * 10);
    const randomPattern = new Pattern(onsetsDataMatrix._T[x][y], patternShape);
    return randomPattern;
  }
}

function extractNotesFromPattern(pattern) {
  /*
   * Extract list of active notes from Pattern object
   */
  const tensor = pattern.tensor()[0]
  const notes = []

  for (let step = 0; step < pattern.shape[1]; step++) {
    for (let channel = 0; channel < pattern.shape[2]; channel++) {
      const note = tensor[step][channel];
      if (note === 1) {
        notes.push({
          time: stepToTransportTime(step),
          instrument: midiMap.get(DRUM_PITCH_CLASSES.drum_index[channel]),
          step: step,
          velocity: 1,
        });
      }
    }
  }
  return notes;
}

function createPartFromNotes(notes) {
  const part = new Tone.Part((time, value) => {
    if (players.has(value.instrument)) {
      players.player(value.instrument).start(time);
    } else {
      console.error(`No player with name ${value.instrument}.`);
    }
  }, notes);
  part.humanize = false;
  return part;
}

function createOneHotNoteArr(items) {
  const sampleNames = Object.keys(sampleMap);
  const numRowsInCables = 9;
  const totalSteps = 16; // 2m
  const arr = [];
  for (let i = 0; i < sampleNames.length; i++) {
    for (let j = 0; j < totalSteps; j++) {
      arr[i * totalSteps + j] = items.some(
        (item) => item.step === j && item.instrument === sampleNames[i]
      )
        ? 1
        : 0;
    }
  }
  return arr;
}


/* ==================================================
 * Transport
 * ==================================================
 */
let playing = true;
window.playPause = () => {
  if (playing) {
    Tone.Transport.stop(0);
    currentPart.stop(0);
    playing = false;
  } else {
    Tone.Transport.start(0);
    currentPart.start(0);
    playing = true;
  }
};

const part = new Tone.Part(
  (time, value) => {
    Tone.Draw.schedule(function () {
      //do drawing or DOM manipulation here
      CABLES.patch.setVariable("step", value.step);
    }, time);
  },
  [
    { time: "0:0:0", step: 0 },
    { time: "0:0:1", step: 1 },
    { time: "0:0:2", step: 2 },
    { time: "0:0:3", step: 3 },
    { time: "0:1:0", step: 4 },
    { time: "0:1:1", step: 5 },
    { time: "0:1:2", step: 6 },
    { time: "0:1:3", step: 7 },
    { time: "0:2:0", step: 8 },
    { time: "0:2:1", step: 9 },
    { time: "0:2:2", step: 10 },
    { time: "0:2:3", step: 11 },
    { time: "0:3:0", step: 12 },
    { time: "0:3:1", step: 13 },
    { time: "0:3:2", step: 14 },
    { time: "0:3:3", step: 15 },
  ]
);

Tone.Transport.loopStart = 0;
Tone.Transport.loopEnd = "1m";
Tone.Transport.loop = true;
Tone.Transport.start(0);
Tone.Transport.bpm.value = 140;
part.start(0);

/**
 * Converts a step to a transport time unit.
 * @param {number} step - [0..31]
 * @returns {string} - e.g. '2:3:0'
 * @see https://github.com/Tonejs/Tone.js/wiki/Time
 */
function stepToTransportTime(step) {
  const bars = Math.floor(step / 16);
  let rest = step % 16;
  const quarters = Math.floor(rest / 4);
  const sixteenth = step % 4;
  return `${bars}:${quarters}:${sixteenth}`;
}

export default {};
