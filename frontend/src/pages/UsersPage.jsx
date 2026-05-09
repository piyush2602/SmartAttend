import { useEffect, useState } from "react";
import { getUsers, deleteUser } from "../services/api";
import { Plus, Pencil, Trash2, Camera, Search, CheckCircle, XCircle, Users } from "lucide-react";
import UserModal from "../components/UserModal";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getUsers()
      .then(res => { setUsers(res.data); setFiltered(res.data); })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(users); return; }
    const q = search.toLowerCase();
    setFiltered(users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.employee_id.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q)
    ));
  }, [search, users]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}? This also removes all face data.`)) return;
    try {
      await deleteUser(id);
      toast.success("Deleted");
      load();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          <h2 className="text-base font-semibold text-gray-800">Students / Employees</h2>
          <span className="badge-blue">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input pl-8 w-52" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setModal("add")} className="btn-primary text-sm py-2">
            <Plus size={15} /> Add Student
          </button>
        </div>
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
                  {["Student", "ID", "Department", "Email", "Face", "Actions"].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="td text-center text-gray-400 py-10">No students found.</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id} className="table-row">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        {u.profile_photo
                          ? <img src={u.profile_photo} alt={u.name} className="w-9 h-9 rounded-full object-cover border-2 border-blue-200 shrink-0" />
                          : <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm shrink-0">{u.name[0]}</div>
                        }
                        <span className="font-medium text-gray-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="td font-mono text-xs text-gray-500">{u.employee_id}</td>
                    <td className="td text-gray-600">{u.department}</td>
                    <td className="td text-gray-500 text-xs">{u.email}</td>
                    <td className="td">
                      {u.face_registered
                        ? <span className="badge-green"><CheckCircle size={11} /> Registered</span>
                        : <span className="badge-red"><XCircle size={11} /> Not registered</span>
                      }
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/users/${u.id}/register`)}
                          className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="Register Face">
                          <Camera size={14} />
                        </button>
                        <button onClick={() => setModal(u)}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(u.id, u.name)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
