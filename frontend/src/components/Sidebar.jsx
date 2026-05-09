import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Camera, ClipboardList,
  Download, LogOut, ScanFace, Menu, X
} from "lucide-react";
import { useState } from "react";

const links = [
  { to: "/",              label: "Dashboard",       icon: LayoutDashboard },
  { to: "/users",         label: "Employees",       icon: Users },
  { to: "/attendance/live", label: "Live Attendance", icon: Camera },
  { to: "/attendance/log",  label: "Attendance Log",  icon: ClipboardList },
  { to: "/export",          label: "Export Reports",   icon: Download },
];

export default function Sidebar() {
  const { admin, logoutAdmin } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logoutAdmin(); navigate("/login"); };

  return (
    <aside className={`flex flex-col h-screen bg-gray-900 border-r border-gray-800 transition-all duration-300 ${collapsed ? "w-16" : "w-64"} shrink-0`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
          <ScanFace size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <p className="text-sm font-bold text-white leading-tight">FaceAttend</p>
            <p className="text-xs text-gray-500">AI Attendance System</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-gray-500 hover:text-white transition-colors"
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
            title={collapsed ? label : ""}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="animate-fade-in">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Admin info + logout */}
      <div className="border-t border-gray-800 p-3">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-sm font-bold">
              {admin?.username?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{admin?.username || "Admin"}</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
          title={collapsed ? "Logout" : ""}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
