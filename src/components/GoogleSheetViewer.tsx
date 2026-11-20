import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  Search,
  Settings2,
} from 'lucide-react';
import {
  getEffectiveGasDeployUrl,
  getStoredSheetUrl,
  isGasUrlConfigured,
  setGasDeployUrlOverride,
  setStoredSheetUrl,
} from '../config/gasConfig';
import { fetchAllSheetDataForAdmin } from '../services/gasApi';
import type { DutyRecord, SchoolRecord, UserRole } from '../types/duty';

interface GoogleSheetViewerProps {
  role: UserRole;
  developerEmail: string;
  developerPasscode: string;
  sheetUrl: string;
  onSheetUrlChange: (url: string) => void;
  onRequestAuth: () => void;
  onSelectRecordForEdit: (record: DutyRecord) => void;
}

export const GoogleSheetViewer: React.FC<GoogleSheetViewerProps> = ({
  role,
  developerEmail,
  developerPasscode,
  sheetUrl,
  onSheetUrlChange,
  onRequestAuth,
  onSelectRecordForEdit,
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'schools' | 'config'>('data');
  const [records, setRecords] = useState<DutyRecord[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [nyayFilter, setNyayFilter] = useState('');
  const [source, setSource] = useState<'gas' | 'preview'>('preview');

  const [gasUrlInput, setGasUrlInput] = useState(() =>
    isGasUrlConfigured() ? getEffectiveGasDeployUrl() : ''
  );
  const [sheetUrlInput, setSheetUrlInput] = useState(() => sheetUrl || getStoredSheetUrl());
  const [configSavedNotice, setConfigSavedNotice] = useState('');

  const loadSheets = async () => {
    if (role !== 'developer') return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchAllSheetDataForAdmin(developerEmail, developerPasscode);
      if (!res.success) {
        setError(res.error || 'Access denied.');
      } else {
        setRecords(res.records);
        setSchools(res.schools);
        setSource(res.source);
        if (res.sheetUrl) {
          onSheetUrlChange(res.sheetUrl);
          setSheetUrlInput(res.sheetUrl);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Google Sheet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'developer') {
      loadSheets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const nyayOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.nyayPanchayat && set.add(r.nyayPanchayat));
    schools.forEach((s) => s.nyayPanchayat && set.add(s.nyayPanchayat));
    return Array.from(set).sort();
  }, [records, schools]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (nyayFilter && r.nyayPanchayat !== nyayFilter) return false;
      if (!q) return true;
      return (
        r.udiseCode.toLowerCase().includes(q) ||
        r.schoolName.toLowerCase().includes(q) ||
        r.employeeName.toLowerCase().includes(q) ||
        r.manavSampadaId.toLowerCase().includes(q) ||
        r.mobileNumber.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, nyayFilter]);

  const filteredSchools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return schools.filter((s) => {
      if (nyayFilter && s.nyayPanchayat !== nyayFilter) return false;
      if (!q) return true;
      return (
        s.udiseCode.toLowerCase().includes(q) ||
        s.schoolName.toLowerCase().includes(q) ||
        s.nyayPanchayat.toLowerCase().includes(q)
      );
    });
  }, [schools, searchQuery, nyayFilter]);

  const handleExportCsv = () => {
    const headers = [
      'UDISE CODE',
      'विद्यालय का नाम',
      'न्याय पंचायत',
      'कार्मिक का नाम',
      'पद',
      'मोबाइल नंबर',
      'मानव सम्पदा ID',
      'निर्वाचन डयूटी',
      'विधानसभा बीएलओ/ सुपरवाईजर',
      'विधानसभा का नाम',
      'बूथ संख्या',
      'जनगणना डयूटी(प्रगणक/सुपरवाइज़र/ नहीं )',
      'जनगणना क्षेत्र',
      'ईबी नंबर/ सर्कल नंबर',
      'निर्वाचन डयूटी के साथ-साथ जनगणना करना चाहते हैं या नहीं',
      'Timestamp',
    ];
    const escapeCell = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
    const rows = filteredRecords.map((r) =>
      [
        r.udiseCode,
        r.schoolName,
        r.nyayPanchayat,
        r.employeeName,
        r.designation,
        r.mobileNumber,
        r.manavSampadaId,
        r.electionDuty,
        r.assemblyRole,
        r.assemblyName,
        r.boothNumber,
        r.censusDuty,
        r.censusArea,
        r.ebCircleNumber,
        r.censusWithElection,
        r.timestamp || '',
      ]
        .map(escapeCell)
        .join(',')
    );
    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Swar_Duty_Data_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setGasDeployUrlOverride(gasUrlInput);
    if (sheetUrlInput.trim()) {
      setStoredSheetUrl(sheetUrlInput.trim());
      onSheetUrlChange(sheetUrlInput.trim());
    }
    setConfigSavedNotice('Configuration updated. Reloading data from endpoint...');
    setTimeout(() => setConfigSavedNotice(''), 3500);
    loadSheets();
  };

  if (role !== 'developer') {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Google Sheet Access Restricted
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-500">
          Viewing and navigating to the underlying Google Sheet is restricted strictly to the App Developer / Admin role.
        </p>
        <button
          type="button"
          onClick={onRequestAuth}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Lock className="h-3.5 w-3.5" />
          Sign In as App Developer
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-900" />
            <h2 className="text-base font-semibold text-slate-900">
              Google Sheet Console (Developer Only)
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Source: {source === 'gas' ? 'Live Google Apps Script Web App' : 'Local Preview Storage'}
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="tabular-nums">{records.length} Data rows</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="tabular-nums">{schools.length} Schools</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadSheets}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          <a
            href={sheetUrl || getStoredSheetUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Navigate to Google Sheet
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'data'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Data Sheet ({records.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schools')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'schools'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            School_List ({schools.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'config'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            GAS Deploy URL
          </button>
        </div>

        {activeTab !== 'config' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search UDISE, school, staff..."
                className="w-60 rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <select
              value={nyayFilter}
              onChange={(e) => setNyayFilter(e.target.value)}
              aria-label="Filter by Nyay Panchayat"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-700 focus:outline-none"
            >
              <option value="">All Nyay Panchayats</option>
              {nyayOptions.map((np) => (
                <option key={np} value={np}>
                  {np}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="m-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {activeTab === 'config' ? (
        <form onSubmit={handleSaveConfig} className="space-y-5 p-6">
          {configSavedNotice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
              {configSavedNotice}
            </div>
          )}

          <div className="max-w-2xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Google Apps Script Web App Deploy URL
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Deploy <span className="font-mono text-slate-700">code.js</span> in your Google Spreadsheet (Extensions → Apps Script → Deploy → Web app, Execute as Me, Access: Anyone). You can set <span className="font-mono text-slate-700">GAS_DEPLOY_URL</span> directly in <span className="font-mono text-slate-700">src/config/gasConfig.ts</span> or test an override URL below.
              </p>
            </div>

            <div>
              <label htmlFor="gas-url-input" className="block text-xs font-medium text-slate-700">
                Web App Deploy URL (https://script.google.com/macros/s/.../exec)
              </label>
              <input
                id="gas-url-input"
                type="url"
                value={gasUrlInput}
                onChange={(e) => setGasUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
              />
            </div>

            <div>
              <label htmlFor="sheet-url-input" className="block text-xs font-medium text-slate-700">
                Google Spreadsheet Direct URL (for Navigate Button)
              </label>
              <input
                id="sheet-url-input"
                type="url"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                Save & Sync Connection
              </button>
              <button
                type="button"
                onClick={() => {
                  setGasUrlInput('');
                  setGasDeployUrlOverride('');
                  loadSheets();
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Reset Override
              </button>
            </div>
          </div>
        </form>
      ) : activeTab === 'data' ? (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2 p-6">
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-700">No rows in Data sheet yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Submitted and updated staff duty records will appear here with timestamps.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="px-3 py-2.5 whitespace-nowrap">UDISE CODE</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">विद्यालय का नाम</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">न्याय पंचायत</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">कार्मिक का नाम</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">पद</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">मोबाइल नंबर</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">मानव सम्पदा ID</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">निर्वाचन डयूटी</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">BLO/Supervisor</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">विधानसभा का नाम</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">बूथ संख्या</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">जनगणना डयूटी</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">जनगणना क्षेत्र</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">ईबी/सर्कल नंबर</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">साथ-साथ जनगणना</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Timestamp</th>
                  <th className="px-3 py-2.5 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r, i) => (
                  <tr key={`${r.rowIndex ?? i}-${r.manavSampadaId}`} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {r.udiseCode}
                    </td>
                    <td className="px-3 py-2.5 text-slate-900 whitespace-nowrap">{r.schoolName}</td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.nyayPanchayat}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                      {r.employeeName}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.designation}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {r.mobileNumber}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {r.manavSampadaId}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.electionDuty || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.assemblyRole || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.assemblyName || '—'}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {r.boothNumber || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.censusDuty || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{r.censusArea || '—'}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {r.ebCircleNumber || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      {r.censusWithElection || '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {r.timestamp || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectRecordForEdit(r)}
                        className="font-medium text-blue-800 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="px-4 py-2.5">UDISE CODE</th>
                <th className="px-4 py-2.5">विद्यालय का नाम</th>
                <th className="px-4 py-2.5">न्याय पंचायत</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map((s) => (
                <tr key={s.udiseCode} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 font-mono tabular-nums text-slate-800">{s.udiseCode}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{s.schoolName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{s.nyayPanchayat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
