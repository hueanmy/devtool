import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Check } from 'lucide-react';

/* ─── Types ─── */

type DiffCategory = 'missing' | 'type_mismatch' | 'value_diff';
type LineHL = 'removed' | 'added' | 'type_mismatch' | null;

export interface DiffItem {
  path: string;
  category: DiffCategory;
  side?: 'left' | 'right'; // for 'missing': which side HAS the value
}

interface LineData {
  text: string;
  hl: LineHL;
}

interface Filters {
  missing: boolean;
  types: boolean;
  values: boolean;
}

/* ─── Diff Algorithm ─── */

export function findDiffs(a: any, b: any, path = ''): DiffItem[] {
  if (a === undefined && b === undefined) return [];
  if (a === undefined) return [{ path, category: 'missing', side: 'right' }];
  if (b === undefined) return [{ path, category: 'missing', side: 'left' }];

  const tA = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tB = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;

  if (tA !== tB) return [{ path, category: 'type_mismatch' }];
  if (a === null) return [];

  if (tA === 'array') {
    const r: DiffItem[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++)
      r.push(...findDiffs(a[i], b[i], `${path}[${i}]`));
    return r;
  }

  if (tA === 'object') {
    const r: DiffItem[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      r.push(...findDiffs(a[k], b[k], path ? `${path}.${k}` : k));
    return r;
  }

  return a !== b ? [{ path, category: 'value_diff' }] : [];
}

/* ─── Highlight Resolution ─── */

function resolveHL(
  path: string,
  map: Map<string, DiffItem>,
  side: 'left' | 'right',
  parentHL: LineHL,
  f: Filters,
): LineHL {
  if (parentHL) return parentHL;
  const d = map.get(path);
  if (!d) return null;
  if (d.category === 'missing') {
    if (!f.missing) return null;
    return d.side === side ? (side === 'left' ? 'removed' : 'added') : null;
  }
  if (d.category === 'type_mismatch') return f.types ? 'type_mismatch' : null;
  return f.values ? (side === 'left' ? 'removed' : 'added') : null;
}

/* ─── JSON → Annotated Lines ─── */

function buildLines(
  v: any,
  path: string,
  map: Map<string, DiffItem>,
  side: 'left' | 'right',
  ind: number,
  parentHL: LineHL,
  f: Filters,
): LineData[] {
  const h = resolveHL(path, map, side, parentHL, f);
  const pad = '  '.repeat(ind);

  // Primitive
  if (v === null || typeof v !== 'object') {
    return [{ text: `${pad}${JSON.stringify(v)}`, hl: h }];
  }

  // Array
  if (Array.isArray(v)) {
    if (!v.length) return [{ text: `${pad}[]`, hl: h }];
    const out: LineData[] = [{ text: `${pad}[`, hl: h }];
    v.forEach((item, i) => {
      const cl = buildLines(item, `${path}[${i}]`, map, side, ind + 1, h, f);
      if (i < v.length - 1 && cl.length) cl[cl.length - 1] = { ...cl[cl.length - 1], text: cl[cl.length - 1].text + ',' };
      out.push(...cl);
    });
    out.push({ text: `${pad}]`, hl: h });
    return out;
  }

  // Object
  const entries = Object.entries(v);
  if (!entries.length) return [{ text: `${pad}{}`, hl: h }];

  const out: LineData[] = [{ text: `${pad}{`, hl: h }];
  entries.forEach(([k, val], i) => {
    const cp = path ? `${path}.${k}` : k;
    const cl = buildLines(val, cp, map, side, ind + 1, h, f);
    const keyStr = `${'  '.repeat(ind + 1)}${JSON.stringify(k)}: `;
    if (cl.length) cl[0] = { ...cl[0], text: keyStr + cl[0].text.trimStart() };
    if (i < entries.length - 1 && cl.length) cl[cl.length - 1] = { ...cl[cl.length - 1], text: cl[cl.length - 1].text + ',' };
    out.push(...cl);
  });
  out.push({ text: `${pad}}`, hl: h });
  return out;
}

/* ─── Syntax Highlight ─── */

function syntaxHL(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(?:\\.|[^"\\])*")(\s*:)|("(?:\\.|[^"\\])*")|(true|false)|(null)|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
      (_, k, c, s, b, n, num) => {
        if (k) return `<span style="color:#1d4ed8;font-weight:600">${k}</span>${c}`;
        if (s) return `<span style="color:#059669">${s}</span>`;
        if (b) return `<span style="color:#7c3aed">${b}</span>`;
        if (n) return `<span style="color:#64748b">${n}</span>`;
        if (num) return `<span style="color:#ea580c">${num}</span>`;
        return _;
      },
    );
}

