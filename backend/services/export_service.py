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


def export_individual_pdf(user: dict, records: list, dates: list, start_date: str, end_date: str, working_days: str = None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    elements.append(Paragraph(f"Attendance Report: {user.get('name', 'N/A')}", styles["Title"]))
    elements.append(Spacer(1, 0.5*cm))

    # User Details
    details_data = [
        [Paragraph(f"<b>Employee ID:</b> {user.get('employee_id', 'N/A')}", styles["Normal"]),
         Paragraph(f"<b>Department:</b> {user.get('department', 'N/A')}", styles["Normal"])],
        [Paragraph(f"<b>Period:</b> {start_date} to {end_date}", styles["Normal"]),
         Paragraph(f"<b>Total Days Present:</b> {user.get('present_count', 0)}", styles["Normal"])]
    ]
    if working_days:
        details_data.append([
            Paragraph(f"<b>Total Working Days:</b> {working_days}", styles["Normal"]),
            Paragraph("", styles["Normal"])
        ])
    details_table = Table(details_data, colWidths=[9*cm, 9*cm])
    details_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 1*cm))

    # Attendance Table
    # Create a map of date -> record
    att_map = {r.get("date"): r for r in records}
    
    table_data = [["Date", "Time", "Status"]]
    # Sort dates descending
    sorted_dates = sorted(dates, reverse=True)
    
    for d in sorted_dates:
        record = att_map.get(d)
        if record:
            table_data.append([d, record.get("time", ""), "Present"])
        else:
            table_data.append([d, "-", "Absent"])

    table = Table(table_data, colWidths=[6*cm, 6*cm, 6*cm])
    
    # Custom styles to mark 'Absent' in red
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING",    (0, 0), (-1, -1), 8),
    ]
    
    for i in range(1, len(table_data)):
        status = table_data[i][2]
        if status == "Absent":
            ts.append(("TEXTCOLOR", (2, i), (2, i), colors.red))
            ts.append(("FONTNAME", (2, i), (2, i), "Helvetica-Bold"))
        else:
            ts.append(("TEXTCOLOR", (2, i), (2, i), colors.HexColor("#16a34a")))

    table.setStyle(TableStyle(ts))
    elements.append(table)

    doc.build(elements)
    return buf.getvalue()


def export_individual_excel(user: dict, records: list, dates: list, start_date: str, end_date: str, working_days: str = None) -> bytes:
    att_map = {r.get("date"): r for r in records}
    rows = []
    for d in sorted(dates, reverse=True):
        record = att_map.get(d)
        rows.append({
            "Date": d,
            "Time": record.get("time", "-") if record else "-",
            "Status": "Present" if record else "Absent"
        })
    
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        # Write summary at top
        header_rows = [
            ["Employee Name:", user.get("name", "N/A")],
            ["Employee ID:", user.get("employee_id", "N/A")],
            ["Department:", user.get("department", "N/A")],
            ["Period:", f"{start_date} to {end_date}"],
            ["Total Days Present:", user.get("present_count", 0)]
        ]
        if working_days:
            header_rows.append(["Total Working Days:", working_days])
        
        header_rows.append(["", ""]) # spacer
        
        summary = pd.DataFrame(header_rows)
        summary.to_excel(writer, index=False, header=False, sheet_name="Attendance", startrow=0)
        
        # Write the attendance data table
        df.to_excel(writer, index=False, sheet_name="Attendance", startrow=len(summary))
        
        # Adjust column widths
        worksheet = writer.sheets["Attendance"]
        worksheet.column_dimensions['A'].width = 15
        worksheet.column_dimensions['B'].width = 20
        worksheet.column_dimensions['C'].width = 15
            
    return buf.getvalue()


