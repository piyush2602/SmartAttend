import { useState, useEffect } from "react";
import { exportCSV, exportExcel, exportPDF, exportPersonPDF, exportPersonExcel, exportDepartmentPDF, exportDepartmentExcel, getUsers } from "../services/api";
import { FileText, FileDown, Loader2, Filter, Download, User, Building2, Search, X, Eye } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

function handleFile(data, name, type, action = "download", setPreview = null) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  
  if (action === "view") {
    if (type === "application/pdf") {
      window.open(url, "_blank");
    } else if (setPreview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const bstr = e.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        setPreview({ data: jsonData, name });
      };
      reader.readAsBinaryString(new Blob([data]));
    }
  } else {
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export default function ExportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ date: "", department: "" });
  const [personFilters, setPersonFilters] = useState({ employee_id: "", start: today, end: today, workingDays: "" });
  const [personSearch, setPersonSearch] = useState({ id: "", department: "" });
  const [deptFilters, setDeptFilters] = useState({ department: "", start: today, end: today, workingDays: "" });
  const [loading, setLoading] = useState("");
  const [preview, setPreview] = useState(null); // { data: [[]], name: "" }

  useEffect(() => {
    getUsers().then(res => setUsers(res.data)).catch(console.error);
  }, []);

  const doExport = async (type, action = "download") => {
    setLoading(type + (action === "view" ? "_view" : ""));
    const params = {};
    if (filters.date) params.date = filters.date;
    if (filters.department) params.department = filters.department;
    try {
      if (type === "csv") {
        const r = await exportCSV(params); handleFile(r.data, `attendance_${today}.csv`, "text/csv", action, setPreview);
      } else if (type === "excel") {
        const r = await exportExcel(params); handleFile(r.data, `attendance_${today}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", action, setPreview);
      } else if (type === "pdf") {
        const r = await exportPDF(params); handleFile(r.data, `attendance_${today}.pdf`, "application/pdf", action, setPreview);
      } else if (type === "person-pdf") {
        if (!personFilters.employee_id) return toast.error("Please select a person");
        const p = { employee_id: personFilters.employee_id, start_date: personFilters.start, end_date: personFilters.end, working_days: personFilters.workingDays };
        const r = await exportPersonPDF(p);
        handleFile(r.data, `attendance_${personFilters.employee_id}_${personFilters.start}.pdf`, "application/pdf", action, setPreview);
      } else if (type === "person-excel") {
        if (!personFilters.employee_id) return toast.error("Please select a person");
        const p = { employee_id: personFilters.employee_id, start_date: personFilters.start, end_date: personFilters.end, working_days: personFilters.workingDays };
        const r = await exportPersonExcel(p);
        handleFile(r.data, `attendance_${personFilters.employee_id}_${personFilters.start}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", action, setPreview);
      } else if (type === "dept-pdf") {
        if (!deptFilters.department) return toast.error("Please enter a department");
        const p = { department: deptFilters.department, start_date: deptFilters.start, end_date: deptFilters.end, working_days: deptFilters.workingDays };
        const r = await exportDepartmentPDF(p);
        handleFile(r.data, `department_${deptFilters.department}_${deptFilters.start}.pdf`, "application/pdf", action, setPreview);
      } else if (type === "dept-excel") {
        if (!deptFilters.department) return toast.error("Please enter a department");
        const p = { department: deptFilters.department, start_date: deptFilters.start, end_date: deptFilters.end, working_days: deptFilters.workingDays };
        const r = await exportDepartmentExcel(p);
        handleFile(r.data, `department_${deptFilters.department}_${deptFilters.start}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", action, setPreview);
      }
      toast.success(action === "view" ? "Preview ready" : "Downloaded!");
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
            <div className="flex gap-2 mt-auto">
              <button onClick={() => doExport(type, "view")} disabled={!!loading}
                className="btn-secondary text-xs py-2 flex-1">
                {loading === type + "_view" ? <Loader2 size={12} className="animate-spin" /> : <><Eye size={12} /> View</>}
              </button>
              <button onClick={() => doExport(type)} disabled={!!loading}
                className="btn-primary text-xs py-2 flex-1">
                {loading === type ? <Loader2 size={12} className="animate-spin" /> : <><Download size={12} /> Get</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-10">
        <User size={20} className="text-indigo-600" />
        <h2 className="text-base font-semibold text-gray-800">Individual Person Report</h2>
      </div>

      <div className="card p-6 space-y-6">
        <p className="text-sm text-gray-500">Generate a detailed attendance history for a specific individual across a date range.</p>
        
        {/* Search Filters for Person */}
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wider mb-1 w-full">
            <Search size={14} /> Filter Person List
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-gray-400 mb-1">Search ID</label>
            <input 
              className="input text-xs w-full py-1.5" 
              placeholder="Filter by ID..." 
              value={personSearch.id} 
              onChange={e => setPersonSearch({...personSearch, id: e.target.value})}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] text-gray-400 mb-1">Search Department</label>
            <input 
              className="input text-xs w-full py-1.5" 
              placeholder="Filter by Dept..." 
              value={personSearch.department} 
              onChange={e => setPersonSearch({...personSearch, department: e.target.value})}
            />
          </div>
          <button 
            onClick={() => setPersonSearch({id: "", department: ""})}
            className="text-xs text-blue-600 hover:underline self-end pb-2"
          >
            Reset List
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Select Person</label>
            <select 
              className="input text-sm w-full" 
              value={personFilters.employee_id} 
              onChange={e => setPersonFilters({...personFilters, employee_id: e.target.value})}
            >
              <option value="">-- Choose Employee --</option>
              {users
                .filter(u => 
                  u.employee_id.toLowerCase().includes(personSearch.id.toLowerCase()) &&
                  u.department.toLowerCase().includes(personSearch.department.toLowerCase())
                )
                .map(u => (
                  <option key={u.id} value={u.employee_id}>{u.name} ({u.employee_id}) - {u.department}</option>
                ))
              }
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">From Date</label>
            <input 
              type="date" 
              className="input text-sm w-full" 
              value={personFilters.start} 
              onChange={e => setPersonFilters({...personFilters, start: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">To Date</label>
            <input 
              type="date" 
              className="input text-sm w-full" 
              value={personFilters.end} 
              onChange={e => setPersonFilters({...personFilters, end: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Total Working Days</label>
            <input 
              type="number" 
              placeholder="e.g. 22"
              className="input text-sm w-full" 
              value={personFilters.workingDays} 
              onChange={e => setPersonFilters({...personFilters, workingDays: e.target.value})} 
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <button 
              onClick={() => doExport("person-excel", "view")} 
              disabled={!!loading}
              className="bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium text-gray-700 flex items-center gap-2 border-r border-gray-200"
            >
              {loading === "person-excel_view" ? <Loader2 size={14} className="animate-spin" /> : <><Eye size={14} /> Preview Excel</>}
            </button>
            <button 
              onClick={() => doExport("person-excel")} 
              disabled={!!loading}
              className="bg-white hover:bg-gray-50 px-4 py-2 text-xs font-medium text-gray-700 flex items-center gap-2"
            >
              {loading === "person-excel" ? <Loader2 size={14} className="animate-spin" /> : <><Download size={14} /> Download</>}
            </button>
          </div>
          <button 
            onClick={() => doExport("person-pdf", "view")} 
            disabled={!!loading}
            className="btn-secondary px-5 py-2 text-xs flex items-center gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            {loading === "person-pdf_view" ? (
              <><Loader2 size={14} className="animate-spin" /> Preparing...</>
            ) : (
              <><Search size={14} /> View PDF</>
            )}
          </button>
          <button 
            onClick={() => doExport("person-pdf")} 
            disabled={!!loading}
            className="btn-primary px-5 py-2 text-xs flex items-center gap-2"
          >
            {loading === "person-pdf" ? (
              <><Loader2 size={14} className="animate-spin" /> Generating...</>
            ) : (
              <><FileDown size={14} /> Download PDF</>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-10">
        <Building2 size={20} className="text-emerald-600" />
        <h2 className="text-base font-semibold text-gray-800">Departmental Report</h2>
      </div>

      <div className="card p-6 space-y-6">
        <p className="text-sm text-gray-500">Generate a summary report for all employees in a specific department.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Department Name</label>
            <input 
              className="input text-sm w-full" 
              placeholder="e.g. Engineering"
              value={deptFilters.department} 
              onChange={e => setDeptFilters({...deptFilters, department: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">From Date</label>
            <input 
              type="date" 
              className="input text-sm w-full" 
              value={deptFilters.start} 
              onChange={e => setDeptFilters({...deptFilters, start: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">To Date</label>
            <input 
              type="date" 
              className="input text-sm w-full" 
              value={deptFilters.end} 
              onChange={e => setDeptFilters({...deptFilters, end: e.target.value})} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Total Working Days</label>
            <input 
              type="number" 
              placeholder="e.g. 22"
              className="input text-sm w-full" 
              value={deptFilters.workingDays} 
              onChange={e => setDeptFilters({...deptFilters, workingDays: e.target.value})} 
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 gap-3">
          <div className="flex border border-emerald-200 rounded-lg overflow-hidden shadow-sm">
            <button 
              onClick={() => doExport("dept-excel", "view")} 
              disabled={!!loading}
              className="bg-white hover:bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 flex items-center gap-2 border-r border-emerald-200"
            >
              {loading === "dept-excel_view" ? <Loader2 size={14} className="animate-spin" /> : <><Eye size={14} /> Preview Excel</>}
            </button>
            <button 
              onClick={() => doExport("dept-excel")} 
              disabled={!!loading}
              className="bg-white hover:bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 flex items-center gap-2"
            >
              {loading === "dept-excel" ? <Loader2 size={14} className="animate-spin" /> : <><Download size={14} /> Download</>}
            </button>
          </div>
          <button 
            onClick={() => doExport("dept-pdf", "view")} 
            disabled={!!loading}
            className="btn-secondary px-5 py-2 text-xs flex items-center gap-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          >
            {loading === "dept-pdf_view" ? (
              <><Loader2 size={14} className="animate-spin" /> Preparing...</>
            ) : (
              <><Search size={14} /> View PDF</>
            )}
          </button>
          <button 
            onClick={() => doExport("dept-pdf")} 
            disabled={!!loading}
            className="btn-primary px-5 py-2 text-xs flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
          >
            {loading === "dept-pdf" ? (
              <><Loader2 size={14} className="animate-spin" /> Generating...</>
            ) : (
              <><FileDown size={14} /> Download PDF</>
            )}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden scale-in">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Data Preview</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">{preview.name}</p>
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 sticky top-0">
                    {preview.data[0]?.map((cell, i) => (
                      <th key={i} className="p-3 border font-bold text-gray-700 whitespace-nowrap">{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.slice(1).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      {row.map((cell, j) => (
                        <td key={j} className={`p-3 border text-gray-600 ${cell === "Present" || cell === "P" ? "text-green-600 font-medium" : cell === "Absent" || cell === "A" ? "text-red-600 font-medium" : ""}`}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setPreview(null)} className="btn-primary px-8">Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
