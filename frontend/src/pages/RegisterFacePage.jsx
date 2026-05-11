import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import { registerFace, getUsers, getFaceSamples, enrollFingerprint, updateUser } from "../services/api";
import { Camera, CheckCircle, ArrowLeft, Loader2, RefreshCw, ScanFace, User, Fingerprint, Info, Search, Key } from "lucide-react";
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
  const [cameraOn, setCameraOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [savedSamples, setSavedSamples] = useState([]); // existing samples from DB
  const [activeTab, setActiveTab] = useState("face"); // "face", "finger", "mpin"
  const [fingerStatus, setFingerStatus] = useState("idle"); // "idle", "waiting", "success", "error"
  const [searchQuery, setSearchQuery] = useState({ name: "", id: "", department: "" });
  const [mpin, setMpin] = useState("");
  const [updatingMpin, setUpdatingMpin] = useState(false);

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
      const sampRes = await getFaceSamples(selectedId);
      setSavedSamples(sampRes.data || []);
      setTimeout(() => navigate("/users"), 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || "Registration failed — face must be clearly visible");
    } finally {
      setSaving(false);
    }
  };

  const handleFingerEnroll = async () => {
    if (!selectedId) return toast.error("Select a student first");
    setFingerStatus("waiting");
    try {
      const res = await enrollFingerprint(selectedId);
      toast.success(res.data.message);
      setFingerStatus("success");
      const uRes = await getUsers();
      setUsers(uRes.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Fingerprint enrollment failed");
      setFingerStatus("error");
    }
  };

  const handleMpinSave = async () => {
    if (!selectedId) return toast.error("Select a student first");
    if (mpin.length < 4) return toast.error("MPIN must be at least 4 digits");
    setUpdatingMpin(true);
    try {
      await updateUser(selectedId, { mpin });
      toast.success("MPIN updated successfully");
      const uRes = await getUsers();
      setUsers(uRes.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update MPIN");
    } finally {
      setUpdatingMpin(false);
    }
  };

  const generateRandomMpin = () => {
    const randomPin = Math.floor(10000 + Math.random() * 90000).toString();
    setMpin(randomPin);
    toast.success("Random 5-digit PIN generated");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <button onClick={() => navigate("/users")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={15} /> Back to Students
      </button>

      <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm w-fit">
        <button onClick={() => { setActiveTab("face"); setDone(false); }}
          className={`px-6 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "face" ? "bg-blue-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}>
          <div className="flex items-center gap-2"><ScanFace size={14} /> Face Registration</div>
        </button>
        <button onClick={() => { setActiveTab("finger"); setDone(false); }}
          className={`px-6 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "finger" ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}>
          <div className="flex items-center gap-2"><Fingerprint size={14} /> Fingerprint Registration</div>
        </button>
        <button onClick={() => { setActiveTab("mpin"); setDone(false); }}
          className={`px-6 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "mpin" ? "bg-amber-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}>
          <div className="flex items-center gap-2"><Key size={14} /> MPIN Setup</div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        {/* Left Side */}
        <div className="md:col-span-3 card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${activeTab === "face" ? "bg-blue-50 text-blue-600" : activeTab === "finger" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}>
              {activeTab === "face" ? <ScanFace size={20} /> : activeTab === "finger" ? <Fingerprint size={20} /> : <Key size={20} />}
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm">
                {activeTab === "face" ? "Face Registration" : activeTab === "finger" ? "Fingerprint Registration" : "MPIN Registration"}
              </h2>
              <p className="text-xs text-gray-500">
                {activeTab === "face" ? `Capture ${REQUIRED_FRAMES} frames from different angles` : activeTab === "finger" ? "Enroll via the connected hardware scanner" : "Set a secure numeric PIN for attendance"}
              </p>
            </div>
          </div>

          {!id && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <Search size={10} /> Search & Filter
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input 
                  type="text" 
                  placeholder="Name..." 
                  className="input text-[11px] py-1.5"
                  value={searchQuery.name}
                  onChange={e => setSearchQuery({...searchQuery, name: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="ID..." 
                  className="input text-[11px] py-1.5"
                  value={searchQuery.id}
                  onChange={e => setSearchQuery({...searchQuery, id: e.target.value})}
                />
                <input 
                  type="text" 
                  placeholder="Dept..." 
                  className="input text-[11px] py-1.5"
                  value={searchQuery.department}
                  onChange={e => setSearchQuery({...searchQuery, department: e.target.value})}
                />
              </div>
              
              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-gray-500">Select Student from Results</label>
                <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setFrames([]); setDone(false); setFingerStatus("idle"); }}
                  className="input text-sm">
                  <option value="">-- Choose a student --</option>
                  {users
                    .filter(u => 
                      u.name.toLowerCase().includes(searchQuery.name.toLowerCase()) &&
                      u.employee_id.toLowerCase().includes(searchQuery.id.toLowerCase()) &&
                      u.department.toLowerCase().includes(searchQuery.department.toLowerCase())
                    )
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.employee_id}) - {u.department}</option>
                    ))
                  }
                </select>
              </div>
            </div>
          )}

          {selectedUser && (
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${activeTab === "face" ? "bg-blue-50 border-blue-100" : "bg-indigo-50 border-indigo-100"}`}>
              {selectedUser.profile_photo
                ? <img src={selectedUser.profile_photo} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-blue-300" />
                : <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">{selectedUser.name[0]}</div>
              }
              <div>
                <p className="font-medium text-gray-800 text-sm">{selectedUser.name}</p>
                <p className="text-xs text-gray-500">{selectedUser.employee_id} · {selectedUser.department}</p>
              </div>
              <div className="ml-auto flex gap-1">
                {selectedUser.face_registered && (
                  <span className="badge-green text-[10px]"><CheckCircle size={10} /> Face OK</span>
                )}
                {selectedUser.fingerprint_registered && (
                  <span className="badge-green text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200"><Fingerprint size={10} /> Finger OK</span>
                )}
                {selectedUser.mpin && (
                  <span className="badge-green text-[10px] bg-amber-100 text-amber-700 border-amber-200"><Key size={10} /> MPIN OK</span>
                )}
              </div>
            </div>
          )}

          {activeTab === "face" ? (
            <div className="space-y-4">
              <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-200">
                {cameraOn ? (
                  <>
                    <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.9}
                      videoConstraints={VIDEO_CONSTRAINTS} className="w-full h-full object-cover" />
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
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</>
                   : done ? <><CheckCircle size={16} /> ✅ Registered!</>
                   : <><CheckCircle size={16} /> Register Face Samples</>}
                </button>
              )}
            </div>
          ) : activeTab === "finger" ? (
            <div className="space-y-6">
              <div className="bg-indigo-50 rounded-2xl p-10 flex flex-col items-center justify-center border border-indigo-100 gap-4">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
                  fingerStatus === "waiting" ? "bg-indigo-200 animate-pulse scale-110" : 
                  fingerStatus === "success" ? "bg-green-100 text-green-600" : 
                  "bg-white text-indigo-400 shadow-sm"
                }`}>
                  <Fingerprint size={48} />
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-gray-800">
                    {fingerStatus === "idle" ? "Ready to Enroll" :
                     fingerStatus === "waiting" ? "Sensor Active" :
                     fingerStatus === "success" ? "Enrolled Successfully" : "Enrollment Failed"}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                    {fingerStatus === "idle" ? "Click below to start enrollment on the scanner." :
                     fingerStatus === "waiting" ? "Please place your finger on the scanner." :
                     fingerStatus === "success" ? "Registration complete." : "Please try again."}
                  </p>
                </div>
              </div>

              <button 
                onClick={handleFingerEnroll} 
                disabled={fingerStatus === "waiting" || !selectedId}
                className="btn-primary w-full py-3 bg-indigo-600 hover:bg-indigo-700 border-indigo-600 disabled:opacity-50"
              >
                {fingerStatus === "waiting" ? <><Loader2 size={16} className="animate-spin" /> Waiting for Scanner...</> : "Start Enrollment"}
              </button>

              <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg text-[10px] text-gray-500 italic">
                <Info size={12} className="shrink-0 mt-0.5" />
                <span>Make sure the fingerprint scanner is connected to the server before starting.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-amber-50 rounded-2xl p-8 flex flex-col items-center justify-center border border-amber-100 gap-4">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-amber-600 shadow-sm border border-amber-100">
                  <Key size={32} />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="font-semibold text-gray-800">Set Student MPIN</h4>
                  <p className="text-xs text-gray-500">A numeric PIN that the student can use at the kiosk</p>
                </div>
                
                <div className="w-full max-w-[200px] flex flex-col gap-3">
                  <input 
                    type="text" 
                    maxLength={5}
                    placeholder="Enter 5-digit PIN"
                    className="input text-center text-2xl tracking-[0.5em] font-bold py-3"
                    value={mpin}
                    onChange={e => setMpin(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                  <button 
                    onClick={generateRandomMpin}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 py-1 px-2 rounded-lg border border-amber-100 transition-colors"
                  >
                    Generate Random 5-Digit PIN
                  </button>
                </div>
              </div>

              <button 
                onClick={handleMpinSave} 
                disabled={updatingMpin || !selectedId || mpin.length !== 5}
                className="btn-primary w-full py-3 bg-amber-600 hover:bg-amber-700 border-amber-600 disabled:opacity-50"
              >
                {updatingMpin ? <><Loader2 size={16} className="animate-spin" /> Saving PIN...</> : "Save 5-Digit MPIN"}
              </button>

              <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg text-[10px] text-gray-500 italic">
                <Info size={12} className="shrink-0 mt-0.5" />
                <span>The MPIN should be unique and easy for the student to remember.</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side — Stored Samples (Only for Face) */}
        <div className="md:col-span-2 card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Stored Face Samples</h3>
          {savedSamples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <ScanFace size={36} className="opacity-20" />
              <p className="text-xs text-center">No samples stored yet.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">{savedSamples.length} sample{savedSamples.length !== 1 ? "s" : ""} in DB</p>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
