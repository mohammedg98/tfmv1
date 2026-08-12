"""
Shared preprocessing pipeline for training metadata replay at prediction time.

Single source of truth: apply the model's ordered `applied_actions` to raw data
using the parameters stored at training time (never re-fit on prediction data).
"""

from __future__ import annotations

import math
import re
from copy import deepcopy
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd


SKIP_COLUMNS = {"split_type", "id"}


def _action_type(action: Any) -> str:
    if isinstance(action, str):
        return action.split(":")[0].strip().lower()
    if isinstance(action, dict):
        return str(action.get("action") or "").strip().lower()
    return ""


def _source_column(action: Any) -> Optional[str]:
    if isinstance(action, str):
        parts = action.split(":")
        return parts[1] if len(parts) > 1 else None
    if isinstance(action, dict):
        return action.get("source_column") or action.get("column")
    return None


def _params(action: Any) -> Dict[str, Any]:
    if isinstance(action, dict):
        p = action.get("parameters")
        if isinstance(p, dict):
            return p
        # Some older regex actions store pattern/output at top level
        return {
            k: v
            for k, v in action.items()
            if k
            not in {
                "action",
                "description",
                "source_column",
                "column",
                "timestamp",
            }
        }
    return {}


def normalize_action_name(name: str) -> str:
    aliases = {
        "log_transform": "log_transformation",
        "log": "log_transformation",
        "standard": "standard_scaling",
        "minmax": "minmax_normalization",
        "onehot": "onehot_encoding",
        "label": "label_encoding",
        "delete": "column_deletion",
        "regex_extract": "regex_extraction",
        "regex": "regex_extraction",
    }
    key = (name or "").strip().lower()
    return aliases.get(key, key)


