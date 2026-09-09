"""
Auto Transform — Column Transformation Decision Engine.

Stays within existing manual Transform methods only:
  numerical: standard | minmax | log
  categorical: onehot | label
  boolean: binary (skip if already 0/1)
  text: frequency | delete
  date: keep | delete
        - keep: leave selected date for optional Time Series MV (not a feature)
        - delete: drop date column(s)
        - with keep_date_column: keep that one, delete other dates

Order:
  1. Profile + role detection
  2. Build per-column decisions (with confidence + reasons)
  3. Delete unsafe columns (constant / mostly-missing / free-text / ids)
  4. Apply encodings & numeric transforms via process-numerisation
  5. Always finish with delete-rows-with-empty-values

Does NOT run regex Extract-from-text (user must do that manually first).
"""

from __future__ import annotations

import asyncio
import logging
import re
import threading
import uuid
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

auto_transform_jobs: Dict[str, Dict[str, Any]] = {}

EMPTY_TOKENS = (
    "('none','null','na','n/a','nan','nat','missing','unknown','-','--','?')"
)

COL_HIGH_MISSING = 0.90
TEXT_UNIQUE_DELETE = 0.90
ONEHOT_MAX_CLASSES = 10
ID_NAME_HINTS = (
    "id", "uuid", "guid", "pk", "index", "row_id", "rowid",
    "customer_id", "user_id", "session_id", "transaction_id",
)


class AutoTransformStartBody(BaseModel):
    bdName: str = Field(..., min_length=1)
    # none = safest default (trees). standard / minmax / auto
    # auto = Log only when strong positive skew; no Standard/MinMax
    scaling_strategy: str = Field(default="none")
    # keep | delete  (legacy aliases: skip→keep, extract→keep)
    date_strategy: str = Field(default="keep")
    # When keeping dates and several exist: which one to keep for Time Series MV
    keep_date_column: Optional[str] = None


def _append_log(job_id: str, message: str):
    job = auto_transform_jobs.get(job_id)
    if not job:
        return
    text = (message or "").strip()
    if not text:
        return
    ts = datetime.now().strftime("%H:%M:%S")
    job["logs"].append(f"[{ts}] {text}")


def _empty_expr(col: str) -> str:
    c = f'"{col}"'
    return (
        f"({c} IS NULL OR BTRIM(CAST({c} AS text)) = '' "
        f"OR LOWER(BTRIM(CAST({c} AS text))) IN {EMPTY_TOKENS})"
    )


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_")


def _looks_like_id(name: str, unique_ratio: float, distinct: int, n_rows: int) -> bool:
    n = _norm(name)
    if n in ID_NAME_HINTS or n.endswith("_id") or n.startswith("id_"):
        return unique_ratio >= 0.95 and distinct >= max(20, int(0.5 * n_rows))
    # uuid-like names only
    if "uuid" in n or "guid" in n:
        return unique_ratio >= 0.9
    return False


def _already_binary_01(cur, table: str, col: str) -> bool:
    """True if non-null values are only 0/1 (numeric or text) — skip Binary Encoding."""
    try:
        cur.execute(
            f"""
            SELECT DISTINCT LOWER(BTRIM(CAST("{col}" AS text)))
            FROM "{table}"
            WHERE NOT {_empty_expr(col)}
            LIMIT 12
            """
        )
        vals = {(r[0] or "") for r in cur.fetchall()}
        if not vals:
            return False
        # Normalize "1.0" → "1"
        normed = set()
        for v in vals:
            s = v.strip()
            if s.endswith(".0") and s[:-2].lstrip("+-").isdigit():
                s = s[:-2]
            normed.add(s)
        if normed <= {"0", "1"}:
            return True
        return False
    except Exception:
        return False


