export default function StatCard({ icon: Icon, label, value, sub, color = "primary", trend }) {
  const colors = {
    primary: "from-primary-600/20 to-primary-800/5 border-primary-700/30 text-primary-400",
    green:   "from-green-600/20  to-green-800/5  border-green-700/30  text-green-400",
    yellow:  "from-yellow-600/20 to-yellow-800/5 border-yellow-700/30 text-yellow-400",
    blue:    "from-blue-600/20   to-blue-800/5   border-blue-700/30   text-blue-400",
    red:     "from-red-600/20    to-red-800/5    border-red-700/30    text-red-400",
  };

  return (
    <div className={`card bg-gradient-to-br ${colors[color]} hover:scale-[1.02] transition-transform duration-300 cursor-default`}>
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl bg-current/10`}>
          <Icon size={22} className={colors[color].split(" ").pop()} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
        <p className="text-sm font-medium text-gray-300 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
