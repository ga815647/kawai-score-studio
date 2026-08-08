from pathlib import Path
import json
import yaml

DATA = [
    ".github/kss-batch/head.json",
    ".github/kss-batch/ducks.json",
    ".github/kss-batch/painter.json",
    ".github/kss-batch/counting-ducks.json",
    ".github/kss-batch/rabbit.json",
]

songs = [json.loads(Path(path).read_text(encoding="utf-8")) for path in DATA]
scorebook = Path("scorebook.yaml")
text = scorebook.read_text(encoding="utf-8")

old_version = "  version: 0.6.22\n"
new_version = "  version: 0.6.23\n"
assert text.count(old_version) == 1, "unexpected scorebook version marker"
text = text.replace(old_version, new_version, 1)

needle = "  quarantine: []\nworkflow:"
assert text.count(needle) == 1, "unexpected library tail marker"
raw = yaml.safe_dump(songs, allow_unicode=True, sort_keys=False, width=120)
fragment = "".join(f"  {line}\n" for line in raw.splitlines())
text = text.replace(needle, fragment + needle, 1)
scorebook.write_text(text, encoding="utf-8")

package = Path("package.json")
pkg = json.loads(package.read_text(encoding="utf-8"))
assert pkg["version"] == "0.6.22", "unexpected package version"
pkg["version"] = "0.6.23"
package.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("added:", ", ".join(song["id"] for song in songs))
