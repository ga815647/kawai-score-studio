from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
OLD = "0.6.23"
NEW = "0.6.24"

def m(number, cap, seq, pickup=False):
    events = []
    for kind, pitch, duration in seq:
        event = {"kind": kind, "duration": duration}
        if kind == "note":
            event["pitch"] = pitch
        events.append(event)
    out = {"number": number, "capacity_eighth_units": cap, "events": events}
    if pickup:
        out["pickup"] = True
    return out

def number_events(measures):
    n = r = 0
    notes = []
    for measure in measures:
        rebuilt = []
        for event in measure["events"]:
            if event["kind"] == "note":
                n += 1
                eid = f"n{n:02d}"
                notes.append(eid)
            else:
                r += 1
                eid = f"r{r:02d}"
            rebuilt_event = {"id": eid, "kind": event["kind"]}
            if event["kind"] == "note":
                rebuilt_event["pitch"] = event["pitch"]
            rebuilt_event["duration"] = event["duration"]
            rebuilt.append(rebuilt_event)
        measure["events"] = rebuilt
    return notes

VERIFY = {
    "source_to_scorebook_checked": True,
    "melody_checked": True,
    "rhythm_checked": True,
    "rests_checked": True,
    "pickup_checked": True,
    "measures_checked": True,
    "ties_checked": True,
    "lyrics_checked": True,
    "user_approved": True,
}

def track(locale, pairs, continuations=None):
    out = {
        "id": "en" if locale == "en" else "zh-tw",
        "locale": locale,
        "role": "original",
        "status": "verified",
        "default": True,
        "syllables": [{"event": eid, "text": text} for eid, text in pairs],
    }
    if continuations:
        out["continuations"] = continuations
    return [out]

bingo_measures = [
    m(0, 1, [("note", "5", 1)], True),
    m(1, 4, [("note", "1", 1), ("note", "1", 1), ("note", "1", 1), ("note", "5", 1)]),
    m(2, 4, [("note", "6", 1), ("note", "6", 1), ("note", "5", 1), ("note", "5", 1)]),
    m(3, 4, [("note", "1", 1), ("note", "1", 1), ("note", "2", 1), ("note", "2", 1)]),
    m(4, 4, [("note", "3", 2), ("note", "1", 2)]),
    m(5, 4, [("note", "3", 2), ("note", "3", 2)]),
    m(6, 4, [("note", "4", 1), ("note", "4", 1), ("note", "4", 2)]),
    m(7, 4, [("note", "2", 2), ("note", "2", 2)]),
    m(8, 4, [("note", "3", 1), ("note", "3", 1), ("note", "3", 2)]),
    m(9, 4, [("note", "1", 2), ("note", "1", 2)]),
    m(10, 4, [("note", "2", 1), ("note", "2", 1), ("note", "2", 1), ("note", "1", 1)]),
    m(11, 4, [("note", "7", 1), ("note", "5", 1), ("note", "6", 1), ("note", "7", 1)]),
    m(12, 4, [("note", "1", 2), ("note", "1", 1), ("rest", None, 1)]),
]
bingo_ids = number_events(bingo_measures)
bingo_lyrics = ["There","was","a","far-","mer,","had","a","dog,","And","Bin-","go","was","his","name-","o.","B","I","N","G","O,","B","I","N","G","O,","B","I","N","G","O,","And","Bin-","go","was","his","name-","o."]

old_measures = [
    m(1, 8, [("note","5",2),("note","3",2),("note","5",4)]),
    m(2, 8, [("note","5",2),("note","3",2),("note","5",4)]),
    m(3, 8, [("note","6",2),("note","5",2),("note","4",2),("note","3",2)]),
    m(4, 8, [("note","2",2),("note","3",2),("note","4",2),("note","3",1),("note","4",1)]),
    m(5, 8, [("note","5",2),("note","1",2),("note","1",1),("note","1",1),("note","1",2)]),
    m(6, 8, [("note","1",1),("note","2",1),("note","3",1),("note","4",1),("note","5",4)]),
    m(7, 8, [("note","5",2),("note","2",2),("note","2",2),("note","4",2)]),
    m(8, 8, [("note","3",2),("note","2",2),("note","1",4)]),
]
old_ids = number_events(old_measures)
old_lyrics = ["This","old","man,","he","played","one.","He","played","nick-","nack","on","my","thumb;","With","a","nick-","nack","pad-","dy-","whack,","Give","a","dog","a","bone,","This","old","man","came","roll-","ing","home."]

