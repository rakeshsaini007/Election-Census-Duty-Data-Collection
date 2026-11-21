import React, { useCallback, useEffect, useState } from 'react';
import {
  ExternalLink,
  FileSpreadsheet,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { DeveloperAuthModal } from './components/DeveloperAuthModal';
import { DutyEntryForm } from './components/DutyEntryForm';
import { ExistingRecordsPanel } from './components/ExistingRecordsPanel';
import { GoogleSheetViewer } from './components/GoogleSheetViewer';
import {
  DEVELOPER_ADMIN_EMAIL,
  getEffectiveGasDeployUrl,
  getStoredSheetUrl,
  isGasUrlConfigured,
} from './config/gasConfig';
import {
  fetchSchoolList,
  lookupByUdise,
  submitOrUpdateDutyRecord,
} from './services/gasApi';
import {
  EMPTY_DUTY_RECORD,
  type DutyRecord,
  type SchoolRecord,
  type UserRole,
} from './types/duty';

type ActiveView = 'form' | 'sheet';

export default function App() {
  const [role, setRole] = useState<UserRole>('user');
  const [developerEmail, setDeveloperEmail] = useState('');
  const [developerPasscode, setDeveloperPasscode] = useState('');
  const [sheetUrl, setSheetUrl] = useState<string>(() => getStoredSheetUrl());
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [activeView, setActiveView] = useState<ActiveView>('form');
  const [schoolList, setSchoolList] = useState<SchoolRecord[]>([]);
  const [dataSource, setDataSource] = useState<'gas' | 'preview'>(() =>
    isGasUrlConfigured() ? 'gas' : 'preview'
  );

  const [form, setForm] = useState<DutyRecord>(EMPTY_DUTY_RECORD);
  const [existingRecords, setExistingRecords] = useState<DutyRecord[]>([]);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [lookingUpSchool, setLookingUpSchool] = useState(false);
  const [schoolNotFound, setSchoolNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [alertBanner, setAlertBanner] = useState<{
    type: 'success' | 'error';
    message: string;
    timestamp?: string;
  } | null>(null);
  const [roleRestrictionBanner, setRoleRestrictionBanner] = useState('');

  useEffect(() => {
    let active = true;
    fetchSchoolList()
      .then((res) => {
        if (!active) return;
        setSchoolList(res.schools);
        setDataSource(res.source);
      })
      .catch(() => {
        // Keep empty list or fallback cleanly; lookup errors surface on search
      });
    return () => {
      active = false;
    };
  }, []);

  const handleUdiseLookup = useCallback(async (udiseInput: string) => {
    const cleanUdise = udiseInput.trim();
    if (!cleanUdise) return;

    setLookingUpSchool(true);
    setSchoolNotFound(false);
    setAlertBanner(null);

    try {
      const result = await lookupByUdise(cleanUdise);
      setDataSource(result.source);

      if (!result.school) {
        setSchoolNotFound(true);
        setExistingRecords([]);
        setIsUpdateMode(false);
        setForm((prev) => ({
          ...EMPTY_DUTY_RECORD,
          udiseCode: cleanUdise,
          schoolName: '',
          nyayPanchayat: '',
        }));
        return;
      }

      setSchoolNotFound(false);
      setExistingRecords(result.records);

      if (result.records.length > 0) {
        // Auto-load existing record into form & switch Submit -> Update
        const firstExisting = result.records[0];
        setForm({
          ...EMPTY_DUTY_RECORD,
          ...firstExisting,
          udiseCode: result.school.udiseCode,
          schoolName: result.school.schoolName,
          nyayPanchayat: result.school.nyayPanchayat,
        });
        setIsUpdateMode(true);
      } else {
        setForm((prev) => ({
          ...EMPTY_DUTY_RECORD,
          udiseCode: result.school!.udiseCode,
          schoolName: result.school!.schoolName,
          nyayPanchayat: result.school!.nyayPanchayat,
          manavSampadaId: prev.udiseCode === result.school!.udiseCode ? prev.manavSampadaId : '',
        }));
        setIsUpdateMode(false);
      }
    } catch (err) {
      setAlertBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to fetch school details.',
      });
    } finally {
      setLookingUpSchool(false);
    }
  }, []);

  const handleSelectExistingRecord = (rec: DutyRecord) => {
    setForm({
      ...EMPTY_DUTY_RECORD,
      ...rec,
    });
    setIsUpdateMode(true);
    setAlertBanner(null);
    setActiveView('form');
  };

  const handleStartNewEntryForSchool = () => {
    setForm({
      ...EMPTY_DUTY_RECORD,
      udiseCode: form.udiseCode,
      schoolName: form.schoolName,
      nyayPanchayat: form.nyayPanchayat,
    });
    setIsUpdateMode(false);
    setAlertBanner(null);
  };

  const handleReset = () => {
    setForm(EMPTY_DUTY_RECORD);
    setExistingRecords([]);
    setIsUpdateMode(false);
    setSchoolNotFound(false);
    setAlertBanner(null);
  };

  const validateForm = (): string | null => {
    if (!form.udiseCode.trim() || !form.schoolName.trim()) {
      return 'Please enter a valid UDISE CODE and fetch the school name from School_List.';
    }
    if (!form.employeeName.trim() || !/^[A-Z\s.]+$/.test(form.employeeName.trim())) {
      return 'कार्मिक का नाम must be entered in UPPERCASE ENGLISH ALPHABETS only.';
    }
    if (!form.designation.trim() || !/^[A-Z\s./-]+$/.test(form.designation.trim())) {
      return 'पद must be entered in UPPERCASE ENGLISH ALPHABETS only.';
    }
    if (!/^\d{10}$/.test(form.mobileNumber.trim())) {
      return 'मोबाइल नंबर must be a valid 10-digit numerical mobile number.';
    }
    if (!/^\d+$/.test(form.manavSampadaId.trim())) {
      return 'मानव सम्पदा ID must contain numerical digits only.';
    }
    if (!form.electionDuty) {
      return 'Please select an option for निर्वाचन डयूटी (हाँ/ नहीं ).';
    }
    if (form.electionDuty === 'हाँ') {
      if (!form.assemblyRole.trim()) {
        return 'Please select विधानसभा बीएलओ/ सुपरवाईजर.';
      }
      if (!form.assemblyName) {
        return 'Please select विधानसभा का नाम.';
      }
      if (!form.boothNumber.trim()) {
        return 'Please enter बूथ संख्या in uppercase English/numeric format.';
      }
    }
    if (!form.censusDuty) {
      return 'Please select an option for जनगणना डयूटी(प्रगणक/सुपरवाइज़र/ नहीं ).';
    }
    if (form.censusDuty !== 'नहीं') {
      if (!form.censusArea) {
        return 'Please select जनगणना क्षेत्र.';
      }
      if (!/^\d+(\s*,\s*\d+)*$/.test(form.ebCircleNumber.trim())) {
        return 'ईबी नंबर/ सर्कल नंबर must contain numerical digits (use comma "," to separate multiple numbers, e.g. 104, 105).';
      }
      if (!form.censusWithElection) {
        return 'Please select निर्वाचन डयूटी के साथ-साथ जनगणना करना चाहते हैं या नहीं.';
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertBanner(null);

    const validationError = validateForm();
    if (validationError) {
      setAlertBanner({ type: 'error', message: validationError });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      const action = isUpdateMode ? 'update' : 'submit';
      const response = await submitOrUpdateDutyRecord(form, action, form.rowIndex);
      setDataSource(response.source);

      // Refresh existing records list for this UDISE
      const refreshed = await lookupByUdise(form.udiseCode);
      setExistingRecords(refreshed.records);

      setForm(response.record);
      setIsUpdateMode(true);
      setAlertBanner({
        type: 'success',
        message:
          response.mode === 'updated'
            ? 'Alert: Data updated successfully in Google Sheet!'
            : 'Alert: Data saved successfully to Google Sheet!',
        timestamp: response.record.timestamp,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setAlertBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save data.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const isAuthorizedDeveloper =
    role === 'developer' &&
    developerEmail.trim().toLowerCase() === DEVELOPER_ADMIN_EMAIL.toLowerCase();

  const handleShowGoogleSheetClick = () => {
    if (!isAuthorizedDeveloper) {
      setRoleRestrictionBanner(
        `Access Restricted: "Show Google Sheet" works only for the App Developer / Admin (${DEVELOPER_ADMIN_EMAIL}).`
      );
      setAuthModalOpen(true);
      return;
    }
    setRoleRestrictionBanner('');
    setActiveView((prev) => (prev === 'sheet' ? 'form' : 'sheet'));
  };

  const handleSignOutDeveloper = () => {
    setRole('user');
    setDeveloperEmail('');
    setDeveloperPasscode('');
    setActiveView('form');
    setRoleRestrictionBanner('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-8 px-6 py-4">
          {isAuthorizedDeveloper && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={handleShowGoogleSheetClick}
                className={`transition-colors hover:text-slate-900 whitespace-nowrap shrink-0 ${
                  activeView === 'sheet' ? 'text-blue-900 underline underline-offset-8' : ''
                }`}
              >
                Sheet Console
              </button>
            </nav>
          )}

          <div className="flex items-center shrink-0">
            {isAuthorizedDeveloper ? (
              <button
                type="button"
                onClick={handleSignOutDeveloper}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out Admin
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Lock className="h-3.5 w-3.5" />
                Developer Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Workspace Context & Role-Restricted Google Sheet Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Election &amp; Census Duty Data Collection
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Block Swar, District Rampur</span>
              <span aria-hidden="true">·</span>
              <span>
                Role:{' '}
                <strong className="font-semibold text-slate-700">
                  {isAuthorizedDeveloper ? `App Developer (${developerEmail})` : 'School Staff (User)'}
                </strong>
              </span>
            </div>
          </div>

          {/* Role-Restricted Google Sheet Buttons: Strictly visible and active ONLY for App Developer / Admin */}
          {isAuthorizedDeveloper && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleShowGoogleSheetClick}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeView === 'sheet'
                    ? 'border-blue-900 bg-blue-900 text-white'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {activeView === 'sheet' ? 'Back to Duty Form' : 'Show Google Sheet'}
              </button>

              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Navigate Google Sheet
              </a>
            </div>
          )}
        </div>

        {/* Role Restriction Notice */}
        {roleRestrictionBanner && !isAuthorizedDeveloper && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" />
              <span>{roleRestrictionBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setRoleRestrictionBanner('')}
              className="text-amber-800 underline hover:no-underline whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Setup Guide Notice when GAS Deploy URL is not yet replaced */}
        {!isGasUrlConfigured(getEffectiveGasDeployUrl()) && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <div>
              <strong className="font-semibold text-slate-900">Preview Mode Active:</strong>{' '}
              To connect your live Google Sheets (<span className="font-mono">School_List</span> &amp;{' '}
              <span className="font-mono">Data</span>), deploy <span className="font-mono">code.js</span>{' '}
              as a Google Apps Script Web App and paste the Deploy URL in{' '}
              <span className="font-mono">src/config/gasConfig.ts</span> (or configure it in Developer Login → Sheet Console).
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              Sample UDISE: 09050306501
            </span>
          </div>
        )}

        {activeView === 'sheet' && isAuthorizedDeveloper ? (
          <GoogleSheetViewer
            role={role}
            developerEmail={developerEmail}
            developerPasscode={developerPasscode}
            sheetUrl={sheetUrl}
            onSheetUrlChange={setSheetUrl}
            onRequestAuth={() => setAuthModalOpen(true)}
            onSelectRecordForEdit={handleSelectExistingRecord}
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className={existingRecords.length > 0 || lookingUpSchool ? 'lg:col-span-8' : 'lg:col-span-12'}>
              <DutyEntryForm
                form={form}
                isUpdateMode={isUpdateMode}
                schoolList={schoolList}
                lookingUpSchool={lookingUpSchool}
                schoolNotFound={schoolNotFound}
                submitting={submitting}
                alertBanner={alertBanner}
                onDismissAlert={() => setAlertBanner(null)}
                onChangeForm={setForm}
                onUdiseLookup={handleUdiseLookup}
                onSubmit={handleSubmit}
                onReset={handleReset}
              />
            </div>

            {(existingRecords.length > 0 || lookingUpSchool) && (
              <div id="existing-records" className="lg:col-span-4">
                <ExistingRecordsPanel
                  udiseCode={form.udiseCode}
                  schoolName={form.schoolName}
                  records={existingRecords}
                  activeRowIndex={isUpdateMode ? form.rowIndex : undefined}
                  loading={lookingUpSchool}
                  onSelectRecord={handleSelectExistingRecord}
                  onStartNewEntry={handleStartNewEntryForSchool}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <DeveloperAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(email, passcode, resolvedSheetUrl) => {
          setRole('developer');
          setDeveloperEmail(email);
          setDeveloperPasscode(passcode);
          if (resolvedSheetUrl) {
            setSheetUrl(resolvedSheetUrl);
          }
          setRoleRestrictionBanner('');
          setActiveView('sheet');
        }}
      />
    </div>
  );
}
