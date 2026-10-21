import { cn } from "../utils/cn";
import { formatMs } from "../lib/solver";

export type StatusTone = "info" | "work" | "ok" | "bad";

export interface StatsPanelProps {
  n: number;
  visited: number;
  lastSquare: string | null;
  nodes: number | null;
  elapsedMs: number | null;
  toursDone: number;
  statusText: string;
  statusTone: StatusTone;
}

const toneText: Record<StatusTone, string> = {
  info: "text-ink-dim",
  work: "text-brass-300",
  ok: "text-ok",
  bad: "text-bad",
};
const toneDot: Record<StatusTone, string> = {
  info: "bg-ink-faint",
  work: "bg-brass-400 dot-work",
  ok: "bg-ok",
  bad: "bg-bad",
};

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line-soft bg-black/25 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-lg font-bold leading-tight",
          accent ? "text-brass-300" : "text-ink"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function StatsPanel(p: StatsPanelProps) {
  const total = p.n * p.n;
  const pct = total > 0 ? Math.round((p.visited / total) * 100) : 0;
  return (
    <section className="panel p-4">
      <h2 className="panel-title mb-3">Game status</h2>

      <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-line-soft bg-black/25 px-3 py-2.5">
        <span className={cn("status-dot", toneDot[p.statusTone])} />
        <span className={cn("text-[13px] font-semibold leading-snug", toneText[p.statusTone])}>
          {p.statusText}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            Board coverage
          </span>
          <span className="font-mono text-[12px] font-bold text-brass-300">
            {p.visited}/{total} · {pct}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full border border-line-soft bg-black/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brass-600 via-brass-400 to-brass-300 transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Current square" value={p.lastSquare ?? "\u2014"} accent />
        <Stat label="Tours completed" value={String(p.toursDone)} />
        <Stat label="Nodes explored" value={p.nodes === null ? "\u2014" : p.nodes.toLocaleString("en-US")} />
        <Stat label="Time" value={p.elapsedMs === null ? "\u2014" : formatMs(p.elapsedMs)} />
      </div>
    </section>
  );
}
