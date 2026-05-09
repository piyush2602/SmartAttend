import { useRef, useCallback, useState } from "react";
import Webcam from "react-webcam";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

const VIDEO_CONSTRAINTS = {
  width: 640,
  height: 480,
  facingMode: "user",
};

export default function WebcamCapture({ onFrame, interval = 500, autoCapture = false }) {
  const webcamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const startCapture = useCallback(() => {
    setActive(true);
    if (autoCapture && onFrame) {
      intervalRef.current = setInterval(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) onFrame(imageSrc);
      }, interval);
    }
  }, [autoCapture, onFrame, interval]);

  const stopCapture = useCallback(() => {
    setActive(false);
    clearInterval(intervalRef.current);
  }, []);

  const captureOnce = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc && onFrame) onFrame(imageSrc);
    return imageSrc;
  }, [onFrame]);

  const handleError = () => setError("Camera access denied. Please allow camera permissions.");

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-lg aspect-video bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
        {active ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.85}
            videoConstraints={VIDEO_CONSTRAINTS}
            onUserMediaError={handleError}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-3">
            <CameraOff size={48} className="opacity-30" />
            <p className="text-sm">Camera inactive</p>
          </div>
        )}

        {/* Scanning overlay */}
        {active && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-[20%] inset-y-[10%] border-2 border-primary-500/60 rounded-2xl">
              <div className="absolute -top-px left-4 right-4 h-0.5 bg-primary-500 animate-bounce opacity-80" />
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-1.5">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-400 font-medium">LIVE</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <p className="text-red-400 text-sm px-6 text-center">{error}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {!active ? (
          <button onClick={startCapture} className="btn-primary flex items-center gap-2">
            <Camera size={16} /> Start Camera
          </button>
        ) : (
          <>
            <button onClick={stopCapture} className="btn-secondary flex items-center gap-2">
              <CameraOff size={16} /> Stop
            </button>
            {!autoCapture && (
              <button onClick={captureOnce} className="btn-primary flex items-center gap-2">
                <RefreshCw size={16} /> Capture Frame
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
