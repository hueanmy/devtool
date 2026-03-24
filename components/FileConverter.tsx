import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Download, ArrowRight, X, Image, Code2, Binary,
  RefreshCw, Loader2, CheckCircle2, AlertCircle, Copy, Check,
} from 'lucide-react';
import {
  convertImage, convertData, fileToBase64, base64ToBlob, formatSize,
  type ImageFormat, type DataFormat,
} from '../utils/fileConverter';

// ── Types ──

type ConversionCategory = 'image' | 'data' | 'encode';

interface ConvertedFile {
  id: string;
  originalName: string;
  originalSize: number;
  resultBlob: Blob;
  resultName: string;
  resultSize: number;
  status: 'done' | 'error';
  error?: string;
  previewUrl?: string;
}

interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'converting' | 'done' | 'error';
  error?: string;
  result?: ConvertedFile;
}

// ── Constants ──

const IMAGE_FORMATS: { value: ImageFormat; label: string; ext: string }[] = [
  { value: 'png', label: 'PNG', ext: '.png' },
  { value: 'jpeg', label: 'JPG', ext: '.jpg' },
  { value: 'webp', label: 'WebP', ext: '.webp' },
  { value: 'bmp', label: 'BMP', ext: '.bmp' },
  { value: 'avif', label: 'AVIF', ext: '.avif' },
];

const IMAGE_OUTPUT_OPTIONS: { id: string; label: string; value?: ImageFormat }[] = [
  { id: 'png', label: 'PNG', value: 'png' },
  { id: 'jpeg', label: 'JPG / JPEG', value: 'jpeg' },
  { id: 'webp', label: 'WEBP', value: 'webp' },
  { id: 'bmp', label: 'BMP', value: 'bmp' },
  { id: 'avif', label: 'AVIF', value: 'avif' },
  { id: 'svg', label: 'SVG' },
  { id: 'gif', label: 'GIF' },
  { id: 'ico', label: 'ICO' },
  { id: 'dds', label: 'DDS' },
  { id: 'tiff', label: 'TIFF' },
  { id: 'cur', label: 'CUR' },
  { id: 'psd', label: 'PSD' },
  { id: 'wbmp', label: 'WBMP' },
  { id: 'hdr', label: 'HDR' },
  { id: 'heic', label: 'HEIC' },
];

const DATA_FORMATS: { value: DataFormat; label: string; ext: string }[] = [
  { value: 'json', label: 'JSON', ext: '.json' },
  { value: 'csv', label: 'CSV', ext: '.csv' },
  { value: 'tsv', label: 'TSV', ext: '.tsv' },
  { value: 'xml', label: 'XML', ext: '.xml' },
  { value: 'yaml', label: 'YAML', ext: '.yaml' },
];

const DATA_MIME: Record<DataFormat, string> = {
  json: 'application/json;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  xml: 'application/xml;charset=utf-8',
  yaml: 'application/x-yaml;charset=utf-8',
};

const CATEGORIES: { id: ConversionCategory; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'image', label: 'Image', icon: <Image size={16} />, desc: 'PNG, JPG, WebP, BMP' },
  { id: 'data', label: 'Data', icon: <Code2 size={16} />, desc: 'JSON, CSV, XML, YAML, TSV' },
  { id: 'encode', label: 'Encode', icon: <Binary size={16} />, desc: 'File ↔ Base64' },
];

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/bmp,image/avif,image/gif,image/svg+xml,image/tiff,image/heic,image/heif,image/vnd.adobe.photoshop,image/x-icon,image/vnd.microsoft.icon,.png,.jpg,.jpeg,.webp,.bmp,.gif,.svg,.ico,.dds,.tiff,.tif,.avif,.cur,.psd,.wbmp,.hdr,.heic,.heif';
const DATA_ACCEPT = '.json,.csv,.tsv,.xml,.yaml,.yml';

let idCounter = 0;
const uid = () => `fc_${++idCounter}_${Date.now()}`;

// ── Example data ──

