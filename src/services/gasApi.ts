import {
  DEVELOPER_ADMIN_EMAIL,
  DEVELOPER_DEFAULT_PASSCODE,
  getEffectiveGasDeployUrl,
  getStoredSheetUrl,
  isGasUrlConfigured,
  setStoredSheetUrl,
} from '../config/gasConfig';
import { PREVIEW_SCHOOL_LIST } from '../data/fallbackSchools';
import type { DutyRecord, SchoolRecord } from '../types/duty';

const LOCAL_DATA_STORAGE_KEY = 'swar_duty_preview_data_v1';

function formatIstTimestamp(date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
  } catch {
    return date.toISOString();
  }
}

function readLocalDataRecords(): DutyRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_DATA_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalDataRecords(records: DutyRecord[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_DATA_STORAGE_KEY, JSON.stringify(records));
}

export interface UdiseLookupResponse {
  school: SchoolRecord | null;
  records: DutyRecord[];
  source: 'gas' | 'preview';
}

export interface SaveDutyResponse {
  success: boolean;
  mode: 'saved' | 'updated';
  record: DutyRecord;
  message: string;
  source: 'gas' | 'preview';
}

export interface AdminSheetDataResponse {
  success: boolean;
  sheetUrl: string;
  records: DutyRecord[];
  schools: SchoolRecord[];
  source: 'gas' | 'preview';
  error?: string;
}

