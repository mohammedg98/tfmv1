"""
Auto Clean & Split — decision pipeline with anti-leakage guarantees.

Order (strict):
  1. Profile
  2. Safe cleaning (before split): empty/constant columns, empty/high-missing rows,
     duplicates (with confirmation if ratio > 20%)
  3. Split decision + split
  4. Fit imputation on TRAIN only → apply to TRAIN + TEST
  5. Balance TRAIN only (never test)
  6. Final validation + report

Does not load the full dataset into Python memory.
"""

from __future__ import annotations

import asyncio
import logging
import math
import random
import re
import threading
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

auto_clean_split_jobs: Dict[str, Dict[str, Any]] = {}

EMPTY_TOKENS = (
    "('none','null','na','n/a','nan','nat','missing','unknown','-','--','?')"
)

# Configurable thresholds (consultation defaults)
DUP_AUTO_REMOVE_MAX = 0.20          # >20% → ask confirmation
DUP_WARN_FROM = 0.05                # 5–20% → remove + warn
ROW_HIGH_MISSING = 0.80             # row missing ratio → delete
COL_HIGH_MISSING_DROP = 0.90        # feature with ≥90% missing + low info → drop
IMBALANCE_MILD = 1.5
IMBALANCE_STRONG = 10.0
LARGE_TRAIN_FOR_UNDER = 50_000


class AutoCleanSplitStartBody(BaseModel):
    bdName: str = Field(..., min_length=1)
    # Optional overrides from UI (advanced); None = auto
    remove_duplicates: Optional[bool] = None  # if set, skip ask
    train_size: Optional[float] = None
    row_missing_threshold: float = Field(default=ROW_HIGH_MISSING, ge=0.5, le=1.0)


class AutoCleanSplitContinueBody(BaseModel):
    job_id: str
    remove_duplicates: bool = True


def _append_log(job_id: str, message: str):
    job = auto_clean_split_jobs.get(job_id)
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


def _not_empty_expr(col: str) -> str:
    return f"(NOT {_empty_expr(col)})"


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (name or "").lower()).strip("_")