const EXAMPLE_BASE64 = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzNiODJmNiIgcng9IjE2Ii8+PHRleHQgeD0iNTAiIHk9IjU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxNCIgZm9udC1mYW1pbHk9InN5c3RlbS11aSI+RGV2VG9vbDwvdGV4dD48L3N2Zz4=`;

// ── Component ──

const FileConverter: React.FC = () => {
  const [category, setCategory] = useState<ConversionCategory>('image');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [results, setResults] = useState<ConvertedFile[]>([]);
  const [converting, setConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [supportsAvifOutput, setSupportsAvifOutput] = useState(false);

  // Image options
  const [imgTarget, setImgTarget] = useState<ImageFormat>('webp');
  const [imgQuality, setImgQuality] = useState(92);
  const [imgMaxWidth, setImgMaxWidth] = useState<number | ''>('');
  const [imgMaxHeight, setImgMaxHeight] = useState<number | ''>('');

  // Data options
  const [dataFrom, setDataFrom] = useState<DataFormat>('json');
  const [dataTo, setDataTo] = useState<DataFormat>('csv');

  // Encode options
  const [encodeMode, setEncodeMode] = useState<'toBase64' | 'fromBase64'>('toBase64');
  const [base64Input, setBase64Input] = useState('');
  const [base64Output, setBase64Output] = useState('');

  // Data text mode
  const [dataTextInput, setDataTextInput] = useState('');
  const [dataTextOutput, setDataTextOutput] = useState('');
  const [copiedDataOutput, setCopiedDataOutput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──

  useEffect(() => {
    let active = true;

    const detectAvifSupport = async () => {
      try {
        if (typeof OffscreenCanvas !== 'undefined') {
          const canvas = new OffscreenCanvas(1, 1);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            if (active) setSupportsAvifOutput(false);
            return;
          }
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, 1, 1);
          const blob = await canvas.convertToBlob({ type: 'image/avif', quality: 0.8 });
          if (active) setSupportsAvifOutput(blob.type === 'image/avif' && blob.size > 0);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.toBlob) {
          if (active) setSupportsAvifOutput(false);
          return;
        }
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 1, 1);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/avif', 0.8));
        if (active) setSupportsAvifOutput(Boolean(blob && blob.type === 'image/avif' && blob.size > 0));
      } catch {
        if (active) setSupportsAvifOutput(false);
      }
    };

    detectAvifSupport();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supportsAvifOutput && imgTarget === 'avif') {
      setImgTarget('webp');
    }
  }, [supportsAvifOutput, imgTarget]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const items: QueueItem[] = Array.from(files).map(file => ({
      id: uid(),
      file,
      status: 'pending' as const,
    }));
    setQueue(prev => [...prev, ...items]);
  }, []);

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const clearAll = () => {
    setQueue([]);
    setConversionProgress(0);
    setResults(prev => {
      prev.forEach(r => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
      return [];
    });
  };

  // ── Drop handler ──

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // ── Conversion ──

  const handleConvert = async () => {
    const pending = queue.filter(q => q.status === 'pending');
    if (pending.length === 0) return;
    setConverting(true);
    setConversionProgress(0);
    const totalItems = pending.length;
    let completedItems = 0;
    const pendingIds = new Set(pending.map(item => item.id));
    setQueue(prev => prev.map(q => pendingIds.has(q.id) ? { ...q, status: 'converting' } : q));
    const outcomes: Array<{ id: string; converted?: ConvertedFile; error?: string }> = [];

    for (const item of pending) {
      try {
        let resultBlob: Blob;
        let resultName: string;

        if (category === 'image') {
          const { blob } = await convertImage(
            item.file,
            imgTarget,
            imgQuality / 100,
            imgMaxWidth || undefined,
            imgMaxHeight || undefined,
          );
          resultBlob = blob;
          const baseName = item.file.name.replace(/\.[^.]+$/, '');
          const ext = IMAGE_FORMATS.find(f => f.value === imgTarget)!.ext;
          resultName = `${baseName}${ext}`;
        } else if (category === 'data') {
          const text = await item.file.text();
          const output = convertData(text, dataFrom, dataTo);
          const ext = DATA_FORMATS.find(f => f.value === dataTo)!.ext;
          resultBlob = new Blob([output], { type: 'text/plain;charset=utf-8' });
          const baseName = item.file.name.replace(/\.[^.]+$/, '');
          resultName = `${baseName}${ext}`;
        } else {
          throw new Error('Unsupported category');
        }

        const converted: ConvertedFile = {
          id: uid(),
          originalName: item.file.name,
          originalSize: item.file.size,
          resultBlob,
          resultName,
          resultSize: resultBlob.size,
          status: 'done',
          previewUrl: category === 'image' ? URL.createObjectURL(resultBlob) : undefined,
        };

        outcomes.push({ id: item.id, converted });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Conversion failed';
        outcomes.push({ id: item.id, error });
      } finally {
        completedItems += 1;
        setConversionProgress(Math.min(100, Math.round((completedItems / totalItems) * 100)));
      }
    }

    const outcomeById = new Map(outcomes.map(outcome => [outcome.id, outcome]));
    const convertedResults = outcomes
      .map(outcome => outcome.converted)
      .filter((result): result is ConvertedFile => Boolean(result));

    if (convertedResults.length > 0) {
      setResults(prev => [...prev, ...convertedResults]);
    }

    setQueue(prev => prev.map(q => {
      const outcome = outcomeById.get(q.id);
      if (!outcome) return q;
      if (outcome.converted) {
        return { ...q, status: 'done', result: outcome.converted, error: undefined };
      }
      return { ...q, status: 'error', error: outcome.error ?? 'Conversion failed' };
    }));

    setConversionProgress(100);
    setConverting(false);
  };

  // ── Load examples ──

  const loadBase64Example = () => {
    if (encodeMode === 'fromBase64') {
      setBase64Input(EXAMPLE_BASE64);
      setBase64Output('');
    } else {
      const svg = atob(EXAMPLE_BASE64.split(',')[1]);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const file = new File([blob], 'example.svg', { type: 'image/svg+xml' });
      addFiles([file]);
    }
  };

  // ── Data text convert (no file) ──

  const handleDataTextConvert = () => {
    const input = dataTextInput ?? '';
    try {
      const output = convertData(input, dataFrom, dataTo);
      setDataTextOutput(output);

      const fromExt = DATA_FORMATS.find(f => f.value === dataFrom)?.ext || '.txt';
      const toExt = DATA_FORMATS.find(f => f.value === dataTo)?.ext || '.txt';
      const resultBlob = new Blob([output], { type: DATA_MIME[dataTo] || 'text/plain;charset=utf-8' });

      const converted: ConvertedFile = {
        id: uid(),
        originalName: `pasted-input${fromExt}`,
        originalSize: new Blob([input], { type: 'text/plain;charset=utf-8' }).size,
        resultBlob,
        resultName: `converted${toExt}`,
        resultSize: resultBlob.size,
        status: 'done',
      };

      setResults(prev => [converted, ...prev]);
    } catch (err) {
      setDataTextOutput(`Error: ${err instanceof Error ? err.message : 'Conversion failed'}`);
    }
  };

  const handleCopyDataOutput = async () => {
    if (!dataTextOutput) return;
    try {
      await navigator.clipboard.writeText(dataTextOutput);
      setCopiedDataOutput(true);
      window.setTimeout(() => setCopiedDataOutput(false), 1200);
    } catch {
      setCopiedDataOutput(false);
    }
  };

  // ── Base64 ──

  const handleBase64Convert = async () => {
    if (encodeMode === 'toBase64') {
      const pending = queue.filter(q => q.status === 'pending');
      if (pending.length === 0) return;
      const file = pending[0].file;
      const b64 = await fileToBase64(file);
      setBase64Output(b64);
      setQueue(prev => prev.map(q => q.id === pending[0].id ? { ...q, status: 'done' } : q));
    } else {
      try {
        const input = base64Input ?? '';
        const blob = base64ToBlob(input);
        const ext = input.match(/data:([^;]+)/)?.[1]?.split('/')[1] || 'bin';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `decoded.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setBase64Output(`Error: ${err instanceof Error ? err.message : 'Invalid base64'}`);
      }
    }
  };

  // ── Download helpers ──

  const downloadResult = (r: ConvertedFile) => {
    const url = URL.createObjectURL(r.resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.resultName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    for (const r of results) downloadResult(r);
  };

  const clearResults = () => {
    setResults(prev => {
      prev.forEach(r => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
      return [];
    });
    setBase64Output('');
  };

  // ── Accept string for file input ──

  const getAccept = () => {
    if (category === 'image') return IMAGE_ACCEPT;
    if (category === 'data') return DATA_ACCEPT;
    return '*/*';
  };

  // ── UI ──

  const normalizedDataTextInput = dataTextInput ?? '';
  const normalizedBase64Input = base64Input ?? '';
  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const queueHasPending = pendingCount > 0;
  const hasAnyResults = results.length > 0 || Boolean(base64Output);
  const imageFormatMeta = IMAGE_FORMATS.find(f => f.value === imgTarget);
  const supportedImageOutputOptions = IMAGE_OUTPUT_OPTIONS.filter(
    (option): option is { id: string; label: string; value: ImageFormat } => Boolean(option.value)
      && !(option.value === 'avif' && !supportsAvifOutput),
  );
  const advancedImageOutputOptions = IMAGE_OUTPUT_OPTIONS.filter(option =>
    !option.value || (option.value === 'avif' && !supportsAvifOutput),
  );
  const cardClass = 'rounded-[26px] border border-slate-200/70 dark:border-slate-700/70 bg-white/75 dark:bg-slate-900/65 backdrop-blur-xl shadow-[0_28px_60px_-38px_rgba(15,23,42,0.65)]';
  const sectionLabelClass = 'text-[10px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400';
  const inputBaseClass = 'w-full text-sm border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 py-2.5 bg-white/85 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition';
  const compactSelectClass = 'w-full h-11 text-sm font-medium border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-3 bg-white/85 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition';
  const subtleButtonClass = 'text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors';

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <section className={`${cardClass} relative overflow-hidden`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(191,219,254,0.55),transparent_45%),radial-gradient(120%_120%_at_100%_100%,rgba(224,231,255,0.45),transparent_48%)] dark:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(59,130,246,0.2),transparent_45%),radial-gradient(120%_120%_at_100%_100%,rgba(99,102,241,0.16),transparent_48%)]" />
        <div className="relative px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className={sectionLabelClass}>Inspired Workspace</p>
              <h2 className="text-2xl sm:text-[28px] leading-tight font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                File Converter
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl">
                Clean conversion flow for images, structured data, and Base64 with instant preview and export.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2.5 text-center min-w-[220px]">
              <div className="rounded-2xl border border-white/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 px-3 py-2">
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{pendingCount}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Pending</div>
              </div>
              <div className="rounded-2xl border border-white/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 px-3 py-2">
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{queue.length}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Queued</div>
              </div>
              <div className="rounded-2xl border border-white/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/70 px-3 py-2">
                <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{results.length}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Output</div>
              </div>
            </div>
          </div>

          <div className="mt-5 inline-flex flex-wrap rounded-2xl border border-white/80 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-1.5 gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); setQueue([]); }}
                className={`min-w-[170px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all ${
                  category === cat.id
                    ? 'bg-gradient-to-b from-white to-blue-50 dark:from-slate-800 dark:to-slate-800/70 text-slate-900 dark:text-slate-100 shadow-[0_12px_24px_-18px_rgba(59,130,246,0.7)] border border-blue-100/80 dark:border-blue-500/30'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70 border border-transparent'
                }`}
              >
                <span className={`${category === cat.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>{cat.icon}</span>
                <span>
                  <span className="block text-sm font-semibold">{cat.label}</span>
                  <span className="block text-[10px] tracking-wide opacity-80">{cat.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
        <div className="space-y-4">
          <div className={`${cardClass} p-5 space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className={sectionLabelClass}>Settings</h3>
              {category === 'encode' && (
                <button
                  onClick={loadBase64Example}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Load Example
                </button>
              )}
            </div>

            {category === 'image' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-2">Output Format</label>
                  <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_108px] gap-2">
                    <select
                      value={imgTarget}
                      onChange={e => setImgTarget(e.target.value as ImageFormat)}
                      className={compactSelectClass}
                    >
                      <optgroup label="Browser Supported">
                        {supportedImageOutputOptions.map(option => (
                          <option key={option.id} value={option.value}>{option.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Advanced (Not Available Here)">
                        {advancedImageOutputOptions.map(option => (
                          <option key={option.id} value={`unsupported:${option.id}`} disabled>
                            {!option.value && option.label}
                            {option.value === 'avif' && 'AVIF (Not Supported In This Browser)'}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <div className="h-11 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/70 px-3 flex items-center justify-between">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Ext</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{imageFormatMeta?.ext || '.img'}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    In-browser output supports PNG, JPG/JPEG, WEBP only when browser encoder is available.
                  </p>
                </div>
                {imgTarget !== 'png' && imgTarget !== 'bmp' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-2">
                      Quality <span className="text-slate-900 dark:text-slate-100">{imgQuality}%</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={imgQuality}
                      onChange={e => setImgQuality(Number(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">Max Width</label>
                    <input
                      type="number"
                      value={imgMaxWidth}
                      onChange={e => setImgMaxWidth(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Auto"
                      className={inputBaseClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">Max Height</label>
                    <input
                      type="number"
                      value={imgMaxHeight}
                      onChange={e => setImgMaxHeight(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Auto"
                      className={inputBaseClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {category === 'data' && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">From</label>
                  <select
                    value={dataFrom}
                    onChange={e => setDataFrom(e.target.value as DataFormat)}
                    className={inputBaseClass}
                  >
                    {DATA_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <ArrowRight size={16} className="text-slate-400 mb-3" />
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">To</label>
                  <select
                    value={dataTo}
                    onChange={e => setDataTo(e.target.value as DataFormat)}
                    className={inputBaseClass}
                  >
                    {DATA_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {category === 'encode' && (
              <div className="inline-flex rounded-xl bg-slate-100/80 dark:bg-slate-800/70 p-1 gap-1">
                <button
                  onClick={() => setEncodeMode('toBase64')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    encodeMode === 'toBase64' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  File → Base64
                </button>
                <button
                  onClick={() => setEncodeMode('fromBase64')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    encodeMode === 'fromBase64' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Base64 → File
                </button>
              </div>
            )}
          </div>

          {category === 'data' && (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="px-5 py-3 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                <span className={sectionLabelClass}>Paste Input</span>
                <button
                  onClick={handleDataTextConvert}
                  disabled={!normalizedDataTextInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-blue-500 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <RefreshCw size={12} /> Convert
                </button>
              </div>
              <textarea
                value={normalizedDataTextInput}
                onChange={e => setDataTextInput(e.target.value)}
                placeholder={`Paste ${DATA_FORMATS.find(f => f.value === dataFrom)?.label} content here...`}
                className="w-full h-44 px-5 py-4 text-xs font-mono bg-transparent text-slate-700 dark:text-slate-200 resize-none focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {dataTextOutput && (
                <>
                  <div className="px-5 py-2.5 bg-emerald-50/70 dark:bg-emerald-900/20 border-y border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.16em]">
                      Output ({DATA_FORMATS.find(f => f.value === dataTo)?.label})
                    </span>
                    <button
                      onClick={handleCopyDataOutput}
                      className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:opacity-80 transition-opacity"
                    >
                      {copiedDataOutput ? <Check size={11} /> : <Copy size={11} />}
                      {copiedDataOutput ? 'Copied' : 'Copy all'}
                    </button>
                  </div>
                  <pre className="px-5 py-4 text-xs font-mono text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-800/35 max-h-64 overflow-auto whitespace-pre-wrap">
                    {dataTextOutput}
                  </pre>
                </>
              )}
            </div>
          )}

          {category === 'encode' && encodeMode === 'fromBase64' && (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="px-5 py-3 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                <span className={sectionLabelClass}>Base64 Input</span>
                <button
                  onClick={handleBase64Convert}
                  disabled={!normalizedBase64Input.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-blue-500 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Download size={12} /> Decode
                </button>
              </div>
              <textarea
                value={normalizedBase64Input}
                onChange={e => setBase64Input(e.target.value)}
                placeholder="Paste data:... URL or raw base64 here"
                className="w-full h-44 px-5 py-4 text-xs font-mono bg-transparent text-slate-700 dark:text-slate-200 resize-none focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          )}

          {(category !== 'encode' || encodeMode === 'toBase64') && (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onClick={() => fileInputRef.current?.click()}
              className={`${cardClass} border-2 border-dashed border-slate-300/85 dark:border-slate-600/75 hover:border-blue-400 dark:hover:border-blue-500 px-6 py-9 text-center cursor-pointer transition-all group`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={getAccept()}
                multiple={category !== 'encode'}
                className="hidden"
                onChange={e => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-white/90 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-center shadow-sm">
                <Upload size={22} className="text-slate-500 dark:text-slate-300 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Drop files here or click to browse
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {category === 'image' && 'PNG, JPG/JPEG, WebP, BMP, AVIF, GIF, SVG, ICO, TIFF, HEIC, PSD...'}
                {category === 'data' && 'JSON, CSV, TSV, XML, YAML'}
                {category === 'encode' && 'Any file'}
              </p>
              {category === 'image' && (
                <p className="text-[11px] text-blue-600/90 dark:text-blue-400/90 mt-2 font-medium">
                  Multi-select is enabled for batch image conversion.
                </p>
              )}
            </div>
          )}

          {queue.length > 0 && (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="px-5 py-3 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                <span className={sectionLabelClass}>Queue ({queue.length})</span>
                <button onClick={clearAll} className={subtleButtonClass}>
                  Clear all
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {queue.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.file.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatSize(item.file.size)}</p>
                    </div>
                    {item.status === 'pending' && (
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 px-2 py-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-full">Pending</span>
                    )}
                    {item.status === 'converting' && (
                      <Loader2 size={14} className="animate-spin text-blue-500" />
                    )}
                    {item.status === 'done' && (
                      <CheckCircle2 size={15} className="text-emerald-500" />
                    )}
                    {item.status === 'error' && (
                      <div className="flex items-center gap-1 text-red-500">
                        <AlertCircle size={14} />
                        <span className="text-[11px] max-w-[130px] truncate">{item.error}</span>
                      </div>
                    )}
                    {item.status === 'pending' && (
                      <button onClick={() => removeFromQueue(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(queueHasPending || converting) && (
            <button
              onClick={category === 'encode' ? handleBase64Convert : handleConvert}
              disabled={converting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold tracking-wide bg-gradient-to-b from-slate-900 to-slate-700 dark:from-blue-500 dark:to-indigo-500 text-white hover:opacity-95 transition-opacity shadow-[0_16px_36px_-24px_rgba(15,23,42,0.9)] disabled:opacity-45"
            >
              {converting ? (
                <><Loader2 size={16} className="animate-spin" /> Converting {conversionProgress}%</>
              ) : (
                <><RefreshCw size={15} /> Convert {pendingCount} file{pendingCount > 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className={`${cardClass} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
              <span className={sectionLabelClass}>Results {results.length > 0 && `(${results.length})`}</span>
              <div className="flex items-center gap-3">
                {results.length > 1 && (
                  <button
                    onClick={downloadAll}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    <Download size={12} /> Download All
                  </button>
                )}
                {hasAnyResults && (
                  <button
                    onClick={clearResults}
                    className={subtleButtonClass}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {results.length === 0 && !base64Output && (
              <div className="p-14 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-center mb-3">
                  <RefreshCw size={24} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Converted files will appear here</p>
              </div>
            )}

            {category === 'encode' && base64Output && (
              <div className="p-5">
                <textarea
                  readOnly
                  value={base64Output}
                  className="w-full h-52 text-[11px] font-mono bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-3 text-slate-600 dark:text-slate-300 resize-none focus:outline-none"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(base64Output); }}
                  className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Copy to clipboard
                </button>
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[560px] overflow-y-auto">
              {results.map(r => (
                <div key={r.id} className="p-5">
                  {r.previewUrl && r.resultBlob.type.startsWith('image/') && (
                    <div className="mb-3 bg-slate-50/80 dark:bg-slate-800/70 rounded-2xl p-2.5 flex items-center justify-center border border-slate-200/70 dark:border-slate-700/70">
                      <img
                        src={r.previewUrl}
                        alt={r.resultName}
                        className="max-h-44 max-w-full rounded-xl object-contain"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{r.resultName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatSize(r.originalSize)} → {formatSize(r.resultSize)}
                        {r.originalSize > 0 && (
                          <span className={`ml-1.5 font-semibold ${r.resultSize < r.originalSize ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            ({r.resultSize < r.originalSize ? '-' : '+'}{Math.abs(Math.round((1 - r.resultSize / r.originalSize) * 100))}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadResult(r)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-blue-500 hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <Download size={12} /> Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileConverter;
