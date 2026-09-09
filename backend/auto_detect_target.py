"""
Auto-detect a likely target column (SQL aggregations + samples only).

Does NOT train models and does NOT persist the choice. The frontend only
pre-fills Target column; save remains on user Confirm via save-target-column.
"""

from __future__ import annotations

import logging
import re
import threading
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

auto_target_jobs: Dict[str, Dict[str, Any]] = {}

# --- Name dictionaries: MATCH = positive bonus only (absence is NOT a penalty) ---
NAME_TIERS_GENERAL = {
    "very_high": (1.0, ["target", "label", "class"]),
    "high": (0.85, ["y", "output", "outcome", "response"]),
    "medium": (0.6, ["result", "predicted", "prediction", "category", "status", "type"]),
    "low": (0.35, ["value", "score", "grade", "group", "cluster", "segment", "tier", "rank", "level"]),
    "contextual": (0.25, ["price", "amount", "count", "revenue", "profit", "duration", "distance", "weight"]),
}

NAME_TIERS_CYBER = {
    "very_high": (
        1.0,
        [
            "attack_type", "attack_class", "malware", "malware_type", "intrusion",
            "intrusion_type", "threat", "threat_type", "label",
        ],
    ),
    "high": (
        0.85,
        [
            "malicious", "is_malicious", "attack", "attack_category", "anomaly",
            "anomaly_type", "anomaly_label", "incident_type", "alert_type",
        ],
    ),
    "medium": (
        0.6,
        [
            "incident", "alert", "severity", "risk", "risk_level", "vulnerability",
            "exploit", "payload", "behavior", "verdict",
        ],
    ),
}

CYBER_NETWORK_HINTS = [
    "src_ip", "dst_ip", "source_ip", "destination_ip", "src_port", "dst_port",
    "protocol", "flow_duration", "packet", "bytes", "tcp_flags", "dns", "http",
    "ttl", "flow_id",
]

ID_NAME_TOKENS = [
    "uuid", "guid", "session", "transaction", "record", "flow_id", "event_id",
]

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
HASH_RE = re.compile(r"^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
IP_RE = re.compile(
    r"^(?:\d{1,3}\.){3}\d{1,3}$|"
    r"^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$"
)
MAC_RE = re.compile(r"^(?:[0-9a-fA-F]{2}([-:])){5}[0-9a-fA-F]{2}$")


class AutoDetectStartBody(BaseModel):
    bdName: str = Field(..., min_length=1)


def _append_log(job_id: str, message: str):
    job = auto_target_jobs.get(job_id)
    if not job:
        return
    text = (message or "").strip()
    if not text:
        return
    ts = datetime.now().strftime("%H:%M:%S")
    job["logs"].append(f"[{ts}] {text}")


def _clip(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, float(x)))


def _norm_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_")


def _name_token_match(col_norm: str, token: str) -> bool:
    t = _norm_name(token)
    if not t:
        return False
    if col_norm == t:
        return True
    # word-ish boundaries for short tokens like "y"
    if len(t) <= 2:
        return col_norm == t or col_norm.endswith(f"_{t}") or col_norm.startswith(f"{t}_")
    return t in col_norm


def _score_name(col_name: str, domain: str) -> tuple[float, List[str]]:
    col_norm = _norm_name(col_name)
    reasons: List[str] = []
    best = 0.0

    for tier, (score, tokens) in NAME_TIERS_GENERAL.items():
        for tok in tokens:
            if _name_token_match(col_norm, tok):
                if score > best:
                    best = score
                    reasons = [f"name matches '{tok}' ({tier.replace('_', ' ')})"]
                break

    if domain == "cybersecurity_network":
        for tier, (score, tokens) in NAME_TIERS_CYBER.items():
            for tok in tokens:
                if _name_token_match(col_norm, tok):
                    if score > best:
                        best = score
                        reasons = [f"cyber name matches '{tok}' ({tier.replace('_', ' ')})"]
                    elif score == best and reasons and "cyber" not in reasons[0]:
                        reasons.append(f"also cyber match '{tok}'")
                    break

    return best, reasons


def _id_name_pattern(col_name: str) -> bool:
    n = _norm_name(col_name)
    if n == "id" or n.endswith("_id") or n.startswith("id_"):
        return True
    return any(tok in n for tok in ID_NAME_TOKENS)


