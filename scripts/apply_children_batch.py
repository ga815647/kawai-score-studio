from pathlib import Path
import json
import shutil

OLD_VERSION = "0.6.25"
NEW_VERSION = "0.6.26"
root = Path(".")
boot = root / ".bootstrap"

payload_order = [
    "the-muffin-man.yaml",
    "the-farmer-in-the-dell.yaml",
    "ring-around-the-rosie.yaml",
    "little-sister-carries-doll-zh.yaml",
    "little-mouse-on-the-lampstand-zh.yaml",
]
song_snippet = "".join((boot / name).read_text(encoding="utf-8") for name in payload_order)
test_block = (boot / "batch_test.mjs").read_text(encoding="utf-8")
visual_entries = (boot / "visual_entries.txt").read_text(encoding="utf-8")

scorebook_path = root / "scorebook.yaml"
scorebook = scorebook_path.read_text(encoding="utf-8")
if "  - id: the-muffin-man\n" not in scorebook:
    marker = "  quarantine: []\n"
    if marker not in scorebook:
        raise SystemExit("scorebook quarantine marker not found")
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
    "test('0.6.25 has thirty-one verified songs, no quarantine, and passes structural gates'",
    "test('0.6.26 has thirty-six verified songs, no quarantine, and passes structural gates'",
)
score_test = score_test.replace("assert.equal(book.project.version, '0.6.25');", "assert.equal(book.project.version, '0.6.26');", 1)
score_test = score_test.replace("verifiedSongs: 31,", "verifiedSongs: 36,", 1)
ids_marker = "    'telephone-call-zh',\n  ]);"
if "'the-muffin-man'," not in score_test:
    replacement = (
        "    'telephone-call-zh',\n"
        "    'the-muffin-man',\n"
        "    'the-farmer-in-the-dell',\n"
        "    'ring-around-the-rosie',\n"
        "    'little-sister-carries-doll-zh',\n"
        "    'little-mouse-on-the-lampstand-zh',\n"
        "  ]);"
    )
    if ids_marker not in score_test:
        raise SystemExit("scorebook song-id marker not found")
    score_test = score_test.replace(ids_marker, replacement, 1)
if "five-song Muffin/Farmer/Rosie/doll/mouse batch" not in score_test:
    score_test = score_test.rstrip() + "\n\n" + test_block
score_test_path.write_text(score_test, encoding="utf-8")

visual_path = root / "tests" / "library-visual.spec.mjs"
visual = visual_path.read_text(encoding="utf-8")
visual_marker = "  { id: 'telephone-call-zh', title: '打電話', notes: 29, lyrics: 28 },\n];"
if "id: 'the-muffin-man'" not in visual:
    if visual_marker not in visual:
        raise SystemExit("visual song marker not found")
    visual = visual.replace(
        visual_marker,
        "  { id: 'telephone-call-zh', title: '打電話', notes: 29, lyrics: 28 },\n"
        + visual_entries + "];",
        1,
    )
visual = visual.replace("規格 0.6.25", "規格 0.6.26")
visual = visual.replace(".toHaveCount(31)", ".toHaveCount(36)")
visual = visual.replace("?v=0.6.25-", "?v=0.6.26-")
visual_path.write_text(visual, encoding="utf-8")

shutil.rmtree(boot)
(root / ".github" / "workflows" / "apply-children-batch.yml").unlink(missing_ok=True)
(root / "scripts" / "apply_children_batch.py").unlink(missing_ok=True)
