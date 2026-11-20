import React from 'react';
import { CheckCircle2, Edit3, Plus, UserCheck } from 'lucide-react';
import type { DutyRecord } from '../types/duty';

interface ExistingRecordsPanelProps {
  udiseCode: string;
  schoolName: string;
  records: DutyRecord[];
  activeRowIndex?: number;
  loading: boolean;
  onSelectRecord: (record: DutyRecord) => void;
  onStartNewEntry: () => void;
}

export const ExistingRecordsPanel: React.FC<ExistingRecordsPanelProps> = ({
  udiseCode,
  schoolName,
  records,
  activeRowIndex,
  loading,
  onSelectRecord,
  onStartNewEntry,
}) => {
  if (!loading && records.length === 0) {
    return null;
  }

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-6">
      {records.length > 0 && (
        <div className="flex items-center justify-end border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={onStartNewEntry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            New Entry
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
          <div className="h-24 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {records.map((rec, idx) => {
            const isSelected = activeRowIndex !== undefined && activeRowIndex === rec.rowIndex;
            return (
              <div
                key={`${rec.rowIndex ?? idx}-${rec.manavSampadaId}`}
                className={`rounded-lg border p-4 transition-colors ${
                  isSelected
                    ? 'border-blue-700 bg-blue-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {rec.employeeName || 'UNNAMED STAFF'}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span>{rec.designation || 'NO DESIGNATION'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">ID: {rec.manavSampadaId || '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{rec.mobileNumber || '—'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectRecord(rec)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-blue-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Editing
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-3.5 w-3.5" />
                        Load to Update
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <div className="text-slate-500">निर्वाचन डयूटी</div>
                    <div className="mt-0.5 font-medium text-slate-800">
                      {rec.electionDuty || '—'}
                      {rec.electionDuty === 'हाँ' && rec.assemblyName
                        ? ` · ${rec.assemblyName}`
                        : ''}
                    </div>
                    {rec.electionDuty === 'हाँ' && (rec.assemblyRole || rec.boothNumber) && (
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                        {rec.assemblyRole || '—'} · Booth {rec.boothNumber || '—'}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-slate-500">जनगणना डयूटी</div>
                    <div className="mt-0.5 font-medium text-slate-800">
                      {rec.censusDuty || '—'}
                      {rec.censusDuty && rec.censusDuty !== 'नहीं' && rec.censusArea
                        ? ` · ${rec.censusArea}`
                        : ''}
                    </div>
                    {rec.censusDuty && rec.censusDuty !== 'नहीं' && rec.ebCircleNumber && (
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                        EB/Circle: {rec.ebCircleNumber}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="h-3 w-3 text-slate-400" />
                    {rec.nyayPanchayat}
                  </span>
                  <span className="font-mono tabular-nums">
                    {rec.timestamp ? rec.timestamp : 'Saved'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