def register_auto_transform_routes(
    target_router,
    *,
    get_db_connection,
    get_current_user2,
    analyze_column_type_backend,
    process_numerisation_fn: Callable,
    NumerisationRequestModel,
    delete_rows_with_empty_fn: Callable,
    DeleteRowsRequestModel,
):
    """Attach Auto Transform endpoints onto the shared /api router."""

    def _profile(cur, conn, table_name, analyze_fn):
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
        cols_info = cur.fetchall()
        feature_cols = [c[0] for c in cols_info]
        cur.execute(f'SELECT COUNT(*)::bigint FROM "{table_name}"')
        total = int(cur.fetchone()[0] or 0)
        profiles = []
        for col_name, pg_type in cols_info:
            try:
                cur.execute(
                    f"""
                    SELECT COUNT(v)::bigint, COUNT(DISTINCT v)::bigint
                    FROM (
                        SELECT BTRIM(CAST("{col_name}" AS text)) AS v
                        FROM "{table_name}"
                        WHERE NOT {_empty_expr(col_name)}
                    ) t
                    """
                )
                non_null, distinct = cur.fetchone()
            except Exception:
                conn.rollback()
                cur = conn.cursor()
                non_null, distinct = 0, 0
            non_null = int(non_null or 0)
            distinct = int(distinct or 0)
            missing = max(total - non_null, 0)
            missing_ratio = (missing / float(total)) if total else 1.0
            unique_ratio = (distinct / float(non_null)) if non_null else 0.0

            # avg text length (sample)
            avg_len = 0.0
            try:
                cur.execute(
                    f"""
                    SELECT AVG(LENGTH(BTRIM(CAST("{col_name}" AS text))))
                    FROM (
                        SELECT "{col_name}" FROM "{table_name}"
                        WHERE NOT {_empty_expr(col_name)}
                        LIMIT 2000
                    ) s
                    """
                )
                avg_len = float(cur.fetchone()[0] or 0)
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                cur = conn.cursor()

            # numeric stats (train-preferred when split exists)
            skew = None
            col_min = None
            has_neg = False
            try:
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = %s AND column_name = 'split_type'
                    )
                    """,
                    (table_name,),
                )
                has_split = bool(cur.fetchone()[0])
                split_f = "AND split_type = 'train'" if has_split else ""
                cur.execute(
                    f"""
                    SELECT
                        AVG(v),
                        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v),
                        STDDEV_SAMP(v),
                        MIN(v),
                        MAX(v)
                    FROM (
                        SELECT CAST(BTRIM(CAST("{col_name}" AS text)) AS double precision) AS v
                        FROM "{table_name}"
                        WHERE NOT {_empty_expr(col_name)}
                          AND BTRIM(CAST("{col_name}" AS text))
                              ~ '^-?[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$'
                          {split_f}
                        LIMIT 8000
                    ) s
                    """
                )
                mean_v, med_v, std_v, mn, mx = cur.fetchone()
                if mean_v is not None and med_v is not None:
                    std_v = float(std_v or 0)
                    if std_v > 1e-12:
                        skew = (float(mean_v) - float(med_v)) / std_v
                    col_min = float(mn) if mn is not None else None
                    has_neg = col_min is not None and col_min < 0
            except Exception:
                try:
                    conn.rollback()
                except Exception:
                    pass
                cur = conn.cursor()

            if non_null == 0:
                ctype, is_num = "text", False
            else:
                try:
                    ctype, is_num = analyze_fn(
                        cur, conn, table_name, col_name, pg_type, total, non_null, distinct
                    )
                except Exception:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    cur = conn.cursor()
                    ctype, is_num = "text", False

            mapped = ctype
            if ctype in ("numerical", "numeric"):
                mapped = "numeric"

            profiles.append(
                {
                    "column_name": col_name,
                    "pg_type": (pg_type or "").lower(),
                    "mapped_type": mapped,
                    "is_numeric_content": bool(is_num),
                    "total": total,
                    "non_null": non_null,
                    "distinct_count": distinct,
                    "unique_ratio": unique_ratio,
                    "missing_count": missing,
                    "missing_ratio": missing_ratio,
                    "avg_len": avg_len,
                    "skew": skew,
                    "col_min": col_min,
                    "has_neg": has_neg,
                }
            )
        return profiles, total, feature_cols

    def _decide_column(
        p,
        *,
        target_col,
        scaling,
        date_strategy,
        keep_date_column,
        cur,
        table,
    ) -> Dict[str, Any]:
        col = p["column_name"]
        mapped = p["mapped_type"]
        distinct = p["distinct_count"]
        ur = p["unique_ratio"]
        mr = p["missing_ratio"]
        is_target = bool(target_col and col == target_col)
        reasons: List[str] = []

        # --- Target ---
        if is_target:
            # Boolean target (true/false phishing labels, etc.) → Binary, not Label.
            # Label Encoding used to wipe these (True vs 'true' key mismatch).
            if mapped == "boolean" or p["pg_type"] in ("boolean", "bool"):
                if _already_binary_01(cur, table, col):
                    return {
                        "column": col,
                        "role": "target",
                        "action": "leave",
                        "method": None,
                        "confidence": 0.95,
                        "reasons": ["Boolean target already 0/1 — leave unchanged"],
                    }
                return {
                    "column": col,
                    "role": "target",
                    "action": "transform",
                    "method": "binary",
                    "confidence": 0.95,
                    "reasons": ["Boolean target → Binary Encoding (true/false → 1/0)"],
                }
            if mapped == "categorical":
                return {
                    "column": col,
                    "role": "target",
                    "action": "transform",
                    "method": "label",
                    "confidence": 0.95,
                    "reasons": ["Categorical target → Label Encoding (never One-Hot)"],
                }
            return {
                "column": col,
                "role": "target",
                "action": "leave",
                "method": None,
                "confidence": 0.9,
                "reasons": ["Numeric/regression target → leave unchanged"],
            }

        # --- Constant / empty ---
        if p["non_null"] == 0 or distinct <= 1:
            return {
                "column": col,
                "role": "constant",
                "action": "delete",
                "method": None,
                "confidence": 0.99,
                "reasons": ["Constant or empty column (≤1 unique value)"],
            }

        if mr >= COL_HIGH_MISSING:
            return {
                "column": col,
                "role": "mostly_missing",
                "action": "delete",
                "method": None,
                "confidence": 0.9,
                "reasons": [f"Missing ratio {mr*100:.0f}% ≥ {COL_HIGH_MISSING*100:.0f}%"],
            }

        # --- Identifier ---
        if _looks_like_id(col, ur, distinct, p["total"]):
            return {
                "column": col,
                "role": "identifier",
                "action": "delete",
                "method": None,
                "confidence": 0.85,
                "reasons": ["Looks like an identifier (name + near-unique values)"],
            }

        # --- Boolean ---
        if mapped == "boolean" or p["pg_type"] in ("boolean", "bool"):
            if _already_binary_01(cur, table, col):
                return {
                    "column": col,
                    "role": "boolean",
                    "action": "leave",
                    "method": None,
                    "confidence": 0.95,
                    "reasons": ["Already 0/1 — skip Binary Encoding"],
                }
            return {
                "column": col,
                "role": "boolean",
                "action": "transform",
                "method": "binary",
                "confidence": 0.95,
                "reasons": ["Boolean → Binary Encoding (true/false → 1/0)"],
            }

        # --- Date ---
        # Keep = optional clock for Time Series MV later; never a normal feature.
        # Delete = drop. With keep_date_column set, only that date stays.
        if mapped == "date":
            if date_strategy == "delete":
                return {
                    "column": col,
                    "role": "date",
                    "action": "delete",
                    "method": None,
                    "confidence": 0.9,
                    "reasons": ["Date strategy: delete"],
                }
            # keep (and legacy skip/extract → keep)
            if keep_date_column and col != keep_date_column:
                return {
                    "column": col,
                    "role": "date",
                    "action": "delete",
                    "method": None,
                    "confidence": 0.9,
                    "reasons": [
                        f"Extra date — not selected for time-based validation "
                        f"(kept '{keep_date_column}')"
                    ],
                }
            return {
                "column": col,
                "role": "date",
                "action": "leave",
                "method": None,
                "confidence": 0.9,
                "reasons": [
                    "Kept for optional Time Series validation in Create Model "
                    "(ignored as a model feature otherwise)"
                ],
            }

        # --- Text (platform already promotes short repetitive → categorical) ---
        if mapped == "text":
            if ur >= TEXT_UNIQUE_DELETE or (distinct >= max(50, int(0.85 * p["non_null"]))):
                return {
                    "column": col,
                    "role": "free_text",
                    "action": "delete",
                    "method": None,
                    "confidence": 0.9,
                    "reasons": [
                        f"Free / high-cardinality text (unique ratio {ur*100:.0f}%). "
                        "Not NLP — delete. Extract useful fields first if needed."
                    ],
                }
            if ur <= 0.5 and distinct >= 2:
                return {
                    "column": col,
                    "role": "repetitive_text",
                    "action": "transform",
                    "method": "frequency",
                    "confidence": 0.75,
                    "reasons": [
                        f"Repetitive text ({distinct} values, unique ratio {ur*100:.0f}%) → Frequency Encoding"
                    ],
                }
            return {
                "column": col,
                "role": "text",
                "action": "delete",
                "method": None,
                "confidence": 0.7,
                "reasons": [
                    "Text with little reusable structure → delete "
                    "(use Extract from text beforehand for useful patterns)"
                ],
            }

        # --- Categorical ---
        if mapped == "categorical":
            # Numeric-looking categories with many levels → treat as numeric feature
            if p.get("is_numeric_content") and distinct > ONEHOT_MAX_CLASSES:
                reasons.append(
                    f"Categorical with numeric content + {distinct} levels → treat as numerical"
                )
                return _decide_numeric(p, scaling=scaling, reasons=reasons, role="numeric_content")

            if distinct <= ONEHOT_MAX_CLASSES:
                return {
                    "column": col,
                    "role": "categorical",
                    "action": "transform",
                    "method": "onehot",
                    "confidence": 0.9 if distinct <= 6 else 0.8,
                    "reasons": [f"{distinct} classes (≤{ONEHOT_MAX_CLASSES}) → One-Hot Encoding"],
                }
            return {
                "column": col,
                "role": "categorical",
                "action": "transform",
                "method": "label",
                "confidence": 0.85,
                "reasons": [
                    f"{distinct} classes (>{ONEHOT_MAX_CLASSES}) → Label Encoding "
                    "(Frequency Encoding is reserved for type text in the manual UI)"
                ],
            }

        # --- Numerical ---
        if mapped == "numeric":
            return _decide_numeric(p, scaling=scaling, reasons=reasons, role="numerical")

        # Fallback
        return {
            "column": col,
            "role": mapped or "unknown",
            "action": "leave",
            "method": None,
            "confidence": 0.4,
            "reasons": ["Unrecognized type — leave unchanged"],
        }

    def _decide_numeric(p, *, scaling: str, reasons: List[str], role: str) -> Dict[str, Any]:
        col = p["column_name"]
        skew = p.get("skew")
        has_neg = bool(p.get("has_neg"))
        methods: List[Dict[str, Any]] = []

        # Log only under Auto when strong right skew + non-negative
        if scaling == "auto" and skew is not None and skew > 0.5 and not has_neg:
            methods.append(
                {
                    "method": "log",
                    "parameters": {"base": "natural", "offset": 1},
                    "reason": f"Strong right skew (~{skew:.2f}) → Log(1+x)",
                }
            )
            reasons.append(f"Strong right skew (~{skew:.2f}) → Log(1+x)")

        if scaling == "standard":
            methods.append({"method": "standard", "parameters": {}, "reason": "User chose Standardization"})
            reasons.append("Scaling: Standardization")
        elif scaling == "minmax":
            methods.append(
                {
                    "method": "minmax",
                    "parameters": {"min": 0, "max": 1, "clip": False},
                    "reason": "User chose MinMax",
                }
            )
            reasons.append("Scaling: MinMax [0,1]")
        elif scaling == "none":
            reasons.append("Scaling: none (safe default for tree models)")
        elif scaling == "auto" and not methods:
            reasons.append("Auto scaling: no strong skew → leave numeric as-is")

        if not methods:
            return {
                "column": col,
                "role": role,
                "action": "leave",
                "method": None,
                "confidence": 0.75,
                "reasons": reasons or ["Numerical — no transform"],
            }

        # First method is primary; extras applied sequentially
        primary = methods[0]
        return {
            "column": col,
            "role": role,
            "action": "transform",
            "method": primary["method"],
            "parameters": primary.get("parameters") or {},
            "extra_methods": methods[1:],
            "confidence": 0.7,
            "reasons": reasons,
        }

    def _drop_columns(cur, conn, table_name, user_id, names: List[str]):
        if not names:
            return
        for col in names:
            cur.execute(
                f'ALTER TABLE "{table_name}" DROP COLUMN IF EXISTS "{col}"'
            )
        cur.execute(
            """
            UPDATE user_tables_metadata
            SET columns = (
                SELECT array_agg(column_name::text ORDER BY ordinal_position)
                FROM information_schema.columns
                WHERE table_name = %s AND column_name != 'id'
            ),
            updated_at = NOW()
            WHERE table_name = %s AND owner_id = %s
            """,
            (table_name, table_name, user_id),
        )
        conn.commit()

    def _run_pipeline(job_id: str, table: str, user_id: str, opts: dict):
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)
            loop.run_until_complete(_run_pipeline_async(job_id, table, user_id, opts))
        finally:
            try:
                loop.close()
            except Exception:
                pass

    async def _run_pipeline_async(job_id: str, table: str, user_id: str, opts: dict):
        scaling = (opts.get("scaling_strategy") or "none").lower()
        if scaling not in ("none", "standard", "minmax", "auto"):
            scaling = "none"
        raw_date_strategy = (opts.get("date_strategy") or "keep").lower()
        # Legacy aliases from older UI
        if raw_date_strategy in ("skip", "extract"):
            raw_date_strategy = "keep"
        date_strategy = raw_date_strategy if raw_date_strategy in ("keep", "delete") else "keep"
        keep_date_column = opts.get("keep_date_column") or None
        if isinstance(keep_date_column, str):
            keep_date_column = keep_date_column.strip() or None

        report: Dict[str, Any] = {
            "decisions": [],
            "deleted_columns": [],
            "transforms": [],
            "left_unchanged": [],
            "empty_rows_deleted": 0,
            "warnings": [],
            "scaling_strategy": scaling,
            "date_strategy": date_strategy,
            "kept_date_column": None,
        }

        try:
            _append_log(job_id, f"dataset: {table}")
            _append_log(job_id, "extract from text first if you need fields from free text")
            _append_log(
                job_id,
                f"scaling: {scaling} | dates: {date_strategy}"
                + (f" keep {keep_date_column}" if keep_date_column else ""),
            )

            # Profile + decide + delete in a short-lived connection, then RELEASE it.
            # process_numerisation does DROP TABLE — holding a conn open = deadlock.
            configs: List[Dict[str, Any]] = []
            to_delete: List[str] = []

            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT 1 FROM user_tables_metadata
                    WHERE table_name = %s AND owner_id = %s
                    """,
                    (table, user_id),
                )
                if not cur.fetchone():
                    raise RuntimeError("Table not found or access denied")

                cur.execute(
                    """
                    SELECT target_column, model_type FROM user_tables_metadata
                    WHERE table_name = %s AND owner_id = %s
                    """,
                    (table, user_id),
                )
                meta = cur.fetchone() or (None, None)
                target_column = meta[0]
                model_type = (meta[1] or "").lower()

                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = %s AND column_name = 'split_type'
                    )
                    """,
                    (table,),
                )
                has_split = bool(cur.fetchone()[0])
                if not has_split:
                    msg = (
                        "no split_type: Standard/MinMax/Frequency fit on the full table. "
                        "Prefer Clean · Split first."
                    )
                    report["warnings"].append(msg)
                    _append_log(job_id, f"   {msg}")

                _append_log(job_id, "1. profile")
                profiles, n_rows, _ = _profile(
                    cur, conn, table, analyze_column_type_backend
                )
                _append_log(job_id, f"   {n_rows:,} rows x {len(profiles)} columns")
                if target_column:
                    _append_log(job_id, f"   target: {target_column} ({model_type or 'n/a'})")

                _append_log(job_id, "2. decide")
                decisions = []
                for p in profiles:
                    d = _decide_column(
                        p,
                        target_col=target_column,
                        scaling=scaling,
                        date_strategy=date_strategy,
                        keep_date_column=keep_date_column,
                        cur=cur,
                        table=table,
                    )
                    decisions.append(d)
                    conf = int(round(100 * float(d.get("confidence") or 0)))
                    act = d["action"]
                    method = d.get("method") or "-"
                    why = "; ".join(d.get("reasons") or []).replace("—", ",").replace("→", "to")
                    _append_log(
                        job_id,
                        f"   {d['column']} [{d.get('role')}] {act}"
                        + (f"/{method}" if act == "transform" else "")
                        + f"  score={conf}%",
                    )
                    if why:
                        _append_log(job_id, f"      {why}")

                report["decisions"] = decisions
                if date_strategy == "keep":
                    kept = [
                        d["column"]
                        for d in decisions
                        if d.get("role") == "date" and d.get("action") == "leave"
                    ]
                    report["kept_date_column"] = (
                        keep_date_column
                        if keep_date_column in kept
                        else (kept[0] if kept else None)
                    )

                to_delete = [d["column"] for d in decisions if d["action"] == "delete"]
                _append_log(job_id, "3. drop columns")
                if to_delete:
                    _drop_columns(cur, conn, table, user_id, to_delete)
                    report["deleted_columns"] = to_delete
                    for c in to_delete:
                        _append_log(job_id, f"   drop {c}")
                else:
                    _append_log(job_id, "   nothing to drop")

                for d in decisions:
                    if d["action"] != "transform" or not d.get("method"):
                        if d["action"] == "leave":
                            report["left_unchanged"].append(d["column"])
                        continue
                    if d["column"] in to_delete:
                        continue
                    cfg = {
                        "column": d["column"],
                        "method": d["method"],
                        "parameters": d.get("parameters") or {},
                    }
                    configs.append(cfg)
                    for extra in d.get("extra_methods") or []:
                        configs.append(
                            {
                                "column": d["column"],
                                "method": extra["method"],
                                "parameters": extra.get("parameters") or {},
                            }
                        )

                # Commit + release locks before DROP TABLE in process_numerisation
                try:
                    conn.commit()
                except Exception:
                    pass

            # Connection closed here — safe to recreate/drop the table

            _append_log(job_id, "4. apply")
            if not configs:
                _append_log(job_id, "   no encodings to apply")
            else:
                # ONE call for all columns — process_numerisation rewrites the whole
                # table (DROP + INSERT). Doing it per-column is extremely slow / looks stuck.
                preview = ", ".join(
                    f"{c['method']}:{c['column']}" for c in configs[:12]
                )
                if len(configs) > 12:
                    preview += "..."
                _append_log(
                    job_id,
                    f"   {len(configs)} transform(s) in one pass: {preview}",
                )
                _append_log(
                    job_id,
                    "   full table rewrite once, wait if the dataset is large",
                )
                try:
                    req = NumerisationRequestModel(
                        bdName=table, configurations=configs
                    )
                    result = await process_numerisation_fn(
                        req, current_user_id=user_id
                    )
                    applied = []
                    if isinstance(result, dict):
                        applied = result.get("transformations") or []
                    for cfg in configs:
                        report["transforms"].append(
                            {
                                "column": cfg["column"],
                                "method": cfg["method"],
                                "ok": True,
                            }
                        )
                    _append_log(job_id, f"   batch applied ({len(configs)} transform(s))")
                    for line in applied[:20]:
                        _append_log(job_id, f"   {line}")
                    if len(applied) > 20:
                        _append_log(job_id, f"   +{len(applied) - 20} more")
                except HTTPException as he:
                    msg = he.detail if isinstance(he.detail, str) else str(he.detail)
                    report["warnings"].append(f"Batch transform failed: {msg}")
                    _append_log(job_id, f"   batch failed: {msg}")
                    _append_log(job_id, "   fallback: one column at a time")
                    for cfg in configs:
                        col = cfg["column"]
                        method = cfg["method"]
                        _append_log(job_id, f"   {method} on {col}")
                        try:
                            req = NumerisationRequestModel(
                                bdName=table, configurations=[cfg]
                            )
                            await process_numerisation_fn(
                                req, current_user_id=user_id
                            )
                            report["transforms"].append(
                                {"column": col, "method": method, "ok": True}
                            )
                            _append_log(job_id, f"   {method} on {col}: ok")
                        except HTTPException as he2:
                            msg2 = (
                                he2.detail
                                if isinstance(he2.detail, str)
                                else str(he2.detail)
                            )
                            report["transforms"].append(
                                {
                                    "column": col,
                                    "method": method,
                                    "ok": False,
                                    "error": msg2,
                                }
                            )
                            report["warnings"].append(f"{col}/{method}: {msg2}")
                            _append_log(job_id, f"   failed: {msg2}")
                        except Exception as e2:
                            msg2 = str(e2)
                            report["transforms"].append(
                                {
                                    "column": col,
                                    "method": method,
                                    "ok": False,
                                    "error": msg2,
                                }
                            )
                            report["warnings"].append(f"{col}/{method}: {msg2}")
                            _append_log(job_id, f"   failed: {msg2}")
                except Exception as e:
                    msg = str(e)
                    report["warnings"].append(f"Batch transform failed: {msg}")
                    _append_log(job_id, f"   batch failed: {msg}")
                    for cfg in configs:
                        report["transforms"].append(
                            {
                                "column": cfg["column"],
                                "method": cfg["method"],
                                "ok": False,
                                "error": msg,
                            }
                        )

            _append_log(job_id, "5. drop empty rows")
            try:
                del_req = DeleteRowsRequestModel(bdName=table)
                del_res = await delete_rows_with_empty_fn(
                    del_req, current_user_id=user_id
                )
                n_del = 0
                if isinstance(del_res, dict):
                    n_del = int(del_res.get("deleted_count") or 0)
                report["empty_rows_deleted"] = n_del
                _append_log(job_id, f"   drop {n_del:,} empty rows")
            except HTTPException as he:
                msg = he.detail if isinstance(he.detail, str) else str(he.detail)
                report["warnings"].append(f"Empty-row cleanup failed: {msg}")
                _append_log(job_id, f"   empty-row cleanup failed: {msg}")
            except Exception as e:
                report["warnings"].append(f"Empty-row cleanup failed: {e}")
                _append_log(job_id, f"   empty-row cleanup failed: {e}")

            _append_log(job_id, "done.")
            auto_transform_jobs[job_id]["status"] = "done"
            auto_transform_jobs[job_id]["result"] = {
                "ok": True,
                "report": report,
                "message": "Auto Transform completed",
            }

        except Exception as e:
            logger.exception("Auto Transform failed")
            _append_log(job_id, f"ERROR: {e}")
            auto_transform_jobs[job_id]["status"] = "error"
            auto_transform_jobs[job_id]["result"] = {
                "ok": False,
                "message": str(e),
                "report": report,
            }

    @target_router.post("/auto-transform/start")
    async def auto_transform_start(
        body: AutoTransformStartBody,
        current_user_id: str = Depends(get_current_user2),
    ):
        table = (body.bdName or "").strip().lower()
        if not table:
            raise HTTPException(400, "bdName is required")
        job_id = str(uuid.uuid4())
        opts = {
            "scaling_strategy": body.scaling_strategy,
            "date_strategy": body.date_strategy,
            "keep_date_column": body.keep_date_column,
        }
        auto_transform_jobs[job_id] = {
            "status": "running",
            "logs": [],
            "result": None,
            "user_id": current_user_id,
            "bdName": table,
            "started_at": datetime.now().isoformat(),
        }
        t = threading.Thread(
            target=_run_pipeline,
            args=(job_id, table, current_user_id, opts),
            daemon=True,
        )
        t.start()
        return {"job_id": job_id, "status": "running"}

    @target_router.get("/auto-transform/status/{job_id}")
    async def auto_transform_status(
        job_id: str,
        current_user_id: str = Depends(get_current_user2),
    ):
        job = auto_transform_jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        if job.get("user_id") != current_user_id:
            raise HTTPException(403, "Access denied")
        return {
            "job_id": job_id,
            "status": job["status"],
            "logs": job.get("logs") or [],
            "result": job.get("result"),
        }

    logger.info("Auto Transform routes registered")
