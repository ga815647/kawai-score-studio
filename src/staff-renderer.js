import { createRenderModel, parsePitch } from './score-engine.js';

function getVexFlow() {
  const vexflow = globalThis.VexFlow;
  if (!vexflow) throw new Error('VexFlow 尚未載入');
  if (vexflow.BUILD?.VERSION !== '5.0.0') {
    throw new Error(`VexFlow 版本不符：${vexflow.BUILD?.VERSION ?? 'unknown'}`);
  }
  return vexflow;
}

function estimateMeasureWidth(measure, lyricMap) {
  const eventWidth = measure.events.reduce((sum, event) => {
    const lyric = lyricMap.get(event.id) ?? '';
    return sum + Math.max(26, lyric.length * 10 + 12);
  }, 0);
  return 38 + eventWidth;
}

export function splitMeasuresByRequiredWidth(score, track, maximumWidth = 700) {
  const lyricMap = new Map(track.syllables.map((syllable) => [syllable.event, syllable.text]));
  const systems = [];
  let current = [];
  let currentWidth = 0;

  for (const measure of score.measures) {
    const estimatedWidth = estimateMeasureWidth(measure, lyricMap);
    if (current.length > 0 && currentWidth + estimatedWidth > maximumWidth) {
      systems.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(measure);
    currentWidth += estimatedWidth;
  }
  if (current.length > 0) systems.push(current);
  return systems;
}

function scoreForMeasures(score, measures) {
  const eventIds = new Set(measures.flatMap((measure) => measure.events.map((event) => event.id)));
  return {
    ...score,
    pickup_eighth_units: measures[0]?.pickup === true ? measures[0].capacity_eighth_units : 0,
    measures,
    ties: (score.ties ?? []).filter((tie) => eventIds.has(tie.from) && eventIds.has(tie.to)),
  };
}

function createNumberedNote(event, palette) {
  const pitch = parsePitch(event.pitch);
  const wrapper = document.createElement('span');
  wrapper.className = 'numbered-note';
  wrapper.dataset.eventId = event.id;
  wrapper.dataset.pitch = event.pitch;
  wrapper.style.setProperty('--note-color', palette[String(pitch.degree)].hex);

  const upper = document.createElement('span');
  upper.className = `octave-dot octave-dot--upper${pitch.octave === 1 ? ' octave-dot--active' : ''}`;
  const number = document.createElement('span');
  number.className = 'note-number';
  number.textContent = String(pitch.degree);
  const lower = document.createElement('span');
  lower.className = `octave-dot octave-dot--lower${pitch.octave === -1 ? ' octave-dot--active' : ''}`;
  wrapper.append(upper, number, lower);
  return wrapper;
}

function createLyric(eventId, text, center) {
  const lyric = document.createElement('span');
  lyric.className = 'score-lyric';
  lyric.dataset.lyricEventId = eventId;
  lyric.dataset.staffCenterX = center.toFixed(3);
  lyric.style.left = `${center}px`;
  lyric.textContent = text;
  return lyric;
}

function requiredShift(collisionAmount, maximumShift, eventId, target) {
  const shift = Math.max(0, Math.ceil(collisionAmount));
  if (shift > maximumShift) {
    throw new Error(`${eventId} 的 ${target} 需要位移 ${shift}px，超過規格上限 ${maximumShift}px`);
  }
  return shift;
}

function renderedGlyphBounds(note, numberedRowHeight, eventId) {
  const boundingBox = note.getBoundingBox();
  if (!boundingBox) throw new Error(`找不到 ${eventId} 的 VexFlow StaveNote bounding box`);
  const top = numberedRowHeight + boundingBox.getY();
  return {
    left: boundingBox.getX(),
    top,
    right: boundingBox.getX() + boundingBox.getW(),
    bottom: top + boundingBox.getH(),
  };
}

function renderSystem(container, score, palette, options) {
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
  const model = createRenderModel(score, options.trackId);
  const geometry = options.geometry ?? {};
  const width = geometry.staff_width_px ?? 700;
  const height = geometry.staff_canvas_height_px ?? 170;
  const staveY = geometry.stave_top_line_y_px ?? 18;
  const numberedRowHeight = geometry.numbered_row_height_px ?? 50;
  const lyricGap = geometry.lyric_row?.staff_bottom_line_to_top_px ?? 12;
  const lyricLineHeight = geometry.lyric_row?.line_height_px ?? 22;
  const collision = geometry.collision_adjustment ?? {};
  const glyphClearance = collision.glyph_clearance_px ?? 6;
  const maximumShift = collision.maximum_shift_px ?? 32;

  const system = document.createElement('section');
  system.className = 'score-system';
  system.dataset.system = String(options.systemIndex ?? 1);
  system.style.width = `${width}px`;

  const numberedRow = document.createElement('div');
  numberedRow.className = 'numbered-row';
  numberedRow.style.width = `${width}px`;
  numberedRow.style.height = `${numberedRowHeight}px`;

  const staff = document.createElement('div');
  staff.className = 'staff-panel';
  staff.style.width = `${width}px`;
  staff.style.height = `${height}px`;

  const lyricRow = document.createElement('div');
  lyricRow.className = 'lyric-row';
  lyricRow.style.width = `${width}px`;
  lyricRow.style.height = `${lyricLineHeight}px`;
  lyricRow.style.lineHeight = `${lyricLineHeight}px`;

  system.append(numberedRow, staff, lyricRow);
  container.append(system);

  const renderer = new Renderer(staff, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();
  const stave = new Stave(0, staveY, width, { spaceAboveStaffLn: 0, spaceBelowStaffLn: 6 });
  stave.addClef('treble');
  stave.addKeySignature(model.score.key.replace(/ major$/, ''));
  if (options.showTimeSignature) stave.addTimeSignature(model.score.meter);
  stave.setContext(context).draw();

  const segmentNotes = [];
  const tickables = [];
  for (const segment of model.segments) {
    const note = new StaveNote({
      clef: 'treble',
      keys: [segment.vexKey],
      duration: segment.vexDuration,
      autoStem: true,
    });
    note.setAttribute('data-event-id', segment.eventId);
    note.setAttribute('data-event-anchor', segment.eventAnchor ? 'true' : 'false');
    if (segment.dots > 0) Dot.buildAndAttach([note], { all: true });
    segmentNotes.push(note);
    tickables.push(note);
    if (segment.measureEnd) tickables.push(new BarNote());
  }

  const voice = new Voice({
    numBeats: model.totalEighthUnits,
    beatValue: 8,
  }).addTickables(tickables);
  const beams = Beam.applyAndGetBeams(voice);
  new Formatter().joinVoices([voice]).formatToStave([voice], stave, { context, stave });

  const eventCenters = new Map();
  model.segments.forEach((segment, index) => {
    if (!segment.eventAnchor || segment.eventKind !== 'note') return;
    const note = segmentNotes[index];
    const center = (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2;
    eventCenters.set(segment.eventId, center);
  });

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

  const staffTopLineY = stave.getYForLine(0);
  const staffBottomLineY = stave.getYForLine(4);
  const lyricRowTop = numberedRowHeight + staffBottomLineY + lyricGap;
  lyricRow.style.top = `${lyricRowTop}px`;

  const eventGlyphBounds = new Map();
  model.segments.forEach((segment, index) => {
    if (!segment.eventAnchor || segment.eventKind !== 'note') return;
    eventGlyphBounds.set(
      segment.eventId,
      renderedGlyphBounds(segmentNotes[index], numberedRowHeight, segment.eventId),
    );
  });

  const systemRect = system.getBoundingClientRect();
  const lyricMap = new Map(model.track.syllables.map((syllable) => [syllable.event, syllable.text]));
  const adjustments = [];
  let maximumLyricShift = 0;

  for (const event of model.events) {
    if (event.kind !== 'note') continue;
    const center = eventCenters.get(event.id);
    const glyph = eventGlyphBounds.get(event.id);
    if (!Number.isFinite(center) || !glyph) throw new Error(`找不到 ${event.id} 的音頭幾何資料`);

    const numbered = createNumberedNote(event, palette);
    numbered.style.left = `${center}px`;
    numbered.dataset.staffCenterX = center.toFixed(3);
    numberedRow.append(numbered);

    const defaultNumberRect = numbered.getBoundingClientRect();
    const defaultNumberBottom = defaultNumberRect.bottom - systemRect.top;
    const defaultNumberClearance = glyph.top - defaultNumberBottom;
    const numberedShift = requiredShift(
      glyphClearance - defaultNumberClearance,
      maximumShift,
      event.id,
      '簡譜',
    );
    numbered.style.top = `${-numberedShift}px`;
    numbered.dataset.verticalShiftPx = String(-numberedShift);
    numbered.dataset.defaultGlyphClearancePx = defaultNumberClearance.toFixed(3);
    numbered.dataset.adjustedGlyphClearancePx = (defaultNumberClearance + numberedShift).toFixed(3);
    numbered.dataset.glyphTopPx = glyph.top.toFixed(3);
    numbered.dataset.glyphBottomPx = glyph.bottom.toFixed(3);
    numbered.dataset.boundingSource = 'vexflow-stavenote-bounding-box';
    numbered.dataset.collisionAdjusted = String(numberedShift > 0);

    let lyricShift = 0;
    const lyricText = lyricMap.get(event.id);
    if (lyricText) {
      const lyric = createLyric(event.id, lyricText, center);
      lyricRow.append(lyric);
      const defaultLyricRect = lyric.getBoundingClientRect();
      const defaultLyricTop = defaultLyricRect.top - systemRect.top;
      const defaultLyricClearance = defaultLyricTop - glyph.bottom;
      lyricShift = requiredShift(
        glyphClearance - defaultLyricClearance,
        maximumShift,
        event.id,
        '歌詞',
      );
      lyric.style.top = `${lyricShift}px`;
      lyric.dataset.verticalShiftPx = String(lyricShift);
      lyric.dataset.defaultGlyphClearancePx = defaultLyricClearance.toFixed(3);
      lyric.dataset.adjustedGlyphClearancePx = (defaultLyricClearance + lyricShift).toFixed(3);
      lyric.dataset.glyphTopPx = glyph.top.toFixed(3);
      lyric.dataset.glyphBottomPx = glyph.bottom.toFixed(3);
      lyric.dataset.boundingSource = 'vexflow-stavenote-bounding-box';
      lyric.dataset.collisionAdjusted = String(lyricShift > 0);
      maximumLyricShift = Math.max(maximumLyricShift, lyricShift);
    }

    adjustments.push({
      eventId: event.id,
      pitch: event.pitch,
      numberedShiftPx: -numberedShift,
      lyricShiftPx: lyricShift,
      glyphLeftPx: glyph.left,
      glyphTopPx: glyph.top,
      glyphRightPx: glyph.right,
      glyphBottomPx: glyph.bottom,
    });
  }

  const baseSystemHeight = numberedRowHeight + height;
  const adjustedLyricBottom = lyricRowTop + lyricLineHeight + maximumLyricShift;
  system.style.minHeight = `${Math.max(baseSystemHeight, adjustedLyricBottom)}px`;

  const svg = staff.querySelector('svg');
  svg?.setAttribute('aria-label', `${score.title} 五線譜`);
  system.dataset.staffTopLineY = staffTopLineY.toFixed(3);
  system.dataset.staffBottomLineY = staffBottomLineY.toFixed(3);
  system.dataset.numberedRowHeight = numberedRowHeight.toFixed(3);
  system.dataset.defaultNumberedTop = '0';
  system.dataset.lyricRowTop = lyricRowTop.toFixed(3);
  system.dataset.defaultLyricTop = lyricRowTop.toFixed(3);
  system.dataset.glyphClearance = glyphClearance.toFixed(3);
  system.dataset.boundingSource = 'vexflow-stavenote-bounding-box';
  system.dataset.eventCenters = JSON.stringify(Object.fromEntries(eventCenters));
  system.dataset.verticalAdjustments = JSON.stringify(adjustments);
  return { system, model, eventCenters, adjustments };
}

export function renderScore(container, score, palette, options = {}) {
  container.replaceChildren();
  const track = score.lyric_tracks.find((candidate) => (
    options.trackId ? candidate.id === options.trackId : candidate.default === true
  ));
  if (!track) throw new Error('找不到預設歌詞 track');
  const maximumWidth = options.geometry?.staff_width_px ?? 700;
  const systems = splitMeasuresByRequiredWidth(score, track, maximumWidth);
  return systems.map((measures, index) => renderSystem(
    container,
    scoreForMeasures(score, measures),
    palette,
    {
      ...options,
      trackId: track.id,
      systemIndex: index + 1,
      showTimeSignature: index === 0,
    },
  ));
}
