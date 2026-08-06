from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
SCOREBOOK = ROOT / "scorebook.yaml"


def append_unique(items, *values):
    for value in values:
        if value not in items:
            items.append(value)


with SCOREBOOK.open(encoding="utf-8") as handle:
    book = yaml.safe_load(handle)

if book["project"]["version"] != "0.6.14":
    raise SystemExit(f"Unexpected scorebook version: {book['project']['version']}")

book["project"]["version"] = "0.6.15"

entry = book["interaction_entry"]
entry["public_sections"] = ["status", "song_directory", "verified_library"]
entry["internal_routes"] = ["fixture_query_only"]

library_mode = book["modes"]["library"]
library_mode["print_button_label"] = "A4 列印"
library_mode["public_quarantine_panel"] = False
library_mode["song_directory"] = {
    "public": True,
    "position": "before_library_heading",
    "entries": "verified_songs",
    "label_format": "title_with_alias",
    "link_behavior": "same_page_anchor",
}

book["layout"]["print"]["button_label"] = "A4 列印"
book["layout"]["navigation"] = {
    "song_directory": {
        "position": "before_library_heading",
        "source": "verified_songs",
        "anchor_prefix": "song-",
        "label_format": "title_with_alias",
        "sticky_header_offset_px": 88,
    }
}

gates = book["gates"]
append_unique(
    gates["content"]["checks"],
    "public_song_directory_precedes_verified_library",
    "public_quarantine_panel_is_absent",
    "public_studio_controls_are_absent",
)
append_unique(
    gates["html"]["checks"],
    "song_directory_links_target_every_verified_song",
    "public_html_has_no_quarantine_panel",
    "studio_markup_is_hidden_internal_fixture_only",
    "every_verified_song_has_explicit_a4_print_control",
    "static_assets_are_versioned_by_scorebook_hash",
    "stale_index_reloads_to_current_build_hash",
)
append_unique(
    gates["visual"]["checks"],
    "song_directory_click_scrolls_to_target_song",
    "a4_print_control_is_visible_for_every_verified_song",
)

with SCOREBOOK.open("w", encoding="utf-8") as handle:
    yaml.safe_dump(
        book,
        handle,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=1000,
    )