clay_measures = [
    m(1, 8, [("note","3",2),("note","6",2),("note","6",4)]),
    m(2, 8, [("note","3",2),("note","7",2),("note","7",4)]),
    m(3, 8, [("note","6",3),("note","6",1),("note","6",2),("note","5",2)]),
    m(4, 8, [("note","3",6),("rest",None,2)]),
    m(5, 8, [("note","3",2),("note","6",1),("note","5",1),("note","3",2),("note","2",2)]),
    m(6, 8, [("note","1",2),("note","3",1),("note","2",1),("note","1",2),("note","7",2)]),
    m(7, 8, [("note","6",3),("note","6",1),("note","5",2),("note","4",2)]),
    m(8, 8, [("note","3",6),("rest",None,2)]),
]
clay_ids = number_events(clay_measures)
clay_lyrics = list("泥娃娃泥娃娃一個泥娃娃也有那眉毛也有那眼睛眼睛不會眨")

hand_measures = [
    m(1,4,[("note","5",3),("note","3",1)]), m(2,4,[("note","5",3),("note","3",1)]),
    m(3,4,[("note","5",1),("note","3",1),("note","2",1),("note","3",1)]), m(4,4,[("note","5",4)]),
    m(5,4,[("note","5",1),("note","5",1),("note","3",2)]), m(6,4,[("note","6",2),("note","5",2)]),
    m(7,4,[("note","3",1),("note","5",1),("note","3",1),("note","2",1)]), m(8,4,[("note","1",2),("note","2",2)]),
    m(9,4,[("note","3",2),("note","5",2)]), m(10,4,[("note","3",1),("note","2",1),("note","1",1),("note","2",1)]),
    m(11,4,[("note","3",4)]), m(12,4,[("note","6",1),("note","5",1),("note","6",1),("note","5",1)]),
    m(13,4,[("note","2",2),("note","3",2)]), m(14,4,[("note","5",4)]),
    m(15,4,[("note","6",1),("note","5",1),("note","6",1),("note","5",1)]), m(16,4,[("note","2",2),("note","3",2)]),
    m(17,4,[("note","1",4)]),
]
hand_ids = number_events(hand_measures)
hand_lyrics = list("丟丟丟手絹悄悄地放在小朋友的後面大家不要告訴他快點快點捉住他快點快點捉住他")
hand_pairs = [("n01","丟"),("n03","丟"),("n05","丟"),("n07","手"),("n09","絹")] + list(zip(hand_ids[9:], hand_lyrics[5:]))

phone_measures = [
    m(1,4,[("note","3",1),("note","5",1),("note","3",1),("note","2",1)]),
    m(2,4,[("note","3",2),("note","6_",1),("rest",None,1)]),
    m(3,4,[("note","3",1),("note","5",1),("note","3",1),("note","2",1)]),
    m(4,4,[("note","3",2),("note","6_",1),("rest",None,1)]),
    m(5,4,[("note","5",1),("rest",None,1),("note","5",1),("rest",None,1)]), m(6,4,[("note","5",4)]),
    m(7,4,[("note","3",1),("note","3",1),("note","2",1),("note","5",1)]), m(8,4,[("note","3",4)]),
    m(9,4,[("note","2",1),("rest",None,1),("note","2",1),("rest",None,1)]),
    m(10,4,[("note","2",3),("note","3",1)]),
    m(11,4,[("note","5_",1),("note","6_",1),("note","3",1),("note","2",1)]), m(12,4,[("note","1",4)]),
]
phone_ids = number_events(phone_measures)
phone_lyrics = list("一個小娃娃呀正在打電話呀喂喂喂你在哪裡呀哎哎哎我在幼兒園")
phone_pairs = list(zip([eid for eid in phone_ids if eid != "n24"], phone_lyrics))

