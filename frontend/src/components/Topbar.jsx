import { Bell, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

export default function Topbar({ title }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-4 text-gray-400">
        <div className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-400 px-2.5 py-1 rounded-full border border-green-500/20">
          <Wifi size={12} />
          <span>Online</span>
        </div>
        <span className="text-sm font-mono text-gray-400">
          {time.toLocaleTimeString()}
        </span>
        <button className="relative p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          <Bell size={18} />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-primary-500 rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
