#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AI Tools Expense Report Builder
Generates professional Excel workbook with monthly and annual expense tracking.
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference
from openpyxl.worksheet.hyperlink import Hyperlink
import datetime, os

OUTPUT_PATH = r"C:\Users\roita\מעקב הוצאות כלים\AI_Tools_Expenses_2025_2026.xlsx"

# ── Color palette ──────────────────────────────────────────────────────────────
C_NAVY     = "1F3864"
C_BLUE     = "2E75B6"
C_LTBLUE   = "D6E4F0"
C_YELLOW   = "FFFF00"
C_WHITE    = "FFFFFF"
C_BLACK    = "000000"
C_DARKGRAY = "595959"
C_GREEN    = "70AD47"
C_ORANGE   = "ED7D31"

def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def font(bold=False, color=C_BLACK, size=11, name="Arial"):
    return Font(bold=bold, color=color, size=size, name=name)

def border_thin():
    s = Side(style="thin", color=C_DARKGRAY)
    return Border(left=s, right=s, top=s, bottom=s)

def border_medium():
    s = Side(style="medium", color=C_NAVY)
    return Border(left=s, right=s, top=s, bottom=s)

def center():
    return Alignment(horizontal="center", vertical="center", wrap_text=True)

def right():
    return Alignment(horizontal="right", vertical="center")

def left_al():
    return Alignment(horizontal="left", vertical="center", wrap_text=True)

# ── All transactions data ────────────────────────────────────────────────────
TRANSACTIONS = [
    # (date, tool, description, usd_amount)
    ("2025-07-04", "Recraft",       "Basic – first month promo",         1.00),
    ("2025-07-09", "Ideogram AI",   "Ideogram Basic – annual",          72.00),
    ("2025-07-10", "Make",          "Core plan 10k ops/month",          10.59),
    ("2025-07-11", "Anthropic",     "Claude Pro",                       20.00),
    ("2025-07-20", "Runway ML",     "Standard (10% affiliate off)",     13.50),
    ("2025-07-30", "Replicate",     "Early card charge",                10.00),
    ("2025-07-30", "Ideogram AI",   "Upgrade -> Plus Annual",          113.14),
    ("2025-08-02", "Runway ML",     "Credits 1,500",                    15.00),
    ("2025-08-04", "Recraft",       "Basic monthly",                    12.00),
    ("2025-08-05", "Replicate",     "Usage - July",                      0.90),
    ("2025-08-09", "Manus AI",      "Basic monthly",                    19.00),
    ("2025-08-10", "Make",          "Core plan 10k ops/month",          10.59),
    ("2025-08-11", "Anthropic",     "Claude Pro",                       20.00),
    ("2025-08-30", "Runway ML",     "Standard (25% off)",               11.25),
    ("2025-08-30", "Eleven Labs",   "Starter monthly",                   5.00),
    ("2025-09-05", "Replicate",     "Usage - August",                    2.79),
    ("2025-09-10", "Make",          "Core plan 10k ops/month",          10.59),
    ("2025-09-24", "Anthropic",     "Claude Pro",                       20.00),
    ("2025-09-30", "Eleven Labs",   "Starter monthly",                   5.00),
    ("2025-10-24", "Anthropic",     "Claude Pro",                       20.00),
    ("2025-10-30", "Eleven Labs",   "Starter monthly",                   5.00),
    ("2025-11-09", "Recraft",       "Pro 1k credits",                   12.00),
    ("2025-11-11", "Astria",        "Credits x10 + 18% VAT",            11.80),
    ("2025-11-11", "Runway ML",     "Standard monthly",                 15.00),
    ("2025-11-13", "Hedra",         "Extra Small Credit Pack",          10.00),
    ("2025-11-24", "Anthropic",     "Claude Pro",                       20.00),
    ("2025-11-30", "Eleven Labs",   "Starter monthly",                   5.00),
    ("2025-12-03", "Manychat",      "Pro monthly",                      15.00),
    ("2025-12-30", "Eleven Labs",   "Starter monthly",                   5.00),
    ("2026-01-03", "Genspark",      "Plus Annual (happynewyear26 promo)", 139.92),
    ("2026-01-03", "Manychat",      "Pro monthly",                      15.00),
    ("2026-01-05", "Genspark",      "Credits Pack",                     20.00),
    ("2026-01-08", "Genspark",      "Credits Pack",                     20.00),
    ("2026-01-30", "Timeless",      "Pro monthly (50% off)",            14.50),
    ("2026-01-30", "Eleven Labs",   "Starter monthly",                   5.00),
    ("2026-02-01", "Lovable",       "Upgrade Pro1 -> Pro2 (prorated)",  25.00),
    ("2026-02-15", "Anthropic",     "Claude Pro",                       20.00),
    ("2026-02-16", "Anthropic",     "Credit purchase",                   5.00),
    ("2026-02-25", "Meta (Ads)",    "Facebook Ads",                     51.00),
    ("2026-02-25", "Lovable",       "Pro2 monthly",                     50.00),
    ("2026-02-28", "Eleven Labs",   "Starter monthly",                   5.00),
    ("2026-03-01", "Timeless",      "Pro monthly (50% off)",            14.50),
    ("2026-03-03", "Meta (Ads)",    "Facebook Ads",                     40.11),
    ("2026-03-12", "Meta (Ads)",    "Facebook Ads",                     51.00),
    ("2026-03-15", "Anthropic",     "Claude Pro",                       20.00),
    ("2026-03-19", "Anthropic",     "Credit purchase",                  10.00),
    ("2026-03-19", "Eleven Labs",   "Creator (first month 50% off)",    11.00),
    ("2026-04-01", "Anthropic",     "Claude Pro",                       20.00),
    ("2026-04-01", "Anthropic",     "Credit purchase",                   5.00),
]

