from pathlib import Path
import json
import shutil

OLD_VERSION = "0.6.27"
NEW_VERSION = "0.6.28"
root = Path(".")
staging = root / "staging"

song_files = [
    "ode-to-joy.yamlfrag",
    "three-blind-mice.yamlfrag",
    "hot-cross-buns.yamlfrag",
    "the-mulberry-bush.yamlfrag",
]
song_snippet = "".join((staging / name).read_text(encoding="utf-8") for name in song_files)
test_block = (staging / "batch-regression.mjsfrag").read_text(encoding="utf-8")
visual_entries = (staging / "batch-visual.mjsfrag").read_text(encoding="utf-8")

scorebook_path = root / "scorebook.yaml"
scorebook = scorebook_path.read_text(encoding="utf-8")
new_ids = ["ode-to-joy", "three-blind-mice", "hot-cross-buns", "the-mulberry-bush"]
if not all(f"  - id: {song_id}\n" in scorebook for song_id in new_ids):
    marker = "  quarantine: []\n"
    if marker not in scorebook:
        raise SystemExit("scorebook quarantine marker not found")
    if any(f"  - id: {song_id}\n" in scorebook for song_id in new_ids):
        raise SystemExit("partial batch already present")
    scorebook = scorebook.replace(marker, song_snippet + marker, 1)
if f"  version: {OLD_VERSION}\n" in scorebook:
    scorebook = scorebook.replace(f"  version: {OLD_VERSION}\n", f"  version: {NEW_VERSION}\n", 1)
elif f"  version: {NEW_VERSION}\n" not in scorebook:
    raise SystemExit("unexpected scorebook version")
scorebook_path.write_text(scorebook, encoding="utf-8")

package_path = root / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
if package.get("version") not in {OLD_VERSION, NEW_VERSION}:
    raise SystemExit(f"unexpected package version: {package.get('version')}")
package["version"] = NEW_VERSION
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

score_test_path = root / "tests" / "scorebook.test.mjs"
score_test = score_test_path.read_text(encoding="utf-8")
score_test = score_test.replace(
    "test('0.6.27 has forty-one verified songs, no quarantine, and passes structural gates'",
    "test('0.6.28 has forty-five verified songs, no quarantine, and passes structural gates'",
)
score_test = score_test.replace("assert.equal(book.project.version, '0.6.27');", "assert.equal(book.project.version, '0.6.28');", 1)
score_test = score_test.replace("verifiedSongs: 41,", "verifiedSongs: 45,", 1)
ids_marker = "    'one-pug-dog-zh',\n  ]);"
if "'ode-to-joy'," not in score_test:
    replacement = (
        "    'one-pug-dog-zh',\n"
        "    'ode-to-joy',\n"
        "    'three-blind-mice',\n"
        "    'hot-cross-buns',\n"
        "    'the-mulberry-bush',\n"
        "  ]);"
    )
    if ids_marker not in score_test:
        raise SystemExit("scorebook song-id marker not found")
    score_test = score_test.replace(ids_marker, replacement, 1)
if "four-song Ode/Mice/Buns/Mulberry batch" not in score_test:
    score_test = score_test.rstrip() + "\n\n" + test_block
score_test_path.write_text(score_test, encoding="utf-8")

visual_path = root / "tests" / "library-visual.spec.mjs"
visual = visual_path.read_text(encoding="utf-8")
visual_marker = "  { id: 'one-pug-dog-zh', title: '一隻哈巴狗', notes: 20, lyrics: 20 },\n];"
if "id: 'ode-to-joy'" not in visual:
    if visual_marker not in visual:
        raise SystemExit("visual song marker not found")
    visual = visual.replace(
        visual_marker,
        "  { id: 'one-pug-dog-zh', title: '一隻哈巴狗', notes: 20, lyrics: 20 },\n" + visual_entries + "];",
        1,
    )
visual = visual.replace("規格 0.6.27", "規格 0.6.28")
visual = visual.replace(".toHaveCount(41)", ".toHaveCount(45)")
visual = visual.replace("?v=0.6.27-", "?v=0.6.28-")
visual_path.write_text(visual, encoding="utf-8")

difficulty_path = root / "tests" / "difficulty.test.mjs"
difficulty = difficulty_path.read_text(encoding="utf-8")
if "assert.equal(book.library.songs.length, 41);" in difficulty:
    difficulty = difficulty.replace("assert.equal(book.library.songs.length, 41);", "assert.equal(book.library.songs.length, 45);", 1)
elif "assert.equal(book.library.songs.length, 45);" not in difficulty:
    raise SystemExit("unexpected difficulty song count")
difficulty_path.write_text(difficulty, encoding="utf-8")

(root / ".github" / "workflows" / "apply-children-batch.yml").unlink(missing_ok=True)
(root / "scripts" / "apply_children_batch.py").unlink(missing_ok=True)
shutil.rmtree(staging, ignore_errors=True)
