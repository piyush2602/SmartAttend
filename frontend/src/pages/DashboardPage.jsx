import { useEffect, useRef, useCallback, useState } from "react";
import Webcam from "react-webcam";
import { getStats, getTodayAttendance, recognizeLive, verifyFingerprint, markAttendanceMPIN } from "../services/api";
import { Users, UserCheck, Calendar, Clock, Wifi, WifiOff, Fingerprint, ScanFace, Loader2, Key } from "lucide-react";
import toast from "react-hot-toast";

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
  const [activeMode, setActiveMode] = useState("face"); // "face", "finger", "mpin"
  const [verifyingFinger, setVerifyingFinger] = useState(false);
  const [mpinData, setMpinData] = useState({ id: "", pin: "" });
  const [markingMpin, setMarkingMpin] = useState(false);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    loadStats();
    loadToday();
    return () => clearInterval(t);
  }, []);

  const loadStats = async () => {
    try {
      const res = await getStats();
      setStats(res.data);
    } catch {}
  };

  const loadToday = async () => {
    try {
      const res = await getTodayAttendance();
      setTodayList(res.data);
    } catch {}
  };

  const drawFaces = useCallback((faces) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;

    // Match internal canvas resolution to video display resolution
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    faces.forEach(f => {
      const { x, y, w, h } = f.box;
      // Use the actual image dimensions from the last capture to scale
      const frameW = canvas.getAttribute("data-frame-w") || 640;
      const frameH = canvas.getAttribute("data-frame-h") || 480;

      const sx = (x / frameW) * canvas.width;
      const sy = (y / frameH) * canvas.height;
      const sw = (w / frameW) * canvas.width;
      const sh = (h / frameH) * canvas.height;

      ctx.strokeStyle = f.recognized ? "#10b981" : "#f59e0b";
      ctx.lineWidth = 3;
      ctx.strokeRect(sx, sy, sw, sh);
      
      // Label
      ctx.fillStyle = f.recognized ? "#10b981" : "#f59e0b";
      ctx.font = "bold 12px Inter, sans-serif";
      const txt = f.recognized ? `${f.name} (${f.confidence})` : "Scanning...";
      ctx.fillText(txt, sx, sy - 8);
    });
  }, []);

  // Auto-recognition loop
  useEffect(() => {
    if (!cameraOn || activeMode !== "face") {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let active = true;
    const run = async () => {
      if (!active || !cameraOn || activeMode !== "face") return;

      const img = webcamRef.current?.getScreenshot();
      const video = webcamRef.current?.video;
      
      if (img && video) {
        if (canvasRef.current) {
          canvasRef.current.setAttribute("data-frame-w", video.videoWidth);
          canvasRef.current.setAttribute("data-frame-h", video.videoHeight);
        }
        try {
          const res = await recognizeLive(img, SESSION_ID, true);
          if (active) {
            const faces = res.data.faces || [];
            drawFaces(faces);
            
            const newlyRecognized = faces.filter(f => f.recognized && f.just_marked);
            if (newlyRecognized.length > 0) {
              newlyRecognized.forEach(f => {
                toast.success(`Welcome, ${f.name}!`, { icon: "👋", duration: 2000 });
              });
              setRecognitions(prev => {
                const fresh = newlyRecognized.map(f => ({
                  time: new Date().toLocaleTimeString(),
                  name: f.name,
                  employee_id: f.employee_id,
                  success: true
                }));
                return [...fresh, ...prev].slice(0, 20);
              });
              loadStats();
              loadToday();
            }
          }
        } catch (err) {
          console.error("[Dashboard] Recognition error:", err);
        }
      }

      if (active) setTimeout(run, 600);
    };

    // Give webcam a moment to warm up
    const timer = setTimeout(run, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cameraOn, activeMode, drawFaces]);

  const toggleCamera = () => {
    if (cameraOn) {
      setCameraOn(false);
    } else {
      setCameraOn(true);
      setActiveMode("face");
    }
  };

  const handleFingerVerify = async () => {
    setVerifyingFinger(true);
    try {
      const res = await verifyFingerprint();
      if (res?.data?.success && res?.data?.user) {
        toast.success(res.data.message);
        setRecognitions(prev => [
          {
            time: new Date().toLocaleTimeString(),
            name: res.data.user.name || "Unknown",
            employee_id: res.data.user.employee_id || "N/A",
            success: true,
          },
          ...prev
        ].slice(0, 20));
        loadStats();
        loadToday();
      } else if (res?.data?.success && res?.data?.already_marked) {
        toast.success(res.data.message);
        loadStats();
        loadToday();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Fingerprint recognition failed");
    } finally {
      setVerifyingFinger(false);
    }
  };

  const handleMpinSubmit = async (e) => {
    e?.preventDefault();
    if (!mpinData.id || !mpinData.pin) return toast.error("Enter ID and PIN");
    setMarkingMpin(true);
    try {
      const res = await markAttendanceMPIN(mpinData.id, mpinData.pin);
      if (res.data.success) {
        toast.success(res.data.message);
        setRecognitions(prev => [
          {
            time: new Date().toLocaleTimeString(),
            name: res.data.record.name,
            employee_id: res.data.record.employee_id,
            success: true,
          },
          ...prev
        ].slice(0, 20));
        setMpinData({ id: "", pin: "" });
        loadStats();
        loadToday();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "MPIN verification failed");
    } finally {
      setMarkingMpin(false);
    }
  };

  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="text-blue-600" size={24} />} bg="bg-blue-50" label="Total Students" value={stats.total_users} />
        <StatCard icon={<UserCheck className="text-green-600" size={24} />} bg="bg-green-50" label="Today Present" value={stats.today_attendance} />
        <StatCard icon={<ScanFace className="text-purple-600" size={24} />} bg="bg-purple-50" label="Faces Trained" value={stats.registered_faces} />
        <div className="stat-card bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="flex flex-col">
            <p className="text-xs opacity-80 uppercase font-bold tracking-wider">Live Server Time</p>
            <p className="text-2xl font-mono font-bold mt-1">{timeStr}</p>
            <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1"><Calendar size={10}/> {dateStr}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Attendance */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <h2 className="font-semibold text-gray-800 text-sm">Attendance Mode</h2>
              <div className="flex p-0.5 bg-gray-100 rounded-lg">
                <button onClick={() => { setActiveMode("face"); if(!cameraOn) setCameraOn(true); }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeMode === "face" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}>
                  <ScanFace size={13} /> FACE
                </button>
                <button onClick={() => { setActiveMode("finger"); setCameraOn(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeMode === "finger" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"}`}>
                  <Fingerprint size={13} /> FINGERPRINT
                </button>
                <button onClick={() => { setActiveMode("mpin"); setCameraOn(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeMode === "mpin" ? "bg-white text-amber-600 shadow-sm" : "text-gray-500"}`}>
                  <Key size={13} /> MPIN
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeMode === "face" && (
                <>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${cameraOn ? "text-green-600" : "text-gray-400"}`}>
                    {cameraOn ? <Wifi size={13} /> : <WifiOff size={13} />} {cameraOn ? "Connected" : "Disconnected"}
                  </span>
                  <button onClick={toggleCamera}
                    className={`relative w-11 h-6 rounded-full transition-colors ${cameraOn ? "bg-blue-600" : "bg-gray-200"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cameraOn ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </>
              )}
              {activeMode === "finger" && <span className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium"><Wifi size={13} /> Sensor Ready</span>}
              {activeMode === "mpin" && <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium"><Key size={13} /> PIN Pad Active</span>}
            </div>
          </div>

          <div className="flex flex-col md:flex-row">
            {/* Viewport */}
            <div className="relative bg-black md:w-80 shrink-0" style={{ height: 260 }}>
              {activeMode === "face" ? (
                cameraOn ? (
                  <>
                    <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.85} videoConstraints={VIDEO_CONSTRAINTS} className="w-full h-full object-cover" mirrored={false} />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 bg-gray-900 gap-2">
                    <ScanFace size={30} className="opacity-20" />
                    <p className="text-xs text-gray-500">Toggle camera to start</p>
                  </div>
                )
              ) : activeMode === "finger" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950 p-6 text-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${verifyingFinger ? "bg-indigo-500 animate-pulse scale-110" : "bg-indigo-900 text-indigo-400"}`}>
                    <Fingerprint size={32} />
                  </div>
                  <button onClick={handleFingerVerify} disabled={verifyingFinger} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                    {verifyingFinger ? "Verifying..." : "Verify Fingerprint"}
                  </button>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 p-5 gap-3">
                  <Key size={24} className="text-amber-500 opacity-50 mb-1" />
                  <form onSubmit={handleMpinSubmit} className="w-full space-y-2">
                    <input type="text" placeholder="Student ID" className="w-full bg-gray-800 border-gray-700 text-white text-xs py-2 px-3 rounded-lg outline-none" value={mpinData.id} onChange={e => setMpinData({...mpinData, id: e.target.value.toUpperCase()})} />
                    <input type="password" maxLength={6} placeholder="Enter PIN" className="w-full bg-gray-800 border-gray-700 text-white text-center text-lg tracking-widest py-2 px-3 rounded-lg outline-none" value={mpinData.pin} onChange={e => setMpinData({...mpinData, pin: e.target.value.replace(/\D/g, "")})} />
                    <button type="submit" disabled={markingMpin || !mpinData.id || mpinData.pin.length < 4} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg">
                      {markingMpin ? "Processing..." : "Mark Attendance"}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Recents */}
            <div className="flex-1 p-4 bg-gray-50/50 border-l border-gray-100 overflow-y-auto" style={{ height: 260 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Live Log</h3>
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div className="space-y-2">
                {recognitions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                    <Clock size={20} className="mb-1 opacity-20" />
                    <p className="text-[10px]">Awaiting detection...</p>
                  </div>
                ) : recognitions.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 shadow-sm animate-slide-in-right">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-600"><UserCheck size={14} /></div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-800 leading-none">{r.name}</p>
                        <p className="text-[9px] text-gray-500">{r.employee_id}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{r.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Today List */}
        <div className="card h-full flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-xs uppercase tracking-tight">Today's Presence</h2>
            <span className="badge-green text-[10px] font-bold">{todayList.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {todayList.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-xs">No entries yet</div>
            ) : todayList.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                {r.profile_photo 
                  ? <img src={r.profile_photo} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                  : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">{r.name[0]}</div>
                }
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{r.name || "Unknown Student"}</p>
                  <p className="text-[10px] text-gray-500">{r.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, label, value }) {
  return (
    <div className="stat-card">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0 shadow-sm`}>{icon}</div>
      <div className="min-w-0 text-left">
        <p className="text-2xl font-bold text-gray-800 truncate">{value}</p>
        <p className="text-xs text-gray-500 truncate font-medium">{label}</p>
      </div>
    </div>
  );
}
