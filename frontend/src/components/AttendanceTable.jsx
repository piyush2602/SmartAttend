import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AttendanceTable({ records, loading, page, totalPages, onPageChange }) {
  const statusBadge = (status) => {
    const map = { present: "badge-green", absent: "badge-red", late: "badge-yellow", unknown: "badge-red" };
    return <span className={map[status] || "badge-yellow"}>{status}</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-500">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mr-3" />
      Loading records...
    </div>
  );

  if (!records?.length) return (
    <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
      No attendance records found.
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 border-b border-gray-800">
              {["Name", "Employee ID", "Department", "Date", "Time", "Status"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {records.map((r) => (
              <tr key={r.id} className="table-row-hover">
                <td className="px-4 py-3 text-white font-medium">{r.name}</td>
                <td className="px-4 py-3 text-gray-400 font-mono">{r.employee_id}</td>
                <td className="px-4 py-3 text-gray-400">{r.department}</td>
                <td className="px-4 py-3 text-gray-300">{r.date}</td>
                <td className="px-4 py-3 text-gray-300 font-mono">{r.time}</td>
                <td className="px-4 py-3">{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="btn-secondary px-2 py-1 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="btn-secondary px-2 py-1 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