MONTHS = [
    ("2025-07", "\u05d9\u05d5\u05dc\u05d9 2025",    "July 2025"),
    ("2025-08", "\u05d0\u05d5\u05d2\u05d5\u05e1\u05d8 2025",  "August 2025"),
    ("2025-09", "\u05e1\u05e4\u05d8\u05de\u05d1\u05e8 2025",  "September 2025"),
    ("2025-10", "\u05d0\u05d5\u05e7\u05d8\u05d5\u05d1\u05e8 2025", "October 2025"),
    ("2025-11", "\u05e0\u05d5\u05d1\u05de\u05d1\u05e8 2025",  "November 2025"),
    ("2025-12", "\u05d3\u05e6\u05de\u05d1\u05e8 2025",   "December 2025"),
    ("2026-01", "\u05d9\u05e0\u05d5\u05d0\u05e8 2026",   "January 2026"),
    ("2026-02", "\u05e4\u05d1\u05e8\u05d5\u05d0\u05e8 2026",  "February 2026"),
    ("2026-03", "\u05de\u05e8\u05e5 2026",     "March 2026"),
    ("2026-04", "\u05d0\u05e4\u05e8\u05d9\u05dc 2026",   "April 2026"),
]

ALL_TOOLS = sorted(set(t[1] for t in TRANSACTIONS))

# Sheet name for each month (short, safe for Excel tab)
MONTH_SHEET_NAMES = {mk: mname_he for mk, mname_he, _ in MONTHS}


def apply_header(ws, row, col, value, bg=C_NAVY, fg=C_WHITE, bold=True, size=11):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = Font(bold=bold, color=fg, size=size, name="Arial")
    cell.fill = fill(bg)
    cell.alignment = center()
    cell.border = border_thin()
    return cell