songs = [
{"id":"bingo","title":"BINGO","status":"verified","key":"C major","meter":"2/4","pickup_eighth_units":1,
 "source":{"title":"\"Bingo\" Traditional Folk Song","source_type":"score_website","provided_by":"assistant_web_research","publisher_or_origin":"Music You Can Read / Music Notes, Inc.","publisher":"Music You Can Read","accessed_at":"2026-08-08","selected_variant":"Music You Can Read G-major 2/4 pitch-number and rhythm formats, complete first verse; transposed by scale degree to C major for KAWAI. The source closes with the complementary final partial bar; scorebook makes the post-lyric silence explicit as one trailing eighth rest so the final 2/4 measure is structurally complete.","original_key":"G major","original_meter":"2/4","pickup":1,"rights_status":"traditional_usa_folk_song_static_pitch_number_and_rhythm_score","url":"https://www.musicyoucanread.com/SONGS/00-BINGO.html","transposition_semitones":-7},"verification":VERIFY.copy(),"measures":bingo_measures,"ties":[],"lyric_tracks":track("en", zip(bingo_ids,bingo_lyrics))},
{"id":"this-old-man","title":"This Old Man","status":"verified","key":"C major","meter":"4/4","pickup_eighth_units":0,
 "source":{"title":"This Old Man - C Major","source_type":"score_pdf","provided_by":"assistant_web_research","publisher_or_origin":"PianoLessons4Children.com","publisher":"PianoLessons4Children.com","accessed_at":"2026-08-08","selected_variant":"Printable C-major 4/4 beginner score, treble melody and first English verse only; melody and rhythm independently cross-checked against the static ABC transcription.","original_key":"C major","original_meter":"4/4","pickup":0,"rights_status":"traditional_nursery_rhyme_static_c_major_pdf_with_abc_crosscheck","url":"https://www.pianolessons4children.com/sheetmusic/This_Old_Man_C_Major.pdf","supporting_sources":[{"title":"This old man - ABC transcription","publisher_or_origin":"ABCnotation / John Chambers collection","url":"https://abcnotation.com/tunePage?a=trillian.mit.edu%2F~jc%2Fmusic%2Fabc%2Fmirror%2Fmusicaviva.com%2Fanon%2Fthis-old-man%2Fthis-old-man-1%2F0000","purpose":"Machine-readable static C-major 4/4 melody and rhythm cross-check (GEG2|GEG2|AGFE|DEFE/F/|GCC/C/C|C/D/E/F/G2|GDDF|EDC2)."}]},"verification":VERIFY.copy(),"measures":old_measures,"ties":[],"lyric_tracks":track("en", zip(old_ids,old_lyrics))},
{"id":"clay-doll-zh","title":"泥娃娃","status":"verified","key":"C major","meter":"4/4","pickup_eighth_units":0,
 "source":{"title":"歌曲 泥娃娃","source_type":"score_website","provided_by":"assistant_web_research","publisher_or_origin":"簡譜空間","publisher":"簡譜空間","accessed_at":"2026-08-08","selected_variant":"Jianpu Space movable-do/C-normalized first sung verse, eight 4/4 bars as encoded by the static text notation; source lower-octave comma-marked notes that fall below the KAWAI range are raised one octave while unmarked notes retain their source register. Traditional Chinese lyric orthography is retained in scorebook.","original_key":"C major","original_meter":"4/4","pickup":0,"rights_status":"published_children_song_static_machine_readable_jianpu","url":"https://jianpu.space/zh-tw/songList/20","octave_adaptation":"Raise source lower-octave comma-marked notes by one octave only where required by the KAWAI 16-note range; preserve scale degrees and rhythm exactly."},"verification":VERIFY.copy(),"measures":clay_measures,"ties":[],"lyric_tracks":track("zh-TW", zip(clay_ids,clay_lyrics))},
{"id":"drop-the-handkerchief-zh","title":"丟手絹","status":"verified","key":"C major","meter":"2/4","pickup_eighth_units":0,
 "source":{"title":"丢手绢简谱","source_type":"score_image","provided_by":"assistant_web_research","publisher_or_origin":"風雅頌歌譜網","publisher":"風雅頌歌譜網","accessed_at":"2026-08-08","selected_variant":"Fixed static 1=E, 2/4 lyric-aligned jianpu credited 鮑侃詞／關鶴巖曲, one complete verse using the source wording 悄悄地; transposed by scale degree to C major for KAWAI and rendered with Traditional Chinese orthography.","original_key":"E major","original_meter":"2/4","pickup":0,"rights_status":"published_children_song_static_jianpu_image","url":"https://pic.3zitie.cn/fys/songku/2023/02/76/pic/mimg/0021.jpg","transposition_semitones":-4,"supporting_sources":[{"title":"丢手绢-关鹤岩","publisher_or_origin":"EveryonePiano","url":"https://www.everyonepiano.cn/Music-6100-%E4%B8%A2%E6%89%8B%E7%BB%A2-%E5%85%B3%E9%B9%A4%E5%B2%A9.html","purpose":"Static score-preview and composer/lyricist identity cross-check; primary Fengyasong image controls the selected lyric variant."}]},"verification":VERIFY.copy(),"measures":hand_measures,"ties":[],"lyric_tracks":track("zh-TW", hand_pairs,[{"from":"n01","through":"n02"},{"from":"n03","through":"n04"},{"from":"n05","through":"n06"},{"from":"n07","through":"n08"}])},
{"id":"telephone-call-zh","title":"打電話","status":"verified","key":"C major","meter":"2/4","pickup_eighth_units":0,
 "source":{"title":"打電話（《舞蹈與幼兒舞蹈創編》教材頁）","source_type":"score_pdf","provided_by":"assistant_web_research","publisher_or_origin":"高等教育出版社教材靜態 PDF","publisher":"高等教育出版社","accessed_at":"2026-08-08","selected_variant":"Static textbook PDF printed page 146, 1=C 2/4 lyric-aligned jianpu credited 佚名詞／汪玲曲; sung section only, excluding the parenthesized instrumental introduction and the two-measure instrumental cadence after the final lyric. Traditional Chinese orthography is retained in scorebook.","original_key":"C major","original_meter":"2/4","pickup":0,"rights_status":"published_textbook_static_score_pdf","url":"https://oss0.changxianggu.com/book/chapter/269_9787040524413.pdf","selected_source_page":146},"verification":VERIFY.copy(),"measures":phone_measures,"ties":[],"lyric_tracks":track("zh-TW", phone_pairs)},
]