def infer_raw_input_columns(
    feature_columns: Sequence[str],
    applied_actions: Optional[Sequence[Any]],
    target_column: Optional[str] = None,
) -> List[str]:
    """
    Columns the user must fill with RAW values before the pipeline runs.
    Removes columns created by transforms; adds their source columns.
    """
    cols = set(c for c in feature_columns if c)
    exclude = set(SKIP_COLUMNS)
    if target_column:
        exclude.add(target_column)
        cols.discard(target_column)

    for action in applied_actions or []:
        atype = normalize_action_name(_action_type(action))
        src = _source_column(action)
        params = _params(action)

        if atype in ("column_deletion", "delete"):
            if src:
                cols.discard(src)
        elif atype == "onehot_encoding":
            for c in params.get("new_columns") or []:
                cols.discard(c)
            if src:
                cols.add(src)
        elif atype == "regex_extraction":
            outs = params.get("output_column") or (
                action.get("output_column") if isinstance(action, dict) else None
            )
            if isinstance(outs, str):
                outs = [outs]
            for c in outs or []:
                cols.discard(c)
            if src:
                cols.add(src)

    return sorted(c for c in cols if c and c not in exclude)


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _apply_one_row_action(
    row: Dict[str, Any],
    action: Any,
    target_column: Optional[str],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Apply a single action to one row dict. Returns (new_row, step_info)."""
    atype = normalize_action_name(_action_type(action))
    src = _source_column(action)
    params = _params(action)
    step = {
        "action": atype,
        "column": src,
        "status": "success",
        "message": "",
    }

    if not atype:
        step["status"] = "skipped"
        step["message"] = "Empty action"
        return row, step

    if src and target_column and src == target_column:
        step["status"] = "skipped"
        step["message"] = f"Skipped target column '{target_column}'"
        return row, step

    if src in SKIP_COLUMNS:
        step["status"] = "skipped"
        step["message"] = f"Skipped system column '{src}'"
        return row, step

    data = row

    try:
        if atype in ("column_deletion", "delete"):
            if src and src in data:
                del data[src]
                step["message"] = f"Deleted column {src}"
            else:
                step["message"] = f"Column {src} already absent"
            return data, step

        if atype == "standard_scaling":
            if src not in data:
                raise KeyError(f"Column {src} not found for standard_scaling")
            mean = _to_float(params.get("mean"), 0.0)
            std = _to_float(params.get("std"), 1.0)
            raw = _to_float(data.get(src), 0.0)
            data[src] = raw if std == 0 else (raw - mean) / std
            step["message"] = f"standard_scaling({src})"
            return data, step

        if atype == "minmax_normalization":
            if src not in data:
                raise KeyError(f"Column {src} not found for minmax_normalization")
            data_min = _to_float(params.get("data_min"), 0.0)
            data_max = _to_float(params.get("data_max"), 1.0)
            target_min = _to_float(params.get("min"), 0.0)
            target_max = _to_float(params.get("max"), 1.0)
            raw = _to_float(data.get(src), 0.0)
            denom = data_max - data_min
            if denom == 0:
                normalized = target_min
            else:
                normalized = ((raw - data_min) / denom) * (target_max - target_min) + target_min
            if params.get("clip", True) is not False:
                normalized = max(target_min, min(target_max, normalized))
            data[src] = normalized
            step["message"] = f"minmax_normalization({src})"
            return data, step

        if atype == "log_transformation":
            if src not in data:
                raise KeyError(f"Column {src} not found for log_transformation")
            raw = _to_float(data.get(src), 0.0)
            offset = _to_float(params.get("offset"), 0.0)
            effective = raw + offset
            if effective <= 0:
                raise ValueError(
                    f"log_transformation on '{src}': value+offset={effective} ≤ 0"
                )
            base = str(params.get("base", "natural")).lower()
            if base in ("10", "log10"):
                data[src] = math.log10(effective)
            elif base in ("2", "log2"):
                data[src] = math.log2(effective)
            else:
                data[src] = math.log(effective)
            step["message"] = f"log_transformation({src}, base={base})"
            return data, step

        if atype == "binary":
            if src not in data:
                raise KeyError(f"Column {src} not found for binary")
            raw = data.get(src, None)
            if raw is None:
                data[src] = 0
            elif isinstance(raw, bool):
                data[src] = int(raw)
            else:
                try:
                    if not isinstance(raw, str) and float(raw) in (0.0, 1.0):
                        data[src] = int(float(raw))
                        step["message"] = f"binary({src})"
                        return data, step
                except (TypeError, ValueError):
                    pass
                value = str(raw).strip().lower()
                if value.endswith(".0") and value[:-2].lstrip("+-").isdigit():
                    value = value[:-2]
                binary_map = {
                    "true": 1,
                    "false": 0,
                    "1": 1,
                    "0": 0,
                    "t": 1,
                    "f": 0,
                    "yes": 1,
                    "no": 0,
                    "vrai": 1,
                    "faux": 0,
                    "oui": 1,
                    "non": 0,
                }
                data[src] = binary_map.get(value, 0)
            step["message"] = f"binary({src})"
            return data, step

        if atype == "invert":
            if src not in data:
                raise KeyError(f"Column {src} not found for invert")
            value = str(data.get(src, "")).strip().lower()
            invert_map = {
                "true": 0,
                "false": 1,
                "1": 0,
                "0": 1,
                "yes": 0,
                "no": 1,
                "vrai": 0,
                "faux": 1,
            }
            data[src] = invert_map.get(value, 1)
            step["message"] = f"invert({src})"
            return data, step

        if atype == "label_encoding":
            if src not in data:
                raise KeyError(f"Column {src} not found for label_encoding")
            current = str(data.get(src, "")).strip().lower()
            mapping = params.get("mapping") or {}
            clean_mapping = {
                str(k).strip().lower(): v for k, v in mapping.items()
            }
            if current in clean_mapping:
                data[src] = float(clean_mapping[current])
            else:
                categories = [
                    str(c).strip().lower() for c in (params.get("categories") or [])
                ]
                if current in categories:
                    data[src] = float(categories.index(current))
                else:
                    data[src] = 0.0
            step["message"] = f"label_encoding({src})"
            return data, step

        if atype == "onehot_encoding":
            if src not in data:
                raise KeyError(f"Column {src} not found for onehot_encoding")
            categories = params.get("categories") or []
            new_columns = params.get("new_columns") or []
            raw_val = str(data.get(src, "")).strip()

            for col in new_columns:
                data[col] = 0

            matched = None
            # Prefer explicit category → column alignment
            if categories and new_columns and len(categories) == len(new_columns):
                for cat, col in zip(categories, new_columns):
                    if str(cat).strip() == raw_val:
                        matched = col
                        break
            if matched is None:
                for col in new_columns:
                    prefix = f"{src}_"
                    if col.startswith(prefix) and col[len(prefix) :] == raw_val:
                        matched = col
                        break
            if matched is not None:
                data[matched] = 1
                step["message"] = f"onehot_encoding({src}) → {matched}"
            else:
                step["message"] = f"onehot_encoding({src}) → no category match"
            if src in data:
                del data[src]
            return data, step

        if atype == "regex_extraction":
            if src not in data:
                raise KeyError(f"Column {src} not found for regex_extraction")
            from backend.regex_extract_engine import apply_regex_to_record, RegexPatternError

            pattern = (
                params.get("pattern")
                or (action.get("pattern") if isinstance(action, dict) else None)
                or ""
            )
            outs = params.get("output_column") or (
                action.get("output_column") if isinstance(action, dict) else None
            )
            if isinstance(outs, str):
                outs = [outs]
            outs = list(outs or [])
            case_insensitive = bool(
                params.get("case_insensitive")
                or params.get("caseInsensitive")
                or False
            )
            extract_mode = (
                params.get("extract_mode")
                or params.get("extractMode")
                or "first"
            )
            cast_numeric = bool(
                params.get("cast_numeric")
                or params.get("castNumeric")
                or extract_mode == "all_count"
            )
            delete_source = bool(
                params.get("delete_source") or params.get("deleteSource") or False
            )
            validate_kind = params.get("validate_kind") or params.get("validateKind")
            try:
                apply_regex_to_record(
                    data,
                    source_column=src,
                    pattern=pattern,
                    output_columns=outs,
                    case_insensitive=case_insensitive,
                    extract_mode=str(extract_mode),
                    cast_numeric=cast_numeric,
                    delete_source=delete_source,
                    validate_kind=validate_kind,
                    normalize=True,
                )
                step["message"] = (
                    f"regex_extraction({src}) mode={extract_mode} "
                    f"-> {', '.join(outs) if outs else '(no outs)'}"
                )
            except RegexPatternError as exc:
                raise ValueError(str(exc)) from exc
            return data, step

        step["status"] = "skipped"
        step["message"] = f"Unsupported action: {atype}"
        return data, step

    except Exception as exc:
        step["status"] = "failed"
        step["message"] = str(exc)
        step["error"] = str(exc)
        raise


def apply_actions_to_records(
    records: List[Dict[str, Any]],
    applied_actions: Optional[Sequence[Any]],
    target_column: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Apply ordered applied_actions to a list of raw row dicts.
    Returns (transformed_records, steps_for_first_row).
    """
    if not applied_actions:
        return [deepcopy(r) for r in records], []

    transformed: List[Dict[str, Any]] = []
    first_steps: List[Dict[str, Any]] = []

    for i, rec in enumerate(records):
        row = deepcopy(rec)
        steps: List[Dict[str, Any]] = []
        for action in applied_actions:
            row, step = _apply_one_row_action(row, action, target_column)
            steps.append(step)
            if step.get("status") == "failed":
                raise ValueError(step.get("error") or step.get("message") or "Transform failed")
        transformed.append(row)
        if i == 0:
            first_steps = steps

    return transformed, first_steps


def apply_actions_to_dataframe(
    df: pd.DataFrame,
    applied_actions: Optional[Sequence[Any]],
    target_column: Optional[str] = None,
) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
    """Vectorized entry: apply actions row-wise via records (safe for mixed dtypes)."""
    records = df.to_dict(orient="records")
    transformed, steps = apply_actions_to_records(records, applied_actions, target_column)
    if not transformed:
        return pd.DataFrame(), steps
    return pd.DataFrame(transformed), steps


def build_feature_matrix(
    transformed_records: List[Dict[str, Any]],
    feature_columns: Sequence[str],
    target_column: Optional[str] = None,
) -> np.ndarray:
    """Build numeric matrix in exact feature order expected by the model."""
    cols = [c for c in feature_columns if c and c != target_column and c not in SKIP_COLUMNS]
    rows = []
    for rec in transformed_records:
        vals = []
        for c in cols:
            if c not in rec:
                raise ValueError(f"Missing feature '{c}' after transformations")
            vals.append(_to_float(rec[c], 0.0))
        rows.append(vals)
    return np.asarray(rows, dtype=float)


_ACTION_LABELS_EN = {
    "standard_scaling": "Standard scaling",
    "minmax_normalization": "MinMax normalization",
    "log_transformation": "Log transformation",
    "onehot_encoding": "One-hot encoding",
    "label_encoding": "Label encoding",
    "column_deletion": "Column deletion",
    "regex_extraction": "Regex extraction",
    "binary": "Binary encoding",
    "invert": "Invert binary",
}


def extract_target_label_maps(
    applied_actions: Optional[Sequence[Any]],
    target_column: Optional[str] = None,
) -> Tuple[Dict[str, str], Dict[str, Any]]:
    """
    From applied_actions label_encoding on the target:
    returns (reverse_map encoded->label, forward_map label->encoded).
    Keys in reverse_map include "1", "1.0" variants for robust lookup.
    """
    reverse: Dict[str, str] = {}
    forward: Dict[str, Any] = {}
    for action in applied_actions or []:
        if not isinstance(action, dict):
            continue
        if normalize_action_name(_action_type(action)) != "label_encoding":
            continue
        src = _source_column(action)
        if target_column and src and src != target_column:
            continue
        mapping = _params(action).get("mapping") or {}
        for label, enc in mapping.items():
            forward[str(label)] = enc
            for key in _encoding_key_variants(enc):
                reverse[key] = str(label)
        # If target_column matched, stop; else keep last label_encoding found
        if target_column and src == target_column:
            break
    return reverse, forward


def _encoding_key_variants(enc: Any) -> List[str]:
    keys = [str(enc)]
    try:
        f = float(enc)
        keys.append(str(f))
        if float(int(f)) == f:
            keys.append(str(int(f)))
    except (TypeError, ValueError):
        pass
    # unique preserve order
    seen = set()
    out = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            out.append(k)
    return out


def decode_class_label(
    value: Any,
    reverse_map: Optional[Dict[str, str]] = None,
) -> Tuple[str, Any]:
    """
    Returns (human_label, encoded_value).
    If mapping missing, human_label falls back to str(encoded).
    """
    reverse_map = reverse_map or {}
    for key in _encoding_key_variants(value):
        if key in reverse_map:
            return reverse_map[key], value
    return str(value), value


def english_action_description(action: Any) -> str:
    """Always return an English description (ignore stored French text)."""
    atype = normalize_action_name(_action_type(action))
    src = _source_column(action) or "—"
    label = _ACTION_LABELS_EN.get(atype, atype.replace("_", " ").title() or "Transform")
    return f"{label} on {src}"


def pipeline_summary(applied_actions: Optional[Sequence[Any]]) -> List[Dict[str, str]]:
    """Informational summary for the UI (does not execute transforms)."""
    summary = []
    for i, action in enumerate(applied_actions or [], start=1):
        atype = normalize_action_name(_action_type(action))
        src = _source_column(action) or "—"
        summary.append(
            {
                "step": str(i),
                "action": atype,
                "column": str(src),
                "description": english_action_description(action),
            }
        )
    return summary
