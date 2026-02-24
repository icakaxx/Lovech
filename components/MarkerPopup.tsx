import { CATEGORY_LABELS, STATUS_LABELS, CATEGORY_SEVERITY_LABELS, SEVERITY_LABELS } from '@/lib/types';
import type { ReportWithPhotos, ReportCategory, ReportStatus, Severity } from '@/lib/types';

/**
 * Renders popup HTML for a report marker.
 * Used by Map when opening a Leaflet popup (content is set as HTML string).
 */
export function getPopupContent(report: ReportWithPhotos, bucketUrl: string): string {
  const date = new Date(report.created_at).toLocaleDateString('bg-BG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const category = (report.category ?? 'pothole') as ReportCategory;
  const severityKey = (report.severity as Severity) ?? 1;
  const severityLabel =
    CATEGORY_SEVERITY_LABELS[category]?.[severityKey] ?? SEVERITY_LABELS[severityKey] ?? '—';
  const categoryLabel = CATEGORY_LABELS[category] ?? category;
  const status = report.status as ReportStatus | undefined;
  const statusLabel = status ? STATUS_LABELS[status] : null;
  const settlementDisplay =
    report.settlement === 'Other' && report.metadata && typeof report.metadata.settlement_custom === 'string'
      ? report.metadata.settlement_custom
      : (report.settlement ?? '');
  const locationLine = settlementDisplay
    ? `<p style="color:#64748b;font-size:0.75rem;margin:0.25rem 0 0 0;"><strong>Място:</strong> ${escapeHtml(settlementDisplay)}</p>`
    : '';
  const fullName = [report.first_name, report.last_name].filter(Boolean).join(' ');
  const submitter = fullName
    ? `<p style="color:#334155;font-size:0.8rem;margin:0.5rem 0 0 0;"><strong>Подаден от:</strong> ${escapeHtml(fullName)}</p>`
    : '';
  const comment = report.comment
    ? `<p style="color:#475569;font-size:0.875rem;margin-top:0.5rem;">${escapeHtml(report.comment)}</p>`
    : '';
  const photos = (report.photos || [])
    .slice(0, 5)
    .map(
      (p) =>
        `<a href="${bucketUrl}/${p.storage_path}" target="_blank" rel="noopener" style="display:block;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;"><img src="${bucketUrl}/${p.storage_path}" alt="Снимка" style="width:100%;height:5rem;object-fit:cover;" /></a>`
    )
    .join('');
  const gallery =
    photos &&
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem;">${photos}</div>`;

  return `
    <div style="padding:0.5rem;min-width:200px;text-align:left;color:#0f172a;">
      <p style="font-weight:600;color:#0f172a;margin:0;">${escapeHtml(categoryLabel)}</p>
      <p style="color:#64748b;font-size:0.75rem;margin:0.25rem 0 0 0;">${escapeHtml(severityLabel)} · ${escapeHtml(date)}${statusLabel ? ' · ' + escapeHtml(statusLabel) : ''}</p>
      ${locationLine}
      ${submitter}
      ${comment}
      ${gallery}
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
