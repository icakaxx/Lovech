'use client';

import { useState, useRef, useCallback } from 'react';
import { SEVERITY_LABELS, CATEGORY_LABELS, SETTLEMENTS_LOVECH, SETTLEMENT_LABELS_BG, CATEGORY_SEVERITY_LABELS } from '@/lib/types';
import type { Severity, ReportCategory } from '@/lib/types';
import type { ReportWithPhotos } from '@/lib/types';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB (after compression)
const TARGET_SIZE_BYTES = 1 * 1024 * 1024; // Target 1MB for compression
const MAX_DIMENSION = 2048; // Max width/height in pixels
const MAX_COMMENT_LENGTH = 500;

/**
 * Compress an image file using Canvas API
 * Returns the original file if it's already small enough or if compression fails
 */
async function compressImage(file: File): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // If file is already small, return as-is
  if (file.size <= TARGET_SIZE_BYTES) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      if (!ctx) {
        resolve(file);
        return;
      }

      // Calculate new dimensions (maintain aspect ratio)
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw with white background (for transparency)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels until we get under target size
      const tryCompress = (quality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // If we're under target size or at minimum quality, use this result
            if (blob.size <= TARGET_SIZE_BYTES || quality <= 0.3) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              // Try again with lower quality
              tryCompress(quality - 0.1);
            }
          },
          'image/jpeg',
          quality
        );
      };

      // Start with 0.8 quality
      tryCompress(0.8);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
}

interface ReportModalProps {
  lat: number;
  lng: number;
  onClose: () => void;
  onSuccess: (lat: number, lng: number) => void;
  /** Called with the new report when submit succeeds, so the map can show the marker immediately */
  onReportSubmitted?: (report: ReportWithPhotos) => void;
}

