#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Local bridge that lets the static dashboard save manual receipts into the repo."""

from __future__ import annotations

import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from manual_receipts_store import (
    BASE_DIR,
    archive_manual_invoice,
    decode_data_url,
    extract_pdf_suggestions,
    load_existing_transaction_keys,
    load_manual_receipts,
    normalize_manual_receipt,
    receipt_identity,
    save_manual_receipts,
)

HOST = "127.0.0.1"
PORT = 8765
DASHBOARD_DIR = BASE_DIR / "dashboard-web"


def run_command(command, cwd: Path):
    return subprocess.run(
        command,
        cwd=str(cwd),
        capture_output=True,
        text=True,
    )


def git(*args: str):
    return run_command(["git", *args], BASE_DIR)


def rebuild_and_publish(summary: str):
    build_report = run_command([sys.executable, str(BASE_DIR / "build_report.py")], BASE_DIR)
    if build_report.returncode != 0:
        raise RuntimeError(build_report.stderr or build_report.stdout or "build_report.py failed.")

    dashboard_build = run_command(["npm", "run", "build"], DASHBOARD_DIR)
    if dashboard_build.returncode != 0:
        raise RuntimeError(dashboard_build.stderr or dashboard_build.stdout or "dashboard build failed.")

    git("add", "manual_receipts.json")
    git("add", "manual_invoices")
    git("add", "AI_Tools_Expenses_2025_2026.xlsx")
    git("add", "docs")
    git("add", "dashboard-web/public/data.json")

    commit = git("commit", "-m", f"Manual import: add receipt for {summary}")
    if commit.returncode != 0 and "nothing to commit" not in (commit.stdout + commit.stderr).lower():
        raise RuntimeError(commit.stderr or commit.stdout or "git commit failed.")

    push_master = git("push", "origin", "master")
    if push_master.returncode != 0:
        raise RuntimeError(push_master.stderr or push_master.stdout or "git push origin master failed.")

    push_main = git("push", "origin", "master:main")
    if push_main.returncode != 0:
        raise RuntimeError(push_main.stderr or push_main.stdout or "git push origin master:main failed.")

    head = git("rev-parse", "--short", "HEAD")
    return (head.stdout or "").strip()


class ManualReceiptHandler(BaseHTTPRequestHandler):
    server_version = "RTAIBridge/1.0"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def log_message(self, *_args):
        return

    def send_json(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self.send_json(404, {"ok": False, "error": "Not found."})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "mode": "local-bridge",
                "receiptsCount": len(load_manual_receipts()),
                "workspace": str(BASE_DIR),
            },
        )

    def do_POST(self):
        if self.path == "/parse-pdf":
            self.handle_parse_pdf()
            return
        if self.path == "/manual-receipts":
            self.handle_manual_receipt()
            return
        self.send_json(404, {"ok": False, "error": "Not found."})

    def handle_parse_pdf(self):
        payload = self.read_json_body()
        file_data = payload.get("fileBase64")

        if not file_data:
            self.send_json(400, {"ok": False, "error": "A PDF file is required."})
            return

        try:
            pdf_bytes = decode_data_url(file_data)
            suggestions = extract_pdf_suggestions(pdf_bytes)
        except Exception as error:
            self.send_json(422, {"ok": False, "error": f"Could not read the PDF: {error}"})
            return

        self.send_json(200, {"ok": True, **suggestions})

    def handle_manual_receipt(self):
        payload = self.read_json_body()
        entry_payload = payload.get("entry") or {}
        file_name = payload.get("fileName")
        file_data = payload.get("fileBase64")
        pdf_bytes = decode_data_url(file_data) if file_data else None

        existing_entries = load_manual_receipts()

        try:
            entry = normalize_manual_receipt(entry_payload)
        except Exception as error:
            self.send_json(400, {"ok": False, "error": str(error)})
            return

        all_existing_keys = {receipt_identity(item) for item in existing_entries}
        all_existing_keys.update(load_existing_transaction_keys())
        if receipt_identity(entry) in all_existing_keys:
            self.send_json(409, {"ok": False, "error": "החיוב הזה כבר קיים במערכת."})
            return

        saved_attachment = None
        try:
            saved_attachment = archive_manual_invoice(entry, pdf_bytes, file_name)
            if saved_attachment:
                entry["attachment_path"] = saved_attachment
                entry["attachment_name"] = file_name

            updated_entries = sorted(
                [*existing_entries, entry],
                key=lambda item: (item["date"], item["tool"], item["description"]),
            )
            save_manual_receipts(updated_entries)
            commit_hash = rebuild_and_publish(f"{entry['tool']} {entry['date']}")
        except Exception as error:
            save_manual_receipts(existing_entries)
            if saved_attachment:
                attachment_path = BASE_DIR / saved_attachment
                if attachment_path.exists():
                    attachment_path.unlink()
            self.send_json(500, {"ok": False, "error": str(error)})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "message": "הקבלה נשמרה, האקסל נבנה מחדש והדשבורד עודכן.",
                "commit": commit_hash,
                "entry": entry,
            },
        )


def main():
    server = ThreadingHTTPServer((HOST, PORT), ManualReceiptHandler)
    print(f"Manual receipt bridge listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping manual receipt bridge.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
