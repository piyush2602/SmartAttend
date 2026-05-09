import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { registerFace, getUsers, getFaceSamples } from "../services/api";
import { Camera, CheckCircle, ArrowLeft, Loader2, RefreshCw, ScanFace, User } from "lucide-react";
import toast from "react-hot-toast";

const REQUIRED_FRAMES = 5;
const VIDEO_CONSTRAINTS = { width: 640, height: 480, facingMode: "user" };

export default function RegisterFacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const webcamRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(id || "");
  const [frames, setFrames] = useState([]);   // base64 images captured
  const [previews, setPreviews] = useState([]); // face crop previews returned by backend
  const [cameraOn, setCameraOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedSamples, setSavedSamples] = useState([]); // existing samples from DB

  // Load user list
  useEffect(() => {
    getUsers().then(res => setUsers(res.data)).catch(() => {});
  }, []);

  // Load already-registered samples when a user is selected
  useEffect(() => {
    if (!selectedId) { setSavedSamples([]); return; }
    getFaceSamples(selectedId)
      .then(res => setSavedSamples(res.data || []))
      .catch(() => setSavedSamples([]));
  }, [selectedId]);

  const selectedUser = users.find(u => u.id === selectedId);

  const capture = useCallback(() => {
    if (frames.length >= REQUIRED_FRAMES) { toast("All 5 frames captured!"); return; }
    const img = webcamRef.current?.getScreenshot();
    if (!img) { toast.error("Could not capture — ensure camera is active"); return; }
    setFrames(prev => {
      toast.success(`Frame ${prev.length + 1}/${REQUIRED_FRAMES} captured ✓`);
      return [...prev, img];
    });
  }, [frames.length]);

  const handleSave = async () => {
    if (!selectedId) { toast.error("Select a student first"); return; }
    if (frames.length === 0) { toast.error("Capture at least 1 frame"); return; }
    setSaving(true);
    try {
      const res = await registerFace(selectedId, frames);
      toast.success(`✅ ${res.data.message}`);
      if (res.data.errors?.length) {
        res.data.errors.forEach(e => toast(e, { icon: "⚠️" }));
      }
      setDone(true);
      // Refresh samples view
      const sampRes = await getFaceSamples(selectedId);
      setSavedSamples(sampRes.data || []);
      setTimeout(() => navigate("/users"), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed — face must be clearly visible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <button onClick={() => navigate("/users")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={15} /> Back to Students
      </button>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        {/* Left — camera capture */}
        <div className="md:col-span-3 card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <ScanFace size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">Face Registration</h2>
              <p className="text-xs text-gray-500">Capture {REQUIRED_FRAMES} frames · different angles work best</p>
            </div>
          </div>

          {/* Student selector */}
          {!id && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Student</label>
              <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setFrames([]); setDone(false); }}
                className="input text-sm">
                <option value="">-- Choose a student --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.employee_id})</option>
                ))}
              </select>
            </div>
          )}

          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
              {selectedUser.profile_photo
                ? <img src={selectedUser.profile_photo} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-blue-300" />
                : <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">{selectedUser.name[0]}</div>
              }
              <div>
                <p className="font-medium text-gray-800 text-sm">{selectedUser.name}</p>
                <p className="text-xs text-gray-500">{selectedUser.employee_id} · {selectedUser.department}</p>
              </div>
              {selectedUser.face_registered && (
                <span className="ml-auto badge-green text-xs"><CheckCircle size={11} /> Registered</span>
              )}
            </div>
          )}

          {/* Webcam */}
          <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-200">
            {cameraOn ? (
              <>
                <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.9}
                  videoConstraints={VIDEO_CONSTRAINTS} className="w-full h-full object-cover" />
                {/* Face guide overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-56 border-2 border-blue-400/70 rounded-full" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)" }} />
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs bg-black/40 py-1">
                  Center your face in the oval · {frames.length}/{REQUIRED_FRAMES} captured
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                <User size={40} className="opacity-20 mb-2" />
                <p className="text-sm text-gray-500">Start camera to begin</p>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          <div className="flex gap-2">
            {Array.from({ length: REQUIRED_FRAMES }).map((_, i) => (
              <div key={i} className={`flex-1 aspect-square rounded-lg overflow-hidden border-2 ${frames[i] ? "border-blue-500" : "border-gray-200"} bg-gray-100`}>
                {frames[i]
                  ? <img src={frames[i]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold">{i + 1}</div>
                }
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            {!cameraOn ? (
              <button onClick={() => setCameraOn(true)} className="btn-primary flex-1 text-sm py-2.5">
                <Camera size={15} /> Start Camera
              </button>
            ) : (
              <>
                <button onClick={capture} disabled={frames.length >= REQUIRED_FRAMES}
                  className="btn-primary flex-1 text-sm py-2.5 disabled:opacity-50">
                  <Camera size={15} /> Capture ({frames.length}/{REQUIRED_FRAMES})
                </button>
                <button onClick={() => setFrames([])} className="btn-secondary text-sm py-2.5 px-3">
                  <RefreshCw size={14} />
                </button>
              </>
            )}
          </div>

          {frames.length > 0 && (
            <button onClick={handleSave} disabled={saving || done}
              className="btn-primary w-full py-3 text-sm disabled:opacity-50">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Processing & saving...</>
               : done ? <><CheckCircle size={16} /> ✅ Registered! Redirecting...</>
               : <><CheckCircle size={16} /> Register {frames.length} Face Samples</>}
            </button>
          )}
        </div>

        {/* Right — stored samples */}
        <div className="md:col-span-2 card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Stored Face Samples</h3>
          {savedSamples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <ScanFace size={36} className="opacity-20" />
              <p className="text-xs text-center">No face samples stored yet.<br />Register face to see previews.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">{savedSamples.length} sample{savedSamples.length !== 1 ? "s" : ""} stored in MongoDB</p>
              <div className="grid grid-cols-2 gap-2">
                {savedSamples.map((s, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    {s.preview
                      ? <img src={s.preview} alt={`sample ${i + 1}`} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sample {i + 1}</div>
                    }
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center">These samples are used for recognition</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
