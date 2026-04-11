#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Local bridge that lets the static dashboard save manual receipts into the repo."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

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
    executable = command[0]
    resolved_executable = shutil.which(executable)

    if resolved_executable is None and sys.platform.startswith("win"):
        for suffix in (".cmd", ".exe", ".bat"):
            resolved_executable = shutil.which(f"{executable}{suffix}")
            if resolved_executable:
                break

    if resolved_executable:
        command = [resolved_executable, *command[1:]]

    return subprocess.run(
        command,
        cwd=str(cwd),
        capture_output=True,
        text=True,
    )


def git(*args: str):
    return run_command(["git", *args], BASE_DIR)


def sort_entries(entries: list[dict]) -> list[dict]:
    return sorted(entries, key=lambda item: (item["date"], item["tool"], item["description"]))


def receipt_commit_message(action: str, entry: dict) -> str:
    return f"Manual import: {action} receipt for {entry['tool']} {entry['date']}"


def rebuild_and_publish(commit_message: str):
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

    commit = git("commit", "-m", commit_message)
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


def receipt_not_found(receipt_id: str) -> str:
    return f"לא נמצאה קבלה ידנית עם המזהה {receipt_id}."


def build_updated_entry(entry_payload: dict, existing_entry: dict, file_name: str | None) -> dict:
    entry_mode = entry_payload.get("entry_mode") or existing_entry.get("entry_mode")
    if not entry_mode:
        entry_mode = "pdf-upload" if file_name or existing_entry.get("attachment_path") else "manual-form"

    normalized_payload = {
        **entry_payload,
        "id": existing_entry["id"],
        "created_at": existing_entry.get("created_at"),
        "entry_source": existing_entry.get("entry_source", "manual"),
        "attachment_path": existing_entry.get("attachment_path"),
        "attachment_name": file_name or existing_entry.get("attachment_name"),
        "entry_mode": entry_mode,
    }
    return normalize_manual_receipt(normalized_payload)


def write_attachment(target_path: Path, content: bytes):
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content)


