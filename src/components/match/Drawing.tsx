"use client";

// Telestrazione su fermo immagine: forme vettoriali salvate in coordinate 0-1 rispetto al riquadro video.
import { useEffect, useRef, useState } from "react";
import type { Shape } from "@/lib/match";

export type Tool = Shape["type"];

export const TOOLS: { key: Tool; label: string }[] = [
  { key: "arrow", label: "Freccia" },
  { key: "line", label: "Linea" },
  { key: "circle", label: "Cerchio" },
  { key: "zone", label: "Zona" },
  { key: "free", label: "Mano libera" },
  { key: "text", label: "Testo" },
];

export const COLORS = ["#E0B04A", "#FFFFFF", "#EF4444", "#22C55E", "#3B82F6"];

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

function ShapeView({ s, w, h, id }: { s: Shape; w: number; h: number; id: string }) {
  const p = s.points.map((pt) => ({ x: pt.x * w, y: pt.y * h }));
  const stroke = { stroke: s.color, strokeWidth: 4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const [a, b] = [p[0], p[p.length - 1]];
  switch (s.type) {
    case "arrow":
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...stroke} markerEnd={`url(#${id}-${s.color.slice(1)})`} />;
    case "line":
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...stroke} strokeDasharray="10 8" />;
    case "circle":
      return <ellipse cx={a.x} cy={a.y} rx={Math.hypot(b.x - a.x, b.y - a.y)} ry={Math.hypot(b.x - a.x, b.y - a.y) * 0.45} {...stroke} />;
    case "zone":
      return (
        <rect
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          stroke={s.color}
          strokeWidth={3}
          fill={s.color}
          fillOpacity={0.22}
        />
      );
    case "free":
      return <polyline points={p.map((q) => `${q.x},${q.y}`).join(" ")} {...stroke} />;
    case "text":
      return (
        <text x={a.x} y={a.y} fill={s.color} fontSize={Math.max(14, h * 0.045)} fontWeight={700} stroke="#000" strokeWidth={0.8} paintOrder="stroke">
          {s.text}
        </text>
      );
  }
}

interface Props {
  shapes: Shape[];
  editable: boolean;
  tool: Tool;
  color: string;
  textValue?: string;
  onChange?: (shapes: Shape[]) => void;
}

export function DrawingLayer({ shapes, editable, tool, color, textValue, onChange }: Props) {
  const { ref, w, h } = useSize<HTMLDivElement>();
  const [draft, setDraft] = useState<Shape | null>(null);
  const id = "arrow";

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const down = (e: React.PointerEvent) => {
    if (!editable) return;
    e.preventDefault();
    const pt = pos(e);
    if (tool === "text") {
      const text = textValue?.trim().slice(0, 80);
      if (text) onChange?.([...shapes, { type: "text", color, points: [pt], text }]);
      return;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDraft({ type: tool, color, points: [pt, pt] });
  };
  const move = (e: React.PointerEvent) => {
    if (!draft) return;
    const pt = pos(e);
    setDraft(draft.type === "free" ? { ...draft, points: [...draft.points, pt].slice(-500) } : { ...draft, points: [draft.points[0], pt] });
  };
  const up = () => {
    if (!draft) return;
    const [a, b] = [draft.points[0], draft.points[draft.points.length - 1]];
    if (Math.hypot(a.x - b.x, a.y - b.y) > 0.01) onChange?.([...shapes, draft]);
    setDraft(null);
  };

  const all = draft ? [...shapes, draft] : shapes;
  return (
    <div
      ref={ref}
      className={`absolute inset-0 ${editable ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDraft(null)}
      aria-hidden={!editable}
    >
      {w > 0 ? (
        <svg width={w} height={h} className="absolute inset-0">
          <defs>
            {COLORS.map((c) => (
              <marker key={c} id={`${id}-${c.slice(1)}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0 0 10 5 0 10z" fill={c} />
              </marker>
            ))}
          </defs>
          {all.map((s, i) => (
            <ShapeView key={i} s={s} w={w} h={h} id={id} />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
