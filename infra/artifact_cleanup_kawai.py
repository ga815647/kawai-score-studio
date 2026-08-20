import base64
import datetime as dt
import json
import os
import urllib.error
import urllib.parse
import urllib.request

api = os.environ["GH_API_URL"].rstrip("/")
repo = os.environ["GH_REPOSITORY"]
token = os.environ["GH_TOKEN"]
branch = "exp/artifact-cleanup-kawai-01"
expected_main = "d3be667912b650e694b7faf89197b0d9fca50133"
identity_commit = "aa0c957973ab95226c5fba29dc0a1585ade792b6"
identity_path = "infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_before.json"
before_path = "infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_before_delete.json"
evidence_path = "infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_cleanup.json"
headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


def req(path, method="GET", body=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(api + path, headers=headers, data=data, method=method)
    with urllib.request.urlopen(request) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def persist(path, obj, message):
    encoded = "/".join(urllib.parse.quote(x, safe="") for x in path.split("/"))
    endpoint = f"/repos/{repo}/contents/{encoded}"
    payload = {
        "message": message,
        "content": base64.b64encode((json.dumps(obj, indent=2, sort_keys=True) + "\n").encode()).decode(),
        "branch": branch,
    }
    try:
        current = req(endpoint + "?ref=" + urllib.parse.quote(branch, safe=""))
        payload["sha"] = current["sha"]
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
    req(endpoint, method="PUT", body=payload)


def list_artifacts():
    out = []
    page = 1
    while True:
        payload = req(f"/repos/{repo}/actions/artifacts?per_page=100&page={page}")
        batch = payload.get("artifacts", [])
        out.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return out


def compact(a):
    return {
        "id": a.get("id"),
        "name": a.get("name"),
        "size_bytes": int(a.get("size_in_bytes") or 0),
        "created_at": a.get("created_at"),
        "expires_at": a.get("expires_at"),
        "expired": a.get("expired"),
        "workflow_run_ref": a.get("workflow_run") or {},
    }


def triple(a):
    return (a.get("id"), a.get("name"), int(a.get("size_in_bytes") or a.get("size_bytes") or 0))


def when(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


blockers = []
main = req(f"/repos/{repo}/branches/main")
main_sha = (main.get("commit") or {}).get("sha")
if main_sha != expected_main:
    blockers.append(f"main moved: expected {expected_main}, got {main_sha}")

encoded_identity = "/".join(urllib.parse.quote(x, safe="") for x in identity_path.split("/"))
snap = req(f"/repos/{repo}/contents/{encoded_identity}?ref={identity_commit}")
historical = json.loads(base64.b64decode(snap["content"]).decode())
hist_by_id = {int(r["id"]): r for r in historical.get("artifacts", [])}

live1 = list_artifacts()


def history_for(a):
    h = hist_by_id.get(int(a["id"]))
    if not h:
        return None
    if (h.get("id"), h.get("name"), int(h.get("size_bytes") or 0)) != triple(a):
        return None
    return h


live_hist = [(a, history_for(a)) for a in live1]
ci_anchors = []
pages_anchors = []
for a, h in live_hist:
    if not h or not h.get("run"):
        continue
    run = h["run"]
    name = a.get("name") or ""
    is_gate = name == "gate-reports" or name.startswith("gate-reports-")
    is_pregate = name == "pages-gate-reports" or name.startswith("pages-gate-reports-")
    if (
        is_gate
        and run.get("name") == "CI"
        and run.get("event") == "push"
        and run.get("head_branch") == "main"
        and run.get("head_sha") == main_sha
        and run.get("conclusion") == "success"
    ):
        ci_anchors.append((a, h))
    if (
        (is_pregate or name == "github-pages")
        and run.get("name") == "Deploy Pages"
        and run.get("head_branch") == "main"
        and run.get("head_sha") == main_sha
        and run.get("conclusion") == "success"
    ):
        pages_anchors.append((a, h))

if not ci_anchors:
    blockers.append("no live current-main CI acceptance anchor")
if not pages_anchors:
    blockers.append("no live current-main Pages anchor")

ci_time = max((when(h["run"].get("created_at")) for _, h in ci_anchors), default=None)
pages_time = max((when(h["run"].get("created_at")) for _, h in pages_anchors), default=None)

push_heads = set()
for a, h in live_hist:
    if h and h.get("run"):
        run = h["run"]
        name = a.get("name") or ""
        if (
            (name == "gate-reports" or name.startswith("gate-reports-"))
            and run.get("name") == "CI"
            and run.get("event") == "push"
            and run.get("conclusion") == "success"
            and run.get("head_sha")
        ):
            push_heads.add(run["head_sha"])

decisions = []
for a, h in live_hist:
    row = compact(a)
    name = row["name"] or ""
    classification = "UNKNOWN"
    action = "KEEP"
    reason = "live artifact not matched to durable enriched identity or unrecognized type"
    gate = name == "gate-reports" or name.startswith("gate-reports-")
    pregate = name == "pages-gate-reports" or name.startswith("pages-gate-reports-")
    pages = name == "github-pages"
    run = (h or {}).get("run")

    if (
        h
        and run
        and gate
        and run.get("name") == "CI"
        and run.get("event") == "push"
        and run.get("head_branch") == "main"
        and run.get("head_sha") == main_sha
        and run.get("conclusion") == "success"
    ):
        classification = "UNIQUE_CURRENT_ACCEPTANCE_EVIDENCE"
        reason = "current-main exact-SHA successful CI evidence"
    elif (
        h
        and run
        and pregate
        and run.get("name") == "Deploy Pages"
        and run.get("head_branch") == "main"
        and run.get("head_sha") == main_sha
        and run.get("conclusion") == "success"
    ):
        classification = "UNIQUE_CURRENT_ACCEPTANCE_EVIDENCE"
        reason = "current-main successful Pages re-Gate evidence"
    elif (
        h
        and run
        and pages
        and run.get("name") == "Deploy Pages"
        and run.get("head_branch") == "main"
        and run.get("head_sha") == main_sha
        and run.get("conclusion") == "success"
    ):
        classification = "ACTIVE_DEPLOYMENT_DEPENDENCY"
        reason = "current-main successful Pages deployment artifact"
    elif not h or not run:
        classification = "UNKNOWN"
        reason = "durable run identity unavailable or exact triple mismatch; fail closed"
    elif gate:
        run_time = when(run.get("created_at"))
        if ci_time and run_time and run_time < ci_time:
            if run.get("event") == "pull_request" and run.get("head_sha") in push_heads:
                classification = "DUPLICATE_TRANSPORT"
                reason = "same head has push CI transport and later current-main exact-SHA acceptance"
            elif run.get("conclusion") in {
                "failure",
                "cancelled",
                "timed_out",
                "action_required",
                "startup_failure",
                "stale",
            }:
                classification = "DISPOSABLE_DEBUG_TEST"
                reason = "failed CI intermediate superseded by later authoritative exact-SHA acceptance"
            else:
                classification = "SUPERSEDED_INTERMEDIATE"
                reason = "older CI transport superseded by current-main exact-SHA acceptance"
            action = "DELETE"
        else:
            classification = "UNKNOWN"
            reason = "not proven older than current CI anchor"
    elif pregate or pages:
        run_time = when(run.get("created_at"))
        if pages_time and run_time and run_time < pages_time:
            classification = (
                "DISPOSABLE_DEBUG_TEST"
                if run.get("conclusion")
                in {"failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"}
                else "SUPERSEDED_INTERMEDIATE"
            )
            reason = "older Pages/re-Gate evidence superseded by current-main successful Pages deployment"
            action = "DELETE"
        else:
            classification = "UNKNOWN"
            reason = "not proven older than current Pages anchor"

    decisions.append({**row, "run": run, "classification": classification, "action": action, "reason": reason})

# Full second enumeration is the exact pre-delete reconfirmation surface.
live2 = list_artifacts()
map1 = {int(a["id"]): triple(a) for a in live1}
map2 = {int(a["id"]): triple(a) for a in live2}
if map1 != map2:
    blockers.append("artifact population changed between inventory and preflight")

candidates = [d for d in decisions if d["action"] == "DELETE"]
for d in candidates:
    actual = map2.get(int(d["id"]))
    expected = (d["id"], d["name"], d["size_bytes"])
    if actual != expected:
        blockers.append(f"preflight mismatch {d['id']}: expected={expected} actual={actual}")

official_before = {
    "package": "EXP-ARTIFACT-CLEANUP-KAWAI-01",
    "phase": "official_before_delete",
    "repo": repo,
    "authoritative_main_sha": main_sha,
    "count": len(live2),
    "bytes": sum(int(a.get("size_in_bytes") or 0) for a in live2),
    "artifacts": [compact(a) for a in live2],
    "decisions": decisions,
    "blockers": blockers,
}
persist(before_path, official_before, "infra(exp): persist official stable pre-delete inventory")

deleted = []
delete_errors = []
if not blockers:
    for d in candidates:
        try:
            req(f"/repos/{repo}/actions/artifacts/{d['id']}", method="DELETE")
            deleted.append(d)
        except Exception as exc:
            delete_errors.append(
                {"id": d["id"], "name": d["name"], "size_bytes": d["size_bytes"], "error": repr(exc)}
            )
            break

after = list_artifacts()
after_rows = [compact(a) for a in after]
after_ids = {int(a["id"]) for a in after}
before_count = official_before["count"]
before_bytes = official_before["bytes"]
deleted_bytes = sum(d["size_bytes"] for d in deleted)
after_count = len(after)
after_bytes = sum(r["size_bytes"] for r in after_rows)
checks = {
    "all_deleted_absent": all(int(d["id"]) not in after_ids for d in deleted),
    "count_delta_ok": before_count - after_count == len(deleted),
    "byte_delta_ok": before_bytes - after_bytes == deleted_bytes,
}
state = "BLOCKED" if blockers else ("INCONCLUSIVE" if delete_errors or not all(checks.values()) else "PASS")

by_decision = {int(d["id"]): d for d in decisions}
remaining = [
    {
        **r,
        "classification": by_decision.get(int(r["id"]), {}).get("classification", "UNKNOWN"),
        "run": by_decision.get(int(r["id"]), {}).get("run"),
    }
    for r in after_rows
]
classification_counts = {}
classification_bytes = {}
for d in decisions:
    c = d["classification"]
    classification_counts[c] = classification_counts.get(c, 0) + 1
    classification_bytes[c] = classification_bytes.get(c, 0) + d["size_bytes"]

result = {
    "state": state,
    "package": "EXP-ARTIFACT-CLEANUP-KAWAI-01",
    "repo": repo,
    "authoritative_main_sha": main_sha,
    "before_count": before_count,
    "before_bytes": before_bytes,
    "before_mib": before_bytes / 1048576,
    "deleted_count": len(deleted),
    "deleted_bytes": deleted_bytes,
    "deleted_mib": deleted_bytes / 1048576,
    "kept_acceptance_bytes": sum(
        d["size_bytes"] for d in decisions if d["classification"] == "UNIQUE_CURRENT_ACCEPTANCE_EVIDENCE"
    ),
    "kept_active_deployment_bytes": sum(
        d["size_bytes"] for d in decisions if d["classification"] == "ACTIVE_DEPLOYMENT_DEPENDENCY"
    ),
    "unknown_bytes": sum(d["size_bytes"] for d in decisions if d["classification"] == "UNKNOWN"),
    "after_count": after_count,
    "after_bytes": after_bytes,
    "after_mib": after_bytes / 1048576,
    "top_deleted": sorted(deleted, key=lambda x: (-x["size_bytes"], x["id"]))[:10],
    "top_remaining": sorted(remaining, key=lambda x: (-x["size_bytes"], x["id"]))[:10],
    "duplication_finding": {
        "push_pr_duplicate_artifacts_deleted": sum(
            1 for d in deleted if d["classification"] == "DUPLICATE_TRANSPORT"
        ),
        "older_pages_or_pages_regate_artifacts_deleted": sum(
            1
            for d in deleted
            if d["name"] == "github-pages"
            or d["name"] == "pages-gate-reports"
            or d["name"].startswith("pages-gate-reports-")
        ),
        "architecture": "CI uploads on push and pull_request; Pages reruns gates after successful main CI and uploads re-Gate/deployment transport.",
    },
    "classification_counts": classification_counts,
    "classification_bytes": classification_bytes,
    "preflight_population_stable": map1 == map2,
    "blockers": blockers,
    "delete_errors": delete_errors,
    "delta_checks": checks,
    "deleted": deleted,
    "remaining": remaining,
}
persist(evidence_path, result, "infra(exp): persist verified artifact cleanup result")
print(json.dumps({k: result[k] for k in ["state", "before_count", "before_bytes", "deleted_count", "deleted_bytes", "kept_acceptance_bytes", "kept_active_deployment_bytes", "unknown_bytes", "after_count", "after_bytes", "classification_counts", "delta_checks"]}, sort_keys=True))
if state != "PASS":
    raise SystemExit(1)
