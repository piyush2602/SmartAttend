import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import RegisterFacePage from "./pages/RegisterFacePage";
import AttendanceLogPage from "./pages/AttendanceLogPage";
import ExportPage from "./pages/ExportPage";
import LiveAttendancePage from "./pages/LiveAttendancePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#fff",
              color: "#1f2937",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              fontSize: "13px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id/register" element={<RegisterFacePage />} />
            <Route path="register" element={<RegisterFacePage />} />
            <Route path="attendance/live" element={<LiveAttendancePage />} />
            <Route path="attendance/log" element={<AttendanceLogPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="logs" element={<AttendanceLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