export function ReportModal({ lat, lng, onClose, onSuccess, onReportSubmitted }: ReportModalProps) {
  const [category, setCategory] = useState<ReportCategory>('pothole');
  const [settlement, setSettlement] = useState('Lovech');
  const [settlementOther, setSettlementOther] = useState('');
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [comment, setComment] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'form' | 'submitting' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const severityLabels = CATEGORY_SEVERITY_LABELS[category] ?? SEVERITY_LABELS;

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    if (chosen.length === 0) return;

    setIsCompressing(true);
    setErrorMessage('');

    try {
      // Compress all selected images in parallel
      const compressed = await Promise.all(chosen.map(compressImage));
      
      // Filter out files that are still too large after compression
      const valid: File[] = [];
      for (const f of compressed) {
        if (f.size > MAX_IMAGE_BYTES) {
          setErrorMessage(`Снимка "${f.name}" е твърде голяма дори след компресия.`);
          continue;
        }
        if (valid.length >= MAX_IMAGES) break;
        valid.push(f);
      }
      
      setFiles((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
    } catch {
      setErrorMessage('Грешка при обработка на снимките.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    if (!severity) return 'Изберете тежест на сигнала.';
    if (!firstName.trim()) return 'Името е задължително.';
    if (!lastName.trim()) return 'Фамилията е задължителна.';
    if (settlement === 'Друго') {
      if (!settlementOther.trim()) return 'Въведете населено място при избор "Друго".';
    } else if (!settlement) {
      return 'Изберете населено място.';
    }
    if (comment.length > MAX_COMMENT_LENGTH) return `Коментарът е максимум ${MAX_COMMENT_LENGTH} символа.`;
    if (files.length === 0) return 'Добавете поне една снимка.';
    if (files.length > MAX_IMAGES) return `Максимум ${MAX_IMAGES} снимки.`;
    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) return 'Снимката е твърде голяма. Опитайте с по-малка снимка.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setErrorMessage(err);
      return;
    }
    setErrorMessage('');
    setStatus('submitting');

    const formData = new FormData();
    formData.set('lat', String(lat));
    formData.set('lng', String(lng));
    formData.set('category', category);
    if (settlement === 'Друго') {
      formData.set('settlement', 'Other');
      formData.set('settlement_custom', settlementOther.trim());
    } else {
      formData.set('settlement', settlement);
    }
    formData.set('municipality', 'Lovech');
    formData.set('severity', String(severity));
    formData.set('comment', comment);
    formData.set('first_name', firstName.trim());
    formData.set('last_name', lastName.trim());
    files.forEach((f) => formData.append('images', f));

    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Неуспешно изпращане. Опитайте отново.');
        return;
      }
      if (data.report) onReportSubmitted?.(data.report as ReportWithPhotos);
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Грешка при изпращане. Опитайте отново.');
    }
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm transition-smooth">
        <div className="rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl w-full sm:max-w-md p-6 text-center">
          <p className="text-lg text-slate-900">
            Сигналът е изпратен и вече е видим на картата.
          </p>
          <button
            type="button"
            onClick={() => onSuccess(lat, lng)}
            className="mt-4 px-6 py-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white text-base sm:text-sm transition-smooth"
          >
            Затвори
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm transition-smooth">
      <div className="rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 shadow-xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Нов сигнал</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-900 transition-smooth"
            aria-label="Затвори"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Категория *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              {(Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Населено място *</label>
            <select
              value={settlement}
              onChange={(e) => setSettlement(e.target.value)}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              {SETTLEMENTS_LOVECH.filter((s) => s !== 'Друго').map((s) => (
                <option key={s} value={s}>{SETTLEMENT_LABELS_BG[s] ?? s}</option>
              ))}
              <option value="Друго">Друго</option>
            </select>
            {settlement === 'Друго' && (
              <input
                type="text"
                value={settlementOther}
                onChange={(e) => setSettlementOther(e.target.value)}
                placeholder="Въведете населено място"
                className="mt-2 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Тежест на сигнала</p>
            <div className="flex flex-col gap-2">
              {([1, 2, 3] as const).map((s) => {
                const bgColor = s === 1 ? '#22c55e' : s === 2 ? '#eab308' : '#ef4444';
                const selectedBg = s === 1 ? 'bg-green-100' : s === 2 ? 'bg-yellow-100' : 'bg-red-100';
                const isSelected = severity === s;
                return (
                  <label
                    key={s}
                    className={`flex items-center gap-3 p-4 sm:p-3 rounded-lg border-2 cursor-pointer transition-smooth active:bg-slate-100 ${
                      isSelected
                        ? `${selectedBg} shadow-md`
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={isSelected ? { borderColor: bgColor, boxShadow: `0 0 0 3px ${bgColor}33` } : undefined}
                  >
                    <input
                      type="radio"
                      name="severity"
                      value={s}
                      checked={isSelected}
                      onChange={() => setSeverity(s)}
                      className="sr-only"
                    />
                    <span
                      className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full flex-shrink-0 ${isSelected ? 'scale-110' : ''}`}
                      style={{ 
                        background: bgColor, 
                        boxShadow: isSelected ? `0 0 0 3px ${bgColor}40` : undefined 
                      }}
                    />
                    <span className={`text-base sm:text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{severityLabels[s]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Коментар (по избор, макс. {MAX_COMMENT_LENGTH} символа)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              rows={3}
              className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              placeholder="Опишете мястото ако е нужно..."
            />
            <p className="text-xs text-slate-500 mt-1">{comment.length}/{MAX_COMMENT_LENGTH}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Снимки (1–{MAX_IMAGES}, автоматично компресирани)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={isCompressing}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="w-full py-3 sm:py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-smooth active:bg-slate-50 disabled:opacity-50 disabled:cursor-wait"
            >
              {isCompressing ? 'Компресиране...' : '+ Добави снимки'}
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-slate-600 gap-2">
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-600 hover:text-red-700 whitespace-nowrap">
                      Премахни
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Име *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                placeholder="Иван"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Фамилия *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 sm:py-2 text-base sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                placeholder="Иванов"
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <div className="flex gap-2 pt-2 pb-2 sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 sm:py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-smooth text-base sm:text-sm"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={status === 'submitting' || isCompressing}
              className="flex-1 py-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white font-medium disabled:opacity-50 transition-smooth text-base sm:text-sm"
            >
              {status === 'submitting' ? 'Изпращане...' : 'Изпрати сигнал'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

