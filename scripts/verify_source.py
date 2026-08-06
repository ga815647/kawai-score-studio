#!/usr/bin/env python3
"""Deterministic MusicXML source verification for Kawai Score Studio."""

from __future__ import annotations

import base64
import hashlib
import html
import importlib.metadata
import json
import re
import sys
import traceback
import urllib.request
from fractions import Fraction
from pathlib import Path
from typing import Any

import verovio
import xmlschema
import yaml
from music21 import chord, converter, key, meter, note, stream

ROOT = Path(__file__).resolve().parents[1]
SCOREBOOK_PATH = ROOT / "scorebook.yaml"
FIXTURE_BOOK_PATH = ROOT / "fixtures" / "engine-fixtures.yaml"
REPORT_DIR = ROOT / "reports" / "source"
CACHE_DIR = ROOT / ".cache" / "musicxml"

MAJOR_SCALE_SEMITONES = (0, 2, 4, 5, 7, 9, 11)
TONIC_MIDI = {
    "C": 60, "C#": 61, "Db": 61, "D": 62, "D#": 63, "Eb": 63,
    "E": 64, "F": 65, "F#": 66, "Gb": 66, "G": 67, "G#": 68,
    "Ab": 68, "A": 69, "A#": 70, "Bb": 70, "B": 71,
}


def read_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = yaml.safe_load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path} 必須是 YAML object")
    return value


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def git_blob_sha(content: bytes) -> str:
    prefix = f"blob {len(content)}\0".encode("ascii")
    return hashlib.sha1(prefix + content).hexdigest()


def download_pinned(url: str, expected_blob_sha: str, destination: Path) -> dict[str, Any]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    content: bytes | None = None
    source = "cache"
    if destination.exists():
        candidate = destination.read_bytes()
        if git_blob_sha(candidate) == expected_blob_sha:
            content = candidate
    if content is None:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "kawai-score-studio-source-verification/1"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
        source = "download"
        actual = git_blob_sha(content)
        if actual != expected_blob_sha:
            raise ValueError(
                f"固定 schema 雜湊不符：{destination.name} expected={expected_blob_sha} actual={actual}"
            )
        destination.write_bytes(content)
    return {
        "file": destination.name,
        "url": url,
        "expectedGitBlobSha": expected_blob_sha,
        "actualGitBlobSha": git_blob_sha(content),
        "source": source,
        "pass": git_blob_sha(content) == expected_blob_sha,
    }


def prepare_schema(spec: dict[str, Any]) -> tuple[Path, list[dict[str, Any]]]:
    release = spec["schema"]["release"]
    files = spec["schema"]["files"]
    schema_dir = CACHE_DIR / release
    base_url = f"https://raw.githubusercontent.com/w3c-cg/musicxml/{release}/schema"
    records = []
    for filename in ("musicxml.xsd", "xml.xsd"):
        expected = files[filename]["git_blob_sha"]
        records.append(
            download_pinned(
                f"{base_url}/{filename}",
                expected,
                schema_dir / filename,
            )
        )

    original = (schema_dir / "musicxml.xsd").read_text(encoding="utf-8")
    patched, count = re.subn(
        r'(<xs:import\s+namespace="http://www\.w3\.org/XML/1998/namespace"\s+schemaLocation=")[^"]+(")',
        r"\1xml.xsd\2",
        original,
        count=1,
    )
    if count != 1:
        patched, count = re.subn(
            r'(<xsd:import\s+namespace="http://www\.w3\.org/XML/1998/namespace"\s+schemaLocation=")[^"]+(")',
            r"\1xml.xsd\2",
            original,
            count=1,
        )
    if count != 1:
        raise ValueError("找不到 MusicXML XSD 的 xml namespace import")
    local_schema = schema_dir / "musicxml-local.xsd"
    local_schema.write_text(patched, encoding="utf-8")
    return local_schema, records