/* ─── Line Background ─── */

const LINE_BG: Record<string, string> = {
  removed: 'bg-red-100/70',
  added: 'bg-emerald-100/70',
  type_mismatch: 'bg-sky-100/70',
};

const LINE_BORDER: Record<string, string> = {
  removed: 'border-l-[3px] border-l-red-400',
  added: 'border-l-[3px] border-l-emerald-500',
  type_mismatch: 'border-l-[3px] border-l-sky-400',
};

/* ─── Panel Component ─── */

function Panel({
  label,
  labelColor,
  data,
  scrollRef,
  onScroll,
}: {
  label: string;
  labelColor: string;
  data: LineData[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}) {
  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className={`px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest ${labelColor}`}>
        {label}
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {data.map((line, i) => {
              const bg = line.hl ? LINE_BG[line.hl] : '';
              const border = line.hl ? LINE_BORDER[line.hl] : 'border-l-[3px] border-l-transparent';
              return (
                <tr key={i} className={`${bg} ${border}`}>
                  <td className="w-10 text-right pr-3 pl-2 text-slate-400 select-none text-[11px] font-mono leading-[1.7] align-top whitespace-nowrap">
                    {i + 1}.
                  </td>
                  <td className="pr-4">
                    <pre
                      className="font-mono text-[13px] leading-[1.7] whitespace-pre"
                      dangerouslySetInnerHTML={{ __html: syntaxHL(line.text) }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Main Component (result-only) ─── */

interface JsonDiffV2Props {
  a: any;
  b: any;
  diffs: DiffItem[];
}

export default function JsonDiffV2({ a, b, diffs }: JsonDiffV2Props) {
  const [filters, setFilters] = useState<Filters>({ missing: true, types: true, values: true });

  // Scroll sync refs
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const syncScroll = useCallback((source: 'left' | 'right') => {
    if (syncing.current) return;
    syncing.current = true;
    const s = source === 'left' ? leftRef.current : rightRef.current;
    const t = source === 'left' ? rightRef.current : leftRef.current;
    if (s && t) {
      t.scrollTop = s.scrollTop;
      t.scrollLeft = s.scrollLeft;
    }
    requestAnimationFrame(() => { syncing.current = false; });
  }, []);

  const display = useMemo(() => {
    const map = new Map<string, DiffItem>(diffs.map(d => [d.path, d]));
    return {
      left: buildLines(a, '', map, 'left', 0, null, filters),
      right: buildLines(b, '', map, 'right', 0, null, filters),
    };
  }, [a, b, diffs, filters]);

  const stats = useMemo(() => ({
    total: diffs.length,
    missing: diffs.filter(x => x.category === 'missing').length,
    types: diffs.filter(x => x.category === 'type_mismatch').length,
    values: diffs.filter(x => x.category === 'value_diff').length,
  }), [diffs]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Summary bar */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-x-8 gap-y-3">
        <span className="text-sm font-black text-slate-700">
          Found <span className="text-blue-600">{stats.total}</span> difference{stats.total !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-6 text-xs font-bold">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.missing}
              onChange={e => setFilters(f => ({ ...f, missing: e.target.checked }))}
              className="accent-red-500 w-3.5 h-3.5"
            />
            <span className="text-red-600">{stats.missing} missing properties</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.types}
              onChange={e => setFilters(f => ({ ...f, types: e.target.checked }))}
              className="accent-sky-500 w-3.5 h-3.5"
            />
            <span className="text-sky-600">{stats.types} incorrect types</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.values}
              onChange={e => setFilters(f => ({ ...f, values: e.target.checked }))}
              className="accent-amber-500 w-3.5 h-3.5"
            />
            <span className="text-amber-600">{stats.values} unequal values</span>
          </label>
        </div>
      </div>

      {/* Side-by-side panels */}
      {stats.total === 0 ? (
        <div className="p-12 text-center">
          <Check size={32} className="mx-auto mb-3 text-emerald-400" />
          <p className="text-sm font-bold text-emerald-600">No differences — JSON objects are identical</p>
        </div>
      ) : (
        <div className="flex border-t border-slate-200" style={{ maxHeight: '65vh' }}>
          <div className="flex-1 border-r border-slate-200 overflow-hidden flex flex-col">
            <Panel
              label="Before"
              labelColor="text-red-500"
              data={display.left}
              scrollRef={leftRef}
              onScroll={() => syncScroll('left')}
            />
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <Panel
              label="After"
              labelColor="text-emerald-600"
              data={display.right}
              scrollRef={rightRef}
              onScroll={() => syncScroll('right')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
