import { useEffect, useState, useCallback } from "react";
import { getAttendance } from "../services/api";
import { Search, Filter, RefreshCw, ClipboardList } from "lucide-react";

export default function AttendanceLogPage() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 25;
  const [filters, setFilters] = useState({ date: "", department: "", search: "" });

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await getAttendance({ ...filters, page: pg, limit: LIMIT });
      setRecords(res.data.records);
      setTotal(res.data.total);
      setPage(pg);
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(1); }, [load]);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <ClipboardList size={20} className="text-blue-600" />
        <h2 className="text-base font-semibold text-gray-800">Attendance Log</h2>
        <span className="badge-blue">{total} records</span>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" className="input text-sm" value={filters.date}
            onChange={e => setFilters({ ...filters, date: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Department</label>
          <input className="input text-sm w-40" placeholder="All" value={filters.department}
            onChange={e => setFilters({ ...filters, department: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input text-sm pl-8 w-44" placeholder="Name or ID" value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })} />
          </div>
        </div>
        <button onClick={() => load(1)} className="btn-primary text-sm py-2"><Filter size={14} /> Filter</button>
        <button onClick={() => setFilters({ date: "", department: "", search: "" })} className="btn-secondary text-sm py-2">
          <RefreshCw size={14} /> Clear
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" /> Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Name", "Employee ID", "Department", "Date", "Time", "Status"].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={6} className="td text-center text-gray-400 py-10">No records found</td></tr>
                ) : records.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="td font-medium text-gray-800">{r.name}</td>
                    <td className="td font-mono text-xs text-gray-500">{r.employee_id}</td>
                    <td className="td text-gray-600">{r.department}</td>
                    <td className="td text-gray-500">{r.date}</td>
                    <td className="td font-mono text-gray-500">{r.time}</td>
                    <td className="td">
                      <span className={r.status === "present" ? "badge-green" : "badge-red"}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-xs">← Prev</button>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-xs">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
