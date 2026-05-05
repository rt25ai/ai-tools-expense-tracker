from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.benchmark import run_benchmark
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.detect import detect
    from graphify.export import to_html, to_json
    from graphify.extract import extract
    from graphify.report import generate
except ImportError as exc:  # pragma: no cover - import error is the user-facing path
    raise SystemExit(
        "Graphify is not installed. Run `python -m pip install graphifyy` first."
    ) from exc


ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "graphify-out"

PATH_LABEL_RULES: tuple[tuple[str, str], ...] = (
    ("dashboard-web/src/components/ui/", "UI Primitives"),
    ("dashboard-web/src/components/pages/", "Report Views"),
    ("dashboard-web/src/components/", "Dashboard Components"),
    ("dashboard-web/src/lib/", "Dashboard Data"),
    ("dashboard-web/src/app/reports/", "Report Routes"),
    ("dashboard-web/src/app/", "App Routes"),
    ("dashboard-web/next.config.ts", "Next Config"),
    ("dashboard-web/next-env.d.ts", "Next.js Types"),
    ("dashboard-web/public/sw.js", "Service Worker"),
    ("api/_lib/", "Import Gateway"),
    ("api/health.js", "Health API"),
    ("api/manual-import.js", "Manual Import Route"),
    ("api/", "Manual Import API"),
    ("auto_invoice.py", "Invoice Scanner"),
    ("build_report.py", "Report Builder"),
    ("manual_receipt_bridge.py", "Receipt Bridge"),
    ("manual_receipts_store.py", "Receipt Store"),
    ("exchange_rate.py", "Exchange Rate"),
)

LABEL_STOPWORDS = {
    "app",
    "auto",
    "bars",
    "bridge",
    "budget",
    "button",
    "card",
    "chart",
    "client",
    "components",
    "dashboard",
    "data",
    "frame",
    "github",
    "import",
    "manual",
    "page",
    "pages",
    "receipt",
    "receipts",
    "report",
    "reports",
    "settings",
    "table",
    "tools",
    "tracker",
    "transactions",
    "ui",
    "use",
    "utils",
    "view",
    "web",
}


def normalize_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    root_normalized = str(ROOT).replace("\\", "/")
    if normalized.startswith(root_normalized + "/"):
        return normalized[len(root_normalized) + 1 :]
    return normalized


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def count_words(path: Path) -> int:
    try:
        return len(path.read_text(encoding="utf-8").split())
    except UnicodeDecodeError:
        return len(path.read_text(errors="ignore").split())


def summarize_detection(detection: dict[str, object]) -> str:
    files = detection.get("files", {})
    total_files = int(detection.get("total_files", 0))
    total_words = int(detection.get("total_words", 0))
    parts = [f"Corpus: {total_files} files | ~{total_words:,} words"]

    for key, label in (
        ("code", "code"),
        ("document", "docs"),
        ("paper", "papers"),
        ("image", "images"),
        ("video", "video"),
    ):
        count = len(files.get(key, []))
        if count:
            parts.append(f"  {label}: {count}")

    skipped = detection.get("skipped_sensitive", [])
    if skipped:
        parts.append(f"  skipped sensitive: {len(skipped)}")

    return "\n".join(parts)


def infer_label(graph, nodes: list[str], community_id: int) -> str:
    source_scores: Counter[str] = Counter()
    for node in nodes:
        source_file = normalize_path(graph.nodes[node].get("source_file", ""))
        for prefix, label in PATH_LABEL_RULES:
            if source_file == prefix or source_file.startswith(prefix):
                source_scores[label] += 1

    if source_scores:
        return source_scores.most_common(1)[0][0]

    token_scores: Counter[str] = Counter()
    for node in nodes:
        node_data = graph.nodes[node]
        source_file = normalize_path(node_data.get("source_file", ""))
        label = node_data.get("label", "")
        if not label:
            continue
        if source_file and Path(source_file).name == label:
            continue
        if label.startswith(".") and label.endswith("()"):
            continue

        for token in re.findall(r"[A-Za-z][A-Za-z0-9]+", label):
            normalized = token.lower()
            if len(normalized) < 3 or normalized in LABEL_STOPWORDS:
                continue
            token_scores[normalized] += 1

    if token_scores:
        tokens = [token.title() for token, _ in token_scores.most_common(2)]
        return " ".join(tokens)

    return f"Community {community_id}"


def build_code_graph() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / ".graphify_python").write_text(sys.executable, encoding="utf-8")

    detection = detect(ROOT)
    write_json(OUT_DIR / ".graphify_detect.json", detection)
    print(summarize_detection(detection))

    code_files = [ROOT / Path(path) for path in detection["files"].get("code", [])]
    if not code_files:
        raise SystemExit("No code files detected after applying .graphifyignore.")

    extraction = extract(code_files)
    write_json(OUT_DIR / ".graphify_extract.json", extraction)

    graph = build_from_json(extraction)
    if graph.number_of_nodes() == 0:
        raise SystemExit("Graphify extraction produced an empty graph.")

    communities = cluster(graph)
    cohesion = score_all(graph, communities)
    labels = {cid: infer_label(graph, nodes, cid) for cid, nodes in communities.items()}
    questions = suggest_questions(graph, communities, labels)
    gods = god_nodes(graph)
    surprises = surprising_connections(graph, communities)

    code_total_words = sum(count_words(path) for path in code_files)
    graph_detection = {
        "files": {"code": [normalize_path(str(path.relative_to(ROOT))) for path in code_files]},
        "total_files": len(code_files),
        "total_words": code_total_words,
        "needs_graph": True,
        "warning": detection.get("warning"),
        "skipped_sensitive": detection.get("skipped_sensitive", []),
    }

    report = generate(
        graph,
        communities,
        cohesion,
        labels,
        gods,
        surprises,
        graph_detection,
        {
            "input": extraction.get("input_tokens", 0),
            "output": extraction.get("output_tokens", 0),
        },
        str(ROOT),
        suggested_questions=questions,
    )
    (OUT_DIR / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    to_json(graph, communities, str(OUT_DIR / "graph.json"))

    if graph.number_of_nodes() <= 5000:
        to_html(graph, communities, str(OUT_DIR / "graph.html"), community_labels=labels)

    analysis = {
        "communities": {str(cid): nodes for cid, nodes in communities.items()},
        "cohesion": {str(cid): score for cid, score in cohesion.items()},
        "gods": gods,
        "surprises": surprises,
        "questions": questions,
    }
    write_json(OUT_DIR / ".graphify_analysis.json", analysis)
    write_json(OUT_DIR / ".graphify_labels.json", {str(cid): label for cid, label in labels.items()})

    if code_total_words > 5000:
        benchmark = run_benchmark(str(OUT_DIR / "graph.json"), corpus_words=code_total_words)
        write_json(OUT_DIR / "benchmark.json", benchmark)

    print(
        f"Graph complete: {graph.number_of_nodes()} nodes, "
        f"{graph.number_of_edges()} edges, {len(communities)} communities"
    )
    print(f"Outputs: {OUT_DIR}")


if __name__ == "__main__":
    build_code_graph()
