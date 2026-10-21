import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { algebraic } from "../lib/solver";

export interface MoveLogProps {
  n: number;
  /** visible path (flat indices), in visit order */
  path: number[];
  emptyText: string;
  completed: boolean;
}

export function MoveLog({ n, path, emptyText, completed }: MoveLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [path.length]);

  const copyLog = async () => {
    const text = path
      .map((idx, i) =>
        i === 0
          ? `1. ${algebraic(idx, n)} (start)`
          : `${i + 1}. ${algebraic(path[i - 1], n)} \u2192 ${algebraic(idx, n)}`
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="panel flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="panel-title">Move log</h2>
        <button className="btn btn-ghost !px-2.5 !py-1 text-[11px]" onClick={copyLog} disabled={path.length === 0}>
          {copied ? "Copied \u2713" : "Copy"}
        </button>
      </div>

      {path.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-line-soft bg-black/15 p-6 text-center">
          <p className="max-w-[28ch] text-[12.5px] leading-relaxed text-ink-faint">{emptyText}</p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1" style={{ maxHeight: 420 }}>
            <ol className="space-y-0.5">
              {path.map((idx, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-[3px] font-mono text-[12px] transition-colors",
                    i === path.length - 1
                      ? "bg-brass-500/15 text-brass-200"
                      : "text-ink-dim odd:bg-white/[0.025]"
                  )}
                >
                  <span className="w-7 text-right text-[11px] text-ink-faint">{i + 1}.</span>
                  {i === 0 ? (
                    <span className="font-bold text-brass-300">
                      {algebraic(idx, n)}
                      <span className="ml-2 font-body text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
                        start
                      </span>
                    </span>
                  ) : (
                    <span>
                      <span className="text-ink-faint">{algebraic(path[i - 1], n)}</span>
                      <span className="mx-1.5 text-brass-500">{"\u2192"}</span>
                      <span className={cn(i === path.length - 1 && "font-bold")}>{algebraic(idx, n)}</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
          {completed && (
            <div className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-center text-[12px] font-bold text-ok">
              Tour complete: {path.length} squares visited exactly once {"\u265E"}
            </div>
          )}
        </>
      )}
    </section>
  );
}
