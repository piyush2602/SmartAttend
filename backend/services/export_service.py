import io
import pandas as pd
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


def records_to_df(records: list) -> pd.DataFrame:
    rows = []
    for r in records:
        rows.append({
            "Name": r.get("name", ""),
            "Employee ID": r.get("employee_id", ""),
            "Department": r.get("department", ""),
            "Date": r.get("date", ""),
            "Time": r.get("time", ""),
            "Status": r.get("status", ""),
        })
    return pd.DataFrame(rows)


def export_csv(records: list) -> bytes:
    df = records_to_df(records)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode("utf-8")


def export_excel(records: list) -> bytes:
    df = records_to_df(records)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Attendance")
    return buf.getvalue()


def export_pdf(records: list) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), rightMargin=1*cm, leftMargin=1*cm,
                            topMargin=1.5*cm, bottomMargin=1*cm)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("Attendance Report", styles["Title"]))
    elements.append(Spacer(1, 0.5*cm))

    if not records:
        elements.append(Paragraph("No records found.", styles["Normal"]))
        doc.build(elements)
        return buf.getvalue()

    df = records_to_df(records)
    data = [list(df.columns)] + df.values.tolist()

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 10),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("FONTSIZE",   (0, 1), (-1, -1), 9),
        ("PADDING",    (0, 0), (-1, -1), 6),
    ]))
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()
