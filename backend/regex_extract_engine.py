"""
Unified regex extraction engine for train (extract/test) and predict (replay).

Single Python `re` implementation so training and model usage stay consistent.
Also provides: pattern guards, international numeric parsing, output
normalization, and light semantic validation (IP / email / URL / hash).
"""

from __future__ import annotations

import ipaddress
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

# ---- Limits / ReDoS guards -------------------------------------------------

MAX_PATTERN_LENGTH = 500

# Nested quantifiers / catastrophic backtracking heuristics
_DANGEROUS_NESTED = re.compile(
    r"\((?:[^()]*[+*][^()]*)\)[+*{]"  # (a+)+  (a*)*  (a+){2,}
    r"|(\.\*){3,}"  # .*.*.*
    r"|(\.\+){3,}"
)

_POSIX_CLASS_MAP = {
    "[[:space:]]": r"\s",
    "[[:digit:]]": r"\d",
    "[[:alpha:]]": r"[A-Za-z]",
    "[[:alnum:]]": r"[A-Za-z0-9]",
    "[[:word:]]": r"\w",
    "[[:blank:]]": r"[ \t]",
    "[[:punct:]]": r"[!\"\#\$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]",
    "[[:lower:]]": r"[a-z]",
    "[[:upper:]]": r"[A-Z]",
    "[[:xdigit:]]": r"[0-9A-Fa-f]",
}


class RegexPatternError(ValueError):
    """User-facing pattern validation error."""


def translate_legacy_pattern(pattern: str) -> str:
    """
    Convert PostgreSQL-oriented patterns (\\y, POSIX classes) to Python `re`.
    Safe no-op for already-Python patterns.
    """
    if not pattern:
        return pattern
    out = pattern
    # Word boundary: PG \\y → Python \\b
    out = out.replace(r"\y", r"\b")
    for posix, py in _POSIX_CLASS_MAP.items():
        out = out.replace(posix, py)
    # Negated POSIX in character classes: [^[:space:]] already partially handled
    # if written as [^[:space:]] — replace remaining common forms
    out = out.replace("[^[:space:]]", r"[^\s]")
    out = out.replace("[:space:]", r"\s")
    return out


def validate_pattern_safety(pattern: str) -> str:
    """
    Guard against empty / oversized / dangerous patterns.
    Returns the translated (Python-safe) pattern.
    Raises RegexPatternError with a clear message.
    """
    if pattern is None or not str(pattern).strip():
        raise RegexPatternError("Pattern is empty. Enter a regular expression first.")

    raw = str(pattern)
    if len(raw) > MAX_PATTERN_LENGTH:
        raise RegexPatternError(
            f"Pattern is too long ({len(raw)} chars). "
            f"Maximum allowed is {MAX_PATTERN_LENGTH}."
        )

    translated = translate_legacy_pattern(raw)

    if _DANGEROUS_NESTED.search(translated):
        raise RegexPatternError(
            "This pattern looks expensive (nested quantifiers) and may freeze the "
            "server. Simplify it (avoid forms like (a+)+ or (.*)*.*)."
        )

    try:
        re.compile(translated)
    except re.error as exc:
        raise RegexPatternError(f"Invalid regular expression: {exc}") from exc

    return translated


def compile_pattern(pattern: str, case_insensitive: bool = False) -> re.Pattern:
    flags = re.IGNORECASE if case_insensitive else 0
    safe = validate_pattern_safety(pattern)
    return re.compile(safe, flags)


def count_capturing_groups(pattern: str) -> int:
    try:
        safe = validate_pattern_safety(pattern)
        return re.compile(safe).groups
    except RegexPatternError:
        return 0
    except re.error:
        return len(re.findall(r"\((?!\?)", pattern or ""))


# ---- Numeric / output normalization ---------------------------------------

def normalize_international_number(value: Any) -> Optional[float]:
    """
    Parse numbers with mixed , / . conventions:
      72,5 → 72.5
      1.234,56 → 1234.56
      1,234.56 → 1234.56
      15 → 15.0
    Returns None if not parseable.
    """
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    # strip currency / percent leftovers if any slipped through
    s = re.sub(r"[€$£¥%\s]", "", s)
    if not s or not re.search(r"\d", s):
        return None

    neg = False
    if s.startswith("-"):
        neg = True
        s = s[1:]
    elif s.startswith("+"):
        s = s[1:]

    if "," in s and "." in s:
        # Last separator is the decimal
        if s.rfind(",") > s.rfind("."):
            # EU: 1.234,56
            s = s.replace(".", "").replace(",", ".")
        else:
            # US: 1,234.56
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            # decimal comma: 72,5
            s = parts[0].replace(".", "") + "." + parts[1]
        else:
            # thousands: 1,234
            s = s.replace(",", "")
    # else: only dots — leave as is (1.5 or 1.234 ambiguous → float handles 1.5;
    # multiple dots treated as invalid below)

    try:
        val = float(s)
        return -val if neg else val
    except ValueError:
        return None


