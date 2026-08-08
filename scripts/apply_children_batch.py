from pathlib import Path
import base64
import json
import shutil
import zlib

OLD_VERSION = "0.6.26"
NEW_VERSION = "0.6.27"
OLD_COUNT = 36
NEW_COUNT = 41
root = Path(".")

def decode(value):
    return zlib.decompress(base64.b64decode(value)).decode("utf-8")

song_snippet = decode("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")
test_block = decode("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")
visual_entries = decode("eNpV0MFqwkAQBuC7TzE3LxmQLbHiueDFguBBegzdIVncZpZkRaIUvAiFHjx4KPQpPAgVim9jkL5FN8Hg5jb8P3zMDMAalBxCt4jSORFKZqmpG4BVVpPLX+ocnpo8ZUv5EMIwAF1k6rWaH+A96EAj5XNl0DK+Fah54VFTV4BleC5gXBc3S3iWCFuWYYMxU442IVxSlJP2wAkbGLkWXAuzpr2p/Z63oWipWlkHYEYSMyVVGmPizsNV4tnlYXc9bsvT+S4+irvYH7RETgnNInbvi9vM5bT5+/4t9x/lz/H6+eUd7a0nehX2D7Uog4Y=")

scorebook_path = root / "scorebook.yaml"
scorebook = scorebook_path.read_text(encoding="utf-8")
new_ids = [
    "yankee-doodle",
    "skip-to-my-lou",
    "pop-goes-the-weasel",
    "little-red-riding-hood-zh",
    "one-pug-dog-zh",
]
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
    "test('0.6.26 has thirty-six verified songs, no quarantine, and passes structural gates'",
    "test('0.6.27 has forty-one verified songs, no quarantine, and passes structural gates'",
)
score_test = score_test.replace("assert.equal(book.project.version, '0.6.26');", "assert.equal(book.project.version, '0.6.27');", 1)
score_test = score_test.replace("verifiedSongs: 36,", "verifiedSongs: 41,", 1)
ids_marker = "    'little-mouse-on-the-lampstand-zh',\n  ]);"
if "'yankee-doodle'," not in score_test:
    replacement = (
        "    'little-mouse-on-the-lampstand-zh',\n"
        "    'yankee-doodle',\n"
        "    'skip-to-my-lou',\n"
        "    'pop-goes-the-weasel',\n"
        "    'little-red-riding-hood-zh',\n"
        "    'one-pug-dog-zh',\n"
        "  ]);"
    )
    if ids_marker not in score_test:
        raise SystemExit("scorebook song-id marker not found")
    score_test = score_test.replace(ids_marker, replacement, 1)
if "five-song Yankee/Skip/Pop/red-hood/pug batch" not in score_test:
    score_test = score_test.rstrip() + "\n\n" + test_block
score_test_path.write_text(score_test, encoding="utf-8")

visual_path = root / "tests" / "library-visual.spec.mjs"
visual = visual_path.read_text(encoding="utf-8")
visual_marker = "  { id: 'little-mouse-on-the-lampstand-zh', title: '小老鼠上燈台', notes: 26, lyrics: 25 },\n];"
if "id: 'yankee-doodle'" not in visual:
    if visual_marker not in visual:
        raise SystemExit("visual song marker not found")
    visual = visual.replace(
        visual_marker,
        "  { id: 'little-mouse-on-the-lampstand-zh', title: '小老鼠上燈台', notes: 26, lyrics: 25 },\n"
        + visual_entries + "];",
        1,
    )
visual = visual.replace("規格 0.6.26", "規格 0.6.27")
visual = visual.replace(".toHaveCount(36)", ".toHaveCount(41)")
visual = visual.replace("?v=0.6.26-", "?v=0.6.27-")
visual_path.write_text(visual, encoding="utf-8")

(root / ".github" / "workflows" / "apply-children-batch.yml").unlink(missing_ok=True)
(root / "scripts" / "apply_children_batch.py").unlink(missing_ok=True)