playable = {"4_","5_","6_","7_","1","2","3","4","5","6","7","1^","2^","3^","4^","5^"}
meter_cap = {"2/4":4,"4/4":8}
expected = {"bingo":(37,37,13),"this-old-man":(32,32,8),"clay-doll-zh":(26,26,8),"drop-the-handkerchief-zh":(41,37,17),"telephone-call-zh":(29,28,12)}
for song in songs:
    note_count = 0
    for measure in song["measures"]:
        assert sum(event["duration"] for event in measure["events"]) == measure["capacity_eighth_units"], (song["id"], measure["number"])
        if not measure.get("pickup"):
            assert measure["capacity_eighth_units"] == meter_cap[song["meter"]]
        for event in measure["events"]:
            if event["kind"] == "note":
                note_count += 1
                assert event["pitch"] in playable
    assert (note_count, len(song["lyric_tracks"][0]["syllables"]), len(song["measures"])) == expected[song["id"]]

score_path = ROOT / "scorebook.yaml"
score = score_path.read_text(encoding="utf-8")
assert f"  version: {OLD}\n" in score
assert "\n  quarantine: []\n" in score
score = score.replace(f"  version: {OLD}\n", f"  version: {NEW}\n", 1)
block = yaml.safe_dump(songs, allow_unicode=True, sort_keys=False, width=120)
block = "".join("  " + line if line.strip() else line for line in block.splitlines(True))
score = score.replace("\n  quarantine: []\n", "\n" + block + "  quarantine: []\n", 1)
score_path.write_text(score, encoding="utf-8")

package_path = ROOT / "package.json"
package = package_path.read_text(encoding="utf-8")
assert f'"version": "{OLD}"' in package
package_path.write_text(package.replace(f'"version": "{OLD}"', f'"version": "{NEW}"', 1), encoding="utf-8")

test_path = ROOT / "tests/scorebook.test.mjs"
test = test_path.read_text(encoding="utf-8")
test = test.replace("test('0.6.23 has twenty-six verified songs, no quarantine, and passes structural gates'", "test('0.6.24 has thirty-one verified songs, no quarantine, and passes structural gates'", 1)
test = test.replace("assert.equal(book.project.version, '0.6.23');", "assert.equal(book.project.version, '0.6.24');", 1)
test = test.replace("verifiedSongs: 26,", "verifiedSongs: 31,", 1)
needle = "    'little-rabbit-be-good-zh',\n"
assert needle in test
test = test.replace(needle, needle + "    'bingo',\n    'this-old-man',\n    'clay-doll-zh',\n    'drop-the-handkerchief-zh',\n    'telephone-call-zh',\n", 1)