def sanitize_musicxml(source: Path, destination: Path) -> dict[str, Any]:
    text = source.read_text(encoding="utf-8")
    if re.search(r"<!ENTITY\b", text, flags=re.IGNORECASE):
        raise ValueError("MusicXML 禁止 ENTITY 宣告")
    doctype_matches = list(re.finditer(r"<!DOCTYPE\b", text, flags=re.IGNORECASE))
    if doctype_matches:
        if re.search(r"<!DOCTYPE[^>]*\[", text, flags=re.IGNORECASE | re.DOTALL):
            raise ValueError("MusicXML 禁止 DOCTYPE internal subset")
        text, count = re.subn(
            r"<!DOCTYPE[^>]*>\s*",
            "",
            text,
            count=1,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if count != 1:
            raise ValueError("無法安全移除 MusicXML DOCTYPE")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(text, encoding="utf-8")
    root_match = re.search(r"<([A-Za-z0-9_-]+)(?:\s|>)", text)
    root_name = root_match.group(1) if root_match else None
    return {
        "source": str(source.relative_to(ROOT)),
        "sanitized": str(destination.relative_to(ROOT)),
        "doctypeRemoved": bool(doctype_matches),
        "entityDeclarationsRejected": True,
        "root": root_name,
    }


def rational_json(value: Any) -> int | str:
    fraction = Fraction(value).limit_denominator(4096)
    if fraction.denominator == 1:
        return fraction.numerator
    return f"{fraction.numerator}/{fraction.denominator}"


def rational_fraction(value: int | str) -> Fraction:
    return Fraction(value)


def version_of(distribution: str) -> str:
    return importlib.metadata.version(distribution)


def first_element(iterator: Any) -> Any | None:
    values = list(iterator)
    return values[0] if values else None


def measure_number(value: Any) -> int | str:
    try:
        return int(value)
    except (TypeError, ValueError):
        return str(value)


def normalize_music21_score(score: stream.Score) -> dict[str, Any]:
    parts = list(score.parts)
    if len(parts) != 1:
        raise ValueError(f"MusicXML 必須只有一個 part，目前為 {len(parts)}")

    part = parts[0]
    measures = list(part.getElementsByClass(stream.Measure))
    if not measures:
        raise ValueError("MusicXML 沒有 measure")

    time_signature = first_element(score.recurse().getElementsByClass(meter.TimeSignature))
    if time_signature is None:
        raise ValueError("MusicXML 沒有拍號")
    meter_text = time_signature.ratioString
    capacity_eighth = rational_json(time_signature.barDuration.quarterLength * 2)

    key_signature = first_element(score.recurse().getElementsByClass(key.KeySignature))
    key_fifths = int(key_signature.sharps) if key_signature is not None else None

    events: list[dict[str, Any]] = []
    previous_end_by_measure: dict[int | str, Fraction] = {}

    for measure in measures:
        number_value = measure_number(measure.number)
        elements = list(measure.recurse().notesAndRests)
        measure_event_index = 0
        for item in elements:
            if isinstance(item, chord.Chord):
                raise ValueError(f"不支援和弦：measure {number_value}")
            if not isinstance(item, (note.Note, note.Rest)):
                continue
            duration_eighth = rational_json(item.duration.quarterLength * 2)
            if rational_fraction(duration_eighth) <= 0:
                raise ValueError(f"不支援零時值或裝飾音：measure {number_value}")
            offset_eighth = rational_json(item.getOffsetInHierarchy(measure) * 2)
            start = rational_fraction(offset_eighth)
            end = start + rational_fraction(duration_eighth)
            previous_end = previous_end_by_measure.get(number_value, Fraction(0))
            if start < previous_end:
                raise ValueError(f"MusicXML 不是單聲部：measure {number_value}")
            previous_end_by_measure[number_value] = end

            pitch_midi = int(item.pitch.midi) if isinstance(item, note.Note) else None
            tie_type = item.tie.type if isinstance(item, note.Note) and item.tie else None
            lyric = item.lyric if isinstance(item, note.Note) and item.lyric else ""
            events.append({
                "measure": number_value,
                "event_index": measure_event_index,
                "offset_eighth_units": offset_eighth,
                "kind": "note" if isinstance(item, note.Note) else "rest",
                "pitch_midi": pitch_midi,
                "duration_eighth_units": duration_eighth,
                "tie": tie_type,
                "lyric": lyric,
            })
            measure_event_index += 1

    first_measure = measures[0]
    first_duration = rational_json(first_measure.duration.quarterLength * 2)
    pickup = first_duration if rational_fraction(first_duration) < rational_fraction(capacity_eighth) else 0

    return {
        "metadata": {
            "partCount": 1,
            "measureCount": len(measures),
            "meter": meter_text,
            "keyFifths": key_fifths,
            "pickupEighthUnits": pickup,
        },
        "events": events,
    }


def parse_major_key(name: str) -> str:
    match = re.fullmatch(r"([A-G](?:#|b)?) major", str(name))
    if not match:
        raise ValueError(f"來源 Gate 目前只支援大調：{name}")
    return match.group(1)


def pitch_token_to_midi(token: str, key_name: str) -> int:
    match = re.fullmatch(r"([1-7])(\^|_)?", str(token))
    if not match:
        raise ValueError(f"非法簡譜音符：{token}")
    tonic = parse_major_key(key_name)
    tonic_midi = TONIC_MIDI[tonic]
    degree = int(match.group(1))
    octave = 1 if match.group(2) == "^" else -1 if match.group(2) == "_" else 0
    return tonic_midi + MAJOR_SCALE_SEMITONES[degree - 1] + octave * 12


def normalize_scorebook_fixture(fixture: dict[str, Any]) -> dict[str, Any]:
    lyric_tracks = fixture.get("lyric_tracks") or []
    track = next((item for item in lyric_tracks if item.get("default") is True), None)
    if track is None:
        raise ValueError("fixture 缺少 default lyric track")
    lyric_map = {item["event"]: item["text"] for item in track.get("syllables", [])}

    tie_roles: dict[str, set[str]] = {}
    for tie in fixture.get("ties", []):
        tie_roles.setdefault(tie["from"], set()).add("start")
        tie_roles.setdefault(tie["to"], set()).add("stop")

    events: list[dict[str, Any]] = []
    for measure_data in fixture.get("measures", []):
        offset = Fraction(0)
        for event_index, event in enumerate(measure_data.get("events", [])):
            roles = tie_roles.get(event["id"], set())
            tie_value = (
                "continue" if roles == {"start", "stop"}
                else "start" if "start" in roles
                else "stop" if "stop" in roles
                else None
            )
            duration = rational_json(event["duration"])
            events.append({
                "measure": measure_data["number"],
                "event_index": event_index,
                "offset_eighth_units": rational_json(offset),
                "kind": event["kind"],
                "pitch_midi": (
                    pitch_token_to_midi(event["pitch"], fixture["key"])
                    if event["kind"] == "note"
                    else None
                ),
                "duration_eighth_units": duration,
                "tie": tie_value,
                "lyric": lyric_map.get(event["id"], ""),
            })
            offset += rational_fraction(duration)

    key_name = parse_major_key(fixture["key"])
    circle_of_fifths = {
        "Cb": -7, "Gb": -6, "Db": -5, "Ab": -4, "Eb": -3, "Bb": -2, "F": -1,
        "C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F#": 6, "C#": 7,
    }
    return {
        "metadata": {
            "partCount": 1,
            "measureCount": len(fixture.get("measures", [])),
            "meter": fixture["meter"],
            "keyFifths": circle_of_fifths[key_name],
            "pickupEighthUnits": fixture.get("pickup_eighth_units", 0),
        },
        "events": events,
    }


def compare_normalized(
    left: dict[str, Any],
    right: dict[str, Any],
    fields: list[str],
    left_name: str,
    right_name: str,
) -> dict[str, Any]:
    differences: list[dict[str, Any]] = []
    for field in ("partCount", "measureCount", "meter", "keyFifths", "pickupEighthUnits"):
        left_value = left["metadata"].get(field)
        right_value = right["metadata"].get(field)
        if left_value != right_value:
            differences.append({
                "scope": "metadata",
                "field": field,
                left_name: left_value,
                right_name: right_value,
            })

    left_events = left["events"]
    right_events = right["events"]
    if len(left_events) != len(right_events):
        differences.append({
            "scope": "events",
            "field": "event_count",
            left_name: len(left_events),
            right_name: len(right_events),
        })

    for index in range(max(len(left_events), len(right_events))):
        left_event = left_events[index] if index < len(left_events) else None
        right_event = right_events[index] if index < len(right_events) else None
        if left_event is None or right_event is None:
            differences.append({
                "scope": "event",
                "index": index,
                left_name: left_event,
                right_name: right_event,
            })
            continue
        for field in fields:
            if left_event.get(field) != right_event.get(field):
                differences.append({
                    "scope": "event",
                    "index": index,
                    "measure": left_event.get("measure"),
                    "event_index": left_event.get("event_index"),
                    "field": field,
                    left_name: left_event.get(field),
                    right_name: right_event.get(field),
                })

    return {
        "pass": not differences,
        "left": left_name,
        "right": right_name,
        "eventCount": {"left": len(left_events), "right": len(right_events)},
        "differences": differences,
    }


def validate_xml(schema: xmlschema.XMLSchema, path: Path) -> dict[str, Any]:
    errors = [str(error) for error in schema.iter_errors(str(path))]
    return {
        "file": str(path.relative_to(ROOT)),
        "pass": not errors,
        "errors": errors,
    }


def render_verovio(source: Path, svg_path: Path, midi_path: Path) -> dict[str, Any]:
    toolkit = verovio.toolkit()
    toolkit.setOptions({
        "adjustPageHeight": True,
        "breaks": "auto",
        "pageWidth": 2100,
        "scale": 40,
    })
    if not toolkit.loadFile(str(source)):
        raise ValueError("Verovio 無法載入 MusicXML")
    svg = toolkit.renderToSVG(1)
    if not svg or "<svg" not in svg:
        raise ValueError("Verovio 未產生 SVG")
    svg_path.write_text(svg, encoding="utf-8")

    midi_value = toolkit.renderToMIDI()
    if isinstance(midi_value, bytes):
        midi_bytes = midi_value
    elif isinstance(midi_value, str):
        try:
            midi_bytes = base64.b64decode(midi_value, validate=True)
        except Exception:
            midi_bytes = midi_value.encode("latin-1")
    else:
        raise ValueError("Verovio MIDI 回傳型別不支援")
    if len(midi_bytes) < 14 or midi_bytes[:4] != b"MThd":
        raise ValueError("Verovio 未產生有效 MIDI header")
    midi_path.write_bytes(midi_bytes)
    version = toolkit.getVersion() if hasattr(toolkit, "getVersion") else version_of("verovio")
    return {
        "version": str(version),
        "svg": str(svg_path.relative_to(ROOT)),
        "svgBytes": svg_path.stat().st_size,
        "midi": str(midi_path.relative_to(ROOT)),
        "midiBytes": midi_path.stat().st_size,
        "pass": True,
    }


def write_html_report(summary: dict[str, Any], destination: Path) -> None:
    checks = summary.get("checks", {})
    rows = "\n".join(
        f"<tr><th>{html.escape(name)}</th><td>{'PASS' if value else 'FAIL'}</td></tr>"
        for name, value in checks.items()
    )
    errors = summary.get("errors", [])
    error_html = (
        "<p>None</p>"
        if not errors
        else "<ul>" + "".join(f"<li>{html.escape(str(item))}</li>" for item in errors) + "</ul>"
    )
    destination.write_text(
        f"""<!doctype html>
<html lang="zh-Hant">
<head><meta charset="utf-8"><title>MusicXML Source Verification</title>
<style>body{{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem}}
table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #bbb;padding:.5rem;text-align:left}}
.pass{{color:#176b2c}}.fail{{color:#a31515}}code{{word-break:break-all}}</style></head>
<body>
<h1>MusicXML Source Verification</h1>
<p class="{'pass' if summary.get('pass') else 'fail'}"><strong>{'PASS' if summary.get('pass') else 'FAIL'}</strong></p>
<p>Fixture: <code>{html.escape(str(summary.get('fixture')))}</code></p>
<table>{rows}</table>
<h2>Errors</h2>{error_html}
</body></html>
""",
        encoding="utf-8",
    )


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    summary: dict[str, Any] = {
        "pass": False,
        "fixture": None,
        "checks": {},
        "tools": {},
        "errors": [],
    }
    schema_report: dict[str, Any] = {
        "pass": False,
        "schemaFiles": [],
        "source": None,
        "roundtrip": None,
    }

    try:
        book = read_yaml(SCOREBOOK_PATH)
        fixture_book = read_yaml(FIXTURE_BOOK_PATH)
        spec = book["source_verification"]
        source_path = ROOT / spec["synthetic_fixture"]["musicxml_file"]
        fixture_id = spec["synthetic_fixture"]["scorebook_fixture_id"]
        fixture = next(
            item for item in fixture_book.get("fixtures", [])
            if item.get("id") == fixture_id
        )
        summary["fixture"] = fixture_id
        summary["tools"] = {
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
            "music21": version_of("music21"),
            "verovio": version_of("verovio"),
            "xmlschema": version_of("xmlschema"),
            "pyyaml": version_of("PyYAML"),
        }
        expected_tools = spec["tools"]
        for tool_name, expected in expected_tools.items():
            actual = summary["tools"][tool_name]
            if actual != expected:
                raise ValueError(f"工具版本不符：{tool_name} expected={expected} actual={actual}")
        summary["checks"]["toolVersionsPinned"] = True

        schema_path, schema_records = prepare_schema(spec)
        schema_report["schemaFiles"] = schema_records
        summary["checks"]["schemaHashesPinned"] = all(item["pass"] for item in schema_records)

        sanitized_source = REPORT_DIR / "source-sanitized.musicxml"
        sanitation = sanitize_musicxml(source_path, sanitized_source)
        if sanitation["root"] != spec["input"]["root"]:
            raise ValueError(
                f"MusicXML root 不符：expected={spec['input']['root']} actual={sanitation['root']}"
            )
        summary["checks"]["safeXmlInput"] = True

        schema = xmlschema.XMLSchema(str(schema_path))
        source_validation = validate_xml(schema, sanitized_source)
        schema_report["source"] = source_validation
        if not source_validation["pass"]:
            raise ValueError("來源 MusicXML 未通過 XSD")
        summary["checks"]["sourceXsdValid"] = True

        source_score = converter.parse(str(sanitized_source), format="musicxml")
        source_normalized = normalize_music21_score(source_score)
        scorebook_normalized = normalize_scorebook_fixture(fixture)
        write_json(REPORT_DIR / "normalized-source-events.json", source_normalized)
        write_json(REPORT_DIR / "normalized-scorebook-events.json", scorebook_normalized)

        fields = list(spec["comparison"]["exact_fields"])
        event_diff = compare_normalized(
            source_normalized,
            scorebook_normalized,
            fields,
            "source",
            "scorebook",
        )
        write_json(REPORT_DIR / "event-diff.json", event_diff)
        if not event_diff["pass"]:
            raise ValueError("MusicXML 與 scorebook event 不一致")
        summary["checks"]["sourceMatchesScorebook"] = True

        roundtrip_path = REPORT_DIR / "roundtrip.musicxml"
        source_score.write("musicxml", fp=str(roundtrip_path))
        sanitized_roundtrip = REPORT_DIR / "roundtrip-sanitized.musicxml"
        sanitize_musicxml(roundtrip_path, sanitized_roundtrip)
        roundtrip_validation = validate_xml(schema, sanitized_roundtrip)
        schema_report["roundtrip"] = roundtrip_validation
        if not roundtrip_validation["pass"]:
            raise ValueError("music21 round-trip 未通過 XSD")
        summary["checks"]["roundtripXsdValid"] = True

        roundtrip_score = converter.parse(str(sanitized_roundtrip), format="musicxml")
        roundtrip_normalized = normalize_music21_score(roundtrip_score)
        roundtrip_diff = compare_normalized(
            source_normalized,
            roundtrip_normalized,
            fields,
            "source",
            "roundtrip",
        )
        write_json(REPORT_DIR / "roundtrip-diff.json", roundtrip_diff)
        if not roundtrip_diff["pass"]:
            raise ValueError("music21 round-trip event 已改變")
        summary["checks"]["roundtripMatchesSource"] = True

        verovio_report = render_verovio(
            sanitized_source,
            REPORT_DIR / "verovio-reference.svg",
            REPORT_DIR / "verovio-reference.mid",
        )
        summary["verovio"] = verovio_report
        summary["checks"]["verovioSvgCreated"] = True
        summary["checks"]["verovioMidiCreated"] = True

        required_files = spec["reports"]["required_files"]
        pending = {"musicxml-schema-report.json", "source-verification-report.json", "source-verification-report.html"}
        missing = [
            filename for filename in required_files
            if filename not in pending and not (REPORT_DIR / filename).is_file()
        ]
        if missing:
            raise ValueError(f"來源報告缺檔：{', '.join(missing)}")
        summary["checks"]["reportsComplete"] = True
        summary["pass"] = all(summary["checks"].values())
        schema_report["pass"] = (
            summary["checks"]["schemaHashesPinned"]
            and source_validation["pass"]
            and roundtrip_validation["pass"]
        )
    except Exception as error:
        summary["errors"].append(str(error))
        summary["traceback"] = traceback.format_exc()
        schema_report["pass"] = False
    finally:
        write_json(REPORT_DIR / "musicxml-schema-report.json", schema_report)
        write_json(REPORT_DIR / "source-verification-report.json", summary)
        write_html_report(summary, REPORT_DIR / "source-verification-report.html")

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
