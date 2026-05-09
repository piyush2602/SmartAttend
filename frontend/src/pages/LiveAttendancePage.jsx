import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { markAttendance, checkLiveness, resetSession } from "../services/api";
import { Camera, CameraOff, UserCheck, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";

const SESSION_ID = `live_${Date.now()}`;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const VIDEO_CONSTRAINTS = { width: 640, height: 480, facingMode: "user" };

export default function LiveAttendancePage() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [active, setActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [liveness, setLiveness] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [markedToday, setMarkedToday] = useState([]);
  const detectInterval = useRef(null);
  const livenessInterval = useRef(null);

  const drawBoxes = useCallback((faces, vidW, vidH) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;
    const dW = video.clientWidth, dH = video.clientHeight;
    canvas.width = dW; canvas.height = dH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dW, dH);
    const sx = vidW > 0 ? dW / vidW : 1;
    const sy = vidH > 0 ? dH / vidH : 1;
    faces.forEach(({ x, y, w, h }) => {
      ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 3;
      ctx.strokeRect(x * sx, y * sy, w * sx, h * sy);
      ctx.fillStyle = "rgba(34,197,94,0.1)";
      ctx.fillRect(x * sx, y * sy, w * sx, h * sy);
    });
  }, []);

  const startDetectionLoop = useCallback(() => {
    detectInterval.current = setInterval(async () => {
      const img = webcamRef.current?.getScreenshot();
      if (!img) return;
      try {
        const token = localStorage.getItem("token");
        const res = await axios.post(`${API_URL}/attendance/detect`, { frame: img }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        drawBoxes(res.data.faces || [], res.data.width, res.data.height);
      } catch {}
    }, 500);
  }, [drawBoxes]);

  const startCamera = useCallback(() => {
    setActive(true);
    setTimeout(() => startDetectionLoop(), 1000);
  }, [startDetectionLoop]);

  const stopCamera = useCallback(async () => {
    clearInterval(detectInterval.current);
    clearInterval(livenessInterval.current);
    setActive(false);
    setScanning(false);
    setLiveness(null);
    try { await resetSession(SESSION_ID); } catch {}
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startScan = useCallback(() => {
    if (scanning) return;
    setScanning(true);
    setLiveness(null);
    let attempts = 0;

    livenessInterval.current = setInterval(async () => {
      const img = webcamRef.current?.getScreenshot();
      if (!img) return;
      attempts++;
      try {
        const res = await checkLiveness(img, SESSION_ID);
        setLiveness(res.data);
        if (res.data.is_live || attempts > 50) {
          clearInterval(livenessInterval.current);
          const rImg = webcamRef.current?.getScreenshot();
          if (!rImg) { setScanning(false); return; }
          try {
            const rRes = await markAttendance(rImg, SESSION_ID);
            setLastResult(rRes.data);
            if (rRes.data.success) {
              toast.success(rRes.data.message);
              setMarkedToday(p => [rRes.data.record, ...p]);
            } else if (rRes.data.already_marked) {
              toast(rRes.data.message, { icon: "📋" });
            } else {
              toast.error(rRes.data.message);
            }
          } catch { toast.error("Server error"); }
          setScanning(false);
          setLiveness(null);
          try { await resetSession(SESSION_ID); } catch {}
        }
      } catch {}
    }, 300);
  }, [scanning]);

  useEffect(() => () => {
    clearInterval(detectInterval.current);
    clearInterval(livenessInterval.current);
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 animate-fade-in">
      {/* Camera */}
      <div className="xl:col-span-3 space-y-4">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Camera size={16} className="text-blue-500" /> Live Attendance Scan
            </h2>
            {active && <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />LIVE</span>}
          </div>

          <div className="relative bg-black" style={{ aspectRatio: "4/3", maxHeight: 420 }}>
            {active ? (
              <>
                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.85}
                  videoConstraints={VIDEO_CONSTRAINTS} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                {active && <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-xs">Live</span>
                </div>}
                {liveness && <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
                  {scanning ? `👁 Blink to verify: ${liveness.blink_count}/2 blinks detected` : ""}
                </div>}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                <CameraOff size={48} className="opacity-20 mb-2" />
                <p className="text-sm text-gray-600">Camera off</p>
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
            {!active ? (
              <button onClick={startCamera} className="btn-primary text-sm py-2 px-4">
                <Camera size={15} /> Start Camera
              </button>
            ) : (
              <>
                <button onClick={startScan} disabled={scanning}
                  className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
                  {scanning ? "Scanning..." : "Mark Attendance"}
                </button>
                <button onClick={stopCamera} className="btn-secondary text-sm py-2 px-3">
                  <RefreshCw size={14} /> Stop
                </button>
              </>
            )}
          </div>

          {lastResult && (
            <div className={`mx-4 mb-4 rounded-xl p-3 text-sm flex items-center gap-3 ${
              lastResult.success ? "bg-green-50 border border-green-100 text-green-700" :
              lastResult.already_marked ? "bg-yellow-50 border border-yellow-100 text-yellow-700" :
              "bg-red-50 border border-red-100 text-red-700"
            }`}>
              <span>{lastResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Marked Today */}
      <div className="xl:col-span-2 card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <UserCheck size={16} className="text-green-500" /> Marked Today
          </h3>
          <span className="badge-green">{markedToday.length}</span>
        </div>
        <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {markedToday.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10 px-4">No attendance marked yet.</p>
          ) : markedToday.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm shrink-0">
                {r.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                <p className="text-xs text-gray-400">{r.employee_id} · {r.time}</p>
              </div>
              <span className="badge-green">Present</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
