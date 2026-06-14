import { ChartColumn, Earth, Star, Users } from "lucide-react";

const STATS = [
  { icon: Users, value: "1M+", label: "Active traders" },
  { icon: ChartColumn, value: "$2B+", label: "Total traded" },
  { icon: Earth, value: "150+", label: "Countries" },
  { icon: Star, value: "4.9/5", label: "User rating" },
];

export function Stats() {
  return (
    <section
      className="border-y border-white/[0.07]"
      style={{
        background: "linear-gradient(135deg, rgba(59,130,246,.06), rgba(0,212,170,.04))",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-10 sm:py-14 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="text-center">
              <Icon className="w-6 h-6 mx-auto mb-3" style={{ color: "#3B82F6" }} />
              <div className="text-3xl md:text-4xl font-extrabold mb-1 text-white">{value}</div>
              <div className="text-sm text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
