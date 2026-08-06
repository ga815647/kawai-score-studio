import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtures, loadScorebook, validateProject } from '../scripts/lib.mjs';
import { adaptBookForLegacyValidation, validateSourcePolicy } from '../scripts/source-policy.mjs';

async function loadProject() {
  const [{ data: book }, { data: fixtures }] = await Promise.all([
    loadScorebook(),
    loadFixtures(),
  ]);
  return { book, fixtures };
}

function verifiedCandidate(fixtures, source) {
  const candidate = structuredClone(fixtures.fixtures[0]);
  candidate.synthetic = false;
  candidate.status = 'verified';
  candidate.source = {
    title: 'Synthetic exact source',
    source_type: 'score_website',
    provided_by: 'assistant_web_research',
    publisher_or_origin: 'Synthetic test publisher',
    accessed_at: '2026-08-06',
    selected_variant: 'synthetic fixture variant',
    original_key: 'C major',
    original_meter: '6/8',
    pickup: 1,
    rights_status: 'synthetic_test_only',
    url: 'https://example.com/synthetic-score',
    ...source,
  };
  candidate.verification = {
    source_to_scorebook_checked: true,
    melody_checked: true,
    rhythm_checked: true,
    rests_checked: true,
    pickup_checked: true,
    measures_checked: true,
    ties_checked: true,
    lyrics_checked: true,
    user_approved: true,
  };
  return candidate;
}

test('one ChatGPT project handles score content and generator development', async () => {
  const { book } = await loadProject();
  const result = validateSourcePolicy(book);
  assert.equal(result.pass, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(book.interaction_entry.handles, ['score_content', 'generator_development']);
  assert.equal(book.interaction_entry.user_selects_work_type, false);
  assert.equal(book.interaction_entry.assistant_classifies_request, true);
  assert.deepEqual(book.interaction_entry.website_modes_remain_internal, ['library', 'studio']);
});

test('assistant-researched HTTPS sheet music passes both policy and structural gates', async () => {
  const { book, fixtures } = await loadProject();
  const candidateBook = structuredClone(book);
  candidateBook.library.songs.push(verifiedCandidate(fixtures, {}));

  const policy = validateSourcePolicy(candidateBook);
  assert.equal(policy.pass, true, JSON.stringify(policy.errors, null, 2));

  const structural = validateProject(adaptBookForLegacyValidation(candidateBook), fixtures);
  assert.equal(structural.pass, true, JSON.stringify(structural.errors, null, 2));
});

test('user-provided image or PDF may use a hashed file reference instead of a URL', async () => {
  const { book, fixtures } = await loadProject();
  const candidateBook = structuredClone(book);
  candidateBook.library.songs.push(verifiedCandidate(fixtures, {
    source_type: 'score_pdf',
    provided_by: 'user',
    url: undefined,
    file_reference: 'private/original-score.pdf',
    content_sha256: 'a'.repeat(64),
  }));

  const policy = validateSourcePolicy(candidateBook);
  assert.equal(policy.pass, true, JSON.stringify(policy.errors, null, 2));

  const structural = validateProject(adaptBookForLegacyValidation(candidateBook), fixtures);
  assert.equal(structural.pass, true, JSON.stringify(structural.errors, null, 2));
});

test('YouTube, audio, missing locators, and unhashed files are rejected', async () => {
  const { book, fixtures } = await loadProject();

  const youtubeBook = structuredClone(book);
  youtubeBook.library.songs.push(verifiedCandidate(fixtures, {
    source_type: 'youtube',
    url: 'https://www.youtube.com/watch?v=synthetic',
  }));
  assert.ok(validateSourcePolicy(youtubeBook).errors.some((error) => error.code === 'source-type'));

  const noLocatorBook = structuredClone(book);
  noLocatorBook.library.songs.push(verifiedCandidate(fixtures, { url: undefined }));
  assert.ok(validateSourcePolicy(noLocatorBook).errors.some((error) => error.code === 'source-locator'));

  const unhashedFileBook = structuredClone(book);
  unhashedFileBook.library.songs.push(verifiedCandidate(fixtures, {
    source_type: 'score_image',
    provided_by: 'user',
    url: undefined,
    file_reference: 'score.png',
  }));
  assert.ok(validateSourcePolicy(unhashedFileBook).errors.some((error) => error.code === 'source-file-hash'));
});