def apply_data(ws, row, col, value, bg=C_WHITE, fg=C_BLACK, bold=False,
               num_fmt=None, align=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = Font(bold=bold, color=fg, size=10, name="Arial")
    cell.fill = fill(bg)
    cell.border = border_thin()
    if align:
        cell.alignment = align
    if num_fmt:
        cell.number_format = num_fmt
    return cell


def set_col_width(ws, col, width):
    ws.column_dimensions[get_column_letter(col)].width = width


def internal_link(ws, cell_addr, target_sheet, target_cell="A1", display=None):
    """Add a clickable internal hyperlink to another sheet."""
    cell = ws[cell_addr]
    if display is not None:
        cell.value = display
    cell.hyperlink = f"#{target_sheet}!{target_cell}"
    cell.font = Font(bold=True, color=C_WHITE, size=10, underline="single", name="Arial")


# ════════════════════════════════════════════════════════════════════════════════
# Sheet 1 – Settings
# ════════════════════════════════════════════════════════════════════════════════
def build_settings(wb):
    ws = wb.create_sheet("\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea")
    ws.sheet_view.rightToLeft = True
    ws.sheet_properties.tabColor = C_ORANGE

    ws.merge_cells("A1:E1")
    c = ws["A1"]
    c.value = "  \u05d4\u05d2\u05d3\u05e8\u05d5\u05ea \u05d5\u05e4\u05e8\u05de\u05d8\u05e8\u05d9\u05dd \u2013 AI Tool Expenses"
    c.font = Font(bold=True, color=C_WHITE, size=16, name="Arial")
    c.fill = fill(C_NAVY)
    c.alignment = center()
    ws.row_dimensions[1].height = 35

    ws.merge_cells("A3:B3")
    ws["A3"].value = "\u05e9\u05e2\u05e8 \u05d7\u05dc\u05d9\u05e4\u05d9\u05df"
    ws["A3"].font = Font(bold=True, color=C_WHITE, size=12, name="Arial")
    ws["A3"].fill = fill(C_BLUE)
    ws["A3"].alignment = left_al()

    ws["A4"].value = "\u05e9\u05e2\u05e8 USD \u2192 ILS (\u05dc\u05e2\u05d3\u05db\u05d5\u05df \u05d9\u05d3\u05e0\u05d9)"
    ws["A4"].font = Font(bold=False, size=10, name="Arial")
    ws["A4"].alignment = left_al()

    ws["B4"].value = 3.65
    ws["B4"].font = Font(bold=True, color="0000FF", size=12, name="Arial")
    ws["B4"].fill = fill(C_YELLOW)
    ws["B4"].number_format = '#,##0.00" \u20aa/$"'
    ws["B4"].alignment = center()
    ws["B4"].border = border_medium()
    ws.row_dimensions[4].height = 22

    ws["C4"].value = "\u2190 \u05e0\u05d9\u05ea\u05df \u05dc\u05e2\u05d3\u05db\u05df \u05e9\u05d9\u05e2\u05d5\u05e8 \u05d6\u05d4 \u05d1\u05db\u05dc \u05e2\u05ea"
    ws["C4"].font = Font(italic=True, size=9, color=C_DARKGRAY, name="Arial")

    ws["A6"].value = "\u05d4\u05e2\u05e8\u05d4:"
    ws["A6"].font = Font(bold=True, size=10, name="Arial")
    ws.merge_cells("B6:E8")
    ws["B6"].value = (
        "\u05db\u05dc \u05d4\u05e1\u05db\u05d5\u05de\u05d9\u05dd \u05d1\u05e9\u05e7\u05dc\u05d9\u05dd \u05de\u05d7\u05d5\u05e9\u05d1\u05d9\u05dd \u05e2\u05dc \u05e4\u05d9 \u05d4\u05e9\u05d9\u05e2\u05d5\u05e8 \u05e9\u05de\u05d5\u05d2\u05d3\u05e8 \u05d1\u05ea\u05d0 B4. "
        "\u05e0\u05d9\u05ea\u05df \u05dc\u05e9\u05e0\u05d5\u05ea \u05e9\u05d9\u05e2\u05d5\u05e8 \u05d6\u05d4 \u05dc\u05e4\u05d9 \u05d4\u05e9\u05d9\u05e2\u05d5\u05e8 \u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9 \u05d4\u05e8\u05e6\u05d5\u05d9. "
        "\u05e9\u05d9\u05e2\u05d5\u05e8\u05d9 \u05d4\u05d4\u05de\u05e8\u05d4 \u05d1\u05e4\u05d5\u05e2\u05dc \u05e9\u05e9\u05d5\u05dc\u05de\u05d5 \u05e2\u05e9\u05d5\u05d9\u05d9\u05dd \u05dc\u05d4\u05d9\u05d5\u05ea \u05e9\u05d5\u05e0\u05d9\u05dd \u05de\u05e2\u05d8 \u05d1\u05e9\u05dc \u05e2\u05de\u05dc\u05d5\u05ea \u05d4\u05de\u05e8\u05d4."
    )
    ws["B6"].font = Font(italic=True, size=9, color=C_DARKGRAY, name="Arial")
    ws["B6"].alignment = Alignment(wrap_text=True, vertical="top")

    set_col_width(ws, 1, 35)
    set_col_width(ws, 2, 18)
    set_col_width(ws, 3, 45)

    return ws


# ════════════════════════════════════════════════════════════════════════════════
# Sheet 2 – All Transactions
# ════════════════════════════════════════════════════════════════════════════════
def build_transactions(wb):
    ws = wb.create_sheet("\u05db\u05dc \u05d4\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea")
    ws.sheet_view.rightToLeft = True
    ws.sheet_properties.tabColor = C_BLUE
    ws.freeze_panes = "A3"

    ws.merge_cells("A1:F1")
    c = ws["A1"]
    c.value = "\u05db\u05dc \u05d4\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea \u2013 \u05db\u05dc\u05d9 AI  |  \u05d9\u05d5\u05dc\u05d9 2025 \u2013 \u05d0\u05e4\u05e8\u05d9\u05dc 2026"
    c.font = Font(bold=True, color=C_WHITE, size=14, name="Arial")
    c.fill = fill(C_NAVY)
    c.alignment = center()
    ws.row_dimensions[1].height = 32

    headers = ["\u05ea\u05d0\u05e8\u05d9\u05da", "\u05db\u05dc\u05d9", "\u05ea\u05d9\u05d0\u05d5\u05e8", "\u05e1\u05db\u05d5\u05dd ($)", "\u05e1\u05db\u05d5\u05dd (\u20aa)", "\u05d7\u05d5\u05d3\u05e9"]
    for ci, h in enumerate(headers, 1):
        apply_header(ws, 2, ci, h, bg=C_BLUE)
    ws.row_dimensions[2].height = 22

    txns = sorted(TRANSACTIONS, key=lambda x: x[0])
    rate_ref = "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea!$B$4"

    for ri, (date, tool, desc, usd) in enumerate(txns, 3):
        bg = C_LTBLUE if ri % 2 == 0 else C_WHITE
        month_key = date[:7]
        month_name = next((m[1] for m in MONTHS if m[0] == month_key), month_key)

        apply_data(ws, ri, 1, date, bg=bg, align=center())
        apply_data(ws, ri, 2, tool, bg=bg, align=left_al())
        apply_data(ws, ri, 3, desc, bg=bg, align=left_al())

        usd_cell = ws.cell(row=ri, column=4, value=usd)
        usd_cell.font = Font(size=10, name="Arial", color=C_BLACK)
        usd_cell.fill = fill(bg)
        usd_cell.border = border_thin()
        usd_cell.number_format = '[$$-en-US]#,##0.00'
        usd_cell.alignment = right()

        ils_cell = ws.cell(row=ri, column=5)
        ils_cell.value = f"=D{ri}*{rate_ref}"
        ils_cell.font = Font(size=10, name="Arial", color=C_BLACK)
        ils_cell.fill = fill(bg)
        ils_cell.border = border_thin()
        ils_cell.number_format = '#,##0.00" \u20aa"'
        ils_cell.alignment = right()

        apply_data(ws, ri, 6, month_name, bg=bg, align=center())

    last_row = len(txns) + 2
    total_row = last_row + 1
    ws.merge_cells(f"A{total_row}:C{total_row}")
    tc = ws.cell(row=total_row, column=1, value='\u05e1\u05d4"\u05db"')
    tc.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
    tc.fill = fill(C_NAVY)
    tc.alignment = center()
    tc.border = border_thin()

    for ci in [2, 3]:
        ws.cell(row=total_row, column=ci).fill = fill(C_NAVY)
        ws.cell(row=total_row, column=ci).border = border_thin()

    tot_usd = ws.cell(row=total_row, column=4, value=f"=SUM(D3:D{last_row})")
    tot_usd.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
    tot_usd.fill = fill(C_NAVY)
    tot_usd.border = border_medium()
    tot_usd.number_format = '[$$-en-US]#,##0.00'
    tot_usd.alignment = right()

    tot_ils = ws.cell(row=total_row, column=5, value=f"=SUM(E3:E{last_row})")
    tot_ils.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
    tot_ils.fill = fill(C_NAVY)
    tot_ils.border = border_medium()
    tot_ils.number_format = '#,##0.00" \u20aa"'
    tot_ils.alignment = right()

    ws.cell(row=total_row, column=6).fill = fill(C_NAVY)
    ws.cell(row=total_row, column=6).border = border_thin()

    widths = [14, 18, 40, 14, 14, 16]
    for ci, w in enumerate(widths, 1):
        set_col_width(ws, ci, w)

    return ws


# ════════════════════════════════════════════════════════════════════════════════
# Monthly Individual Sheets – one per month
# ════════════════════════════════════════════════════════════════════════════════
def build_month_sheets(wb):
    """Create one sheet per month with that month's transactions.
    Returns dict: month_key -> sheet_name"""
    rate_ref = "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea!$B$4"
    txns_sheet = "\u05db\u05dc \u05d4\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea"
    summary_sheet = "\u05e1\u05d9\u05db\u05d5\u05dd \u05d7\u05d5\u05d3\u05e9\u05d9"

    created = {}

    for mk, mname_he, mname_en in MONTHS:
        month_txns = sorted(
            [(d, tool, desc, usd) for d, tool, desc, usd in TRANSACTIONS if d[:7] == mk],
            key=lambda x: x[0]
        )

        ws = wb.create_sheet(mname_he)
        ws.sheet_view.rightToLeft = True
        ws.sheet_properties.tabColor = "9DC3E6"
        ws.freeze_panes = "A3"
        created[mk] = mname_he

        # Title row
        ws.merge_cells("A1:F1")
        c = ws["A1"]
        c.value = f"{mname_he}  |  {mname_en}"
        c.font = Font(bold=True, color=C_WHITE, size=14, name="Arial")
        c.fill = fill(C_BLUE)
        c.alignment = center()
        ws.row_dimensions[1].height = 32

        # Back-link row
        back_cell = ws["A2"]
        back_cell.value = f"\u2190 \u05d7\u05d6\u05e8\u05d4 \u05dc\u05e1\u05d9\u05db\u05d5\u05dd \u05d7\u05d5\u05d3\u05e9\u05d9"
        back_cell.hyperlink = f"#'{summary_sheet}'!A1"
        back_cell.font = Font(bold=False, color="0000FF", size=9, underline="single", name="Arial")
        back_cell.fill = fill(C_LTBLUE)
        back_cell.alignment = left_al()
        back_cell.border = border_thin()
        for ci in range(2, 7):
            c = ws.cell(row=2, column=ci)
            c.fill = fill(C_LTBLUE)
            c.border = border_thin()
        ws.row_dimensions[2].height = 16

        # Column headers
        headers = ["\u05ea\u05d0\u05e8\u05d9\u05da", "\u05db\u05dc\u05d9", "\u05ea\u05d9\u05d0\u05d5\u05e8", "\u05e1\u05db\u05d5\u05dd ($)", "\u05e1\u05db\u05d5\u05dd (\u20aa)", ""]
        for ci, h in enumerate(headers, 1):
            apply_header(ws, 3, ci, h, bg=C_NAVY)
        ws.row_dimensions[3].height = 22

        if month_txns:
            for ri, (date, tool, desc, usd) in enumerate(month_txns, 4):
                bg = C_LTBLUE if ri % 2 == 0 else C_WHITE
                apply_data(ws, ri, 1, date, bg=bg, align=center())
                apply_data(ws, ri, 2, tool, bg=bg, align=left_al())
                apply_data(ws, ri, 3, desc, bg=bg, align=left_al())

                c_usd = ws.cell(row=ri, column=4, value=usd)
                c_usd.font = Font(size=10, name="Arial")
                c_usd.fill = fill(bg)
                c_usd.border = border_thin()
                c_usd.number_format = '[$$-en-US]#,##0.00'
                c_usd.alignment = right()

                c_ils = ws.cell(row=ri, column=5)
                c_ils.value = f"=D{ri}*{rate_ref}"
                c_ils.font = Font(size=10, name="Arial")
                c_ils.fill = fill(bg)
                c_ils.border = border_thin()
                c_ils.number_format = '#,##0.00" \u20aa"'
                c_ils.alignment = right()

                ws.cell(row=ri, column=6).fill = fill(bg)
                ws.cell(row=ri, column=6).border = border_thin()

            last_row = len(month_txns) + 3
            total_row = last_row + 1

            # Totals
            ws.merge_cells(f"A{total_row}:C{total_row}")
            tc = ws.cell(row=total_row, column=1, value='\u05e1\u05d4"\u05db \u05d7\u05d5\u05d3\u05e9"')
            tc.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
            tc.fill = fill(C_NAVY)
            tc.alignment = center()
            tc.border = border_medium()
            ws.cell(row=total_row, column=2).fill = fill(C_NAVY)
            ws.cell(row=total_row, column=2).border = border_medium()
            ws.cell(row=total_row, column=3).fill = fill(C_NAVY)
            ws.cell(row=total_row, column=3).border = border_medium()

            t_usd = ws.cell(row=total_row, column=4, value=f"=SUM(D4:D{last_row})")
            t_usd.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
            t_usd.fill = fill(C_NAVY)
            t_usd.border = border_medium()
            t_usd.number_format = '[$$-en-US]#,##0.00'
            t_usd.alignment = right()

            t_ils = ws.cell(row=total_row, column=5, value=f"=SUM(E4:E{last_row})")
            t_ils.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
            t_ils.fill = fill(C_NAVY)
            t_ils.border = border_medium()
            t_ils.number_format = '#,##0.00" \u20aa"'
            t_ils.alignment = right()

            ws.cell(row=total_row, column=6).fill = fill(C_NAVY)
            ws.cell(row=total_row, column=6).border = border_medium()
            ws.row_dimensions[total_row].height = 24
        else:
            # Empty month
            ws.merge_cells("A4:F4")
            c = ws["A4"]
            c.value = "\u05d0\u05d9\u05df \u05d4\u05d5\u05e6\u05d0\u05d5\u05ea \u05d1\u05d7\u05d5\u05d3\u05e9 \u05d6\u05d4"
            c.font = Font(italic=True, size=10, color=C_DARKGRAY, name="Arial")
            c.fill = fill(C_LTBLUE)
            c.alignment = center()
            c.border = border_thin()

        # Column widths
        for ci, w in enumerate([14, 18, 40, 14, 14, 6], 1):
            set_col_width(ws, ci, w)

    return created


# ════════════════════════════════════════════════════════════════════════════════
# Sheet 3 – Monthly Summary Matrix (with SUMIFS + clickable month links)
# ════════════════════════════════════════════════════════════════════════════════
def build_monthly_summary(wb, month_sheet_names):
    ws = wb.create_sheet("\u05e1\u05d9\u05db\u05d5\u05dd \u05d7\u05d5\u05d3\u05e9\u05d9")
    ws.sheet_view.rightToLeft = True
    ws.sheet_properties.tabColor = C_GREEN
    ws.freeze_panes = "B4"

    rate_ref = "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea!$B$4"
    txns_sheet = "\u05db\u05dc \u05d4\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea"

    num_months = len(MONTHS)
    ws.merge_cells(f"A1:{get_column_letter(num_months * 2 + 2)}1")
    c = ws["A1"]
    c.value = "\u05e1\u05d9\u05db\u05d5\u05dd \u05d7\u05d5\u05d3\u05e9\u05d9 \u05dc\u05e4\u05d9 \u05db\u05dc\u05d9  |  \u05d9\u05d5\u05dc\u05d9 2025 \u2013 \u05d0\u05e4\u05e8\u05d9\u05dc 2026"
    c.font = Font(bold=True, color=C_WHITE, size=14, name="Arial")
    c.fill = fill(C_NAVY)
    c.alignment = center()
    ws.row_dimensions[1].height = 32

    # Instruction row
    ws.merge_cells(f"A2:{get_column_letter(num_months * 2 + 2)}2")
    c = ws["A2"]
    c.value = "\u05dc\u05d7\u05e5 \u05e2\u05dc \u05e9\u05dd \u05d7\u05d5\u05d3\u05e9 \u05db\u05d3\u05d9 \u05dc\u05e6\u05e4\u05d9\u05d9\u05d4 \u05d1\u05d2\u05dc\u05d9\u05d5\u05df \u05d4\u05de\u05e4\u05d5\u05e8\u05d8 \u2193"
    c.font = Font(italic=True, size=9, color=C_DARKGRAY, name="Arial")
    c.fill = fill("F2F2F2")
    c.alignment = center()
    c.border = border_thin()
    ws.row_dimensions[2].height = 14

    # Header row: "Tool" then months (clickable)
    apply_header(ws, 3, 1, "\u05db\u05dc\u05d9", bg=C_NAVY)
    col = 2
    month_start_cols = {}
    for mi, (mk, mname_he, mname_en) in enumerate(MONTHS):
        ws.merge_cells(start_row=3, start_column=col, end_row=3, end_column=col + 1)
        cell = ws.cell(row=3, column=col)
        cell.value = f"{mname_he}\n({mname_en})"
        cell.fill = fill(C_BLUE)
        cell.alignment = center()
        cell.border = border_thin()

        # Hyperlink to the individual month sheet (single quotes required for Hebrew sheet names)
        target_sheet = month_sheet_names.get(mk, mname_he)
        cell.hyperlink = f"#'{target_sheet}'!A1"
        cell.font = Font(bold=True, color=C_WHITE, size=9, underline="single", name="Arial")

        month_start_cols[mk] = col
        col += 2

    # Total columns
    total_usd_col = col
    total_ils_col = col + 1
    apply_header(ws, 3, total_usd_col, '\u05e1\u05d4"\u05db ($)', bg=C_NAVY)
    apply_header(ws, 3, total_ils_col, '\u05e1\u05d4"\u05db (\u20aa)', bg=C_NAVY)
    ws.row_dimensions[3].height = 42

    # Sub-header row for USD/ILS
    for mk, sc in month_start_cols.items():
        c1 = ws.cell(row=4, column=sc, value="$")
        c1.font = Font(bold=True, size=9, color=C_WHITE, name="Arial")
        c1.fill = fill(C_BLUE)
        c1.alignment = center()
        c1.border = border_thin()
        c2 = ws.cell(row=4, column=sc + 1, value="\u20aa")
        c2.font = Font(bold=True, size=9, color=C_WHITE, name="Arial")
        c2.fill = fill(C_BLUE)
        c2.alignment = center()
        c2.border = border_thin()

    ws.cell(row=4, column=1).fill = fill(C_NAVY)
    ws.cell(row=4, column=1).border = border_thin()
    for col_label, col_idx in [("$", total_usd_col), ("\u20aa", total_ils_col)]:
        c = ws.cell(row=4, column=col_idx, value=col_label)
        c.font = Font(bold=True, size=9, color=C_WHITE, name="Arial")
        c.fill = fill(C_NAVY)
        c.alignment = center()
        c.border = border_thin()
    ws.row_dimensions[4].height = 18

    # Data rows – SUMIFS pulling from "כל ההוצאות" so adding a row there auto-updates here
    data_start_row = 5
    for ti, tool in enumerate(ALL_TOOLS):
        row = data_start_row + ti
        bg = C_LTBLUE if ti % 2 == 0 else C_WHITE

        tc = ws.cell(row=row, column=1, value=tool)
        tc.font = Font(bold=True, size=10, name="Arial")
        tc.fill = fill(bg)
        tc.alignment = left_al()
        tc.border = border_thin()

        usd_sum_parts = []
        for mk, sc in month_start_cols.items():
            mname_he = MONTH_SHEET_NAMES[mk]
            # SUMIFS: sum col D in transactions sheet where col B = tool AND col F = month name
            sumif_formula = (
                f"=SUMIFS('{txns_sheet}'!$D:$D,"
                f"'{txns_sheet}'!$B:$B,\"{tool}\","
                f"'{txns_sheet}'!$F:$F,\"{mname_he}\")"
            )
            c_usd = ws.cell(row=row, column=sc, value=sumif_formula)
            c_usd.font = Font(size=10, name="Arial")
            c_usd.fill = fill(bg)
            c_usd.number_format = '[$$-en-US]#,##0.00;[$$-en-US](#,##0.00);"-"'
            c_usd.alignment = right()
            c_usd.border = border_thin()
            usd_sum_parts.append(f"{get_column_letter(sc)}{row}")

            c_ils = ws.cell(row=row, column=sc + 1)
            c_ils.value = f"=IF({get_column_letter(sc)}{row}>0,{get_column_letter(sc)}{row}*{rate_ref},\"\")"
            c_ils.font = Font(size=10, name="Arial")
            c_ils.fill = fill(bg)
            c_ils.number_format = '#,##0.00" \u20aa";(#,##0.00" \u20aa");"-"'
            c_ils.alignment = right()
            c_ils.border = border_thin()

        # Row totals
        t_usd = ws.cell(row=row, column=total_usd_col,
                        value=f"=SUM({','.join(usd_sum_parts)})")
        t_usd.font = Font(bold=True, size=10, name="Arial")
        t_usd.fill = fill(C_LTBLUE)
        t_usd.number_format = '[$$-en-US]#,##0.00;[$$-en-US](#,##0.00);"-"'
        t_usd.alignment = right()
        t_usd.border = border_thin()

        t_ils = ws.cell(row=row, column=total_ils_col)
        t_ils.value = f"=IF({get_column_letter(total_usd_col)}{row}>0,{get_column_letter(total_usd_col)}{row}*{rate_ref},\"\")"
        t_ils.font = Font(bold=True, size=10, name="Arial")
        t_ils.fill = fill(C_LTBLUE)
        t_ils.number_format = '#,##0.00" \u20aa";(#,##0.00" \u20aa");"-"'
        t_ils.alignment = right()
        t_ils.border = border_thin()

    # Grand total row
    tot_row = data_start_row + len(ALL_TOOLS)
    tc = ws.cell(row=tot_row, column=1, value='\u05e1\u05d4"\u05db \u05d7\u05d5\u05d3\u05e9\u05d9')
    tc.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
    tc.fill = fill(C_NAVY)
    tc.alignment = center()
    tc.border = border_medium()

    for mk, sc in month_start_cols.items():
        t_usd = ws.cell(row=tot_row, column=sc,
            value=f"=SUM({get_column_letter(sc)}{data_start_row}:{get_column_letter(sc)}{tot_row-1})")
        t_usd.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
        t_usd.fill = fill(C_NAVY)
        t_usd.number_format = '[$$-en-US]#,##0.00'
        t_usd.alignment = right()
        t_usd.border = border_medium()

        t_ils = ws.cell(row=tot_row, column=sc + 1,
            value=f"=SUM({get_column_letter(sc+1)}{data_start_row}:{get_column_letter(sc+1)}{tot_row-1})")
        t_ils.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
        t_ils.fill = fill(C_NAVY)
        t_ils.number_format = '#,##0.00" \u20aa"'
        t_ils.alignment = right()
        t_ils.border = border_medium()

    gt_usd = ws.cell(row=tot_row, column=total_usd_col,
        value=f"=SUM({get_column_letter(total_usd_col)}{data_start_row}:{get_column_letter(total_usd_col)}{tot_row-1})")
    gt_usd.font = Font(bold=True, color=C_WHITE, size=12, name="Arial")
    gt_usd.fill = fill(C_NAVY)
    gt_usd.number_format = '[$$-en-US]#,##0.00'
    gt_usd.alignment = right()
    gt_usd.border = border_medium()

    gt_ils = ws.cell(row=tot_row, column=total_ils_col,
        value=f"=SUM({get_column_letter(total_ils_col)}{data_start_row}:{get_column_letter(total_ils_col)}{tot_row-1})")
    gt_ils.font = Font(bold=True, color=C_WHITE, size=12, name="Arial")
    gt_ils.fill = fill(C_NAVY)
    gt_ils.number_format = '#,##0.00" \u20aa"'
    gt_ils.alignment = right()
    gt_ils.border = border_medium()

    ws.row_dimensions[tot_row].height = 24

    # Column widths
    set_col_width(ws, 1, 20)
    for mk, sc in month_start_cols.items():
        set_col_width(ws, sc, 11)
        set_col_width(ws, sc + 1, 13)
    set_col_width(ws, total_usd_col, 12)
    set_col_width(ws, total_ils_col, 14)

    return ws


# ════════════════════════════════════════════════════════════════════════════════
# Sheet 4 – Annual Report
# ════════════════════════════════════════════════════════════════════════════════
def build_annual_report(wb, month_sheet_names):
    ws = wb.create_sheet("\u05d3\u05d5\u05d7 \u05e9\u05e0\u05ea\u05d9")
    ws.sheet_view.rightToLeft = True
    ws.sheet_properties.tabColor = "ED7D31"

    rate_ref = "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea!$B$4"
    txns_sheet = "\u05db\u05dc \u05d4\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea"

    ws.merge_cells("A1:F1")
    c = ws["A1"]
    c.value = "\u05d3\u05d5\u05d7 \u05e9\u05e0\u05ea\u05d9 \u2013 AI Tool Expenses"
    c.font = Font(bold=True, color=C_WHITE, size=16, name="Arial")
    c.fill = fill(C_NAVY)
    c.alignment = center()
    ws.row_dimensions[1].height = 35

    ws.merge_cells("A2:F2")
    c = ws["A2"]
    c.value = "\u05e1\u05d9\u05db\u05d5\u05dd \u05d4\u05d5\u05e6\u05d0\u05d5\u05ea \u05dc\u05e4\u05d9 \u05d7\u05d5\u05d3\u05e9 \u2013 \u05d9\u05d5\u05dc\u05d9 2025 \u05e2\u05d3 \u05d0\u05e4\u05e8\u05d9\u05dc 2026"
    c.font = Font(bold=False, color=C_WHITE, size=11, italic=True, name="Arial")
    c.fill = fill(C_BLUE)
    c.alignment = center()
    ws.row_dimensions[2].height = 20

    hdrs = ["\u05d7\u05d5\u05d3\u05e9", "\u05ea\u05d0\u05e8\u05d9\u05da", '\u05d4\u05d5\u05e6\u05d0\u05d4 ($)', '\u05d4\u05d5\u05e6\u05d0\u05d4 (\u20aa)', '% \u05de\u05e1\u05d4"\u05db', "\u05d4\u05e2\u05e8\u05d5\u05ea"]
    for ci, h in enumerate(hdrs, 1):
        apply_header(ws, 3, ci, h, bg=C_NAVY)
    ws.row_dimensions[3].height = 22

    row = 4
    for mi, (mk, mname_he, mname_en) in enumerate(MONTHS):
        bg = C_LTBLUE if mi % 2 == 0 else C_WHITE

        # Month name cell: clickable link to individual month sheet
        month_cell = ws.cell(row=row, column=1, value=mname_he)
        month_cell.font = Font(bold=True, color="0000FF", size=10, underline="single", name="Arial")
        month_cell.fill = fill(bg)
        month_cell.border = border_thin()
        month_cell.alignment = left_al()
        target_sheet = month_sheet_names.get(mk, mname_he)
        month_cell.hyperlink = f"#'{target_sheet}'!A1"

        apply_data(ws, row, 2, mname_en, bg=bg, align=left_al())

        # SUMIFS formula: sum all transactions for this month from transactions sheet
        sumif_formula = (
            f"=SUMIF('{txns_sheet}'!$F:$F,\"{mname_he}\",'{txns_sheet}'!$D:$D)"
        )
        c_usd = ws.cell(row=row, column=3, value=sumif_formula)
        c_usd.font = Font(bold=True, size=11, name="Arial")
        c_usd.fill = fill(bg)
        c_usd.border = border_thin()
        c_usd.number_format = '[$$-en-US]#,##0.00'
        c_usd.alignment = right()

        c_ils = ws.cell(row=row, column=4)
        c_ils.value = f"=C{row}*{rate_ref}"
        c_ils.font = Font(bold=True, size=11, name="Arial")
        c_ils.fill = fill(bg)
        c_ils.border = border_thin()
        c_ils.number_format = '#,##0.00" \u20aa"'
        c_ils.alignment = right()

        total_row_ref = 4 + len(MONTHS) + 1
        c_pct = ws.cell(row=row, column=5)
        c_pct.value = f"=IF(C{total_row_ref}>0,C{row}/C{total_row_ref},0)"
        c_pct.font = Font(size=10, name="Arial")
        c_pct.fill = fill(bg)
        c_pct.border = border_thin()
        c_pct.number_format = '0.0%'
        c_pct.alignment = center()

        ws.cell(row=row, column=6).fill = fill(bg)
        ws.cell(row=row, column=6).border = border_thin()

        ws.row_dimensions[row].height = 20
        row += 1

    # Separator
    for ci in range(1, 7):
        ws.cell(row=row, column=ci).fill = fill(C_LTBLUE)
        ws.cell(row=row, column=ci).border = border_thin()
    row += 1

    # Grand Total
    ws.merge_cells(f"A{row}:B{row}")
    tc = ws.cell(row=row, column=1, value='\u05e1\u05d4"\u05db \u05e9\u05e0\u05ea\u05d9')
    tc.font = Font(bold=True, color=C_WHITE, size=13, name="Arial")
    tc.fill = fill(C_NAVY)
    tc.alignment = center()
    tc.border = border_medium()
    ws.cell(row=row, column=2).fill = fill(C_NAVY)
    ws.cell(row=row, column=2).border = border_medium()

    gt_usd = ws.cell(row=row, column=3, value=f"=SUM(C4:C{row-2})")
    gt_usd.font = Font(bold=True, color=C_WHITE, size=13, name="Arial")
    gt_usd.fill = fill(C_NAVY)
    gt_usd.border = border_medium()
    gt_usd.number_format = '[$$-en-US]#,##0.00'
    gt_usd.alignment = right()

    gt_ils = ws.cell(row=row, column=4, value=f"=C{row}*{rate_ref}")
    gt_ils.font = Font(bold=True, color=C_WHITE, size=13, name="Arial")
    gt_ils.fill = fill(C_NAVY)
    gt_ils.border = border_medium()
    gt_ils.number_format = '#,##0.00" \u20aa"'
    gt_ils.alignment = right()

    gt_pct = ws.cell(row=row, column=5, value="100%")
    gt_pct.font = Font(bold=True, color=C_WHITE, size=11, name="Arial")
    gt_pct.fill = fill(C_NAVY)
    gt_pct.border = border_medium()
    gt_pct.number_format = '0.0%'
    gt_pct.alignment = center()

    ws.cell(row=row, column=6).fill = fill(C_NAVY)
    ws.cell(row=row, column=6).border = border_medium()
    ws.row_dimensions[row].height = 28

    avg_row = row + 1
    ws.merge_cells(f"A{avg_row}:B{avg_row}")
    ws.cell(row=avg_row, column=1).value = "\u05de\u05de\u05d5\u05e6\u05e2 \u05d7\u05d5\u05d3\u05e9\u05d9"
    ws.cell(row=avg_row, column=1).font = Font(bold=True, size=10, color=C_DARKGRAY, name="Arial")
    ws.cell(row=avg_row, column=1).fill = fill(C_LTBLUE)
    ws.cell(row=avg_row, column=1).alignment = center()
    ws.cell(row=avg_row, column=1).border = border_thin()
    ws.cell(row=avg_row, column=2).fill = fill(C_LTBLUE)
    ws.cell(row=avg_row, column=2).border = border_thin()

    avg_usd = ws.cell(row=avg_row, column=3, value=f"=AVERAGE(C4:C{row-2})")
    avg_usd.font = Font(bold=True, size=10, color=C_DARKGRAY, name="Arial")
    avg_usd.fill = fill(C_LTBLUE)
    avg_usd.border = border_thin()
    avg_usd.number_format = '[$$-en-US]#,##0.00'
    avg_usd.alignment = right()

    avg_ils = ws.cell(row=avg_row, column=4, value=f"=AVERAGE(D4:D{row-2})")
    avg_ils.font = Font(bold=True, size=10, color=C_DARKGRAY, name="Arial")
    avg_ils.fill = fill(C_LTBLUE)
    avg_ils.border = border_thin()
    avg_ils.number_format = '#,##0.00" \u20aa"'
    avg_ils.alignment = right()

    for ci in [5, 6]:
        ws.cell(row=avg_row, column=ci).fill = fill(C_LTBLUE)
        ws.cell(row=avg_row, column=ci).border = border_thin()

    # Bar chart
    chart = BarChart()
    chart.type = "col"
    chart.title = "Monthly AI Tool Expenses (USD)"
    chart.y_axis.title = "USD ($)"
    chart.x_axis.title = "Month"
    chart.style = 10
    chart.width = 20
    chart.height = 12

    data_ref = Reference(ws, min_col=3, min_row=3, max_row=row - 2)
    cats = Reference(ws, min_col=1, min_row=4, max_row=row - 2)
    chart.add_data(data_ref, titles_from_data=True)
    chart.set_categories(cats)
    chart.shape = 4
    ws.add_chart(chart, f"A{avg_row + 2}")

    set_col_width(ws, 1, 20)
    set_col_width(ws, 2, 18)
    set_col_width(ws, 3, 14)
    set_col_width(ws, 4, 14)
    set_col_width(ws, 5, 12)
    set_col_width(ws, 6, 22)

    return ws


# ════════════════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════════════════
def main():
    wb = openpyxl.Workbook()
    del wb[wb.sheetnames[0]]

    build_settings(wb)
    build_transactions(wb)
    month_sheet_names = build_month_sheets(wb)
    build_monthly_summary(wb, month_sheet_names)
    build_annual_report(wb, month_sheet_names)

    for i, sheet in enumerate(wb.worksheets):
        if sheet.title == "\u05d3\u05d5\u05d7 \u05e9\u05e0\u05ea\u05d9":
            wb.active = i

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    wb.save(OUTPUT_PATH)
    print(f"Saved: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
