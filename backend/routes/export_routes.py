from flask import Blueprint, request, jsonify, send_file
from db import get_db
from utils.auth_middleware import require_auth
from services.export_service import export_csv, export_excel, export_pdf
import io
from datetime import date

export_bp = Blueprint("export", __name__)


def get_records_for_export(db):
    date_filter = request.args.get("date")
    dept_filter = request.args.get("department")
    query = {}
    if date_filter:
        query["date"] = date_filter
    if dept_filter:
        query["department"] = dept_filter
    records = list(db["attendance"].find(query).sort("date", -1))
    return records


@export_bp.route("/csv", methods=["GET"])
@require_auth
def download_csv():
    db = get_db()
    records = get_records_for_export(db)
    data = export_csv(records)
    return send_file(
        io.BytesIO(data),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"attendance_{date.today().isoformat()}.csv"
    )


@export_bp.route("/excel", methods=["GET"])
@require_auth
def download_excel():
    db = get_db()
    records = get_records_for_export(db)
    data = export_excel(records)
    return send_file(
        io.BytesIO(data),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"attendance_{date.today().isoformat()}.xlsx"
    )


@export_bp.route("/pdf", methods=["GET"])
@require_auth
def download_pdf():
    db = get_db()
    records = get_records_for_export(db)
    data = export_pdf(records)
    return send_file(
        io.BytesIO(data),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"attendance_{date.today().isoformat()}.pdf"
    )