def register_auto_clean_split_routes(
    target_router,
    *,
    get_db_connection,
    get_current_user2,
    analyze_column_type_backend,
    apply_random_split,
    apply_stratified_split,
    apply_oversampling,
    apply_undersampling,
    get_class_distribution,
    get_duplicate_key,
):
    """Attach Auto Clean & Split endpoints onto the shared /api router."""

    def _run_async(coro):
        try:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()
        except Exception:
            return asyncio.run(coro)

    def _run_job(job_id: str, table_name: str, user_id: str, opts: dict):
        report: Dict[str, Any] = {
            "original": {},
            "removed": {
                "empty_columns": [],
                "constant_columns": [],
                "high_missing_columns": [],
                "empty_rows": 0,
                "high_missing_rows": 0,
                "duplicate_rows": 0,
                "target_missing_rows": 0,
            },
            "split": {},
            "imputation": {"median": [], "mean": [], "mode": []},
            "balance": {},
            "validation": {},
            "warnings": [],
        }
        try:
            _append_log(job_id, f"dataset: {table_name}")

            with get_db_connection() as conn:
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT target_column, model_type
                    FROM user_tables_metadata
                    WHERE table_name = %s AND owner_id = %s
                    """,
                    (table_name, user_id),
                )
                meta = cur.fetchone()
                if not meta:
                    raise RuntimeError("Dataset not found or access denied")

                target_column = meta[0]
                model_type = (meta[1] or "").lower()
                supervised = bool(target_column) and model_type != "unsupervised"

                # ─── STEP 1: PROFILE ───────────────────────────────────────
                _append_log(job_id, "1. profile")
                profiles, n_rows, feature_cols = _profile(
                    cur, conn, table_name, analyze_column_type_backend
                )
                report["original"] = {
                    "rows": n_rows,
                    "columns": len(feature_cols),
                    "target": target_column if supervised else None,
                    "supervised": supervised,
                }
                total_missing = sum(p["missing_count"] for p in profiles)
                cells = max(n_rows * max(len(feature_cols), 1), 1)
                _append_log(
                    job_id,
                    f"   {n_rows:,} rows x {len(feature_cols)} columns",
                )
                _append_log(
                    job_id,
                    f"   missing cells: {total_missing:,} ({100.0 * total_missing / cells:.1f}%)",
                )
                if supervised:
                    _append_log(job_id, f"   target: {target_column}")
                else:
                    _append_log(job_id, "   no target")

                dup_count, dup_ratio = _count_duplicates(cur, table_name, get_duplicate_key)
                _append_log(
                    job_id,
                    f"   duplicates: {dup_count:,} ({dup_ratio * 100:.1f}%)",
                )

                # Problem type hint from target cardinality
                problem_type = "unsupervised"
                if supervised and target_column:
                    tp = next((p for p in profiles if p["column_name"] == target_column), None)
                    if tp:
                        d = tp["distinct_count"]
                        if tp["mapped_type"] in ("categorical", "boolean") or (
                            d >= 2 and d <= 50 and tp["unique_ratio"] < 0.5
                        ):
                            problem_type = "classification"
                        elif tp["mapped_type"] == "numeric" or tp.get("is_numeric_content"):
                            problem_type = "regression"
                        else:
                            problem_type = "classification" if d <= 50 else "regression"
                    _append_log(job_id, f"   problem type: {problem_type}")

                # Temporal hint (warn only — this page has no time-based split)
                date_like = [
                    p["column_name"]
                    for p in profiles
                    if p["mapped_type"] == "date"
                    or any(t in _norm(p["column_name"]) for t in ("date", "time", "timestamp", "datetime"))
                ]
                if date_like:
                    msg = (
                        f"Possible time-related columns: {', '.join(date_like[:4])}. "
                        "The split is random, not by time."
                    )
                    report["warnings"].append(msg)
                    _append_log(job_id, f"   time-like columns: {', '.join(date_like[:4])} (split is not chronological)")

                # ─── STEP 2: SAFE CLEANING ─────────────────────────────────
                _append_log(job_id, "2. clean")

                # 2a columns: 100% empty + constant (never drop target)
                drop_cols = []
                for p in profiles:
                    col = p["column_name"]
                    if supervised and col == target_column:
                        continue
                    if p["missing_ratio"] >= 0.999 or p["non_null"] == 0:
                        drop_cols.append((col, "completely empty"))
                    elif p["distinct_count"] <= 1:
                        drop_cols.append((col, "constant (1 unique value)"))
                    elif (
                        p["missing_ratio"] >= COL_HIGH_MISSING_DROP
                        and p["distinct_count"] <= 2
                        and (not supervised or col != target_column)
                    ):
                        drop_cols.append((col, f"≥{COL_HIGH_MISSING_DROP*100:.0f}% missing + very low information"))

                if drop_cols:
                    names = [c for c, _ in drop_cols]
                    _drop_columns(cur, conn, table_name, user_id, names)
                    for c, why in drop_cols:
                        if "empty" in why:
                            report["removed"]["empty_columns"].append(c)
                        elif "constant" in why:
                            report["removed"]["constant_columns"].append(c)
                        else:
                            report["removed"]["high_missing_columns"].append(c)
                        _append_log(job_id, f"   drop column {c}: {why}")
                    # refresh column list
                    profiles, n_rows, feature_cols = _profile(
                        cur, conn, table_name, analyze_column_type_backend
                    )
                else:
                    _append_log(job_id, "   no empty or constant columns")

                # 2b target missing rows (supervised) — never impute target
                if supervised and target_column:
                    cur.execute(
                        f"""
                        DELETE FROM "{table_name}"
                        WHERE {_empty_expr(target_column)}
                        """
                    )
                    n_tgt = cur.rowcount or 0
                    conn.commit()
                    report["removed"]["target_missing_rows"] = n_tgt
                    if n_tgt:
                        _append_log(
                            job_id,
                            f"   drop {n_tgt:,} rows with empty target {target_column}",
                        )
                    else:
                        _append_log(job_id, "   no empty target rows")

                # 2c completely empty rows + high-missing rows
                row_thr = float(opts.get("row_missing_threshold") or ROW_HIGH_MISSING)
                empty_del, high_del = _delete_sparse_rows(
                    cur, conn, table_name, feature_cols, target_column if supervised else None, row_thr
                )
                report["removed"]["empty_rows"] = empty_del
                report["removed"]["high_missing_rows"] = high_del
                if empty_del:
                    _append_log(job_id, f"   drop {empty_del:,} empty rows")
                if high_del:
                    _append_log(
                        job_id,
                        f"   drop {high_del:,} rows with >= {row_thr*100:.0f}% missing",
                    )
                if not empty_del and not high_del:
                    _append_log(job_id, "   no empty or almost-empty rows")

                # 2d duplicates
                dup_count, dup_ratio = _count_duplicates(cur, table_name, get_duplicate_key)
                remove_dups = opts.get("remove_duplicates")
                if dup_count == 0:
                    _append_log(job_id, "   no duplicates")
                else:
                    if remove_dups is None:
                        if dup_ratio > DUP_AUTO_REMOVE_MAX:
                            _append_log(
                                job_id,
                                f"   {dup_count:,} duplicates ({dup_ratio*100:.1f}%). waiting for your choice",
                            )
                            auto_clean_split_jobs[job_id]["status"] = "awaiting_input"
                            auto_clean_split_jobs[job_id]["pending_question"] = {
                                "type": "duplicates",
                                "duplicate_count": dup_count,
                                "duplicate_ratio": round(dup_ratio, 4),
                                "message": (
                                    f"{dup_ratio*100:.1f}% of rows are duplicates ({dup_count:,} rows). "
                                    "Identical rows can be real repeated events. Remove them, or keep them?"
                                ),
                            }
                            event = auto_clean_split_jobs[job_id].setdefault(
                                "input_event", threading.Event()
                            )
                            event.clear()
                            ok = event.wait(timeout=900)
                            if not ok:
                                raise RuntimeError("Timed out waiting for duplicate decision")
                            remove_dups = bool(
                                auto_clean_split_jobs[job_id].get("user_choice_remove_duplicates", True)
                            )
                            auto_clean_split_jobs[job_id]["status"] = "running"
                            auto_clean_split_jobs[job_id]["pending_question"] = None
                        else:
                            remove_dups = True

                    if remove_dups:
                        deleted = _delete_duplicates(cur, conn, table_name, get_duplicate_key)
                        report["removed"]["duplicate_rows"] = deleted
                        note = ""
                        if DUP_WARN_FROM <= dup_ratio <= DUP_AUTO_REMOVE_MAX:
                            note = " (moderate share, removed)"
                            report["warnings"].append(
                                f"Removed {deleted} duplicate rows ({dup_ratio*100:.1f}%)."
                            )
                        _append_log(job_id, f"   drop {deleted:,} duplicates{note}")
                    else:
                        _append_log(job_id, "   keep duplicates (your choice)")
                        report["warnings"].append("Duplicate rows were kept by user choice.")

                cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                n_rows = int(cur.fetchone()[0] or 0)
                if n_rows < 10:
                    raise RuntimeError(
                        f"Too few rows left after cleaning ({n_rows}). Cannot split reliably."
                    )

                # ─── STEP 3: SPLIT DECISION ────────────────────────────────
                _append_log(job_id, "3. split")
                train_size = opts.get("train_size")
                if train_size is None:
                    train_size = 0.9 if n_rows > 100_000 else 0.8
                train_size = float(max(0.1, min(0.9, train_size)))

                if supervised and problem_type == "classification" and target_column:
                    split_method = "stratified"
                    _append_log(job_id, "   method: stratified (same class mix in train and test)")
                else:
                    split_method = "random"
                    why = "regression / unsupervised" if supervised else "unsupervised"
                    _append_log(job_id, f"   method: random ({why})")

                _append_log(
                    job_id,
                    f"   train {train_size*100:.0f}% / test {(1-train_size)*100:.0f}% ({n_rows:,} rows)",
                )

                # Ensure split_type column
                cur.execute(
                    f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS split_type VARCHAR(10)'
                )
                conn.commit()

                if split_method == "stratified":
                    apply_stratified_split(cur, table_name, train_size, target_column, True, 42)
                else:
                    apply_random_split(cur, table_name, train_size, True, 42)
                conn.commit()

                cur.execute(
                    f"""
                    SELECT split_type, COUNT(*) FROM "{table_name}"
                    WHERE split_type IS NOT NULL GROUP BY split_type
                    """
                )
                counts = {r[0]: int(r[1]) for r in cur.fetchall()}
                train_n = counts.get("train", 0)
                test_n = counts.get("test", 0)
                report["split"] = {
                    "method": split_method,
                    "train_size": train_size,
                    "train_rows": train_n,
                    "test_rows": test_n,
                    "problem_type": problem_type,
                }
                _append_log(job_id, f"   result: train {train_n:,} / test {test_n:,}")
                if train_n == 0 or test_n == 0:
                    raise RuntimeError("Split produced an empty train or test set")

                # ─── STEP 4: IMPUTATION (fit train → apply train+test) ─────
                _append_log(job_id, "4. fill missing (stats from train only)")

                # Refresh profiles after cleaning/split
                profiles, _, feature_cols = _profile(
                    cur, conn, table_name, analyze_column_type_backend
                )
                impute_plan = _plan_imputation(
                    cur, conn, table_name, profiles, target_column if supervised else None
                )
                if not impute_plan["median"] and not impute_plan["mean"] and not impute_plan["mode"]:
                    _append_log(job_id, "   no missing features, skip fill")
                else:
                    for method, cols in impute_plan.items():
                        if not cols:
                            continue
                        _append_log(
                            job_id,
                            f"   {method}: {len(cols)} column(s): {', '.join(cols[:8])}"
                            + ("..." if len(cols) > 8 else ""),
                        )
                        details = _apply_imputation_sync(cur, table_name, method, cols)
                        conn.commit()
                        report["imputation"][method] = [
                            {"column": c, **(details.get(c) or {})} for c in cols
                        ]
                        for c in cols:
                            d = details.get(c) or {}
                            if d.get("error"):
                                _append_log(job_id, f"   {c}: failed ({d['error']})")
                            elif d.get("skipped"):
                                _append_log(job_id, f"   {c}: skipped ({d['skipped']})")
                            else:
                                val = d.get("value")
                                aff = d.get("affected_rows", 0)
                                _append_log(job_id, f"   {c}: fill={val!s}, {aff} cells")

                # ─── STEP 5: BALANCE TRAIN ONLY ────────────────────────────
                _append_log(job_id, "5. class balance (train only)")
                balance_info = {"applied": False, "method": None}
                if supervised and problem_type == "classification" and target_column:
                    dist = get_class_distribution(cur, table_name, target_column, split_type="train")
                    if dist and len(dist) >= 2:
                        vals = list(dist.values())
                        ratio = (max(vals) / max(min(vals), 1)) if vals else 1.0
                        _append_log(
                            job_id,
                            "   train classes: "
                            + ", ".join(f"{k}={v}" for k, v in list(dist.items())[:8]),
                        )
                        _append_log(job_id, f"   max/min ratio: {ratio:.1f}:1")
                        if ratio < IMBALANCE_MILD:
                            _append_log(job_id, "   balanced, no resampling")
                            balance_info = {"applied": False, "method": "none", "ratio": ratio}
                        elif ratio >= IMBALANCE_STRONG:
                            msg = (
                                f"Extreme class imbalance ({ratio:.0f}:1). "
                                "Applying oversampling on TRAIN with caution; review results."
                            )
                            report["warnings"].append(msg)
                            _append_log(job_id, f"   strong imbalance {ratio:.0f}:1, oversample train")
                            _run_async(apply_oversampling(conn, cur, table_name, target_column))
                            conn.commit()
                            balance_info = {
                                "applied": True,
                                "method": "oversampling",
                                "ratio": ratio,
                                "extreme": True,
                            }
                            _append_log(job_id, "   oversampling on train. test unchanged")
                        else:
                            method = "undersampling" if train_n >= LARGE_TRAIN_FOR_UNDER else "oversampling"
                            if method == "oversampling":
                                _run_async(apply_oversampling(conn, cur, table_name, target_column))
                            else:
                                _run_async(apply_undersampling(conn, cur, table_name, target_column))
                            conn.commit()
                            balance_info = {"applied": True, "method": method, "ratio": ratio}
                            _append_log(job_id, f"   {method} on train. test unchanged")
                    else:
                        _append_log(job_id, "   cannot read train class counts, skip balance")
                else:
                    _append_log(job_id, "   not classification, skip balance")
                report["balance"] = balance_info

                # ─── STEP 6: VALIDATION ────────────────────────────────────
                _append_log(job_id, "6. check")
                profiles, n_final, feature_cols = _profile(
                    cur, conn, table_name, analyze_column_type_backend
                )
                # missing on train/test features only (exclude target from "must be 0" features)
                miss_train, miss_test = _count_missing_by_split(
                    cur, table_name, feature_cols, target_column if supervised else None
                )
                cur.execute(
                    f"""
                    SELECT split_type, COUNT(*) FROM "{table_name}"
                    WHERE split_type IS NOT NULL GROUP BY split_type
                    """
                )
                counts = {r[0]: int(r[1]) for r in cur.fetchall()}
                report["final"] = {
                    "rows": n_final,
                    "columns": len(feature_cols),
                    "train_rows": counts.get("train", 0),
                    "test_rows": counts.get("test", 0),
                }
                report["validation"] = {
                    "missing_train_features": miss_train,
                    "missing_test_features": miss_test,
                    "leakage_safe_imputation": True,
                    "test_not_resampled": True,
                }
                _append_log(
                    job_id,
                    f"   missing feature cells: train {miss_train}, test {miss_test}",
                )
                if miss_train == 0 and miss_test == 0:
                    _append_log(job_id, "   train and test features have no missing cells")
                else:
                    report["warnings"].append(
                        f"Some missing feature cells remain (train={miss_train}, test={miss_test}). "
                        "They may be non-imputable types or empty columns created later."
                    )
                    _append_log(job_id, "   some missing values remain")
                _append_log(job_id, "   fill values came from train only")
                _append_log(job_id, "   test was not resampled")
                _append_log(job_id, "done.")

                auto_clean_split_jobs[job_id]["status"] = "done"
                auto_clean_split_jobs[job_id]["result"] = {
                    "ok": True,
                    "report": report,
                }
        except Exception as e:
            detail = getattr(e, "detail", None) or str(e)
            logger.exception("auto-clean-split failed")
            auto_clean_split_jobs[job_id]["status"] = "error"
            auto_clean_split_jobs[job_id]["result"] = {"ok": False, "message": detail, "report": report}
            _append_log(job_id, f"ERROR: {detail}")

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
                    "column_type": ctype,
                    "mapped_type": mapped,
                    "is_numeric_content": bool(is_num),
                    "total": total,
                    "non_null": non_null,
                    "distinct_count": distinct,
                    "unique_ratio": unique_ratio,
                    "missing_count": missing,
                    "missing_ratio": missing_ratio,
                }
            )
        return profiles, total, feature_cols

    def _count_duplicates(cur, table_name, get_dup_key):
        cur.execute(f'SELECT COUNT(*)::bigint FROM "{table_name}"')
        total = int(cur.fetchone()[0] or 0)
        if total == 0:
            return 0, 0.0
        key = get_dup_key(table_name, cur)
        cur.execute(
            f"""
            SELECT COUNT(*)::bigint FROM (
                SELECT 1 FROM "{table_name}"
                GROUP BY {key}
                HAVING COUNT(*) > 1
            ) d
            """
        )
        # count of duplicate groups is not row count — use rowcount of extras
        cur.execute(
            f"""
            SELECT COALESCE(SUM(cnt - 1), 0)::bigint FROM (
                SELECT COUNT(*) AS cnt FROM "{table_name}"
                GROUP BY {key}
                HAVING COUNT(*) > 1
            ) t
            """
        )
        dup_rows = int(cur.fetchone()[0] or 0)
        return dup_rows, (dup_rows / float(total)) if total else 0.0

    def _delete_duplicates(cur, conn, table_name, get_dup_key):
        key = get_dup_key(table_name, cur)
        cur.execute(
            f"""
            WITH duplicates AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY {key} ORDER BY id) AS rn
                FROM "{table_name}"
            )
            DELETE FROM "{table_name}"
            WHERE id IN (SELECT id FROM duplicates WHERE rn > 1)
            """
        )
        n = cur.rowcount or 0
        conn.commit()
        return n

    def _drop_columns(cur, conn, table_name, user_id, columns: List[str]):
        for col in columns:
            cur.execute(
                f'ALTER TABLE "{table_name}" DROP COLUMN IF EXISTS "{col}"'
            )
        cur.execute(
            """
            UPDATE user_tables_metadata
            SET columns = (
                SELECT array_agg(column_name::text)
                FROM information_schema.columns
                WHERE table_name = %s
                  AND column_name NOT IN ('id', 'split_type')
            )
            WHERE table_name = %s AND owner_id = %s
            """,
            (table_name, table_name, user_id),
        )
        conn.commit()

    def _delete_sparse_rows(cur, conn, table_name, feature_cols, target_col, thr):
        """Delete 100% empty rows and rows with missing_ratio >= thr (features only)."""
        cols = [c for c in feature_cols if c != target_col]
        if not cols:
            return 0, 0
        empty_all = " AND ".join(_empty_expr(c) for c in cols)
        cur.execute(f'DELETE FROM "{table_name}" WHERE {empty_all}')
        empty_del = cur.rowcount or 0

        # High missing: count empty feature cells per row via SUM of indicators
        parts = [f"(CASE WHEN {_empty_expr(c)} THEN 1 ELSE 0 END)" for c in cols]
        sum_expr = " + ".join(parts)
        n_feat = len(cols)
        # Keep rows that still have target if we want? Consultation: high missing features → delete
        cur.execute(
            f"""
            DELETE FROM "{table_name}"
            WHERE ({sum_expr})::float / {n_feat} >= %s
              AND NOT ({empty_all})
            """,
            (thr,),
        )
        high_del = cur.rowcount or 0
        conn.commit()
        return empty_del, high_del

    def _plan_imputation(cur, conn, table_name, profiles, target_col):
        """Choose imputation method per column.

        Boolean / binary → always MODE (majority True/False or 0/1).
        Mean/median on PG boolean fails (cannot cast boolean → numeric) and
        mean would invent fractional values that are invalid for binary features.
        """
        plan = {"median": [], "mean": [], "mode": []}
        for p in profiles:
            col = p["column_name"]
            if target_col and col == target_col:
                continue
            if p["missing_count"] <= 0:
                continue
            mapped = p["mapped_type"]
            # Boolean (PG bool or 2-class binary) → mode only
            if mapped == "boolean":
                plan["mode"].append(col)
                continue
            is_num = mapped == "numeric" or p.get("is_numeric_content")
            if mapped in ("categorical", "text") and not is_num:
                plan["mode"].append(col)
            elif is_num:
                # skewness proxy on TRAIN sample
                skewed = _is_skewed_train(cur, conn, table_name, col)
                if skewed:
                    plan["median"].append(col)
                else:
                    plan["mean"].append(col)
            else:
                plan["mode"].append(col)
        return plan

    def _is_skewed_train(cur, conn, table_name, col) -> bool:
        try:
            cur.execute(
                f"""
                SELECT AVG(v),
                       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v),
                       STDDEV_SAMP(v)
                FROM (
                    SELECT CAST(BTRIM(CAST("{col}" AS text)) AS double precision) AS v
                    FROM "{table_name}"
                    WHERE split_type = 'train'
                      AND {_not_empty_expr(col)}
                      AND BTRIM(CAST("{col}" AS text))
                          ~ '^-?[0-9]+([.][0-9]+)?([eE][-+]?[0-9]+)?$'
                    LIMIT 5000
                ) s
                """
            )
            mean_v, med_v, std_v = cur.fetchone()
            if mean_v is None or med_v is None:
                return True  # prefer median when unsure
            std_v = float(std_v or 0)
            if std_v <= 1e-12:
                return False
            return abs(float(mean_v) - float(med_v)) > 0.15 * std_v
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            return True

    def _pg_column_type(cur, table_name, column):
        cur.execute(
            """
            SELECT data_type FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
            """,
            (table_name, column),
        )
        row = cur.fetchone()
        return (row[0] or "").lower() if row else ""

    def _apply_mode_one(cur, table_name, column, empty_sql):
        q = f'"{column}"'
        ec = empty_sql.format(col=column)
        cur.execute(
            f"""
            SELECT {q} FROM {table_name}
            WHERE split_type = 'train' AND NOT ({ec})
            GROUP BY {q}
            ORDER BY COUNT(*) DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
        if not row:
            return None, 0, "No train values for mode"
        val = row[0]
        cur.execute(
            f"""
            UPDATE {table_name} SET {q} = %s
            WHERE ({ec}) AND split_type IN ('train', 'test')
            """,
            (val,),
        )
        return val, cur.rowcount or 0, None

    def _apply_imputation_sync(cur, table_name, method, columns):
        empty = (
            '("{col}" IS NULL OR TRIM("{col}"::text) = \'\' OR '
            "LOWER(TRIM(\"{col}\"::text)) IN "
            "('none','null','na','n/a','nan','nat','missing','unknown','-','--','?'))"
        )
        results = {}
        for column in columns:
            try:
                q = f'"{column}"'
                ec = empty.format(col=column)
                pg_type = _pg_column_type(cur, table_name, column)
                # PG boolean cannot use mean/median (::numeric cast fails).
                # Use majority class (mode) — correct for binary features.
                effective = method
                if method in ("mean", "median") and pg_type in ("boolean", "bool"):
                    effective = "mode"

                if effective == "mean":
                    cur.execute(
                        f"""
                        SELECT AVG({q}::numeric) FROM {table_name}
                        WHERE split_type = 'train' AND NOT ({ec})
                        """
                    )
                    val = cur.fetchone()[0]
                    if val is None:
                        results[column] = {"skipped": "No train numeric values", "affected_rows": 0}
                        continue
                    val = float(val)
                    cur.execute(
                        f"""
                        UPDATE {table_name} SET {q} = %s
                        WHERE ({ec}) AND split_type IN ('train', 'test')
                        """,
                        (val,),
                    )
                    results[column] = {
                        "method": "mean",
                        "value": round(val, 6),
                        "affected_rows": cur.rowcount or 0,
                    }
                elif effective == "median":
                    cur.execute(
                        f"""
                        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY {q}::numeric)
                        FROM {table_name}
                        WHERE split_type = 'train' AND NOT ({ec})
                        """
                    )
                    val = cur.fetchone()[0]
                    if val is None:
                        results[column] = {"skipped": "No train numeric values", "affected_rows": 0}
                        continue
                    val = float(val)
                    cur.execute(
                        f"""
                        UPDATE {table_name} SET {q} = %s
                        WHERE ({ec}) AND split_type IN ('train', 'test')
                        """,
                        (val,),
                    )
                    results[column] = {
                        "method": "median",
                        "value": round(val, 6),
                        "affected_rows": cur.rowcount or 0,
                    }
                else:  # mode
                    val, n_aff, skip = _apply_mode_one(cur, table_name, column, empty)
                    if skip:
                        results[column] = {"skipped": skip, "affected_rows": 0}
                        continue
                    results[column] = {
                        "method": "mode",
                        "value": val if not isinstance(val, float) else round(val, 6),
                        "affected_rows": n_aff,
                        "auto_for_boolean": method != "mode",
                    }
            except Exception as e:
                try:
                    cur.connection.rollback()
                except Exception:
                    pass
                results[column] = {"error": str(e), "affected_rows": 0}
        return results

    def _count_missing_by_split(cur, table_name, feature_cols, target_col):
        cols = [c for c in feature_cols if c != target_col]
        if not cols:
            return 0, 0

        def _count(split):
            total = 0
            for c in cols:
                cur.execute(
                    f"""
                    SELECT COUNT(*)::bigint FROM "{table_name}"
                    WHERE split_type = %s AND {_empty_expr(c)}
                    """,
                    (split,),
                )
                total += int(cur.fetchone()[0] or 0)
            return total

        return _count("train"), _count("test")

    @target_router.post("/auto-clean-split/start")
    async def auto_clean_split_start(
        body: AutoCleanSplitStartBody,
        current_user_id: str = Depends(get_current_user2),
    ):
        table = (body.bdName or "").strip().lower()
        if not table:
            raise HTTPException(400, "bdName is required")
        job_id = str(uuid.uuid4())
        opts = {
            "remove_duplicates": body.remove_duplicates,
            "train_size": body.train_size,
            "row_missing_threshold": body.row_missing_threshold,
        }
        auto_clean_split_jobs[job_id] = {
            "status": "running",
            "logs": [],
            "result": None,
            "pending_question": None,
            "user_id": current_user_id,
            "bdName": table,
            "started_at": datetime.now().isoformat(),
            "input_event": threading.Event(),
        }
        t = threading.Thread(
            target=_run_job,
            args=(job_id, table, current_user_id, opts),
            daemon=True,
            name=f"auto-clean-split-{job_id[:8]}",
        )
        t.start()
        return {"job_id": job_id}

    @target_router.post("/auto-clean-split/continue")
    async def auto_clean_split_continue(
        body: AutoCleanSplitContinueBody,
        current_user_id: str = Depends(get_current_user2),
    ):
        job = auto_clean_split_jobs.get(body.job_id)
        if not job:
            raise HTTPException(404, "Job not found or expired")
        if job.get("user_id") != current_user_id:
            raise HTTPException(403, "Access denied")
        if job.get("status") != "awaiting_input":
            raise HTTPException(400, "Job is not waiting for input")
        job["user_choice_remove_duplicates"] = bool(body.remove_duplicates)
        _append_log(
            body.job_id,
            "choice: " + ("remove duplicates" if body.remove_duplicates else "keep duplicates"),
        )
        ev = job.get("input_event")
        if ev:
            ev.set()
        return {"ok": True}

    @target_router.get("/auto-clean-split/status/{job_id}")
    async def auto_clean_split_status(
        job_id: str,
        current_user_id: str = Depends(get_current_user2),
    ):
        job = auto_clean_split_jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found or expired")
        if job.get("user_id") and job["user_id"] != current_user_id:
            raise HTTPException(403, "Access denied")
        return {
            "status": job.get("status", "error"),
            "logs": list(job.get("logs") or []),
            "result": job.get("result"),
            "pending_question": job.get("pending_question"),
        }
