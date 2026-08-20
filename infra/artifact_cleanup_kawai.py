import datetime as dt
import json
import os
import pathlib
import subprocess
import urllib.request

API = os.environ["GH_API_URL"].rstrip("/")
REPO = os.environ["GH_REPOSITORY"]
TOKEN = os.environ["GH_TOKEN"]
BRANCH = "exp/artifact-cleanup-kawai-01"
EXPECTED_MAIN = "d3be667912b650e694b7faf89197b0d9fca50133"
IDENTITY_COMMIT = "aa0c957973ab95226c5fba29dc0a1585ade792b6"
IDENTITY_PATH = "infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_before.json"
BEFORE_PATH = "infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_before_delete.json"
RESULT_PATH = "infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_cleanup.json"
STARTED_PATH = "infra/EXP_ARTIFACT_CLEANUP_KAWAI_01_started.txt"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


def api(path, method="GET"):
    req = urllib.request.Request(API + path, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def git(*args):
    return subprocess.run(["git", *args], check=True, text=True, capture_output=True).stdout


def git_persist(path, content, message):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    git("add", path)
    if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode != 0:
        git("commit", "-m", message)
        git("push", "origin", f"HEAD:refs/heads/{BRANCH}")


def persist_json(path, obj, message):
    git_persist(path, json.dumps(obj, indent=2, sort_keys=True) + "\n", message)


def artifacts():
    out, page = [], 1
    while True:
        batch = api(f"/repos/{REPO}/actions/artifacts?per_page=100&page={page}").get("artifacts", [])
        out.extend(batch)
        if len(batch) < 100:
            return out
        page += 1


def compact(a):
    return {"id": a.get("id"), "name": a.get("name"), "size_bytes": int(a.get("size_in_bytes") or 0), "created_at": a.get("created_at"), "expires_at": a.get("expires_at"), "expired": a.get("expired"), "workflow_run_ref": a.get("workflow_run") or {}}


def triple(a):
    return (a.get("id"), a.get("name"), int(a.get("size_in_bytes") or a.get("size_bytes") or 0))


def when(v):
    return dt.datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


# First durable checkpoint: proves the canonical CI runner actually started.
git_persist(STARTED_PATH, os.environ.get("GITHUB_RUN_ID", "started") + "\n", "infra(exp): cleanup runner started")

blockers = []
main_sha = (api(f"/repos/{REPO}/branches/main").get("commit") or {}).get("sha")
if main_sha != EXPECTED_MAIN:
    blockers.append(f"main moved: expected {EXPECTED_MAIN}, got {main_sha}")
historical = json.loads(git("show", f"{IDENTITY_COMMIT}:{IDENTITY_PATH}"))
hist_by_id = {int(x["id"]): x for x in historical.get("artifacts", [])}

live1 = artifacts()


def history_for(a):
    h = hist_by_id.get(int(a["id"]))
    return h if h and (h.get("id"), h.get("name"), int(h.get("size_bytes") or 0)) == triple(a) else None


paired = [(a, history_for(a)) for a in live1]
ci_anchors, pages_anchors, push_heads = [], [], set()
for a, h in paired:
    if not h or not h.get("run"):
        continue
    run, name = h["run"], a.get("name") or ""
    gate = name == "gate-reports" or name.startswith("gate-reports-")
    pregate = name == "pages-gate-reports" or name.startswith("pages-gate-reports-")
    if gate and run.get("name") == "CI" and run.get("event") == "push" and run.get("conclusion") == "success" and run.get("head_sha"):
        push_heads.add(run["head_sha"])
    if gate and run.get("name") == "CI" and run.get("event") == "push" and run.get("head_branch") == "main" and run.get("head_sha") == main_sha and run.get("conclusion") == "success":
        ci_anchors.append((a, h))
    if (pregate or name == "github-pages") and run.get("name") == "Deploy Pages" and run.get("head_branch") == "main" and run.get("head_sha") == main_sha and run.get("conclusion") == "success":
        pages_anchors.append((a, h))
if not ci_anchors:
    blockers.append("no live current-main CI acceptance anchor")
if not pages_anchors:
    blockers.append("no live current-main Pages anchor")
ci_time = max((when(h["run"].get("created_at")) for _, h in ci_anchors), default=None)
pages_time = max((when(h["run"].get("created_at")) for _, h in pages_anchors), default=None)

decisions = []
failed = {"failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"}
for a, h in paired:
    row, name = compact(a), a.get("name") or ""
    gate = name == "gate-reports" or name.startswith("gate-reports-")
    pregate = name == "pages-gate-reports" or name.startswith("pages-gate-reports-")
    pages = name == "github-pages"
    run = (h or {}).get("run")
    c, action, reason = "UNKNOWN", "KEEP", "durable run identity unavailable or type unrecognized"
    if h and run and gate and run.get("name") == "CI" and run.get("event") == "push" and run.get("head_branch") == "main" and run.get("head_sha") == main_sha and run.get("conclusion") == "success":
        c, reason = "UNIQUE_CURRENT_ACCEPTANCE_EVIDENCE", "current-main exact-SHA successful CI evidence"
    elif h and run and pregate and run.get("name") == "Deploy Pages" and run.get("head_branch") == "main" and run.get("head_sha") == main_sha and run.get("conclusion") == "success":
        c, reason = "UNIQUE_CURRENT_ACCEPTANCE_EVIDENCE", "current-main successful Pages re-Gate evidence"
    elif h and run and pages and run.get("name") == "Deploy Pages" and run.get("head_branch") == "main" and run.get("head_sha") == main_sha and run.get("conclusion") == "success":
        c, reason = "ACTIVE_DEPLOYMENT_DEPENDENCY", "current-main successful Pages deployment artifact"
    elif h and run and gate and ci_time and when(run.get("created_at")) and when(run.get("created_at")) < ci_time:
        if run.get("event") == "pull_request" and run.get("head_sha") in push_heads:
            c, reason = "DUPLICATE_TRANSPORT", "same head has push CI transport; current-main exact-SHA acceptance is later authoritative evidence"
        elif run.get("conclusion") in failed:
            c, reason = "DISPOSABLE_DEBUG_TEST", "failed CI intermediate superseded by current-main exact-SHA acceptance"
        else:
            c, reason = "SUPERSEDED_INTERMEDIATE", "older CI transport superseded by current-main exact-SHA acceptance"
        action = "DELETE"
    elif h and run and (pregate or pages) and pages_time and when(run.get("created_at")) and when(run.get("created_at")) < pages_time:
        c = "DISPOSABLE_DEBUG_TEST" if run.get("conclusion") in failed else "SUPERSEDED_INTERMEDIATE"
        reason, action = "older Pages/re-Gate evidence superseded by current-main successful Pages deployment", "DELETE"
    decisions.append({**row, "run": run, "classification": c, "action": action, "reason": reason})

# Exact fail-closed preflight: the whole live population and every candidate triple must remain identical.
live2 = artifacts()
map1 = {int(a["id"]): triple(a) for a in live1}
map2 = {int(a["id"]): triple(a) for a in live2}
if map1 != map2:
    blockers.append("artifact population changed between inventory and preflight")
candidates = [d for d in decisions if d["action"] == "DELETE"]
for d in candidates:
    if map2.get(int(d["id"])) != (d["id"], d["name"], d["size_bytes"]):
        blockers.append(f"preflight mismatch for artifact {d['id']}")

official_before = {"package": "EXP-ARTIFACT-CLEANUP-KAWAI-01", "phase": "official_before_delete", "repo": REPO, "authoritative_main_sha": main_sha, "count": len(live2), "bytes": sum(int(a.get("size_in_bytes") or 0) for a in live2), "artifacts": [compact(a) for a in live2], "decisions": decisions, "blockers": blockers}
persist_json(BEFORE_PATH, official_before, "infra(exp): persist official stable pre-delete inventory")

deleted, delete_errors = [], []
if not blockers:
    for d in candidates:
        try:
            api(f"/repos/{REPO}/actions/artifacts/{d['id']}", "DELETE")
            deleted.append(d)
        except Exception as exc:
            delete_errors.append({"id": d["id"], "name": d["name"], "size_bytes": d["size_bytes"], "error": repr(exc)})
            break

after = artifacts()
after_rows = [compact(a) for a in after]
after_ids = {int(a["id"]) for a in after}
before_count, before_bytes = official_before["count"], official_before["bytes"]
deleted_bytes = sum(d["size_bytes"] for d in deleted)
after_count, after_bytes = len(after), sum(r["size_bytes"] for r in after_rows)
checks = {"all_deleted_absent": all(int(d["id"]) not in after_ids for d in deleted), "count_delta_ok": before_count - after_count == len(deleted), "byte_delta_ok": before_bytes - after_bytes == deleted_bytes}
state = "BLOCKED" if blockers else ("INCONCLUSIVE" if delete_errors or not all(checks.values()) else "PASS")
byid = {int(d["id"]): d for d in decisions}
remaining = [{**r, "classification": byid.get(int(r["id"]), {}).get("classification", "UNKNOWN"), "run": byid.get(int(r["id"]), {}).get("run")} for r in after_rows]
cc, cb = {}, {}
for d in decisions:
    c = d["classification"]
    cc[c] = cc.get(c, 0) + 1
    cb[c] = cb.get(c, 0) + d["size_bytes"]
result = {"state": state, "package": "EXP-ARTIFACT-CLEANUP-KAWAI-01", "repo": REPO, "authoritative_main_sha": main_sha, "before_count": before_count, "before_bytes": before_bytes, "before_mib": before_bytes / 1048576, "deleted_count": len(deleted), "deleted_bytes": deleted_bytes, "deleted_mib": deleted_bytes / 1048576, "kept_acceptance_bytes": sum(d["size_bytes"] for d in decisions if d["classification"] == "UNIQUE_CURRENT_ACCEPTANCE_EVIDENCE"), "kept_active_deployment_bytes": sum(d["size_bytes"] for d in decisions if d["classification"] == "ACTIVE_DEPLOYMENT_DEPENDENCY"), "unknown_bytes": sum(d["size_bytes"] for d in decisions if d["classification"] == "UNKNOWN"), "after_count": after_count, "after_bytes": after_bytes, "after_mib": after_bytes / 1048576, "top_deleted": sorted(deleted, key=lambda x: (-x["size_bytes"], x["id"]))[:10], "top_remaining": sorted(remaining, key=lambda x: (-x["size_bytes"], x["id"]))[:10], "duplication_finding": {"push_pr_duplicate_artifacts_deleted": sum(1 for d in deleted if d["classification"] == "DUPLICATE_TRANSPORT"), "older_pages_or_pages_regate_artifacts_deleted": sum(1 for d in deleted if d["name"] == "github-pages" or d["name"] == "pages-gate-reports" or d["name"].startswith("pages-gate-reports-")), "architecture": "CI uploads on push and pull_request; Pages reruns gates after successful main CI and uploads re-Gate/deployment transport."}, "classification_counts": cc, "classification_bytes": cb, "preflight_population_stable": map1 == map2, "blockers": blockers, "delete_errors": delete_errors, "delta_checks": checks, "deleted": deleted, "remaining": remaining}
persist_json(RESULT_PATH, result, "infra(exp): persist verified artifact cleanup result")
print(json.dumps({k: result[k] for k in ["state", "before_count", "before_bytes", "deleted_count", "deleted_bytes", "kept_acceptance_bytes", "kept_active_deployment_bytes", "unknown_bytes", "after_count", "after_bytes", "classification_counts", "delta_checks"]}, sort_keys=True))
if state != "PASS":
    raise SystemExit(1)
