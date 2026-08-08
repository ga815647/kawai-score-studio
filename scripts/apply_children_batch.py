from pathlib import Path
import base64
import json
import zlib

OLD_VERSION = "0.6.27"
NEW_VERSION = "0.6.28"
OLD_COUNT = 41
NEW_COUNT = 45
root = Path(".")

def decode(value):
    return zlib.decompress(base64.b64decode(value)).decode("utf-8")

song_snippet = decode("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")
test_block = decode("eNq1V81uGzcQvucpCAPBrgBrvf9aOXADJEhRBEgTILkJhsGfoUR7tVSX3Nhq4B567kP0WKAP0adpgb5Fh9yVLNsyksZtDhE5HHI/fvPNcGzB2DCQumvHRjdz8lbA0RvF4ehF15ijN13NoG3XhFHLFwSuKLf1mizdDAyR6goEMZZaxYnBMziY4JBQs244CUfk5Bvy6QkhXDfGkk+EaX1BrskJoZdUWVJrKt61+hy4DUfPtn5mBdygk9t5oAWMrR6f6/XBsbegzSpbA04P/vzj979++/nvX385OOxXhJJS8a62zjsbjEuw0Dr3/CjfOK4Uv+hWaIwHQ6MtGJyX6WCo163iZsdDqDlS5c7hVSXzIq5EQfMsZbSQORRAeZxWBUxEVk1pnMZFkVS55BztWZLncVLyLC9YLOUGRNfW7riFtStzfHREGUcUSKVuIq6XR7Zr4B2dw3N6YltV14o20VLZCET3NP32p3OO/y87o9wv7nUz1ba6xYFttQHaCGqM5ori1dyJWz+M8Qf9Wq9xGOO/A4Rz7TAd2EULMGa1asR4iSLYw/kH50JeOBfidPJl1JdH1Wepz6u71G8tN9wLwWnMKshEkSbTtKDVRJZJWjKe5KysBJ3GGaviSZVmVSqzgseySCfIfJ7JCUDx77mntTrn0VzZRccipXdIl62CRtTr8UJ3BsYGGqXbMV9o1Xpms/SG2YW2Y45RMWOGebWH1++0JS+dA3GJt5fV5GsEnUzusrq13LAKZVFlTE5pElcpnfJiApOSsWlB07KalmKa5TITE8jSjKUyoUmalmVZJBMax1XO6AOsXl5eRiuUrXaVRejLxmW85xdv+zSN/X3x1904Wgm5K0QYL4fag4yZxV4lAtnWpxfO5z+TYlbeJS0r7pGWFtPJNM8Slmc5E7KUVUanOGBplUnGZUYntIKSFbGkkmXA0hy4SCZARVlVrPwfyoArsPjz6iO0a0HX75H2F/tNqVfopPSUP7l+9gR/pW5J2NfgmRKHWO2xElsQp0RL8pa5Oh1BgyDAhL5Ij0ZDUIbC7d6PE1/lo1qxlrbryNlMJLFahCHHiqQEViP/MGxnkRLk5OSEKOEfAYLPh4HWRavoidLsP7y3ADx2t/VrkxXCDtJ8/6H0jjJ0tN8YH910Abghe4rN3rtvgQTcvsZ2T/fxB7158Z6DmC7s46xplzc7efvXBzf1bG6F0dvbg7B6DQ9g+0rpzUXN7UQkKb+wVNorACSMMvYOPix/5gNgWTSMvjU2I0bux7nGWNbUWmld+7s/dh7V3x/DXyETYT/1H/Ci6cI+I+1LgEi8YRTU0c7vYuZJPyOHkHoFtKb9AAP4qPj3PvOlzIhMgKQZ5H0q/PzLruqasxqfyHoq+CtxmAlNzhc3QG6Cma8FsEC2HebSkqzAcZh7KMI4GTty6P46QHV5mPTEr5bqt589J09Uuwt4outbH7LSvG6NbtPRlCVHwFvC631GzCAOzoGlRIq/dynEQvn7/9vvIYAI3cyXX4Z0rjEZRf0oYLOBqr8z79VvJ0xuGFL1+su3isHF7RC0Ibvq+HsgAQwCsXnko6HAr/LP49HCoRkock0AhiLZbInG0DnrGas1pDbj249XVYGq1N+hWzVWzdXQNbWfQ3qcKiME+aOjYZ8bgulHNMZn5wFzvwoUt1I0uZklyupEAteE4GfXBxvpSnAW9xHoCXf/1GAbv9nLBfWC3k9g5jb4gV/EWdidXi13Qrrl5DOjbbdIeyM68qX74SURvz3qZI4MioVykgF02jcspTTOalRMpKTBW8klWFDGTgEvYqWdJwqaAAZUirYCnLBFi+oDUfKD9h7fZbWokK4wPSTr6okx/IMXvpfZo1MtqNpsFGf4llaOoZ0HqR244CxIcV6enXmu35LLphB4lmTtd1+c1M3h/hW7S/WRvTryb3D7aquk8T/hSzj4R2eolJmmTOX5Q7rqbL/w8C8j1KR7vcvEfKDSutw==")
visual_entries = decode("eNpdzjEOgjAUxvHdU7zNhSYiCIQRFxc2TwC8hJrCS9oyEOPi7CEcTTyEp9HEW9hKDeD28v2TXx7AEXiVwpIqZJrYgfqlB5prgWZ8Pu6v2/l9vZitJY0qhWjtgeglL829gpO3gJ+ga4nICsHbijW8xImztwkymyAfkuPCZOTCZObVpFkpSSlWdK2aaDvSsLUBsiE4y49Hy4//fkPWdKJAKXvDqXr2HELumhG/zYlBNIrBxoofcYxhrQ==")

scorebook_path = root / "scorebook.yaml"
scorebook = scorebook_path.read_text(encoding="utf-8")
new_ids = [
    "ode-to-joy",
    "three-blind-mice",
    "hot-cross-buns",
    "the-mulberry-bush",
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
        "  { id: 'one-pug-dog-zh', title: '一隻哈巴狗', notes: 20, lyrics: 20 },\n"
        + visual_entries + "];",
        1,
    )
visual = visual.replace("規格 0.6.27", "規格 0.6.28")
visual = visual.replace(".toHaveCount(41)", ".toHaveCount(45)")
visual = visual.replace("?v=0.6.27-", "?v=0.6.28-")
visual_path.write_text(visual, encoding="utf-8")

difficulty_path = root / "tests" / "difficulty.test.mjs"
difficulty = difficulty_path.read_text(encoding="utf-8")
if "assert.equal(book.library.songs.length, 41);" in difficulty:
    difficulty = difficulty.replace(
        "assert.equal(book.library.songs.length, 41);",
        "assert.equal(book.library.songs.length, 45);",
        1,
    )
elif "assert.equal(book.library.songs.length, 45);" not in difficulty:
    raise SystemExit("unexpected difficulty song count")
difficulty_path.write_text(difficulty, encoding="utf-8")

(root / ".github" / "workflows" / "apply-children-batch.yml").unlink(missing_ok=True)
(root / "scripts" / "apply_children_batch.py").unlink(missing_ok=True)
