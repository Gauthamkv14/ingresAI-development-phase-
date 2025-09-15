# backend/utils_no_pandas.py
import csv
from collections import defaultdict
from typing import List, Dict, Callable, Any, Optional
import io

def read_csv_dicts(path: str, encoding: str = "utf-8") -> List[Dict[str, Any]]:
    """Read CSV returning a list of dicts (string values)."""
    with open(path, newline="", encoding=encoding) as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]

def write_csv_dicts(path: str, rows: List[Dict[str, Any]], fieldnames: Optional[List[str]] = None, encoding: str = "utf-8"):
    """Write list-of-dicts to CSV file."""
    if not rows:
        # If no rows specified and no fieldnames, just write nothing
        fieldnames = fieldnames or []
        with open(path, "w", newline="", encoding=encoding) as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if fieldnames:
                writer.writeheader()
        return

    if fieldnames is None:
        # infer order from first row
        fieldnames = list(rows[0].keys())

    with open(path, "w", newline="", encoding=encoding) as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in fieldnames})

def to_csv_bytes(rows: List[Dict[str, Any]], fieldnames: Optional[List[str]] = None) -> bytes:
    """Return CSV bytes (useful for returning as HTTP response)."""
    buf = io.StringIO()
    if not rows:
        if fieldnames is None:
            return b""
        writer = csv.DictWriter(buf, fieldnames=fieldnames)
        writer.writeheader()
    else:
        if fieldnames is None:
            fieldnames = list(rows[0].keys())
        writer = csv.DictWriter(buf, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in fieldnames})
    return buf.getvalue().encode("utf-8")

def groupby(rows: List[Dict[str, Any]], key: str) -> Dict[Any, List[Dict[str, Any]]]:
    """Group rows by a key value. Returns dict: key_value -> list(rows)."""
    g = defaultdict(list)
    for r in rows:
        g[r.get(key)] .append(r)
    return dict(g)

def aggregate_mean(rows: List[Dict[str, Any]], field: str, coerce: Callable[[Any], float] = float, default: float = 0.0) -> float:
    """Compute mean of numeric field for a list of rows. Non-numeric values are ignored."""
    total = 0.0
    count = 0
    for r in rows:
        v = r.get(field)
        try:
            fv = coerce(v) if v not in (None, "") else None
        except Exception:
            fv = None
        if fv is not None:
            total += fv
            count += 1
    return (total / count) if count > 0 else default

def groupby_aggregate(rows: List[Dict[str, Any]], group_key: str, agg_field: str, agg: str = "mean"):
    """
    Return {group_key_value: aggregated_value}.
    agg can be 'mean', 'sum', 'count', 'max', 'min'.
    """
    g = defaultdict(list)
    for r in rows:
        g[r.get(group_key)].append(r)

    out = {}
    for k, items in g.items():
        if agg == "count":
            out[k] = len(items)
        else:
            vals = []
            for i in items:
                v = i.get(agg_field)
                try:
                    if v in (None, ""):
                        continue
                    vals.append(float(v))
                except Exception:
                    continue
            if not vals:
                out[k] = None
            elif agg == "sum":
                out[k] = sum(vals)
            elif agg == "max":
                out[k] = max(vals)
            elif agg == "min":
                out[k] = min(vals)
            else:
                out[k] = sum(vals) / len(vals)
    return out
