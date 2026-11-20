/**
 * Manual Google Apps Script Web App Deploy URL Configuration.
 *
 * Replace GAS_DEPLOY_URL below with your deployed Google Apps Script Web App URL
 * (from Extensions -> Apps Script -> Deploy -> Web app).
 */
export const GAS_DEPLOY_URL = 'https://script.google.com/macros/s/AKfycbxVHAMYXNPvE_Taly9DvYI2v6KoGk28B7OogjJxLjZVGdnqMKFJQcgIU4-iOcRHl1KSew/exec';

export const DEFAULT_GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/';

// Authorized App Developer / Admin identity for role-restricted Sheet Access
export const DEVELOPER_ADMIN_EMAIL = 'basiceducationswar@gmail.com';
export const DEVELOPER_DEFAULT_PASSCODE = 'Admin@2026';

const CUSTOM_GAS_URL_STORAGE_KEY = 'swar_gas_deploy_url_override';
const CUSTOM_SHEET_URL_STORAGE_KEY = 'swar_google_sheet_url_override';

export function getEffectiveGasDeployUrl(): string {
  if (typeof window !== 'undefined') {
    const override = window.localStorage.getItem(CUSTOM_GAS_URL_STORAGE_KEY);
    if (override && override.trim().startsWith('https://script.google.com/')) {
      return override.trim();
    }
  }
  return GAS_DEPLOY_URL;
}

export function setGasDeployUrlOverride(url: string): void {
  if (typeof window === 'undefined') return;
  if (!url.trim()) {
    window.localStorage.removeItem(CUSTOM_GAS_URL_STORAGE_KEY);
  } else {
    window.localStorage.setItem(CUSTOM_GAS_URL_STORAGE_KEY, url.trim());
  }
}

export function isGasUrlConfigured(url = getEffectiveGasDeployUrl()): boolean {
  return (
    Boolean(url) &&
    url !== 'YOUR_GOOGLE_APPS_SCRIPT_DEPLOY_URL_HERE' &&
    url.startsWith('https://script.google.com/')
  );
}

export function getStoredSheetUrl(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(CUSTOM_SHEET_URL_STORAGE_KEY);
    if (stored && stored.trim().startsWith('https://')) {
      return stored.trim();
    }
  }
  return DEFAULT_GOOGLE_SHEET_URL;
}

export function setStoredSheetUrl(url: string): void {
  if (typeof window === 'undefined') return;
  if (url && url.trim().startsWith('https://')) {
    window.localStorage.setItem(CUSTOM_SHEET_URL_STORAGE_KEY, url.trim());
  }
}