def normalize_output_value(
    value: Any,
    *,
    kind: Optional[str] = None,
    lowercase_kinds: Optional[Sequence[str]] = None,
) -> str:
    """Trim; optionally lowercase for hash / domain / email."""
    if value is None:
        return ""
    s = str(value).strip()
    # strip trailing punctuation often captured from logs
    s = s.strip(".,;:\"'()[]{}<>")
    kinds = set(lowercase_kinds or ("hash", "md5", "sha1", "sha256", "domain", "email", "url_host"))
    if kind and kind.lower() in kinds:
        s = s.lower()
    return s


# ---- Semantic validation --------------------------------------------------

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MD5_RE = re.compile(r"^[0-9a-f]{32}$", re.I)
_SHA1_RE = re.compile(r"^[0-9a-f]{40}$", re.I)
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$", re.I)


def validate_extracted(value: str, kind: Optional[str]) -> Tuple[bool, str]:
    """
    Soft semantic check. Returns (ok, reject_reason).
    Empty kind → always ok (no semantic check).
    """
    if not kind:
        return True, ""
    if value is None or str(value).strip() == "":
        return False, "empty"
    v = str(value).strip()
    k = kind.lower()

    try:
        if k in ("ipv4", "ip"):
            addr = ipaddress.ip_address(v)
            if addr.version != 4:
                return False, "not_ipv4"
            return True, ""
        if k in ("ipv6",):
            addr = ipaddress.ip_address(v)
            if addr.version != 6:
                return False, "not_ipv6"
            return True, ""
        if k in ("email",):
            if not _EMAIL_RE.match(v) or ".." in v:
                return False, "invalid_email"
            return True, ""
        if k in ("url",):
            parsed = urlparse(v if "://" in v else f"http://{v}")
            if not parsed.netloc and not parsed.path:
                return False, "invalid_url"
            if "://" in v and parsed.scheme not in ("http", "https", "ftp"):
                return False, "invalid_url_scheme"
            return True, ""
        if k in ("md5", "hash_md5"):
            ok = _MD5_RE.match(v) is not None
            return ok, "" if ok else "invalid_md5"
        if k in ("sha1", "hash_sha1"):
            ok = _SHA1_RE.match(v) is not None
            return ok, "" if ok else "invalid_sha1"
        if k in ("sha256", "hash_sha256", "hash"):
            if _MD5_RE.match(v) or _SHA1_RE.match(v) or _SHA256_RE.match(v):
                return True, ""
            return False, "invalid_hash"
    except ValueError:
        return False, f"invalid_{k}"

    return True, ""


def infer_validation_kind(preset_id: Optional[str], pattern: str = "") -> Optional[str]:
    """Map preset id (or pattern hints) to a validation kind."""
    if preset_id:
        pid = preset_id.lower()
        mapping = {
            "ipv4": "ipv4",
            "ipv6": "ipv6",
            "email": "email",
            "email_domain": "domain",
            "url": "url",
            "url_host": "domain",
            "domain": "domain",
            "md5": "md5",
            "sha1": "sha1",
            "sha256": "sha256",
        }
        if pid in mapping:
            return mapping[pid]
    # light heuristic from pattern text
    p = (pattern or "").lower()
    if "25[0-5]" in p or "ipv4" in p:
        return "ipv4"
    if "cve-" in p:
        return None
    return None


# ---- Core extract ---------------------------------------------------------

def _groups_from_match(match: re.Match) -> List[str]:
    """Prefer capturing groups; fall back to full match (group 0)."""
    if match.lastindex:
        return [match.group(i) if match.group(i) is not None else "" for i in range(1, match.lastindex + 1)]
    return [match.group(0) or ""]


