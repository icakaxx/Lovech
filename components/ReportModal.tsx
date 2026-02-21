'use client';

import { useState, useRef } from 'react';
import { SEVERITY_LABELS } from '@/lib/types';
import type { Severity } from '@/lib/types';
import type { ReportWithPhotos } from '@/lib/types';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_COMMENT_LENGTH = 500;

interface ReportModalProps {
  lat: number;
  lng: number;
  onClose: () => void;
  onSuccess: (lat: number, lng: number) => void;
  /** Called with the new report when submit succeeds, so the map can show the marker immediately */
  onReportSubmitted?: (report: ReportWithPhotos) => void;
}

export function ReportModal({ lat, lng, onClose, onSuccess, onReportSubmitted }: ReportModalProps) {
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [comment, setComment] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'form' | 'submitting' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const f of chosen) {
      if (f.size > MAX_IMAGE_BYTES) continue;
      if (valid.length >= MAX_IMAGES) break;
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    if (!severity) return 'Изберете тежест на неравността.';
    if (!firstName.trim()) return 'Името е задължително.';
    if (!lastName.trim()) return 'Фамилията е задължителна.';
    if (comment.length > MAX_COMMENT_LENGTH) return `Коментарът е максимум ${MAX_COMMENT_LENGTH} символа.`;
    if (files.length === 0) return 'Добавете поне една снимка.';
    if (files.length > MAX_IMAGES) return `Максимум ${MAX_IMAGES} снимки.`;
    for (const f of files) {
      if (f.size > MAX_IMAGE_BYTES) return 'Всяка снимка трябва да е до 8 MB.';
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
    formData.set('severity', String(severity));
    formData.set('comment', comment);
    formData.set('first_name', firstName.trim());
    formData.set('last_name', lastName.trim());
    files.forEach((f, i) => formData.append('images', f));

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
            <p className="text-sm font-medium text-slate-700 mb-2">Тежест на неравността</p>
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
                    <span className={`text-base sm:text-sm ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{SEVERITY_LABELS[s]}</span>
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
              Снимки (1–{MAX_IMAGES}, до 8 MB всяка)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 sm:py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-smooth active:bg-slate-50"
            >
              + Добави снимки
            </button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-slate-600">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-red-600 hover:text-red-700">
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
              disabled={status === 'submitting'}
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