def export_department_pdf(department: str, summary_data: list, dates: list, start_date: str, end_date: str, working_days: str = None) -> bytes:
    """
    summary_data: list of dicts like {"name": "...", "employee_id": "...", "attendance": {"2024-01-01": "P", ...}, "total_present": 5}
    """
    buf = io.BytesIO()
    # Always use landscape for department grid to maximize space
    page_size = landscape(A4)
    doc = SimpleDocTemplate(buf, pagesize=page_size, rightMargin=0.5*cm, leftMargin=0.5*cm,
                            topMargin=1*cm, bottomMargin=1*cm)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    elements.append(Paragraph(f"Departmental Attendance Grid: {department}", styles["Title"]))
    elements.append(Spacer(1, 0.4*cm))

    # Info
    info_text = f"<b>Period:</b> {start_date} to {end_date} | <b>Total Employees:</b> {len(summary_data)}"
    if working_days:
        info_text += f" | <b>Total Working Days:</b> {working_days}"
    
    elements.append(Paragraph(info_text, styles["Normal"]))
    elements.append(Spacer(1, 0.6*cm))

    if not summary_data:
        elements.append(Paragraph("No users found in this department.", styles["Normal"]))
    else:
        # Prepare table header: ID, Name, [Dates...], Total
        # Format dates as MM/DD. If too many dates, we'll use vertical text simulation or very small font.
        short_dates = [d.split("-")[1] + "/" + d.split("-")[2] for d in dates]
        header = ["ID", "Name"] + short_dates + ["Total"]
        
        table_data = [header]
        for row in summary_data:
            att_values = [row["attendance"].get(d, "A") for d in dates]
            line = [row.get("employee_id", ""), row.get("name", "")] + att_values + [str(row.get("total_present", 0))]
            table_data.append(line)

        # Dynamic column widths
        page_width = landscape(A4)[0] - 1*cm # margins
        id_w = 1.5*cm
        name_w = 3.0*cm
        total_w = 1.2*cm
        remaining = page_width - (id_w + name_w + total_w)
        date_w = remaining / len(dates) if dates else 1*cm
        
        col_widths = [id_w, name_w] + [date_w] * len(dates) + [total_w]

        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        # Base styles
        header_font_size = 7 if len(dates) > 15 else 9
        cell_font_size = 6 if len(dates) > 20 else 8
        
        ts = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, 0), header_font_size),
            ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID",       (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
            ("FONTSIZE",   (0, 1), (-1, -1), cell_font_size),
            ("LEFTPADDING", (0, 0), (-1, -1), 1),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1),
        ]
        
        # Color codes for P and A
        for row_idx in range(1, len(table_data)):
            for col_idx in range(2, 2 + len(dates)):
                val = table_data[row_idx][col_idx]
                if val == "P":
                    ts.append(("TEXTCOLOR", (col_idx, row_idx), (col_idx, row_idx), colors.HexColor("#16a34a"))) # Green
                    ts.append(("FONTNAME", (col_idx, row_idx), (col_idx, row_idx), "Helvetica-Bold"))
                else:
                    ts.append(("TEXTCOLOR", (col_idx, row_idx), (col_idx, row_idx), colors.HexColor("#dc2626"))) # Red
        
        table.setStyle(TableStyle(ts))
        elements.append(table)

    doc.build(elements)
    return buf.getvalue()


def export_department_excel(department: str, summary_data: list, dates: list, start_date: str, end_date: str, working_days: str = None) -> bytes:
    rows = []
    for user in summary_data:
        row = {
            "Employee ID": user.get("employee_id", ""),
            "Name": user.get("name", ""),
        }
        # Add dates
        for d in dates:
            row[d] = user["attendance"].get(d, "A")
        
        row["Total Present"] = user.get("total_present", 0)
        rows.append(row)
    
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        # Write summary rows
        header_rows = [
            ["Department:", department],
            ["Period:", f"{start_date} to {end_date}"],
            ["Total Employees:", len(summary_data)]
        ]
        if working_days:
            header_rows.append(["Total Working Days:", working_days])
        
        header_rows.append(["", ""])
        pd.DataFrame(header_rows).to_excel(writer, index=False, header=False, sheet_name="Dept Attendance", startrow=0)

        df.to_excel(writer, index=False, sheet_name="Dept Attendance", startrow=len(header_rows))
        worksheet = writer.sheets["Dept Attendance"]
        for i, col in enumerate(df.columns):
            column_len = max(df[col].astype(str).str.len().max(), len(col)) + 2
            worksheet.column_dimensions[chr(65 + i) if i < 26 else 'A' + chr(65 + i - 26)].width = column_len
            
    return buf.getvalue()