def _map_platform_type(column_type: str) -> str:
    """Map platform labels to scoring buckets used in the prompt."""
    t = (column_type or "").lower()
    if t in ("numerical", "numeric"):
        return "numeric"
    if t in ("categorical", "boolean", "date", "text"):
        return t
    return "text"


def register_auto_detect_target_routes(
    target_router,
    *,
    get_db_connection,
    get_current_user2,
    analyze_column_type_backend,
):
    """Attach auto-detect-target endpoints onto the shared /api router."""

    def _run_job(job_id: str, table_name: str, user_id: str):
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT 1 FROM user_tables_metadata
                    WHERE table_name = %s AND owner_id = %s
                    """,
                    (table_name, user_id),
                )
                if not cur.fetchone():
                    raise RuntimeError("Dataset not found or access denied")

                cur.execute(
                    """
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = %s
                      AND column_name NOT IN ('id', 'split_type')
                    ORDER BY ordinal_position
                    """,
                    (table_name,),
                )
                columns_info = cur.fetchall()
                if not columns_info:
                    raise RuntimeError("No analyzable columns found")

                n_cols = len(columns_info)
                _append_log(job_id, f"dataset: {table_name}")
                _append_log(job_id, f"1. profile columns (n={n_cols}, skip id and split_type)")
                _append_log(job_id, "   fields: type, unique count, missing %, id-like values")

                profiles: List[Dict[str, Any]] = []
                for idx, (col_name, pg_type) in enumerate(columns_info, start=1):
                    profile = _profile_column(
                        cur, conn, table_name, col_name, pg_type, analyze_column_type_backend
                    )
                    profiles.append(profile)
                    # Short per-column summary (readable for small datasets)
                    if n_cols <= 12 or idx == 1 or idx == n_cols or idx % 5 == 0:
                        _append_log(
                            job_id,
                            f"   [{idx}/{n_cols}] {col_name}  type={profile['column_type']}  "
                            f"unique={profile['distinct_count']}  "
                            f"missing={profile['missing_ratio']*100:.0f}%",
                        )

                domain, cyber_hits = _detect_domain(profiles)
                _append_log(job_id, "2. context")
                if domain == "cybersecurity_network":
                    extra = ", ".join(cyber_hits[:6])
                    if len(cyber_hits) > 6:
                        extra += "..."
                    _append_log(
                        job_id,
                        f"   network/security names: {len(cyber_hits)} ({extra})",
                    )
                    _append_log(job_id, "   name bonus uses attack_type, malware, threat, label, ...")
                else:
                    _append_log(job_id, "   general (fewer than 2 network/security column names)")

                _append_log(job_id, "3. score each column")
                _append_log(
                    job_id,
                    "   score = 0.40*nunique + 0.25*type + 0.25*name + extras, then clip to [0,1]",
                )
                _append_log(
                    job_id,
                    "   extras: first/last col, cyber name +0.15, only class-col +0.35; "
                    "penalties for constant, id, sequential, missing, text, date",
                )
                scored = []
                for i, p in enumerate(profiles):
                    s, reasons = _score_column(p, domain, i, len(profiles))
                    p["score"] = s
                    p["reasons"] = reasons
                    scored.append(p)

                # Classic Iris-like pattern: exactly one low-cardinality class column
                # among mostly numeric features → boost that label candidate.
                lone_cats = [
                    c
                    for c in scored
                    if c["mapped_type"] in ("categorical", "boolean")
                    and 2 <= c["distinct_count"] <= 20
                    and not c["is_constant"]
                    and not (
                        c["is_uuid_like"]
                        or c["is_hash_like"]
                        or c["is_email_like"]
                        or c["is_ip_like"]
                        or c["is_mac_like"]
                        or c["id_name_pattern"]
                    )
                ]
                if len(lone_cats) == 1:
                    only = lone_cats[0]
                    before = only["score"]
                    only["score"] = _clip(before + 0.35)
                    only["reasons"] = list(only.get("reasons") or [])
                    only["reasons"].append(
                        "only class-like column among features"
                    )
                    _append_log(
                        job_id,
                        f"   only class-like column: {only['column_name']} "
                        f"({only['distinct_count']} classes)  {before:.2f} -> {only['score']:.2f}",
                    )

                scored.sort(key=lambda x: x["score"], reverse=True)

                low = [c for c in scored if c["score"] < 0.15]
                notable = [c for c in scored if c["score"] >= 0.15]
                if low:
                    _append_log(
                        job_id,
                        f"   skip detail for {len(low)} columns with score < 0.15",
                    )
                for c in notable[:12]:
                    why = "; ".join(c["reasons"][:4]) if c["reasons"] else "weak signal"
                    _append_log(
                        job_id,
                        f"   {c['column_name']}: {why}  score={c['score']:.2f}",
                    )
                if scored:
                    _append_log(
                        job_id,
                        f"   best so far: {scored[0]['column_name']}  score={scored[0]['score']:.2f}",
                    )

                _append_log(job_id, "4. duplicate check vs best column")
                leakage_col = None
                if scored and scored[0]["score"] >= 0.40:
                    leakage_col = _find_potential_leakage(
                        cur, conn, table_name, scored[0]["column_name"], profiles
                    )
                    if leakage_col:
                        _append_log(
                            job_id,
                            f"   warn: {leakage_col} matches {scored[0]['column_name']} on ~98% of a sample",
                        )
                    else:
                        _append_log(job_id, "   no near-duplicate found")
                else:
                    _append_log(job_id, "   skipped (best score < 0.40)")

                _append_log(job_id, "5. decision")
                result = _decide(scored, domain, leakage_col)
                decision = result["decision"]
                if decision == "single_target":
                    _append_log(
                        job_id,
                        f"   pick {result.get('target')}  score={result.get('score', 0)*100:.0f}%",
                    )
                elif decision == "ambiguous":
                    names = ", ".join(
                        f"{c['column_name']} ({c['score']*100:.0f}%)"
                        for c in (result.get("candidates") or [])[:3]
                    )
                    _append_log(job_id, f"   close scores, choose one: {names}")
                else:
                    _append_log(job_id, "   no column looks like a target (unsupervised)")
                _append_log(job_id, "done. not saved until Confirm")

                auto_target_jobs[job_id]["status"] = "done"
                auto_target_jobs[job_id]["result"] = result
        except Exception as e:
            detail = getattr(e, "detail", None) or str(e)
            logger.exception("auto-detect-target failed")
            auto_target_jobs[job_id]["status"] = "error"
            auto_target_jobs[job_id]["result"] = {"message": detail}
            _append_log(job_id, f"ERROR: {detail}")

    def _profile_column(cur, conn, table_name, col_name, pg_type, analyze_fn) -> Dict[str, Any]:
        total = non_null = distinct_count = 0
        try:
            cur.execute(
                f"""
                SELECT
                    (SELECT COUNT(*)::bigint FROM "{table_name}") AS total,
                    COUNT(v)::bigint AS non_null,
                    COUNT(DISTINCT v)::bigint AS distinct_count
                FROM (
                    SELECT BTRIM(CAST("{col_name}" AS text)) AS v
                    FROM "{table_name}"
                    WHERE "{col_name}" IS NOT NULL
                      AND BTRIM(CAST("{col_name}" AS text)) <> ''
                ) t
                """
            )
            total, non_null, distinct_count = cur.fetchone()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            cur = conn.cursor()
            cur.execute(
                f"""
                SELECT COUNT(*)::bigint, COUNT("{col_name}")::bigint,
                       COUNT(DISTINCT "{col_name}")::bigint
                FROM "{table_name}"
                """
            )
            total, non_null, distinct_count = cur.fetchone()

        total = int(total or 0)
        non_null = int(non_null or 0)
        distinct_count = int(distinct_count or 0)
        unique_ratio = (distinct_count / float(non_null)) if non_null > 0 else 0.0
        missing_ratio = 1.0 - (non_null / float(total)) if total > 0 else 1.0
        is_constant = distinct_count <= 1

        if non_null == 0:
            column_type = "text"
            is_numeric_content = False
        else:
            column_type, is_numeric_content = analyze_fn(
                cur, conn, table_name, col_name, pg_type, total, non_null, distinct_count
            )

        mapped = _map_platform_type(column_type)
        min_v = max_v = mean_v = std_v = None
        avg_len = None
        is_sequential = False

        if mapped == "numeric" or is_numeric_content:
            try:
                cur.execute(
                    f"""
                    SELECT MIN(v), MAX(v), AVG(v), STDDEV_SAMP(v)
                    FROM (
                        SELECT CAST(BTRIM(CAST("{col_name}" AS text)) AS double precision) AS v
                        FROM "{table_name}"
                        WHERE "{col_name}" IS NOT NULL
                          AND BTRIM(CAST("{col_name}" AS text)) <> ''
                          AND BTRIM(CAST("{col_name}" AS text))
                              ~ '^-?[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$'
                    ) s
                    """
                )
                row = cur.fetchone()
                if row and row[0] is not None:
                    min_v, max_v, mean_v, std_v = (
                        float(row[0]),
                        float(row[1]),
                        float(row[2]),
                        float(row[3]) if row[3] is not None else 0.0,
                    )
                    # Integer-like sequential ID heuristic
                    if (
                        abs(min_v - round(min_v)) < 1e-9
                        and abs(max_v - round(max_v)) < 1e-9
                        and distinct_count > 1
                    ):
                        span = (max_v - min_v) + 1.0
                        if abs(span - float(distinct_count)) / max(span, 1.0) < 0.02:
                            is_sequential = True
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                cur = conn.cursor()

        if mapped in ("text", "categorical") or column_type == "text":
            try:
                cur.execute(
                    f"""
                    SELECT AVG(LENGTH(v))
                    FROM (
                        SELECT BTRIM(CAST("{col_name}" AS text)) AS v
                        FROM "{table_name}"
                        WHERE "{col_name}" IS NOT NULL
                          AND BTRIM(CAST("{col_name}" AS text)) <> ''
                        LIMIT 300
                    ) s
                    """
                )
                al = cur.fetchone()[0]
                avg_len = float(al) if al is not None else None
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                cur = conn.cursor()

        patterns = _sample_patterns(cur, conn, table_name, col_name)

        return {
            "column_name": col_name,
            "column_type": column_type,
            "mapped_type": mapped,
            "is_numeric_content": bool(is_numeric_content),
            "total_rows": total,
            "non_null_count": non_null,
            "distinct_count": distinct_count,
            "unique_ratio": unique_ratio,
            "missing_ratio": missing_ratio,
            "is_constant": is_constant,
            "min": min_v,
            "max": max_v,
            "mean": mean_v,
            "stddev": std_v,
            "avg_length": avg_len,
            "is_sequential_numeric": is_sequential,
            "id_name_pattern": _id_name_pattern(col_name),
            **patterns,
        }

    def _sample_patterns(cur, conn, table_name, col_name) -> Dict[str, bool]:
        flags = {
            "is_uuid_like": False,
            "is_hash_like": False,
            "is_email_like": False,
            "is_ip_like": False,
            "is_mac_like": False,
        }
        try:
            cur.execute(
                f"""
                SELECT BTRIM(CAST("{col_name}" AS text))
                FROM "{table_name}"
                WHERE "{col_name}" IS NOT NULL
                  AND BTRIM(CAST("{col_name}" AS text)) <> ''
                LIMIT 200
                """
            )
            samples = [r[0] for r in cur.fetchall() if r and r[0] is not None]
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            return flags

        if not samples:
            return flags
        n = len(samples)
        uuid_n = sum(1 for s in samples if UUID_RE.match(str(s).strip()))
        hash_n = sum(1 for s in samples if HASH_RE.match(str(s).strip()))
        email_n = sum(1 for s in samples if EMAIL_RE.match(str(s).strip()))
        ip_n = sum(1 for s in samples if IP_RE.match(str(s).strip()))
        mac_n = sum(1 for s in samples if MAC_RE.match(str(s).strip()))
        thr = 0.7
        flags["is_uuid_like"] = (uuid_n / n) >= thr
        flags["is_hash_like"] = (hash_n / n) >= thr
        flags["is_email_like"] = (email_n / n) >= thr
        flags["is_ip_like"] = (ip_n / n) >= thr
        flags["is_mac_like"] = (mac_n / n) >= thr
        return flags

    def _detect_domain(profiles: List[Dict[str, Any]]):
        hits = []
        for p in profiles:
            n = _norm_name(p["column_name"])
            for hint in CYBER_NETWORK_HINTS:
                h = _norm_name(hint)
                if h in n or n in h:
                    hits.append(p["column_name"])
                    break
        domain = "cybersecurity_network" if len(hits) >= 2 else "general"
        return domain, hits

    def _score_column(p: Dict[str, Any], domain: str, index: int, n_cols: int):
        reasons: List[str] = []
        name_score, name_reasons = _score_name(p["column_name"], domain)
        reasons.extend(name_reasons)

        mapped = p["mapped_type"]
        distinct = p["distinct_count"]
        unique_ratio = p["unique_ratio"]

        if mapped in ("categorical", "boolean") and 2 <= distinct <= 50:
            cardinality_score = 0.9
            reasons.append(f"nunique={distinct} in [2,50]")
        elif (
            mapped == "numeric"
            and unique_ratio > 0.9
            and not p["is_sequential_numeric"]
            and not p["id_name_pattern"]
        ):
            cardinality_score = 0.7
            reasons.append("high nunique numeric")
        else:
            cardinality_score = 0.2

        # Prefer last/first column slightly more when it is class-like (common dataset layout)
        if mapped in ("categorical", "boolean") and 2 <= distinct <= 20 and (index == 0 or index == n_cols - 1):
            reasons.append("first/last + class-like")

        cyber_match = False
        if domain == "cybersecurity_network":
            col_norm = _norm_name(p["column_name"])
            for _tier, (_sc, tokens) in NAME_TIERS_CYBER.items():
                if any(_name_token_match(col_norm, tok) for tok in tokens):
                    cyber_match = True
                    break
        domain_bonus = 0.15 if (domain == "cybersecurity_network" and cyber_match) else 0.0
        if domain_bonus:
            reasons.append("cyber domain bonus")

        if mapped in ("numeric", "categorical", "boolean"):
            dtype_score = 0.8
        elif mapped == "date":
            dtype_score = 0.2
        else:
            dtype_score = 0.1

        position_bonus = 0.02 if (index == 0 or index == n_cols - 1) else 0.0
        if mapped in ("categorical", "boolean") and 2 <= distinct <= 20 and (index == 0 or index == n_cols - 1):
            position_bonus = 0.05

        constant_penalty = -1.0 if p["is_constant"] else 0.0
        if constant_penalty:
            reasons.append("constant")

        id_like = (
            p["is_uuid_like"]
            or p["is_hash_like"]
            or p["is_email_like"]
            or p["is_ip_like"]
            or p["is_mac_like"]
            or p["id_name_pattern"]
        )
        id_penalty = -0.6 if id_like else 0.0
        if id_penalty:
            reasons.append("id-like")

        if p["is_sequential_numeric"] and p["id_name_pattern"]:
            sequential_penalty = -0.4
            reasons.append("sequential numeric + id-like name")
        elif p["is_sequential_numeric"]:
            sequential_penalty = -0.15
            reasons.append("sequential numeric pattern")
        else:
            sequential_penalty = 0.0

        mr = p["missing_ratio"]
        missing_penalty = (-0.5 * min(1.0, mr / 0.8)) if mr > 0.5 else 0.0
        if missing_penalty:
            reasons.append(f"high missing ratio ({mr*100:.0f}%)")

        text_penalty = 0.0
        if mapped == "text" and unique_ratio > 0.8 and (p.get("avg_length") or 0) > 30:
            text_penalty = -0.4
            reasons.append("free-text-like column")

        date_penalty = -0.3 if mapped == "date" else 0.0
        if date_penalty:
            reasons.append("date")

        # Structure-first rubric:
        # - No predefined name match must NOT create a large score hole.
        # - Name match is an optional bonus when present.
        structural = (
            0.40 * cardinality_score
            + 0.25 * dtype_score
            + domain_bonus
            + position_bonus
            + constant_penalty
            + id_penalty
            + sequential_penalty
            + missing_penalty
            + text_penalty
            + date_penalty
        )
        name_bonus = 0.25 * name_score
        if name_score <= 0 and mapped in ("categorical", "boolean") and 2 <= distinct <= 50:
            reasons.append("name: no match")

        score = _clip(structural + name_bonus)
        return score, reasons

    def _find_potential_leakage(cur, conn, table_name, best_col, profiles):
        """Sample-based near-duplicate check vs other columns (no full join)."""
        others = [p["column_name"] for p in profiles if p["column_name"] != best_col][:40]
        for other in others:
            try:
                cur.execute(
                    f"""
                    SELECT
                      COUNT(*)::float AS n,
                      SUM(CASE WHEN a = b THEN 1 ELSE 0 END)::float AS same
                    FROM (
                      SELECT
                        BTRIM(CAST(t."{best_col}" AS text)) AS a,
                        BTRIM(CAST(t."{other}" AS text)) AS b
                      FROM "{table_name}" t
                      WHERE t."{best_col}" IS NOT NULL
                        AND t."{other}" IS NOT NULL
                        AND BTRIM(CAST(t."{best_col}" AS text)) <> ''
                        AND BTRIM(CAST(t."{other}" AS text)) <> ''
                      LIMIT 400
                    ) s
                    """
                )
                n, same = cur.fetchone()
                n = float(n or 0)
                same = float(same or 0)
                if n >= 50 and (same / n) >= 0.98:
                    return other
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                cur = conn.cursor()
        return None

    def _decide(scored, domain, leakage_col):
        if not scored:
            return {
                "decision": "no_target",
                "domain": domain,
                "message": "No reliable target column detected",
                "suggestion": "unsupervised_learning",
                "potential_leakage_column": None,
                "ranked": [],
            }

        best = scored[0]
        second = scored[1] if len(scored) > 1 else None
        best_score = best["score"]
        second_score = second["score"] if second else 0.0
        gap = best_score - second_score
        best_is_classlike = (
            best.get("mapped_type") in ("categorical", "boolean")
            and 2 <= int(best.get("distinct_count") or 0) <= 50
        )

        ranked = [
            {
                "column_name": c["column_name"],
                "score": round(c["score"], 4),
                "column_type": c["column_type"],
                "distinct_count": c["distinct_count"],
                "reasons": c.get("reasons") or [],
            }
            for c in scored[:8]
        ]

        base = {
            "domain": domain,
            "potential_leakage_column": leakage_col,
            "ranked": ranked,
        }

        # Clear winner: high score, OR solid score with a clear gap (Iris-like cases)
        clear_single = (best_score >= 0.80 and gap >= 0.10) or (
            best_score >= 0.55 and gap >= 0.12 and best_is_classlike
        )
        if clear_single:
            return {
                **base,
                "decision": "single_target",
                "target": best["column_name"],
                "score": round(best_score, 4),
                "alternatives": [],
                "reasons": (best.get("reasons") or [])[:4],
            }

        if best_score >= 0.45:
            cands = ranked[:3]
            return {
                **base,
                "decision": "ambiguous",
                "candidates": cands,
                "recommended": best["column_name"],
                "score": round(best_score, 4),
                "reasons": (best.get("reasons") or [])[:4],
            }

        return {
            **base,
            "decision": "no_target",
            "message": "No reliable target column detected",
            "suggestion": "unsupervised_learning",
        }

    @target_router.post("/auto-detect-target/start")
    async def auto_detect_target_start(
        body: AutoDetectStartBody,
        current_user_id: str = Depends(get_current_user2),
    ):
        table = (body.bdName or "").strip().lower()
        if not table:
            raise HTTPException(400, "bdName is required")

        job_id = str(uuid.uuid4())
        auto_target_jobs[job_id] = {
            "status": "running",
            "logs": [],
            "result": None,
            "user_id": current_user_id,
            "bdName": table,
            "started_at": datetime.now().isoformat(),
        }
        # Same pattern as active_trainings: daemon thread, return immediately
        t = threading.Thread(
            target=_run_job,
            args=(job_id, table, current_user_id),
            daemon=True,
            name=f"auto-detect-target-{job_id[:8]}",
        )
        t.start()
        return {"job_id": job_id}

    @target_router.get("/auto-detect-target/status/{job_id}")
    async def auto_detect_target_status(
        job_id: str,
        current_user_id: str = Depends(get_current_user2),
    ):
        job = auto_target_jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found or expired")
        if job.get("user_id") and job["user_id"] != current_user_id:
            raise HTTPException(403, "Access denied")
        return {
            "status": job.get("status", "error"),
            "logs": list(job.get("logs") or []),
            "result": job.get("result"),
        }
