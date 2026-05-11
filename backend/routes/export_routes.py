from flask import Blueprint, request, jsonify, send_file
from db import get_db
from utils.auth_middleware import require_auth
from services.export_service import (
    export_csv, export_excel, export_pdf, export_individual_pdf, export_individual_excel,
    export_department_pdf, export_department_excel
)
import io
from datetime import date, datetime, timedelta

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


@export_bp.route("/person-pdf", methods=["GET"])
@require_auth
def download_person_pdf():
    employee_id = request.args.get("employee_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    working_days = request.args.get("working_days")

    if not all([employee_id, start_date, end_date]):
        return jsonify({"error": "Missing parameters"}), 400

    db = get_db()
    user = db["users"].find_one({"employee_id": employee_id})
    if not user:
        return jsonify({"error": "User not found"}), 404

    query = {
        "employee_id": employee_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    records = list(db["attendance"].find(query).sort("date", -1))
    
    # Calculate dates in range
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    delta = end_dt - start_dt
    dates_in_range = [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(delta.days + 1)]
    
    user["present_count"] = len({r["date"] for r in records})

    data = export_individual_pdf(user, records, dates_in_range, start_date, end_date, working_days)
    return send_file(
        io.BytesIO(data),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"attendance_{employee_id}_{start_date}.pdf"
    )


@export_bp.route("/person-excel", methods=["GET"])
@require_auth
def download_person_excel():
    employee_id = request.args.get("employee_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    working_days = request.args.get("working_days")

    if not all([employee_id, start_date, end_date]):
        return jsonify({"error": "Missing parameters"}), 400

    db = get_db()
    user = db["users"].find_one({"employee_id": employee_id})
    if not user:
        return jsonify({"error": "User not found"}), 404

    records = list(db["attendance"].find({
        "employee_id": employee_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }))
    
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    delta = end_dt - start_dt
    dates_in_range = [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(delta.days + 1)]

    user["present_count"] = len({r["date"] for r in records})

    data = export_individual_excel(user, records, dates_in_range, start_date, end_date, working_days)
    return send_file(
        io.BytesIO(data),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"attendance_{employee_id}_{start_date}.xlsx"
    )


@export_bp.route("/department-pdf", methods=["GET"])
@require_auth
def download_department_pdf():
    department = request.args.get("department")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    working_days = request.args.get("working_days")

    if not all([department, start_date, end_date]):
        return jsonify({"error": "Missing parameters"}), 400

    db = get_db()
    users = list(db["users"].find({"department": department}))
    
    # Generate list of dates in range
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    delta = end_dt - start_dt
    
    dates_in_range = []
    for i in range(delta.days + 1):
        d = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
        dates_in_range.append(d)

    summary_data = []
    for user in users:
        emp_id = user["employee_id"]
        # Fetch all attendance for this user in range
        att_docs = list(db["attendance"].find({
            "employee_id": emp_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }))
        present_dates = {d["date"] for d in att_docs}
        
        row = {
            "name": user["name"],
            "employee_id": emp_id,
            "attendance": {},
            "total_present": len(present_dates)
        }
        
        for d in dates_in_range:
            row["attendance"][d] = "P" if d in present_dates else "A"
            
        summary_data.append(row)

    data = export_department_pdf(department, summary_data, dates_in_range, start_date, end_date, working_days)
    return send_file(
        io.BytesIO(data),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"department_{department}_{start_date}_to_{end_date}.pdf"
    )


@export_bp.route("/department-excel", methods=["GET"])
@require_auth
def download_department_excel():
    department = request.args.get("department")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    working_days = request.args.get("working_days")

    if not all([department, start_date, end_date]):
        return jsonify({"error": "Missing parameters"}), 400

    db = get_db()
    users = list(db["users"].find({"department": department}))
    
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    delta = end_dt - start_dt
    
    dates_in_range = []
    for i in range(delta.days + 1):
        d = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
        dates_in_range.append(d)

    summary_data = []
    for user in users:
        emp_id = user["employee_id"]
        att_docs = list(db["attendance"].find({
            "employee_id": emp_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }))
        present_dates = {d["date"] for d in att_docs}
        
        row = {
            "name": user["name"],
            "employee_id": emp_id,
            "attendance": {},
            "total_present": len(present_dates)
        }
        for d in dates_in_range:
            row["attendance"][d] = "P" if d in present_dates else "A"
        summary_data.append(row)

    data = export_department_excel(department, summary_data, dates_in_range, start_date, end_date, working_days)
    return send_file(
        io.BytesIO(data),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"department_{department}_{start_date}_to_{end_date}.xlsx"
    )
