"""
ReportLab PDF generation for SACS and TCC reports.
Layout is fixed — nothing moves. (Rebecca, 13:57)
"""
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# ── Brand colours ─────────────────────────────────────────────────────────────
NAVY = colors.HexColor("#0f2044")
NAVY_MID = colors.HexColor("#1a3260")
GOLD = colors.HexColor("#c9a84c")
GREEN = colors.HexColor("#2d7a4f")
GREEN_LIGHT = colors.HexColor("#e8f5ee")
RED = colors.HexColor("#c0392b")
RED_LIGHT = colors.HexColor("#fdf0ee")
CREAM = colors.HexColor("#f8f5ef")
GRAY_100 = colors.HexColor("#f4f4f5")
GRAY_200 = colors.HexColor("#e4e4e7")
GRAY_600 = colors.HexColor("#52525b")
GRAY_800 = colors.HexColor("#27272a")
WHITE = colors.white

PAGE_W, PAGE_H = letter  # 612 x 792 pt
MARGIN = 40


def _fmt(amount: float) -> str:
    return f"${amount:,.0f}"


def _draw_header(c: canvas, client, session, subtitle: str):
    """Shared header bar for both report types."""
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 60, PAGE_W, 60, fill=1, stroke=0)

    # Left: Windbrook Solutions
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(MARGIN, PAGE_H - 38, "Windbrook Solutions")

    # Right: client name + quarter
    display_name = _client_display_name(client)
    right_text = f"{display_name}  |  {session.quarter}"
    c.setFont("Helvetica", 11)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 38, right_text)

    # Subtitle bar
    c.setFillColor(NAVY_MID)
    c.rect(0, PAGE_H - 90, PAGE_W, 30, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 78, subtitle)


def _draw_footer(c: canvas, session):
    c.setFillColor(GRAY_600)
    c.setFont("Helvetica", 8)
    date_str = str(session.report_date)
    c.drawCentredString(PAGE_W / 2, 25, f"Windbrook Solutions  ·  Confidential  ·  {date_str}")


def _client_display_name(client) -> str:
    if client.c2_first:
        return f"{client.c1_first} & {client.c2_first} {client.c1_last}"
    return f"{client.c1_first} {client.c1_last}"


# ── SACS PDF ──────────────────────────────────────────────────────────────────

def generate_sacs_pdf(client, session, balance_entries, calculations: dict) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    _draw_header(c, client, session, "Simple Automated Cash Flow System (SACS)")
    _draw_footer(c, session)

    # ── Cashflow diagram — three circles connected by arrows ─────────────────
    cx = PAGE_W / 2
    r = 52
    top_y = PAGE_H - 160      # INFLOW circle centre
    mid_y = top_y - 150       # OUTFLOW circle centre
    bot_y = mid_y - 150       # PRIVATE RESERVE circle centre

    inflow = calculations["monthly_inflow"]
    outflow = calculations["monthly_outflow"]
    excess = calculations["monthly_excess"]
    reserve_bal = calculations["private_reserve_balance"]
    reserve_target = calculations["private_reserve_target"]

    # INFLOW circle (green)
    _draw_circle_node(c, cx, top_y, r, GREEN, "INFLOW", _fmt(inflow), "monthly take-home", WHITE)

    # Arrow down: excess label
    _draw_arrow(c, cx, top_y - r, mid_y + r,
                f"Monthly Excess: {_fmt(excess)}", excess >= 0)

    # OUTFLOW circle (red)
    _draw_circle_node(c, cx, mid_y, r, RED, "OUTFLOW", _fmt(outflow), "expense budget", WHITE)

    # Arrow down (no special label)
    _draw_arrow(c, cx, mid_y - r, bot_y + r, "", True)

    # PRIVATE RESERVE circle (navy)
    target_label = f"target: {_fmt(reserve_target)}"
    _draw_circle_node(c, cx, bot_y, r, NAVY, "PRIVATE RESERVE", _fmt(reserve_bal), target_label, WHITE)

    # ── Summary box ──────────────────────────────────────────────────────────
    box_top = bot_y - r - 30
    box_h = 72
    box_x = MARGIN + 60
    box_w = PAGE_W - 2 * (MARGIN + 60)

    c.setFillColor(GRAY_100)
    c.roundRect(box_x, box_top - box_h, box_w, box_h, 8, fill=1, stroke=0)

    c.setFillColor(GRAY_800)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(box_x + 16, box_top - 22, "Schwab Investment Account")
    c.setFont("Helvetica", 10)
    schwab = calculations.get("schwab_balance", 0.0)
    c.drawRightString(box_x + box_w - 16, box_top - 22, _fmt(schwab))

    # Divider
    c.setStrokeColor(GRAY_200)
    c.line(box_x + 16, box_top - 36, box_x + box_w - 16, box_top - 36)

    # Reserve status
    diff = reserve_bal - reserve_target
    if diff >= 0:
        status = f"Funded  (+{_fmt(diff)})"
        c.setFillColor(GREEN)
    else:
        status = f"Shortfall  ({_fmt(diff)})"
        c.setFillColor(RED)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(box_x + 16, box_top - 54, "Private Reserve vs Target")
    c.setFont("Helvetica", 10)
    c.drawRightString(box_x + box_w - 16, box_top - 54, status)

    c.save()
    return buf.getvalue()


