import { flattenMeasures, pitchToFrequency } from './score-engine.js';

function buildPlaybackTimeline(score) {
  const events = flattenMeasures(score);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const tieFrom = new Map((score.ties ?? []).map((tie) => [tie.from, tie.to]));
  const tiedTo = new Set((score.ties ?? []).map((tie) => tie.to));
  const timeline = [];

  for (const event of events) {
    if (tiedTo.has(event.id)) continue;
    if (event.kind === 'rest') {
      timeline.push({ ...event, playbackDuration: event.duration });
      continue;
    }

    let duration = event.duration;
    let cursor = event.id;
    const visited = new Set([cursor]);
    while (tieFrom.has(cursor)) {
      const nextId = tieFrom.get(cursor);
      if (visited.has(nextId)) throw new Error(`連結線循環：${nextId}`);
      visited.add(nextId);
      const next = eventById.get(nextId);
      if (!next || next.kind !== 'note' || next.pitch !== event.pitch) {
        throw new Error(`無法播放連結線：${cursor} → ${nextId}`);
      }
      duration += next.duration;
      cursor = nextId;
    }
    timeline.push({ ...event, playbackDuration: duration });
  }
  return timeline;
}

export class ScorePlayer {
  constructor() {
    this.context = null;
    this.nodes = [];
  }

  stop() {
    for (const node of this.nodes) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    this.nodes = [];
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }

  async play(score) {
    this.stop();
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) throw new Error('此瀏覽器不支援 Web Audio');
    const context = new AudioContextClass();
    this.context = context;
    await context.resume();

    const quarterBpm = score.tempo_quarter_bpm ?? 96;
    const eighthSeconds = 60 / quarterBpm / 2;
    let cursorTime = context.currentTime + 0.08;

    for (const event of buildPlaybackTimeline(score)) {
      const seconds = event.playbackDuration * eighthSeconds;
      if (event.kind === 'rest') {
        cursorTime += seconds;
        continue;
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = pitchToFrequency(event.pitch, score.key);
      gain.gain.setValueAtTime(0.0001, cursorTime);
      gain.gain.exponentialRampToValueAtTime(0.34, cursorTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, cursorTime + Math.max(0.06, seconds - 0.02));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(cursorTime);
      oscillator.stop(cursorTime + seconds);
      this.nodes.push(oscillator);
      cursorTime += seconds;
    }

    const cleanupDelay = Math.max(0, (cursorTime - context.currentTime + 0.1) * 1000);
    setTimeout(() => {
      if (this.context === context) this.stop();
    }, cleanupDelay);
  }
}
