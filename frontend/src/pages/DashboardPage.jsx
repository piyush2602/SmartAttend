import { useEffect, useRef, useCallback, useState } from "react";
import Webcam from "react-webcam";
import { getStats, getTodayAttendance, recognizeLive } from "../services/api";
import { Users, UserCheck, Calendar, Clock, Wifi, WifiOff } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SESSION_ID = `live_${Date.now()}`;
const VIDEO_CONSTRAINTS = { width: 640, height: 480, facingMode: "user" };

export default function DashboardPage() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  const [stats, setStats] = useState({ total_users: 0, today_attendance: 0, registered_faces: 0 });
  const [todayList, setTodayList] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [recognitions, setRecognitions] = useState([]);
  const [now, setNow] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [sRes, tRes] = await Promise.all([getStats(), getTodayAttendance()]);
      setStats(sRes.data);
      setTodayList(tRes.data);
    } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Draw face boxes with name labels on canvas.
  // Key: canvas pixel dimensions must equal the VIDEO ELEMENT's rendered rect
  // (not clientWidth/clientHeight, which can differ when object-cover is used).
  const drawFaces = useCallback((faceResults, vidW, vidH) => {
    const canvas = canvasRef.current;
    const video  = webcamRef.current?.video;
    if (!canvas || !video || !vidW || !vidH) return;

    // Use the video element's actual on-screen rect so canvas pixels = video pixels
    const rect = video.getBoundingClientRect();
    const dW = rect.width;
    const dH = rect.height;

    if (canvas.width !== dW)  canvas.width  = dW;
    if (canvas.height !== dH) canvas.height = dH;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dW, dH);

    // object-cover letterboxing math:
    // The video renders inside dW×dH but keeps vidW/vidH aspect ratio,
    // cropping edges. We must account for the crop offset.
    const videoAspect   = vidW / vidH;
    const displayAspect = dW   / dH;

    let renderW, renderH, offsetX, offsetY;
    if (videoAspect > displayAspect) {
      // Video is wider than display → top/bottom fit, left/right cropped
      renderH = dH;
      renderW = dH * videoAspect;
      offsetX = (dW - renderW) / 2;   // negative = left crop
      offsetY = 0;
    } else {
      // Video is taller → left/right fit, top/bottom cropped
      renderW = dW;
      renderH = dW / videoAspect;
      offsetX = 0;
      offsetY = (dH - renderH) / 2;   // negative = top crop
    }

    const sx = renderW / vidW;
    const sy = renderH / vidH;

    faceResults.forEach(face => {
      const { x, y, w, h } = face.box;
      const px = offsetX + x * sx;
      const py = offsetY + y * sy;
      const pw = w * sx;
      const ph = h * sy;

      const color = face.recognized
        ? (face.already_marked ? "#f59e0b" : "#22c55e")
        : "#ef4444";

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = color + "18";
      ctx.fillRect(px, py, pw, ph);

      // Corner markers for a cleaner look
      const cs = Math.min(pw, ph) * 0.18;   // corner segment length
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      [[px,py],[px+pw,py],[px,py+ph],[px+pw,py+ph]].forEach(([cx,cy],i) => {
        ctx.beginPath();
        ctx.moveTo(cx + (i%2===0? cs : -cs), cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + (i<2? cs : -cs));
        ctx.stroke();
      });

      // Name label
      const label = face.recognized
        ? `${face.name} · ${face.employee_id}${face.just_marked ? " (marked)" : face.already_marked ? " (marked)" : ""}`
        : "Unknown";

      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      const textW = ctx.measureText(label).width + 14;
      const lh    = 20;
      // Draw below box, but clamp inside canvas
      const ly = (py + ph + lh > dH) ? py - lh : py + ph;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(px, ly, textW, lh, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, px + 7, ly + 14);
    });
  }, []);

  // Auto-recognition loop (every 1200ms)
  const startAutoRecognize = useCallback(() => {
    intervalRef.current = setInterval(async () => {
      const img   = webcamRef.current?.getScreenshot();
      const video = webcamRef.current?.video;
      if (!img || !video) return;

      // Always use native video stream dimensions for coordinate mapping
      const vidW = video.videoWidth  || 640;
      const vidH = video.videoHeight || 480;

      try {
        const res   = await recognizeLive(img, SESSION_ID, true);
        const faces = res.data.faces || [];
        drawFaces(faces, vidW, vidH);

        const marked = faces.filter(f => f.just_marked);
        if (marked.length > 0) {
          setRecognitions(prev => [
            ...marked.map(f => ({
              time:        new Date().toLocaleTimeString(),
              name:        f.name,
              employee_id: f.employee_id,
              success:     true,
            })),
            ...prev,
          ].slice(0, 20));
          loadStats();
        }
      } catch {}
    }, 1200);
  }, [drawFaces, loadStats]);

  const toggleCamera = useCallback(() => {
    if (cameraOn) {
      clearInterval(intervalRef.current);
      setCameraOn(false);
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    } else {
      setCameraOn(true);
      // Give webcam 1s to initialise before starting
      setTimeout(() => startAutoRecognize(), 1200);
    }
  }, [cameraOn, startAutoRecognize]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour12: false });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={22} className="text-blue-600" />} bg="bg-blue-50"
          label="Total Students" value={stats.total_users} />
        <StatCard icon={<UserCheck size={22} className="text-blue-600" />} bg="bg-blue-50"
          label="Present Today" value={stats.today_attendance} />
        <StatCard icon={<Calendar size={22} className="text-pink-500" />} bg="bg-pink-50"
          label="Current Date" value={dateStr} small />
        <StatCard icon={<Clock size={22} className="text-pink-500" />} bg="bg-pink-50"
          label="Current Time" value={timeStr} mono />
      </div>

      {/* Live Attendance */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Live Attendance</h2>
          <div className="flex items-center gap-3">
            {cameraOn
              ? <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium"><Wifi size={13} />Connected</span>
              : <span className="flex items-center gap-1.5 text-xs text-gray-400"><WifiOff size={13} />Disconnected</span>
            }
            <span className="text-xs text-gray-500">Camera</span>
            <button onClick={toggleCamera}
              className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${cameraOn ? "bg-blue-600" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${cameraOn ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Two-column: compact camera + recognitions */}
        <div className="flex flex-col md:flex-row">
          {/* Camera — compact fixed height */}
          <div className="relative bg-black md:w-80 shrink-0" style={{ height: 240 }}>
            {cameraOn ? (
              <>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  screenshotQuality={0.85}
                  videoConstraints={VIDEO_CONSTRAINTS}
                  className="w-full h-full object-cover"
                  mirrored={false}
                />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-xs font-semibold">Live</span>
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-center bg-black/50 text-white text-[10px] px-2 py-1">
                  🟢 marked &nbsp;🟡 present &nbsp;🔴 unknown
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-gray-900 gap-2">
                <div className="w-12 h-12 rounded-full border-2 border-gray-700 flex items-center justify-center">
                  <Users size={22} className="text-gray-600" />
                </div>
                <p className="text-xs text-gray-500">Toggle camera to start</p>
              </div>
            )}
          </div>

          {/* Recent recognitions panel */}
          <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-100 px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide flex items-center gap-2">
              Recent Recognitions
              {recognitions.length > 0 && <span className="badge-green normal-case font-normal">{recognitions.length}</span>}
            </h3>
            {recognitions.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">
                {cameraOn ? "Waiting for faces to detect…" : "Start camera to begin auto-recognition."}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {recognitions.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="font-mono text-gray-400 shrink-0">{r.time}</span>
                    <span className="text-green-700 font-medium">{r.name}</span>
                    <span className="text-gray-400">· {r.employee_id} · Marked</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's attendance table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Today's Attendance</h3>
          <span className="badge-blue">{todayList.length} present</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Photo", "Name", "ID", "Department", "Time", "Status"].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todayList.length === 0 ? (
                <tr><td colSpan={6} className="td text-center text-gray-400 py-10">
                  No attendance marked today
                </td></tr>
              ) : todayList.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="td">
                    {r.profile_photo
                      ? <img src={r.profile_photo} alt={r.name} className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                      : <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">{r.name?.[0]}</div>
                    }
                  </td>
                  <td className="td font-medium text-gray-800">{r.name}</td>
                  <td className="td text-gray-500 font-mono text-xs">{r.employee_id}</td>
                  <td className="td text-gray-500">{r.department}</td>
                  <td className="td font-mono text-gray-500">{r.time}</td>
                  <td className="td"><span className="badge-green">Present</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, label, value, small, mono }) {
  return (
    <div className="stat-card">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className={`font-bold text-gray-800 truncate ${small || mono ? "text-lg" : "text-2xl"} ${mono ? "font-mono" : ""}`}>{value}</p>
        <p className="text-xs text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
}
