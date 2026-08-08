from pathlib import Path

scorebook_path = Path('scorebook.yaml')
text = scorebook_path.read_text(encoding='utf-8')

if 'song_difficulty:' not in text:
    text = text.replace(
        '  smallest_supported_duration: sixteenth_note\n',
        '  smallest_supported_duration: sixteenth_note\n'
        '  song_difficulty:\n'
        '    field: difficulty\n'
        '    scale_min: 1\n'
        '    scale_max: 5\n'
        '    display: five_star_rating\n'
        '    sort_order: ascending_then_title\n'
        '    factors:\n'
        '    - rhythmic_density_and_shortest_duration\n'
        '    - rhythmic_variation_pickup_rests_and_ties\n'
        '    - pitch_range_register_changes_and_leaps\n'
        '    - song_length_and_repetition\n',
        1,
    )

text = text.replace('  version: 0.6.24\n', '  version: 0.6.25\n', 1)

library_directory = (
    '      label_format: title_with_alias\n'
    '      link_behavior: same_page_anchor\n'
)
if '      difficulty_display: five_star_rating\n      sort_order: difficulty_ascending_then_title\n      link_behavior: same_page_anchor\n' not in text:
    text = text.replace(
        library_directory,
        '      label_format: title_with_alias\n'
        '      difficulty_display: five_star_rating\n'
        '      sort_order: difficulty_ascending_then_title\n'
        '      link_behavior: same_page_anchor\n',
        1,
    )

navigation_directory = (
    '      label_format: title_with_alias\n'
    '      sticky_header_offset_px: 88\n'
)
if '      difficulty_display: five_star_rating\n      sort_order: difficulty_ascending_then_title\n      sticky_header_offset_px: 88\n' not in text:
    text = text.replace(
        navigation_directory,
        '      label_format: title_with_alias\n'
        '      difficulty_display: five_star_rating\n'
        '      sort_order: difficulty_ascending_then_title\n'
        '      sticky_header_offset_px: 88\n',
        1,
    )

difficulties = {
    'hickory-dickory-dock': 3,
    'itsy-bitsy-spider': 3,
    'twinkle-twinkle-little-star-zh': 1,
    'two-tigers-zh': 2,
    'old-macdonald-zh': 2,
    'mary-had-a-little-lamb-zh': 1,
    'happy-birthday-zh': 3,
    'row-row-row-your-boat': 2,
    'the-wheels-on-the-bus': 4,
    'canon-in-d': 5,
    'yi-bi-ya-ya-zh': 3,
    'little-bee-zh': 1,
    'fast-train-zh': 3,
    'pull-the-radish-zh': 3,
    'build-an-airplane-zh': 3,
    'tantan-houhou': 4,
    'humpty-dumpty': 4,
    'little-donkey-zh': 4,
    'find-a-friend-zh': 3,
    'london-bridge-zh': 1,
    'if-you-are-happy-clap-zh': 3,
    'head-shoulders-knees-and-toes': 3,
    'five-little-ducks': 2,
    'i-am-a-painter-zh': 3,
    'counting-ducks-zh': 3,
    'little-rabbit-be-good-zh': 2,
    'bingo': 3,
    'this-old-man': 2,
    'clay-doll-zh': 2,
    'drop-the-handkerchief-zh': 3,
    'telephone-call-zh': 3,
}

songs_start = text.index('library:\n  songs:\n')
quarantine_start = text.index('  quarantine:', songs_start)
prefix = text[:songs_start]
songs_section = text[songs_start:quarantine_start]
suffix = text[quarantine_start:]

song_ids = []
for line in songs_section.splitlines():
    if line.startswith('  - id: '):
        song_ids.append(line.removeprefix('  - id: ').strip())
missing = [song_id for song_id in song_ids if song_id not in difficulties]
extra = [song_id for song_id in difficulties if song_id not in song_ids]
if missing or extra:
    raise SystemExit(f'difficulty mapping mismatch: missing={missing}, extra={extra}, songs={song_ids}')

