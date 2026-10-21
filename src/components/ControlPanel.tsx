import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type Mode = "auto" | "manual";
export type AutoPhase = "idle" | "searching" | "running" | "paused" | "done" | "failed";

export interface ControlPanelProps {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  n: number;
  onSizeChange: (n: number) => void;
  speed: number;
  onSpeedChange: (v: number) => void;
  delayMs: number;
  wantClosed: boolean;
  onWantClosedChange: (v: boolean) => void;
  closedPossible: boolean;
  autoPhase: AutoPhase;
  onRandomStart: () => void;
  onPauseResume: () => void;
  onTurbo: () => void;
  onAutoRestart: () => void;
  onUndo: () => void;
  onHint: () => void;
  onManualRestart: () => void;
  showDegrees: boolean;
  onShowDegreesChange: (v: boolean) => void;
  canUndo: boolean;
  canHint: boolean;
}

const SIZES = [5, 6, 7, 8, 9, 10];

function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
          {label}
        </span>
        {hint && <span className="font-mono text-[11px] text-ink-dim">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function ControlPanel(p: ControlPanelProps) {
  const busy = p.autoPhase === "searching" || p.autoPhase === "running";
  return (
    <section className="panel p-4">
      <h2 className="panel-title mb-3">Controls</h2>
      <div className="space-y-4">
        <Row label="Mode">
          <div className="seg">
            <button
              className={cn("seg-btn", p.mode === "auto" && "seg-on")}
              onClick={() => p.onModeChange("auto")}
            >
              {"\u265E"} Solver
            </button>
            <button
              className={cn("seg-btn", p.mode === "manual" && "seg-on")}
              onClick={() => p.onModeChange("manual")}
            >
              Manual play
            </button>
          </div>
        </Row>

        <Row label="Board" hint={`${p.n}\u00D7${p.n} \u00B7 ${p.n * p.n} squares`}>
          <div className="flex gap-1.5">
            {SIZES.map((s) => (
              <button
                key={s}
                className={cn("size-btn", p.n === s && "size-on")}
                onClick={() => p.onSizeChange(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </Row>

        {p.mode === "auto" ? (
          <>
            <Row label="Animation speed" hint={`\u2248 ${p.delayMs} ms / move`}>
              <input
                type="range"
                min={1}
                max={100}
                value={p.speed}
                onChange={(e) => p.onSpeedChange(Number(e.target.value))}
              />
            </Row>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-line-soft bg-black/20 p-2.5">
              <div>
                <div className="text-[13px] font-bold text-ink">Closed tour</div>
                <div className="text-[11.5px] leading-snug text-ink-faint">
                  {p.closedPossible
                    ? "The last move returns to the starting square."
                    : `Impossible on ${p.n}\u00D7${p.n}: N must be even and \u2265 6 (Schwenk).`}
                </div>
              </div>
              <button
                aria-label="Toggle closed tour"
                className={cn("switch mt-0.5", p.wantClosed && "switch-on", !p.closedPossible && "opacity-40")}
                onClick={() => p.closedPossible && p.onWantClosedChange(!p.wantClosed)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-brass" onClick={p.onRandomStart} disabled={busy}>
                Random start
              </button>
              <button
                className="btn btn-ghost"
                onClick={p.onPauseResume}
                disabled={p.autoPhase !== "running" && p.autoPhase !== "paused"}
              >
                {p.autoPhase === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={p.onTurbo}
                disabled={p.autoPhase !== "running" && p.autoPhase !== "paused"}
              >
                Turbo {"\u21AF"}
              </button>
              <button className="btn btn-ghost" onClick={p.onAutoRestart}>
                Restart
              </button>
            </div>
            <p className="text-[11.5px] leading-snug text-ink-faint">
              Click any square on the board: the program searches for the full tour
              starting there and animates it move by move.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-line-soft bg-black/20 p-2.5">
              <div>
                <div className="text-[13px] font-bold text-ink">Show onward moves</div>
                <div className="text-[11.5px] leading-snug text-ink-faint">
                  Legal moves display their number of onward exits (Warnsdorff's rule):
                  favor the lowest number.
                </div>
              </div>
              <button
                aria-label="Toggle Warnsdorff degrees"
                className={cn("switch mt-0.5", p.showDegrees && "switch-on")}
                onClick={() => p.onShowDegreesChange(!p.showDegrees)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-brass" onClick={p.onHint} disabled={!p.canHint}>
                Suggest move
              </button>
              <button className="btn btn-ghost" onClick={p.onUndo} disabled={!p.canUndo}>
                Undo move
              </button>
              <button className="btn btn-ghost col-span-2" onClick={p.onManualRestart}>
                Restart
              </button>
            </div>
            <p className="text-[11.5px] leading-snug text-ink-faint">
              Click a starting square, then move the knight only with L-shaped moves
              to unvisited squares. Golden dots mark the legal moves.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