def _draw_circle_node(c: canvas, cx: float, cy: float, r: float,
                      fill_color, label: str, amount: str, sublabel: str, text_color):
    c.setFillColor(fill_color)
    c.circle(cx, cy, r, fill=1, stroke=0)

    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(cx, cy + 14, label)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(cx, cy, amount)
    c.setFont("Helvetica", 8)
    c.drawCentredString(cx, cy - 14, sublabel)


def _draw_arrow(c: canvas, cx: float, y_from: float, y_to: float, label: str, positive: bool):
    mid_y = (y_from + y_to) / 2
    c.setStrokeColor(GRAY_600)
    c.setLineWidth(1.5)
    c.line(cx, y_from - 4, cx, y_to + 4)
    # arrowhead — use path API (Canvas.polygon does not exist in ReportLab 4.x)
    c.setFillColor(GRAY_600)
    p = c.beginPath()
    p.moveTo(cx - 6, y_to + 10)
    p.lineTo(cx + 6, y_to + 10)
    p.lineTo(cx, y_to)
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    if label:
        c.setFillColor(NAVY if positive else RED)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(cx + 14, mid_y - 4, label)


# ── TCC PDF ───────────────────────────────────────────────────────────────────

def generate_tcc_pdf(client, session, balance_entries, calculations: dict) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    _draw_header(c, client, session, "Total Client Chart — Net Worth Overview")
    _draw_footer(c, session)

    y = PAGE_H - 110  # cursor from top of content area

    # ── Client info bubbles ───────────────────────────────────────────────────
    y = _draw_client_info(c, client, y)
    y -= 14

    # ── Retirement accounts — two columns ─────────────────────────────────────
    c1_entries = [(e.account_id, e.balance) for e in balance_entries
                  if e.account_id and _acct_owner(e.account_id, client) == "c1"
                  and _acct_category(e.account_id, client) == "retirement"]
    c2_entries = [(e.account_id, e.balance) for e in balance_entries
                  if e.account_id and _acct_owner(e.account_id, client) == "c2"
                  and _acct_category(e.account_id, client) == "retirement"]

    col_w = (PAGE_W - 2 * MARGIN - 12) / 2
    c1_label = f"{client.c1_first} {client.c1_last}"
    c2_label = f"{client.c2_first} {client.c2_last}" if client.c2_first else ""

    left_x = MARGIN
    right_x = MARGIN + col_w + 12

    y_left = _draw_retirement_column(c, left_x, col_w, y, c1_label, c1_entries,
                                     client, calculations["c1_retirement_total"])
    y_right = _draw_retirement_column(c, right_x, col_w, y, c2_label, c2_entries,
                                      client, calculations["c2_retirement_total"]) if c2_label else y

    y = min(y_left, y_right) - 18

    # ── Non-retirement accounts ───────────────────────────────────────────────
    non_ret_entries = [(e.account_id, e.balance) for e in balance_entries
                       if e.account_id and _acct_category(e.account_id, client) == "non_retirement"]
    y = _draw_section_row(c, MARGIN, PAGE_W - 2 * MARGIN, y,
                          "Non-Retirement Accounts", non_ret_entries, client,
                          calculations["non_retirement_total"], NAVY_MID)
    y -= 18

    # ── Trust / Property ──────────────────────────────────────────────────────
    trust_balance = calculations.get("trust_value", 0.0)
    trust_acct = _find_trust_account(client)
    trust_label = f"Property — {trust_acct}" if trust_acct else "Property / Trust"
    y = _draw_trust_row(c, MARGIN, PAGE_W - 2 * MARGIN, y, trust_label, trust_balance)
    y -= 18

    # ── Grand Total bar ───────────────────────────────────────────────────────
    bar_h = 38
    c.setFillColor(NAVY)
    c.roundRect(MARGIN, y - bar_h, PAGE_W - 2 * MARGIN, bar_h, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN + 16, y - bar_h + 13, "Grand Total Net Worth")
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(PAGE_W - MARGIN - 16, y - bar_h + 12, _fmt(calculations["grand_total_net_worth"]))
    y -= bar_h + 20

    # ── Liabilities — Rebecca's rule (26:15): shown separately, never subtracted ──
    y = _draw_liabilities_section(c, MARGIN, PAGE_W - 2 * MARGIN, y,
                                  balance_entries, client, calculations["liabilities_total"])

    c.save()
    return buf.getvalue()