for song_id in song_ids:
    marker = f'  - id: {song_id}\n'
    start = songs_section.index(marker)
    next_start = songs_section.find('\n  - id: ', start + len(marker))
    end = len(songs_section) if next_start == -1 else next_start + 1
    block = songs_section[start:end]
    if '\n    difficulty: ' not in block:
        status = '    status: verified\n'
        if status not in block:
            raise SystemExit(f'no verified status for {song_id}')
        block = block.replace(status, f'{status}    difficulty: {difficulties[song_id]}\n', 1)
        songs_section = songs_section[:start] + block + songs_section[end:]

text = prefix + songs_section + suffix

content_anchor = '    - public_song_directory_precedes_verified_library\n'
for check in [
    '    - verified_song_difficulty_is_integer_1_to_5\n',
    '    - public_song_directory_shows_five_star_difficulty\n',
    '    - public_library_is_sorted_by_difficulty_then_title\n',
]:
    if check not in text:
        text = text.replace(content_anchor, content_anchor + check, 1)
        content_anchor = content_anchor + check

html_anchor = '    - song_directory_links_target_every_verified_song\n'
for check in [
    '    - song_directory_and_song_cards_show_five_star_difficulty\n',
    '    - song_directory_and_library_share_difficulty_sort_order\n',
]:
    if check not in text:
        text = text.replace(html_anchor, html_anchor + check, 1)
        html_anchor = html_anchor + check

scorebook_path.write_text(text, encoding='utf-8')

app_path = Path('src/app.js')
app = app_path.read_text(encoding='utf-8')
if 'function difficultyStars(score)' not in app:
    anchor = "function scoreLabel(score) {\n  return score.alias ? `${score.title}（${score.alias}）` : score.title;\n}\n"
    replacement = anchor + "\nfunction difficultyStars(score) {\n  const difficulty = Number(score.difficulty);\n  return `${'★'.repeat(difficulty)}${'☆'.repeat(5 - difficulty)}`;\n}\n\nfunction compareSongDifficulty(left, right) {\n  return left.difficulty - right.difficulty\n    || scoreLabel(left).localeCompare(scoreLabel(right), 'zh-Hant')\n    || left.id.localeCompare(right.id);\n}\n"
    if anchor not in app:
        raise SystemExit('scoreLabel anchor not found in src/app.js')
    app = app.replace(anchor, replacement, 1)

app = app.replace('  link.textContent = scoreLabel(song);\n', '  link.textContent = `${scoreLabel(song)} · ${difficultyStars(song)}`;\n', 1)
app = app.replace('  meta.textContent = `${song.meter} · ${song.key} · ${locale}`;\n', '  meta.textContent = `難度 ${difficultyStars(song)} · ${song.meter} · ${song.key} · ${locale}`;\n', 1)
app = app.replace(
    '  for (const song of book.library.songs) {\n',
    '  const sortedSongs = [...book.library.songs].sort(compareSongDifficulty);\n  for (const song of sortedSongs) {\n',
    1,
)
app_path.write_text(app, encoding='utf-8')

package_path = Path('package.json')
package = package_path.read_text(encoding='utf-8').replace('"version": "0.6.24"', '"version": "0.6.25"', 1)
package_path.write_text(package, encoding='utf-8')

lib_path = Path('scripts/lib.mjs')
lib = lib_path.read_text(encoding='utf-8')
if "fail('song-difficulty'" not in lib:
    anchor = "    if (score?.status !== 'verified') fail('public-status', '公開曲目 status 必須是 verified', 'status');\n"
    replacement = anchor + "    if (!Number.isInteger(score?.difficulty) || score.difficulty < 1 || score.difficulty > 5) {\n      fail('song-difficulty', '公開曲目 difficulty 必須是 1 到 5 的整數', 'difficulty');\n    }\n"
    if anchor not in lib:
        raise SystemExit('public status anchor not found in scripts/lib.mjs')
    lib = lib.replace(anchor, replacement, 1)
lib_path.write_text(lib, encoding='utf-8')

print(f'patched {len(song_ids)} verified songs with difficulty ratings, sorted rendering, and validator contract')
