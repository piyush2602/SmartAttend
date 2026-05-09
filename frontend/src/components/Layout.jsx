import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ScanFace, LogOut, User } from "lucide-react";

const TABS = [
  { label: "Dashboard",  path: "/" },
  { label: "Attendance", path: "/attendance/log" },
  { label: "Register",   path: "/register" },
  { label: "Reports",    path: "/export" },
  { label: "Students",   path: "/users" },
  { label: "Logs",       path: "/logs" },
];

export default function Layout() {
  const { admin, logoutAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          {/* Brand + user */}
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <ScanFace size={18} className="text-white" />
              </div>
              <span className="font-bold text-gray-800 text-base">Smart Attendance</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <User size={14} className="text-blue-600" />
                </div>
                <span className="hidden sm:block font-medium text-gray-700">{admin?.username}</span>
              </div>
              <button
                onClick={() => { logoutAdmin(); navigate("/login"); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
              >
                <LogOut size={15} /> <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`nav-tab ${isActive(tab.path) ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