def extract_from_text(
    text: Any,
    pattern: str,
    *,
    case_insensitive: bool = False,
    extract_mode: str = "first",
    cast_numeric: bool = False,
    validate_kind: Optional[str] = None,
    normalize: bool = True,
    compiled: Optional[re.Pattern] = None,
) -> Dict[str, Any]:
    """
    Extract from a single cell.

    Returns:
      {
        matched: bool,
        groups: List[str|float|None],   # length = n groups (or 1 for all_count)
        invalid_count: int,
        reject_reasons: List[str],
      }
    """
    mode = (extract_mode or "first").lower()
    if mode not in ("first", "all_concat", "all_count"):
        mode = "first"

    if text is None:
        return {"matched": False, "groups": [], "invalid_count": 0, "reject_reasons": []}

    raw = str(text)
    if not raw.strip():
        return {"matched": False, "groups": [], "invalid_count": 0, "reject_reasons": []}

    cre = compiled or compile_pattern(pattern, case_insensitive)

    if mode == "all_count":
        n = len(list(cre.finditer(raw)))
        return {
            "matched": n > 0,
            "groups": [float(n) if cast_numeric else str(n)],
            "invalid_count": 0,
            "reject_reasons": [],
        }

    if mode == "all_concat":
        matches = list(cre.finditer(raw))
        if not matches:
            return {"matched": False, "groups": [], "invalid_count": 0, "reject_reasons": []}
        # Align by max groups across matches
        all_group_lists = [_groups_from_match(m) for m in matches]
        width = max(len(g) for g in all_group_lists)
        columns: List[str] = []
        invalid = 0
        reasons: List[str] = []
        for gi in range(width):
            parts = []
            for gl in all_group_lists:
                part = gl[gi] if gi < len(gl) else ""
                if normalize:
                    part = normalize_output_value(part, kind=validate_kind)
                ok, reason = validate_extracted(part, validate_kind)
                if not ok:
                    invalid += 1
                    reasons.append(reason)
                    continue
                if part:
                    parts.append(part)
            joined = " | ".join(parts)
            if cast_numeric:
                # multi numeric concat stays text; cast only if single value
                num = normalize_international_number(joined) if " | " not in joined else None
                columns.append(num if num is not None else joined)  # type: ignore
            else:
                columns.append(joined)
        return {
            "matched": True,
            "groups": columns,
            "invalid_count": invalid,
            "reject_reasons": reasons,
        }

    # first
    match = cre.search(raw)
    if not match:
        return {"matched": False, "groups": [], "invalid_count": 0, "reject_reasons": []}

    groups = _groups_from_match(match)
    out: List[Any] = []
    invalid = 0
    reasons: List[str] = []
    for g in groups:
        val = normalize_output_value(g, kind=validate_kind) if normalize else (g or "")
        ok, reason = validate_extracted(val, validate_kind)
        if not ok:
            invalid += 1
            reasons.append(reason)
            out.append(None if cast_numeric else "")
            continue
        if cast_numeric:
            num = normalize_international_number(val)
            out.append(num if num is not None else "")
        else:
            out.append(val)
    return {
        "matched": True,
        "groups": out,
        "invalid_count": invalid,
        "reject_reasons": reasons,
    }


def extract_column_values(
    values: Sequence[Any],
    pattern: str,
    *,
    case_insensitive: bool = False,
    extract_mode: str = "first",
    cast_numeric: bool = False,
    validate_kind: Optional[str] = None,
    normalize: bool = True,
    n_groups: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Apply extraction to a full column (list of cell values).

    Returns metrics + per-row group lists (aligned to n_groups).
    """
    cre = compile_pattern(pattern, case_insensitive)
    mode = (extract_mode or "first").lower()
    if n_groups is None:
        n_groups = 1 if mode == "all_count" else max(count_capturing_groups(pattern), 1)

    rows_out: List[List[Any]] = []
    matched_rows = 0
    invalid_total = 0
    non_empty = 0

    for val in values:
        if val is not None and str(val).strip() != "":
            non_empty += 1
        result = extract_from_text(
            val,
            pattern,
            case_insensitive=case_insensitive,
            extract_mode=mode,
            cast_numeric=cast_numeric,
            validate_kind=validate_kind,
            normalize=normalize,
            compiled=cre,
        )
        groups = list(result["groups"])
        # pad / trim to n_groups
        if mode != "all_count":
            while len(groups) < n_groups:
                groups.append(None if cast_numeric else "")
            groups = groups[:n_groups]
        else:
            if not groups:
                groups = [0.0 if cast_numeric else "0"]
        if result["matched"]:
            matched_rows += 1
        invalid_total += int(result["invalid_count"] or 0)
        rows_out.append(groups)

    total = len(values)
    unmatched = total - matched_rows
    match_pct = round((matched_rows / total) * 100, 2) if total else 0.0
    invalid_rate = round((invalid_total / max(matched_rows, 1)) * 100, 2) if matched_rows else 0.0

    return {
        "rows": rows_out,
        "n_groups": n_groups,
        "total_rows": total,
        "non_empty_rows": non_empty,
        "matched_rows": matched_rows,
        "unmatched_rows": unmatched,
        "match_pct": match_pct,
        "invalid_count": invalid_total,
        "invalid_rate": invalid_rate,
        "extract_mode": mode,
        "pattern": cre.pattern,
    }


def apply_regex_to_record(
    data: Dict[str, Any],
    *,
    source_column: str,
    pattern: str,
    output_columns: Sequence[str],
    case_insensitive: bool = False,
    extract_mode: str = "first",
    cast_numeric: bool = False,
    delete_source: bool = False,
    validate_kind: Optional[str] = None,
    normalize: bool = True,
) -> Dict[str, Any]:
    """In-place extract for one prediction row dict. Returns the same dict."""
    outs = list(output_columns or [])
    result = extract_from_text(
        data.get(source_column),
        pattern,
        case_insensitive=case_insensitive,
        extract_mode=extract_mode,
        cast_numeric=cast_numeric,
        validate_kind=validate_kind,
        normalize=normalize,
    )
    groups = list(result["groups"])
    for i, col in enumerate(outs):
        if extract_mode == "all_count":
            data[col] = groups[0] if groups else (0 if cast_numeric else "0")
        elif i < len(groups):
            val = groups[i]
            data[col] = "" if val is None else val
        else:
            data[col] = "" if not cast_numeric else ""
    if delete_source and source_column in data and source_column not in ("id", "split_type"):
        del data[source_column]
    return data