export async function fetchSchoolList(): Promise<{ schools: SchoolRecord[]; source: 'gas' | 'preview' }> {
  const url = getEffectiveGasDeployUrl();
  if (!isGasUrlConfigured(url)) {
    return { schools: PREVIEW_SCHOOL_LIST, source: 'preview' };
  }

  const res = await fetch(`${url}?action=getSchools`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to fetch School_List (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch School_List from Google Sheets.');
  }
  return { schools: data.schools || [], source: 'gas' };
}

export async function lookupByUdise(udiseCode: string): Promise<UdiseLookupResponse> {
  const normalized = udiseCode.trim();
  const url = getEffectiveGasDeployUrl();

  if (!isGasUrlConfigured(url)) {
    const school = PREVIEW_SCHOOL_LIST.find((s) => s.udiseCode === normalized) || null;
    const allRecords = readLocalDataRecords();
    const records = allRecords.filter((r) => r.udiseCode === normalized);
    return { school, records, source: 'preview' };
  }

  const res = await fetch(`${url}?action=getByUdise&udise=${encodeURIComponent(normalized)}`, {
    method: 'GET',
  });
  if (!res.ok) {
    throw new Error(`Lookup failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to lookup UDISE code.');
  }
  return {
    school: data.school || null,
    records: Array.isArray(data.records) ? data.records : [],
    source: 'gas',
  };
}

export async function submitOrUpdateDutyRecord(
  record: DutyRecord,
  action: 'submit' | 'update',
  rowIndex?: number
): Promise<SaveDutyResponse> {
  const url = getEffectiveGasDeployUrl();

  if (!isGasUrlConfigured(url)) {
    const existing = readLocalDataRecords();
    const timestamp = formatIstTimestamp();
    const cleanRecord: DutyRecord = {
      ...record,
      employeeName: record.employeeName.toUpperCase().trim(),
      designation: record.designation.toUpperCase().trim(),
      assemblyRole: record.electionDuty === 'नहीं' ? '' : record.assemblyRole.toUpperCase().trim(),
      assemblyName: record.electionDuty === 'नहीं' ? '' : record.assemblyName,
      boothNumber: record.electionDuty === 'नहीं' ? '' : record.boothNumber.toUpperCase().trim(),
      censusArea: record.censusDuty === 'नहीं' ? '' : record.censusArea,
      ebCircleNumber:
        record.censusDuty === 'नहीं'
          ? ''
          : record.ebCircleNumber.replace(/[^0-9,\s]/g, '').trim(),
      censusWithElection: record.censusDuty === 'नहीं' ? '' : record.censusWithElection,
      timestamp,
    };

    let idx = -1;
    if (action === 'update' && rowIndex !== undefined) {
      idx = existing.findIndex((r) => r.rowIndex === rowIndex);
    }
    if (idx === -1 && cleanRecord.manavSampadaId) {
      idx = existing.findIndex(
        (r) =>
          r.udiseCode === cleanRecord.udiseCode &&
          r.manavSampadaId === cleanRecord.manavSampadaId
      );
    }

    if (idx !== -1) {
      cleanRecord.rowIndex = existing[idx].rowIndex ?? idx + 2;
      existing[idx] = cleanRecord;
      writeLocalDataRecords(existing);
      return {
        success: true,
        mode: 'updated',
        record: cleanRecord,
        message: 'Data updated successfully!',
        source: 'preview',
      };
    }

    const nextRowIndex = existing.reduce((max, r) => Math.max(max, r.rowIndex || 1), 1) + 1;
    cleanRecord.rowIndex = nextRowIndex;
    existing.push(cleanRecord);
    writeLocalDataRecords(existing);
    return {
      success: true,
      mode: 'saved',
      record: cleanRecord,
      message: 'Data saved successfully!',
      source: 'preview',
    };
  }

  // Use text/plain;charset=utf-8 to avoid CORS preflight with Google Apps Script Web Apps
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action,
      rowIndex,
      record,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google Apps Script request failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to save record to Google Sheet.');
  }

  return {
    success: true,
    mode: data.mode === 'updated' ? 'updated' : 'saved',
    record: data.record,
    message: data.message || (data.mode === 'updated' ? 'Data updated successfully!' : 'Data saved successfully!'),
    source: 'gas',
  };
}

export async function verifyDeveloperCredentials(
  email: string,
  passcode: string
): Promise<{ success: boolean; sheetUrl: string; error?: string }> {
  const url = getEffectiveGasDeployUrl();

  if (!isGasUrlConfigured(url)) {
    const valid =
      email.trim().toLowerCase() === DEVELOPER_ADMIN_EMAIL.toLowerCase() &&
      passcode.trim() === DEVELOPER_DEFAULT_PASSCODE;
    if (!valid) {
      return {
        success: false,
        sheetUrl: getStoredSheetUrl(),
        error: 'Invalid App Developer email or passcode.',
      };
    }
    return {
      success: true,
      sheetUrl: getStoredSheetUrl(),
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'verifyDeveloper',
      email: email.trim(),
      passcode: passcode.trim(),
    }),
  });

  if (!res.ok) {
    throw new Error(`Verification request failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success) {
    return {
      success: false,
      sheetUrl: getStoredSheetUrl(),
      error: data.error || 'Invalid developer credentials.',
    };
  }

  if (data.sheetUrl) {
    setStoredSheetUrl(data.sheetUrl);
  }

  return {
    success: true,
    sheetUrl: data.sheetUrl || getStoredSheetUrl(),
  };
}

export async function fetchAllSheetDataForAdmin(
  email: string,
  passcode: string
): Promise<AdminSheetDataResponse> {
  const url = getEffectiveGasDeployUrl();

  if (!isGasUrlConfigured(url)) {
    const valid =
      email.trim().toLowerCase() === DEVELOPER_ADMIN_EMAIL.toLowerCase() &&
      passcode.trim() === DEVELOPER_DEFAULT_PASSCODE;
    if (!valid) {
      return {
        success: false,
        sheetUrl: getStoredSheetUrl(),
        records: [],
        schools: [],
        source: 'preview',
        error: 'Access Denied: App Developer role required.',
      };
    }

    return {
      success: true,
      sheetUrl: getStoredSheetUrl(),
      records: readLocalDataRecords(),
      schools: PREVIEW_SCHOOL_LIST,
      source: 'preview',
    };
  }

  const query = new URLSearchParams({
    action: 'getAllData',
    email: email.trim(),
    passcode: passcode.trim(),
  });

  const res = await fetch(`${url}?${query.toString()}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to load Google Sheet data (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success) {
    return {
      success: false,
      sheetUrl: getStoredSheetUrl(),
      records: [],
      schools: [],
      source: 'gas',
      error: data.error || 'Access Denied.',
    };
  }

  if (data.sheetUrl) {
    setStoredSheetUrl(data.sheetUrl);
  }

  return {
    success: true,
    sheetUrl: data.sheetUrl || getStoredSheetUrl(),
    records: Array.isArray(data.records) ? data.records : [],
    schools: Array.isArray(data.schools) ? data.schools : [],
    source: 'gas',
  };
}
