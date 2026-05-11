import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 30000,
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("admin");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

// ─── Auth ──────────────────────────────────────────────
export const login = (username, password) =>
  API.post("/auth/login", { username, password });
export const setupAdmin = (data) => API.post("/auth/setup", data);
export const verifyToken = () => API.get("/auth/verify");

// ─── Users ─────────────────────────────────────────────
export const getUsers = () => API.get("/users/");
export const createUser = (data) => API.post("/users/", data);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);
export const registerFace = (id, frames) =>
  API.post(`/users/${id}/register-face`, { frames });

// ─── Attendance ─────────────────────────────────────────
export const checkLiveness = (frame, session_id) =>
  API.post("/attendance/liveness", { frame, session_id });
export const markAttendance = (frame, session_id) =>
  API.post("/attendance/mark", { frame, session_id });
export const recognizeLive = (frame, session_id, auto_mark = true) =>
  API.post("/attendance/recognize", { frame, session_id, auto_mark });
export const resetSession = (session_id) =>
  API.post("/attendance/reset-session", { session_id });
export const getAttendance = (params) => API.get("/attendance/", { params });
export const getStats = () => API.get("/attendance/stats");
export const getTodayAttendance = () => API.get("/attendance/today");
export const getFaceSamples = (userId) => API.get(`/users/${userId}/samples`);

// ─── Export ─────────────────────────────────────────────
export const exportCSV = (params) =>
  API.get("/export/csv", { params, responseType: "blob" });
export const exportExcel = (params) =>
  API.get("/export/excel", { params, responseType: "blob" });
export const exportPDF = (params) =>
  API.get("/export/pdf", { params, responseType: "blob" });
export const exportPersonPDF = (params) =>
  API.get("/export/person-pdf", { params, responseType: "blob" });
export const exportPersonExcel = (params) =>
  API.get("/export/person-excel", { params, responseType: "blob" });
export const exportDepartmentPDF = (params) =>
  API.get("/export/department-pdf", { params, responseType: "blob" });
export const exportDepartmentExcel = (params) =>
  API.get("/export/department-excel", { params, responseType: "blob" });

// Fingerprint Biometrics
export const enrollFingerprint = (user_id) => API.post("/fingerprint/enroll", { user_id });
export const verifyFingerprint = () => API.post("/fingerprint/verify", {});

export default API;