class ManualReceiptHandler(BaseHTTPRequestHandler):
    server_version = "RTAIBridge/1.0"

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
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

    def request_path(self):
        return urlparse(self.path).path

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.request_path() != "/health":
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
        path = self.request_path()
        if path == "/parse-pdf":
            self.handle_parse_pdf()
            return
        if path == "/manual-receipts":
            self.handle_manual_receipt_create()
            return
        self.send_json(404, {"ok": False, "error": "Not found."})

    def do_PUT(self):
        if self.request_path() != "/manual-receipts":
            self.send_json(404, {"ok": False, "error": "Not found."})
            return
        self.handle_manual_receipt_update()

    def do_DELETE(self):
        if self.request_path() != "/manual-receipts":
            self.send_json(404, {"ok": False, "error": "Not found."})
            return
        self.handle_manual_receipt_delete()

    def handle_parse_pdf(self):
        payload = self.read_json_body()
        file_data = payload.get("fileBase64")

        if not file_data:
            self.send_json(400, {"ok": False, "error": "A PDF file is required."})
            return

        try:
            pdf_bytes = decode_data_url(file_data)
            suggestions = extract_pdf_suggestions(pdf_bytes, payload.get("fileName"))
        except Exception as error:
            self.send_json(422, {"ok": False, "error": f"Could not read the PDF: {error}"})
            return

        self.send_json(200, {"ok": True, **suggestions})

    def handle_manual_receipt_create(self):
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

        created_attachment_path = None
        try:
            created_attachment_path = archive_manual_invoice(entry, pdf_bytes, file_name)
            if created_attachment_path:
                entry["attachment_path"] = created_attachment_path
                entry["attachment_name"] = file_name

            updated_entries = sort_entries([*existing_entries, entry])
            save_manual_receipts(updated_entries)
            commit_hash = rebuild_and_publish(receipt_commit_message("add", entry))
        except Exception as error:
            save_manual_receipts(existing_entries)
            if created_attachment_path:
                attachment_path = BASE_DIR / created_attachment_path
                if attachment_path.exists():
                    attachment_path.unlink()
            self.send_json(500, {"ok": False, "error": str(error)})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "action": "created",
                "message": "הקבלה נוספה והדשבורד נבנה מחדש.",
                "commit": commit_hash,
                "entry": entry,
            },
        )

    def handle_manual_receipt_update(self):
        payload = self.read_json_body()
        receipt_id = payload.get("id") or payload.get("entry", {}).get("id")
        entry_payload = payload.get("entry") or {}
        file_name = payload.get("fileName")
        file_data = payload.get("fileBase64")
        pdf_bytes = decode_data_url(file_data) if file_data else None
        existing_entries = load_manual_receipts()

        current_index = next((index for index, item in enumerate(existing_entries) if item["id"] == receipt_id), None)
        if current_index is None:
            self.send_json(404, {"ok": False, "error": receipt_not_found(str(receipt_id))})
            return

        existing_entry = existing_entries[current_index]

        try:
            updated_entry = build_updated_entry(entry_payload, existing_entry, file_name)
        except Exception as error:
            self.send_json(400, {"ok": False, "error": str(error)})
            return

        all_existing_keys = {receipt_identity(item) for item in existing_entries if item["id"] != receipt_id}
        all_existing_keys.update(load_existing_transaction_keys())
        all_existing_keys.discard(receipt_identity(existing_entry))
        if receipt_identity(updated_entry) in all_existing_keys:
            self.send_json(409, {"ok": False, "error": "כבר קיימת קבלה ידנית אחרת עם אותם פרטים."})
            return

        attachment_path_str = existing_entry.get("attachment_path")
        attachment_path = BASE_DIR / attachment_path_str if attachment_path_str else None
        attachment_existed_before = bool(attachment_path and attachment_path.exists())
        attachment_backup = attachment_path.read_bytes() if attachment_existed_before else None
        created_attachment_path = None

        try:
            if pdf_bytes:
                if attachment_path:
                    write_attachment(attachment_path, pdf_bytes)
                    updated_entry["attachment_path"] = attachment_path_str
                    updated_entry["attachment_name"] = file_name
                    updated_entry["entry_mode"] = "pdf-upload"
                else:
                    created_attachment_path = archive_manual_invoice(updated_entry, pdf_bytes, file_name)
                    updated_entry["attachment_path"] = created_attachment_path
                    updated_entry["attachment_name"] = file_name
                    updated_entry["entry_mode"] = "pdf-upload"

            updated_entries = existing_entries.copy()
            updated_entries[current_index] = updated_entry
            save_manual_receipts(sort_entries(updated_entries))
            commit_hash = rebuild_and_publish(receipt_commit_message("update", updated_entry))
        except Exception as error:
            save_manual_receipts(existing_entries)
            if created_attachment_path:
                new_attachment = BASE_DIR / created_attachment_path
                if new_attachment.exists():
                    new_attachment.unlink()
            if attachment_path:
                if attachment_existed_before and attachment_backup is not None:
                    write_attachment(attachment_path, attachment_backup)
                elif attachment_path.exists():
                    attachment_path.unlink()
            self.send_json(500, {"ok": False, "error": str(error)})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "action": "updated",
                "message": "הקבלה עודכנה והדשבורד נבנה מחדש.",
                "commit": commit_hash,
                "entry": updated_entry,
            },
        )

    def handle_manual_receipt_delete(self):
        payload = self.read_json_body()
        receipt_id = payload.get("id")
        existing_entries = load_manual_receipts()
        current_index = next((index for index, item in enumerate(existing_entries) if item["id"] == receipt_id), None)

        if current_index is None:
            self.send_json(404, {"ok": False, "error": receipt_not_found(str(receipt_id))})
            return

        deleted_entry = existing_entries[current_index]
        attachment_path_str = deleted_entry.get("attachment_path")
        attachment_path = BASE_DIR / attachment_path_str if attachment_path_str else None
        attachment_backup = attachment_path.read_bytes() if attachment_path and attachment_path.exists() else None

        try:
            updated_entries = [item for item in existing_entries if item["id"] != receipt_id]
            save_manual_receipts(sort_entries(updated_entries))
            if attachment_path and attachment_path.exists():
                attachment_path.unlink()
            commit_hash = rebuild_and_publish(receipt_commit_message("delete", deleted_entry))
        except Exception as error:
            save_manual_receipts(existing_entries)
            if attachment_path and attachment_backup is not None:
                write_attachment(attachment_path, attachment_backup)
            self.send_json(500, {"ok": False, "error": str(error)})
            return

        self.send_json(
            200,
            {
                "ok": True,
                "action": "deleted",
                "message": "הקבלה נמחקה והדשבורד נבנה מחדש.",
                "commit": commit_hash,
                "entry": deleted_entry,
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