batch_test = r'''\ntest('BINGO, This Old Man, 泥娃娃, 丟手絹, and 打電話 pin the selected static-source reductions', async () => {\n  const { book } = await loadProject();\n  const specs = {\n    bingo: { title: 'BINGO', meter: '2/4', pickup: 1, measures: 13, notes: 37, lyrics: 37, rests: 1, digest: 'b90682ad2b9885c285ffaef5c05f67a70f557a69ed480e2362d874d7596bbee7' },\n    'this-old-man': { title: 'This Old Man', meter: '4/4', pickup: 0, measures: 8, notes: 32, lyrics: 32, rests: 0, digest: 'd5aaea07a1c6ffd4cfbc6de9f2694a099909954f6a5674d65adbb56722922382' },\n    'clay-doll-zh': { title: '泥娃娃', meter: '4/4', pickup: 0, measures: 8, notes: 26, lyrics: 26, rests: 2, digest: '7ddb8666951ad92729b899059f88e5a540458ba7d7094ad9f949ff1b70297ae4' },\n    'drop-the-handkerchief-zh': { title: '丟手絹', meter: '2/4', pickup: 0, measures: 17, notes: 41, lyrics: 37, rests: 0, digest: 'd43bacf7518f64e3ab60eb1637799b9e5b44a8ce787e6d173b1551a6e2df43ea' },\n    'telephone-call-zh': { title: '打電話', meter: '2/4', pickup: 0, measures: 12, notes: 29, lyrics: 28, rests: 6, digest: '73b702624282a7018f03d456ea3c091ed88c2c96850cdc808751ab7283c122bf' },\n  };\n  for (const [id, spec] of Object.entries(specs)) {\n    const song = book.library.songs.find((candidate) => candidate.id === id);\n    assert.ok(song, id);\n    assert.equal(song.title, spec.title);\n    assert.equal(song.key, 'C major');\n    assert.equal(song.meter, spec.meter);\n    assert.equal(song.pickup_eighth_units, spec.pickup);\n    assert.equal(song.measures.length, spec.measures);\n    const events = flattenEvents(song);\n    assert.equal(events.filter((event) => event.kind === 'note').length, spec.notes);\n    assert.equal(events.filter((event) => event.kind === 'rest').length, spec.rests);\n    const lyricTrack = song.lyric_tracks.find((candidate) => candidate.default);\n    assert.equal(lyricTrack.syllables.length, spec.lyrics);\n    const digest = createHash('sha256').update(JSON.stringify(\n      events.map((event) => [event.kind, event.pitch ?? null, event.duration]),\n    )).digest('hex');\n    assert.equal(digest, spec.digest, id);\n    assert.ok(Object.values(song.verification).every((value) => value === true));\n  }\n  const bingo = book.library.songs.find((song) => song.id === 'bingo');\n  assert.equal(bingo.source.url, 'https://www.musicyoucanread.com/SONGS/00-BINGO.html');\n  assert.equal(bingo.source.transposition_semitones, -7);\n  const oldMan = book.library.songs.find((song) => song.id === 'this-old-man');\n  assert.equal(oldMan.source.supporting_sources[0].url.startsWith('https://abcnotation.com/'), true);\n  const clay = book.library.songs.find((song) => song.id === 'clay-doll-zh');\n  assert.match(clay.source.octave_adaptation, /lower-octave comma-marked notes/);\n  const handkerchief = book.library.songs.find((song) => song.id === 'drop-the-handkerchief-zh');\n  assert.equal(handkerchief.source.original_key, 'E major');\n  assert.equal(handkerchief.source.transposition_semitones, -4);\n  const phone = book.library.songs.find((song) => song.id === 'telephone-call-zh');\n  assert.equal(phone.source.selected_source_page, 146);\n  assert.equal(phone.measures[9].events.at(-1).id, 'n24');\n  assert.equal(phone.lyric_tracks[0].syllables.some((item) => item.event === 'n24'), false);\n});\n\n'''
marker = "test('A4 print contract selects one verified song and permits page breaks only between systems'"
assert marker in test
test = test.replace(marker, batch_test + marker, 1)
test_path.write_text(test, encoding="utf-8")

visual_path = ROOT / "tests/library-visual.spec.mjs"
visual = visual_path.read_text(encoding="utf-8")
visual_needle = "  { id: 'little-rabbit-be-good-zh', title: '小兔子乖乖', notes: 39, lyrics: 35 },\n"
assert visual_needle in visual
visual = visual.replace(visual_needle, visual_needle + "  { id: 'bingo', title: 'BINGO', notes: 37, lyrics: 37 },\n  { id: 'this-old-man', title: 'This Old Man', notes: 32, lyrics: 32 },\n  { id: 'clay-doll-zh', title: '泥娃娃', notes: 26, lyrics: 26 },\n  { id: 'drop-the-handkerchief-zh', title: '丟手絹', notes: 41, lyrics: 37 },\n  { id: 'telephone-call-zh', title: '打電話', notes: 29, lyrics: 28 },\n", 1)
visual = visual.replace("規格 0.6.23", "規格 0.6.24")
visual = visual.replace("toHaveCount(26)", "toHaveCount(31)")
visual = visual.replace("?v=0.6.23-", "?v=0.6.24-")
visual_path.write_text(visual, encoding="utf-8")

for rel in ["scripts/_apply_children_batch_20260808.py", ".github/workflows/_apply_children_batch_20260808.yml"]:
    path = ROOT / rel
    if path.exists():
        path.unlink()
