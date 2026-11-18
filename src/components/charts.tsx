"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const NAVY = "#3D5A8C";
const GOLD = "#C9962B";
const tooltipStyle = { borderRadius: 8, border: "1px solid #C2CFE3", fontSize: 12, color: "#101C33" };

interface RadarPoint {
  label: string;
  value: number | null;
  first?: number | null;
}

/** Radar delle 6 aree (scala 1-5). La linea tratteggiata è la prima osservazione. */
export function RadarChart({ data, height = 260 }: { data: RadarPoint[]; height?: number }) {
  const hasFirst = data.some((d) => d.first !== null && d.first !== undefined);
  const summary = data.map((d) => `${d.label} ${d.value === null ? "non valutata" : d.value.toFixed(1)}`).join(", ");
  return (
    <div role="img" aria-label={`Radar delle competenze: ${summary}`} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadar data={data.map((d) => ({ ...d, value: d.value ?? 0, first: d.first ?? 0 }))} outerRadius="72%">
          <PolarGrid stroke="#93A8C9" strokeOpacity={0.5} />
          <PolarAngleAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 12 }} />
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
          {hasFirst ? (
            <Radar name="Prima osservazione" dataKey="first" stroke={GOLD} strokeDasharray="4 4" fill="none" isAnimationActive={false} />
          ) : null}
          <Radar name="Valore attuale" dataKey="value" stroke={NAVY} strokeWidth={2} fill={NAVY} fillOpacity={0.28} isAnimationActive={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v.toFixed(1)} />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
}

/** Progressione dell'overall delle singole osservazioni approvate. */
export function ProgressChart({ data }: { data: { date: string; overall: number }[] }) {
  return (
    <div role="img" aria-label="Progressione dell'overall nel tempo" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#93A8C9" strokeOpacity={0.3} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "currentColor", fontSize: 11 }} />
          <YAxis domain={[40, 99]} tick={{ fill: "currentColor", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="overall" name="Overall" stroke={NAVY} strokeWidth={2} dot={{ r: 4, fill: GOLD, stroke: NAVY }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionChart({ data, label }: { data: { name: string; value: number }[]; label: string }) {
  const summary = data.map((d) => `${d.name} ${d.value}`).join(", ");
  return (
    <div role="img" aria-label={`${label}: ${summary}`} className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="#93A8C9" strokeOpacity={0.3} vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "currentColor", fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fill: "currentColor", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(61,90,140,.08)" }} />
          <Bar dataKey="value" name={label} fill={NAVY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
