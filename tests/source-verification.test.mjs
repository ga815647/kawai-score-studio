import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { loadScorebook } from '../scripts/lib.mjs';

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('MusicXML source verification specification pins independent tools and exact evidence', async () => {
  const { data: book } = await loadScorebook();
  const source = book.source_verification;

  assert.equal(source.version, 1);
  assert.equal(source.canonical_data_remains, 'scorebook.yaml');
  assert.deepEqual(source.input, {
    format: 'MusicXML',
    version: '4.0',
    root: 'score-partwise',
    score_shape: 'monophonic_single_part',
    entity_declarations: 'forbidden',
    compressed_mxl: 'unsupported',
  });
  assert.deepEqual(source.tools, {
    python: '3.13',
    music21: '10.5.0',
    verovio: '6.2.1',
    xmlschema: '4.3.2',
    pyyaml: '6.0.3',
  });
  assert.equal(
    source.schema.files['musicxml.xsd'].git_blob_sha,
    '2f2d116e94095cf069a1b3daf3691297b83106d1',
  );
  assert.equal(
    source.schema.files['xml.xsd'].git_blob_sha,
    'eeb9db56093d2382951cbcd1b61c2ccd9d674c92',
  );
  assert.equal(source.comparison.source_to_scorebook, 'exact');
  assert.equal(source.comparison.music21_roundtrip, 'exact');
  assert.equal(source.independent_evidence.verovio_is_not_canonical, true);
  assert.equal(book.gates.source.required, true);
  assert.ok(book.gates.source.checks.includes('official_schema_files_match_pinned_git_blob_shas'));
  assert.ok(book.gates.source.checks.includes('music21_normalized_events_match_scorebook_exactly'));
  assert.ok(book.gates.source.checks.includes('music21_roundtrip_events_match_source_exactly'));
  assert.ok(book.gates.source.checks.includes('verovio_svg_is_created'));
  assert.ok(book.gates.source.checks.includes('verovio_midi_is_created'));
});

test('synthetic MusicXML fixture covers pickup, rests, ties, lyrics, and instrument extremes', async () => {
  const xml = await readFile('fixtures/source-verification.musicxml', 'utf8');
  assert.match(xml, /<score-partwise version="4\.0">/);
  assert.match(xml, /<measure number="0" implicit="yes">/);
  assert.match(xml, /<rest\/>/);
  assert.match(xml, /<tie type="start"\/>/);
  assert.match(xml, /<tie type="stop"\/>/);
  assert.match(xml, /<step>F<\/step><octave>3<\/octave>/);
  assert.match(xml, /<step>G<\/step><octave>5<\/octave>/);
  assert.match(xml, /<text>extraordinary<\/text>/);
  assert.doesNotMatch(xml, /<!ENTITY/i);
});

test('source verification reports prove exact source, round-trip, and independent render evidence', async () => {
  const [summary, schema, sourceEvents, scorebookEvents, eventDiff, roundtripDiff] = await Promise.all([
    readJson('reports/source/source-verification-report.json'),
    readJson('reports/source/musicxml-schema-report.json'),
    readJson('reports/source/normalized-source-events.json'),
    readJson('reports/source/normalized-scorebook-events.json'),
    readJson('reports/source/event-diff.json'),
    readJson('reports/source/roundtrip-diff.json'),
  ]);

  assert.equal(summary.pass, true, JSON.stringify(summary.errors, null, 2));
  assert.equal(schema.pass, true, JSON.stringify(schema, null, 2));
  assert.equal(schema.source.pass, true);
  assert.equal(schema.roundtrip.pass, true);
  assert.equal(eventDiff.pass, true, JSON.stringify(eventDiff.differences, null, 2));
  assert.equal(roundtripDiff.pass, true, JSON.stringify(roundtripDiff.differences, null, 2));
  assert.deepEqual(sourceEvents, scorebookEvents);

  assert.deepEqual(sourceEvents.metadata, {
    partCount: 1,
    measureCount: 4,
    meter: '6/8',
    keyFifths: 0,
    pickupEighthUnits: 1,
  });
  assert.equal(sourceEvents.events.length, 14);
  assert.equal(sourceEvents.events.filter((event) => event.kind === 'rest').length, 2);
  assert.ok(sourceEvents.events.some((event) => event.pitch_midi === 53));
  assert.ok(sourceEvents.events.some((event) => event.pitch_midi === 79));
  assert.ok(sourceEvents.events.some((event) => event.tie === 'start'));
  assert.ok(sourceEvents.events.some((event) => event.tie === 'stop'));
  assert.ok(sourceEvents.events.some((event) => event.lyric === 'extraordinary'));

  assert.deepEqual(summary.tools, {
    python: '3.13',
    music21: '10.5.0',
    verovio: '6.2.1',
    xmlschema: '4.3.2',
    pyyaml: '6.0.3',
  });

  const requiredFiles = [
    'reports/source/roundtrip.musicxml',
    'reports/source/verovio-reference.svg',
    'reports/source/verovio-reference.mid',
    'reports/source/source-verification-report.html',
  ];
  for (const path of requiredFiles) {
    await access(path);
    assert.ok((await stat(path)).size > 0, `${path} is empty`);
  }

  const svg = await readFile('reports/source/verovio-reference.svg', 'utf8');
  const midi = await readFile('reports/source/verovio-reference.mid');
  assert.match(svg, /<svg/);
  assert.equal(midi.subarray(0, 4).toString('ascii'), 'MThd');
});

test('package and workflows run source verification before browser gates', async () => {
  const [packageJson, ci, pages, requirements] = await Promise.all([
    readJson('package.json'),
    readFile('.github/workflows/ci.yml', 'utf8'),
    readFile('.github/workflows/pages.yml', 'utf8'),
    readFile('requirements-source.txt', 'utf8'),
  ]);

  assert.equal(packageJson.scripts['source:verify'], 'python scripts/verify_source.py');
  assert.match(packageJson.scripts.check, /source:verify/);
  assert.match(ci, /actions\/setup-python@v5/);
  assert.match(ci, /python-version: '3\.13'/);
  assert.match(ci, /pip install -r requirements-source\.txt/);
  assert.match(ci, /npm run check:visual/);
  assert.match(pages, /actions\/setup-python@v5/);
  assert.match(pages, /python-version: '3\.13'/);
  assert.match(pages, /pip install -r requirements-source\.txt/);
  assert.match(pages, /npm run check:visual/);
  assert.match(requirements, /^music21==10\.5\.0$/m);
  assert.match(requirements, /^verovio==6\.2\.1$/m);
  assert.match(requirements, /^xmlschema==4\.3\.2$/m);
  assert.match(requirements, /^PyYAML==6\.0\.3$/m);
});
