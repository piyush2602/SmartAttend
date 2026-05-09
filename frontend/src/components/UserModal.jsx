import { useState } from "react";
import { X, User, Hash, Building2, Mail, Save, Loader2 } from "lucide-react";
import { createUser, updateUser } from "../services/api";
import toast from "react-hot-toast";

export default function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || "",
    employee_id: user?.employee_id || "",
    department: user?.department || "",
    email: user?.email || "",
  });
  const [loading, setLoading] = useState(false);
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await updateUser(user.id, { name: form.name, department: form.department, email: form.email });
        toast.success("Updated!");
      } else {
        await createUser(form);
        toast.success("Student added!");
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || "Error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{isEdit ? "Edit Student" : "Add Student"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { name: "name", label: "Full Name", icon: User, placeholder: "John Doe" },
            { name: "employee_id", label: "Student/Employee ID", icon: Hash, placeholder: "STU001", disabled: isEdit },
            { name: "department", label: "Department / Class", icon: Building2, placeholder: "Computer Science" },
            { name: "email", label: "Email", icon: Mail, placeholder: "john@college.edu", type: "email" },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <div className="relative">
                <f.icon size={14} className="absolute left-3 top-2.5 text-gray-400" />
                <input name={f.name} type={f.type || "text"} value={form[f.name]} onChange={handleChange}
                  className="input pl-8 text-sm" placeholder={f.placeholder} required disabled={f.disabled} />
              </div>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm py-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isEdit ? "Update" : "Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
