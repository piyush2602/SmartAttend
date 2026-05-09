import { useState } from "react";
import { exportCSV, exportExcel, exportPDF } from "../services/api";
import { FileText, FileDown, Loader2, Filter, Download } from "lucide-react";
import toast from "react-hot-toast";

function dl(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const [filters, setFilters] = useState({ date: "", department: "" });
  const [loading, setLoading] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const doExport = async (type) => {
    setLoading(type);
    const params = {};
    if (filters.date) params.date = filters.date;
    if (filters.department) params.department = filters.department;
    try {
      if (type === "csv") {
        const r = await exportCSV(params); dl(r.data, `attendance_${today}.csv`, "text/csv");
      } else if (type === "excel") {
        const r = await exportExcel(params); dl(r.data, `attendance_${today}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      } else {
        const r = await exportPDF(params); dl(r.data, `attendance_${today}.pdf`, "application/pdf");
      }
      toast.success("Downloaded!");
    } catch (e) {
      toast.error("Export failed: " + (e.response?.data?.error || e.message));
    } finally { setLoading(""); }
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-2">
        <Download size={20} className="text-blue-600" />
        <h2 className="text-base font-semibold text-gray-800">Export Reports</h2>
      </div>

      {/* Filters */}
      <div className="card p-5 flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2 text-gray-500 self-center"><Filter size={15} /> <span className="text-sm">Filter Export</span></div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date (optional)</label>
          <input type="date" className="input text-sm" value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Department (optional)</label>
          <input className="input text-sm w-44" placeholder="All departments" value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })} />
        </div>
        <button onClick={() => setFilters({ date: "", department: "" })} className="btn-secondary text-sm py-2">Clear</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { type: "csv", label: "CSV", desc: "Comma-separated — open in Excel or Google Sheets", color: "bg-green-500", icon: FileText },
          { type: "excel", label: "Excel", desc: "Formatted .xlsx spreadsheet with styled rows", color: "bg-blue-500", icon: FileText },
          { type: "pdf", label: "PDF", desc: "Printable report with branded table layout", color: "bg-red-500", icon: FileDown },
        ].map(({ type, label, desc, color, icon: Icon }) => (
          <div key={type} className="card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
            <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
              <Icon size={22} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
            </div>
            <button onClick={() => doExport(type)} disabled={!!loading}
              className="btn-primary text-sm py-2 mt-auto">
              {loading === type ? <><Loader2 size={14} className="animate-spin" /> Exporting...</> : <><FileDown size={14} /> Download {label}</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
