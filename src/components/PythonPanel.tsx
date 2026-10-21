import { useMemo, useState, type ReactElement } from "react";
import { PYTHON_SOURCE } from "../lib/pythonSource";

const KEYWORDS =
  /\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|try|except|finally|lambda|None|True|False|pass|break|continue|raise|with|is|global|nonlocal|yield)\b/;

const TOKEN_RE = new RegExp(
  "(" +
    [
      '"""',
      "'''",
      '"(?:[^"\\\\\\n]|\\\\.)*"',
      "'(?:[^'\\\\\\n]|\\\\.)*'",
      "#[^\\n]*",
      "\\b\\d[\\d_.]*\\b",
      KEYWORDS.source.slice(2, -2),
    ].join("|") +
    ")",
  "g"
);

interface TokState {
  inDoc: boolean;
}

function tokenizeLine(line: string, state: TokState, keyBase: string): ReactElement[] {
  const out: ReactElement[] = [];
  let rest = line;
  let k = 0;

  if (state.inDoc) {
    const end = rest.indexOf('"""');
    if (end === -1) {
      out.push(
        <span key={`${keyBase}-${k++}`} className="tok-str">
          {rest}
        </span>
      );
      return out;
    }
    out.push(
      <span key={`${keyBase}-${k++}`} className="tok-str">
        {rest.slice(0, end + 3)}
      </span>
    );
    rest = rest.slice(end + 3);
    state.inDoc = false;
  }

  TOKEN_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(rest)) !== null) {
    if (m.index > last) {
      out.push(<span key={`${keyBase}-${k++}`} className="tok-code">{rest.slice(last, m.index)}</span>);
    }
    const t = m[0];
    let cls = "tok-code";
    if (t.startsWith("#")) cls = "tok-com";
    else if (t === '"""' || t === "'''") {
      cls = "tok-str";
      state.inDoc = true;
    } else if (t.startsWith('"') || t.startsWith("'")) cls = "tok-str";
    else if (/^\d/.test(t)) cls = "tok-num";
    else cls = "tok-kw";
    out.push(
      <span key={`${keyBase}-${k++}`} className={cls}>
        {t}
      </span>
    );
    last = m.index + t.length;
    if (state.inDoc) break;
  }
  if (last < rest.length) {
    out.push(<span key={`${keyBase}-${k++}`} className="tok-code">{rest.slice(last)}</span>);
  }
  return out;
}

function highlight(code: string): ReactElement[] {
  const lines = code.replace(/\n$/, "").split("\n");
  const state: TokState = { inDoc: false };
  return lines.map((line, i) => (
    <div key={i} className="flex px-3 hover:bg-white/[0.03]">
      <span className="w-9 flex-none select-none pr-3 text-right text-ink-faint/60">{i + 1}</span>
      <span className="whitespace-pre">{tokenizeLine(line, state, `l${i}`)}</span>
    </div>
  ));
}

export function PythonPanel() {
  const [copied, setCopied] = useState(false);
  const rendered = useMemo(() => highlight(PYTHON_SOURCE), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PYTHON_SOURCE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const download = () => {
    const blob = new Blob([PYTHON_SOURCE], { type: "text/x-python;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "knights_tour.py";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title">Python version · tkinter</h2>
        <div className="flex gap-2">
          <button className="btn btn-ghost !px-2.5 !py-1 text-[11px]" onClick={copy}>
            {copied ? "Copied \u2713" : "Copy code"}
          </button>
          <button className="btn btn-brass !px-2.5 !py-1 text-[11px]" onClick={download}>
            Download .py
          </button>
        </div>
      </div>

      <p className="mb-3 text-[12px] leading-relaxed text-ink-dim">
        The same program with an integrated GUI, ready to run on your computer: it
        uses only the standard library. Save it and run{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-brass-300">
          python knights_tour.py
        </code>{" "}
        — then click a square and watch the knight complete the board.
      </p>

      <div className="code-block min-h-0 flex-1 py-2">{rendered}</div>
    </section>
  );
}