def _draw_client_info(c: canvas, client, y: float) -> float:
    row_h = 32
    bubble_w = 200
    gap = 16
    start_x = MARGIN

    def _bubble(x, name, dob, ssn):
        c.setFillColor(GREEN)
        c.roundRect(x, y - row_h, bubble_w, row_h, 8, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 10, y - 14, name)
        c.setFont("Helvetica", 8)
        c.drawString(x + 10, y - 25, f"DOB: {dob}  |  SSN: ***{ssn}")

    _bubble(start_x, f"{client.c1_first} {client.c1_last}", client.c1_dob, client.c1_ssn_last4)
    if client.c2_first:
        _bubble(start_x + bubble_w + gap, f"{client.c2_first} {client.c2_last}",
                client.c2_dob, client.c2_ssn_last4)

    return y - row_h


def _draw_retirement_column(c: canvas, x: float, w: float, y: float,
                             label: str, entries: list, client, total: float) -> float:
    if not label:
        return y

    row_h = 28
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y - 14, label)
    y -= 20

    for acct_id, balance in entries:
        acct = _get_account(acct_id, client)
        acct_label = _acct_label(acct) if acct else str(acct_id)
        c.setFillColor(NAVY)
        c.roundRect(x, y - row_h, w, row_h, 6, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica", 9)
        c.drawString(x + 10, y - 18, acct_label)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(x + w - 10, y - 18, _fmt(balance))
        y -= row_h + 4

    # Total box
    c.setFillColor(GRAY_100)
    c.roundRect(x, y - row_h, w, row_h, 6, fill=1, stroke=0)
    c.setFillColor(GRAY_800)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 10, y - 18, "Total")
    c.drawRightString(x + w - 10, y - 18, _fmt(total))
    y -= row_h + 4

    return y


def _draw_section_row(c: canvas, x: float, w: float, y: float,
                      section_label: str, entries: list, client,
                      total: float, color) -> float:
    row_h = 28
    c.setFillColor(GRAY_800)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x, y - 14, section_label)
    y -= 20

    for acct_id, balance in entries:
        acct = _get_account(acct_id, client)
        acct_label = _acct_label(acct) if acct else str(acct_id)
        c.setFillColor(color)
        c.roundRect(x, y - row_h, w, row_h, 6, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica", 9)
        c.drawString(x + 10, y - 18, acct_label)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(x + w - 10, y - 18, _fmt(balance))
        y -= row_h + 4

    # Total box
    c.setFillColor(GRAY_100)
    c.roundRect(x, y - row_h, w, row_h, 6, fill=1, stroke=0)
    c.setFillColor(GRAY_800)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 10, y - 18, "Total")
    c.drawRightString(x + w - 10, y - 18, _fmt(total))
    y -= row_h + 4

    return y


