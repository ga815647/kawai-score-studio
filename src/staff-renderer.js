import { createStaffModel } from './staff-model.js';

function getVexFlow() {
  const vexflow = globalThis.VexFlow;
  if (!vexflow) throw new Error('VexFlow 尚未載入');
  if (vexflow.BUILD?.VERSION !== '5.0.0') {
    throw new Error(`VexFlow 版本不符：${vexflow.BUILD?.VERSION ?? 'unknown'}`);
  }
  return vexflow;
}

function assertAnchorSequence(anchors, expectedCount, width) {
  if (anchors.length !== expectedCount) {
    throw new Error(`五線譜 anchor 數量 ${anchors.length} 與 event 數量 ${expectedCount} 不符`);
  }
  anchors.forEach((anchor, index) => {
    if (!Number.isFinite(anchor) || anchor < 0 || anchor > width) {
      throw new Error(`第 ${index + 1} 個五線譜 anchor 超出範圍：${anchor}`);
    }
    if (index > 0 && anchor <= anchors[index - 1]) {
      throw new Error(`第 ${index + 1} 個五線譜 anchor 未保持遞增`);
    }
  });
}

export function renderStaffSystem(container, events, song, layout, options = {}) {
  const VexFlow = getVexFlow();
  const {
    BarNote,
    Beam,
    Dot,
    Formatter,
    Renderer,
    Stave,
    StaveNote,
    StaveTie,
    Voice,
  } = VexFlow;
  const config = layout.notation_system.staff;
  const model = createStaffModel(events, song);

  container.replaceChildren();
  container.dataset.staffEngine = 'vexflow';
  container.dataset.vexflowVersion = VexFlow.BUILD.VERSION;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(config.width_px, config.height_px);
  const context = renderer.getContext();

  const stave = new Stave(0, config.stave_y_px, config.width_px);
  stave.addClef(config.clef);
  if (config.key_signature === 'from_song_key') stave.addKeySignature(model.keySignature);
  if (options.showTimeSignature) stave.addTimeSignature(song.meter);
  stave.setContext(context).draw();
  container.dataset.staffTopLineY = stave.getYForLine(0).toFixed(3);

  const segmentNotes = [];
  const tickables = [];
  model.segments.forEach((segment) => {
    const note = new StaveNote({
      clef: config.clef,
      keys: [segment.key],
      duration: segment.vexDuration,
      autoStem: true,
    });
    note.setAttribute('data-event-index', String(segment.eventIndex));
    note.setAttribute('data-event-anchor', segment.isEventAnchor ? 'true' : 'false');
    if (segment.dots > 0) Dot.buildAndAttach([note], { all: true });
    segmentNotes.push(note);
    tickables.push(note);
    if (segment.barAfter) tickables.push(new BarNote());
  });

  const voice = new Voice({
    numBeats: model.totalEighthUnits,
    beatValue: 8,
  }).addTickables(tickables);

  const beams = config.beam_eighth_notes ? Beam.applyAndGetBeams(voice) : [];
  const formatter = new Formatter();
  formatter
    .joinVoices([voice])
    .formatToStave([voice], stave, { context, stave });

  const anchors = model.anchorSegmentIndexes.map((segmentIndex) => (
    segmentNotes[segmentIndex].getAbsoluteX()
  ));
  assertAnchorSequence(anchors, events.length, config.width_px);

  voice.setContext(context).setStave(stave).drawWithStyle();
  beams.forEach((beam) => beam.setContext(context).drawWithStyle());
  model.ties.forEach((tie) => {
    new StaveTie({
      firstNote: segmentNotes[tie.fromSegmentIndex],
      lastNote: segmentNotes[tie.toSegmentIndex],
      firstIndexes: [0],
      lastIndexes: [0],
    }).setContext(context).drawWithStyle();
  });

  const svg = container.querySelector('svg');
  if (!svg) throw new Error('VexFlow 未產生 SVG');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${song.title} 五線譜，由 VexFlow 5.0.0 產生`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.dataset.staffEngine = 'vexflow';

  return {
    anchors,
    model,
    staffTopLineY: stave.getYForLine(0),
  };
}