def _draw_trust_row(c: canvas, x: float, w: float, y: float, label: str, balance: float) -> float:
    row_h = 28
    c.setFillColor(NAVY_MID)
    c.roundRect(x, y - row_h, w, row_h, 6, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 10, y - 18, label)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(x + w - 10, y - 18, _fmt(balance))
    return y - row_h


def _draw_liabilities_section(c: canvas, x: float, w: float, y: float,
                               balance_entries, client, total: float) -> float:
    """
    Liabilities shown separately — NEVER subtracted from net worth. (Rebecca, 26:15)
    Label reads explicitly: 'Liabilities (Shown Separately — Not Subtracted from Net Worth)'
    """
    row_h = 28
    header_h = 34
    liability_entries = [(e.liability_id, e.balance) for e in balance_entries if e.liability_id]

    section_h = header_h + len(liability_entries) * (row_h + 4) + row_h + 8
    # Red-tinted background box
    c.setFillColor(RED_LIGHT)
    c.roundRect(x, y - section_h, w, section_h, 8, fill=1, stroke=0)
    c.setStrokeColor(RED)
    c.setLineWidth(1)
    c.roundRect(x, y - section_h, w, section_h, 8, fill=0, stroke=1)

    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 12, y - 22, "Liabilities (Shown Separately — Not Subtracted from Net Worth)")
    y -= header_h

    liab_map = {l.id: l for l in client.liabilities}

    for liab_id, balance in liability_entries:
        liab = liab_map.get(liab_id)
        if liab:
            label = f"{liab.liability_type}  @  {liab.interest_rate}"
        else:
            label = f"Liability #{liab_id}"

        c.setFillColor(colors.HexColor("#f8e0de"))
        c.roundRect(x + 8, y - row_h, w - 16, row_h, 4, fill=1, stroke=0)
        c.setFillColor(GRAY_800)
        c.setFont("Helvetica", 9)
        c.drawString(x + 18, y - 18, label)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(x + w - 18, y - 18, _fmt(balance))
        y -= row_h + 4

    # Total
    c.setFillColor(colors.HexColor("#f8e0de"))
    c.roundRect(x + 8, y - row_h, w - 16, row_h, 4, fill=1, stroke=0)
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 18, y - 18, "Total Liabilities")
    c.drawRightString(x + w - 18, y - 18, _fmt(total))
    y -= row_h + 4

    return y


# ── Account helpers ───────────────────────────────────────────────────────────

def _get_account(acct_id: int, client):
    return next((a for a in client.accounts if a.id == acct_id), None)


def _acct_owner(acct_id: int, client) -> str:
    acct = _get_account(acct_id, client)
    return acct.owner if acct else ""


def _acct_category(acct_id: int, client) -> str:
    acct = _get_account(acct_id, client)
    return acct.account_category if acct else ""


def _acct_label(acct) -> str:
    type_labels = {
        "ira": "IRA",
        "roth_ira": "Roth IRA",
        "401k": "401(k)",
        "pension": "Pension",
        "brokerage": "Joint Brokerage",
        "individual_brokerage": "Individual Brokerage",
        "trust": "Trust",
        "checking": "Checking",
        "savings": "Savings",
    }
    label = type_labels.get(acct.account_type, acct.account_type.replace("_", " ").title())
    if acct.account_number_last4:
        label += f"  ···{acct.account_number_last4}"
    return label


def _find_trust_account(client) -> str:
    """Returns trust account description string if available."""
    trust_accts = [a for a in client.accounts if a.account_category == "trust"]
    if trust_accts:
        a = trust_accts[0]
        if a.account_number_last4:
            return a.account_number_last4
    return ""
