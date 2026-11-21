/**
 * Google Apps Script Backend for Swar Education Duty Registry
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Spreadsheet containing "School_List" and "Data" sheets.
 * 2. Go to Extensions -> Apps Script.
 * 3. Replace the contents of Code.gs with this entire file (code.js).
 * 4. Update DEVELOPER_EMAIL and DEVELOPER_PASSCODE below if desired.
 * 5. Click Deploy -> New deployment -> Select type: Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App Deploy URL and paste it into src/config/gasConfig.ts (GAS_DEPLOY_URL).
 */

var SCHOOL_SHEET_NAME = 'School_List';
var DATA_SHEET_NAME = 'Data';

// Role-based restriction credentials for App Developer / Admin
var DEVELOPER_EMAIL = 'basiceducationswar@gmail.com';
var DEVELOPER_PASSCODE = 'Admin@2026';

// Canonical column headers for the "Data" sheet (Timestamp is always kept as the last column)
var CANONICAL_DATA_HEADERS = [
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
  'Timestamp'
];

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'Swar Education Duty Registry GAS API is active.'
      });
    }

    if (action === 'getSchools') {
      var schools = readSchoolList_();
      return jsonResponse({
        success: true,
        schools: schools
      });
    }

    if (action === 'getByUdise') {
      var udise = normalizeUdise_(params.udise || '');
      if (!udise) {
        return jsonResponse({ success: false, error: 'UDISE CODE is required.' });
      }
      var school = findSchoolByUdise_(udise);
      var records = findDataRecordsByUdise_(udise);
      return jsonResponse({
        success: true,
        school: school,
        records: records
      });
    }

    if (action === 'getAllData') {
      if (!isDeveloperAuthorized_(params.email, params.passcode)) {
        return jsonResponse({
          success: false,
          error: 'Access Denied: Only App Developer / Admin can view Google Sheet data.'
        });
      }
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var allData = readAllDataRecords_();
      var allSchools = readSchoolList_();
      return jsonResponse({
        success: true,
        sheetUrl: ss.getUrl(),
        headers: allData.headers,
        records: allData.records,
        schools: allSchools
      });
    }

    if (action === 'getSheetUrl') {
      if (!isDeveloperAuthorized_(params.email, params.passcode)) {
        return jsonResponse({
          success: false,
          error: 'Access Denied: Only App Developer / Admin can navigate to the Google Sheet.'
        });
      }
      return jsonResponse({
        success: true,
        sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(rawBody);
    var action = payload.action || '';

    if (action === 'verifyDeveloper') {
      var authorized = isDeveloperAuthorized_(payload.email, payload.passcode);
      if (!authorized) {
        return jsonResponse({
          success: false,
          error: 'Invalid App Developer credentials.'
        });
      }
      return jsonResponse({
        success: true,
        role: 'developer',
        sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
      });
    }

    if (action === 'submit' || action === 'update') {
      var record = payload.record || {};
      var result = saveOrUpdateDataRecord_(record, action, payload.rowIndex);
      return jsonResponse(result);
    }

    return jsonResponse({ success: false, error: 'Unsupported POST action: ' + action });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err && err.message ? err.message : String(err)
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignore) {}
  }
}

function isDeveloperAuthorized_(email, passcode) {
  var normalizedEmail = String(email || '').trim().toLowerCase();
  var normalizedPass = String(passcode || '').trim();
  return (
    normalizedEmail === DEVELOPER_EMAIL.toLowerCase() &&
    normalizedPass === DEVELOPER_PASSCODE
  );
}

function normalizeUdise_(val) {
  var str = String(val || '').trim();
  if (/^\d+$/.test(str) && str.length === 10) {
    // Preserve 11-digit UDISE leading zero if spreadsheet stored it as number
    return '0' + str;
  }
  return str;
}

function readSchoolList_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SCHOOL_SHEET_NAME);
  if (!sheet) {
    throw new Error('Sheet "' + SCHOOL_SHEET_NAME + '" not found.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var displayValues = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getDisplayValues();
  var headers = displayValues[0].map(function (h) { return String(h).trim(); });

  var udiseIdx = findColIndex_(headers, ['UDISE CODE', 'UDISE', 'udiseCode']);
  var schoolIdx = findColIndex_(headers, ['विद्यालय का नाम', 'School Name', 'schoolName']);
  var npIdx = findColIndex_(headers, ['न्याय पंचायत', 'Nyay Panchayat', 'nyayPanchayat']);

  if (udiseIdx === -1) udiseIdx = 0;
  if (schoolIdx === -1) schoolIdx = 1;
  if (npIdx === -1) npIdx = 2;

  var schools = [];
  for (var i = 1; i < displayValues.length; i++) {
    var row = displayValues[i];
    var udiseCode = normalizeUdise_(row[udiseIdx]);
    if (!udiseCode) continue;
    schools.push({
      udiseCode: udiseCode,
      schoolName: String(row[schoolIdx] || '').trim(),
      nyayPanchayat: String(row[npIdx] || '').trim()
    });
  }
  return schools;
}

function findSchoolByUdise_(udise) {
  var schools = readSchoolList_();
  for (var i = 0; i < schools.length; i++) {
    if (schools[i].udiseCode === udise) {
      return schools[i];
    }
  }
  return null;
}

function ensureDataSheetAndHeaders_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DATA_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CANONICAL_DATA_HEADERS.length).setValues([CANONICAL_DATA_HEADERS]);
    sheet.getRange(1, 1, 1, CANONICAL_DATA_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return {
      sheet: sheet,
      headers: CANONICAL_DATA_HEADERS.slice()
    };
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function (h) {
    return String(h).trim();
  });

  // Ensure "जनगणना क्षेत्र" column exists (insert before Timestamp if Timestamp exists, else append)
  var hasCensusArea = findColIndex_(headers, ['जनगणना क्षेत्र']) !== -1;
  if (!hasCensusArea) {
    var tsIndexBefore = findColIndex_(headers, ['Timestamp', 'TIMESTAMP', 'timestamp']);
    if (tsIndexBefore !== -1) {
      sheet.insertColumnBefore(tsIndexBefore + 1);
      sheet.getRange(1, tsIndexBefore + 1).setValue('जनगणना क्षेत्र').setFontWeight('bold');
    } else {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('जनगणना क्षेत्र').setFontWeight('bold');
    }
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (h) {
      return String(h).trim();
    });
  }

  // Ensure "Timestamp" column exists at the very last column of "Data" sheet
  var tsIdx = findColIndex_(headers, ['Timestamp', 'TIMESTAMP', 'timestamp']);
  if (tsIdx === -1) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('Timestamp').setFontWeight('bold');
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(function (h) {
      return String(h).trim();
    });
  }

  return {
    sheet: sheet,
    headers: headers
  };
}

function readAllDataRecords_() {
  var setup = ensureDataSheetAndHeaders_();
  var sheet = setup.sheet;
  var headers = setup.headers;
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { headers: headers, records: [] };
  }

  var displayValues = sheet.getRange(1, 1, lastRow, headers.length).getDisplayValues();
  var records = [];

  for (var r = 1; r < displayValues.length; r++) {
    var row = displayValues[r];
    var udiseVal = normalizeUdise_(getValByHeader_(headers, row, ['UDISE CODE', 'UDISE']));
    var empVal = String(getValByHeader_(headers, row, ['कार्मिक का नाम']) || '').trim();
    if (!udiseVal && !empVal) continue;

    records.push(rowToRecordObject_(headers, row, r + 1));
  }

  return {
    headers: headers,
    records: records
  };
}

function findDataRecordsByUdise_(udise) {
  var all = readAllDataRecords_();
  var matched = [];
  for (var i = 0; i < all.records.length; i++) {
    if (all.records[i].udiseCode === udise) {
      matched.push(all.records[i]);
    }
  }
  return matched;
}

function saveOrUpdateDataRecord_(record, action, requestedRowIndex) {
  var setup = ensureDataSheetAndHeaders_();
  var sheet = setup.sheet;
  var headers = setup.headers;

  var udiseCode = normalizeUdise_(record.udiseCode);
  var manavSampadaId = String(record.manavSampadaId || '').replace(/[^0-9]/g, '');

  if (!udiseCode) {
    throw new Error('UDISE CODE is required.');
  }

  // Enforce uppercase English alphabet on text inputs
  var cleanRecord = {
    udiseCode: udiseCode,
    schoolName: String(record.schoolName || '').trim(),
    nyayPanchayat: String(record.nyayPanchayat || '').trim(),
    employeeName: String(record.employeeName || '').toUpperCase().replace(/[^A-Z\s.]/g, '').trim(),
    designation: String(record.designation || '').toUpperCase().replace(/[^A-Z\s./-]/g, '').trim(),
    mobileNumber: String(record.mobileNumber || '').replace(/[^0-9]/g, '').slice(0, 10),
    manavSampadaId: manavSampadaId,
    electionDuty: String(record.electionDuty || '').trim(),
    assemblyRole: record.electionDuty === 'नहीं' ? '' : String(record.assemblyRole || '').toUpperCase().trim(),
    assemblyName: record.electionDuty === 'नहीं' ? '' : String(record.assemblyName || '').trim(),
    boothNumber: record.electionDuty === 'नहीं' ? '' : String(record.boothNumber || '').toUpperCase().replace(/[^A-Z0-9\s/-]/g, '').trim(),
    censusDuty: String(record.censusDuty || '').trim(),
    censusArea: record.censusDuty === 'नहीं' ? '' : String(record.censusArea || '').trim(),
    ebCircleNumber: record.censusDuty === 'नहीं' ? '' : String(record.ebCircleNumber || '').replace(/[^0-9,\s]/g, '').trim(),
    censusWithElection: record.censusDuty === 'नहीं' ? '' : String(record.censusWithElection || '').trim(),
    timestamp: Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss')
  };

  // Determine target row if updating or if matching Manav Sampada ID / UDISE already exists
  var targetRowIndex = null;
  if (action === 'update' && requestedRowIndex && Number(requestedRowIndex) >= 2) {
    targetRowIndex = Number(requestedRowIndex);
  } else {
    var existing = readAllDataRecords_().records;
    for (var i = 0; i < existing.length; i++) {
      if (
        existing[i].udiseCode === cleanRecord.udiseCode &&
        manavSampadaId &&
        existing[i].manavSampadaId === manavSampadaId
      ) {
        targetRowIndex = existing[i].rowIndex;
        break;
      }
    }
  }

  var rowValues = buildRowArrayFromRecord_(headers, cleanRecord);

  var isUpdate = Boolean(targetRowIndex);
  var finalRow = isUpdate ? targetRowIndex : sheet.getLastRow() + 1;

  var range = sheet.getRange(finalRow, 1, 1, headers.length);
  // Set text format on UDISE, Mobile, Manav Sampada ID, EB Number to prevent leading-zero stripping
  setTextFormatsForNumericStrings_(sheet, finalRow, headers);
  range.setValues([rowValues]);

  cleanRecord.rowIndex = finalRow;

  return {
    success: true,
    mode: isUpdate ? 'updated' : 'saved',
    rowIndex: finalRow,
    record: cleanRecord,
    message: isUpdate
      ? 'Data updated successfully in Google Sheet!'
      : 'Data saved successfully to Google Sheet!'
  };
}

function setTextFormatsForNumericStrings_(sheet, rowIndex, headers) {
  var textCols = ['UDISE CODE', 'मोबाइल नंबर', 'मानव सम्पदा ID', 'ईबी नंबर/ सर्कल नंबर', 'बूथ संख्या'];
  for (var i = 0; i < headers.length; i++) {
    if (textCols.indexOf(headers[i]) !== -1) {
      sheet.getRange(rowIndex, i + 1).setNumberFormat('@');
    }
  }
}

function buildRowArrayFromRecord_(headers, rec) {
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h === 'UDISE CODE') {
      row.push(rec.udiseCode);
    } else if (h === 'विद्यालय का नाम') {
      row.push(rec.schoolName);
    } else if (h === 'न्याय पंचायत') {
      row.push(rec.nyayPanchayat);
    } else if (h === 'कार्मिक का नाम') {
      row.push(rec.employeeName);
    } else if (h === 'पद') {
      row.push(rec.designation);
    } else if (h === 'मोबाइल नंबर') {
      row.push(rec.mobileNumber);
    } else if (h === 'मानव सम्पदा ID') {
      row.push(rec.manavSampadaId);
    } else if (h === 'निर्वाचन डयूटी' || h === 'निर्वाचन डयूटी (हाँ/ नहीं )') {
      row.push(rec.electionDuty);
    } else if (h === 'विधानसभा बीएलओ/ सुपरवाईजर') {
      row.push(rec.assemblyRole);
    } else if (h === 'विधानसभा का नाम') {
      row.push(rec.assemblyName);
    } else if (h === 'बूथ संख्या') {
      row.push(rec.boothNumber);
    } else if (h === 'जनगणना डयूटी(प्रगणक/सुपरवाइज़र/ नहीं )') {
      row.push(rec.censusDuty);
    } else if (h === 'जनगणना डयूटी(हाँ/ नहीं )') {
      row.push(rec.censusDuty === 'नहीं' ? 'नहीं' : (rec.censusDuty ? 'हाँ' : ''));
    } else if (h === 'प्रगणक/सुपरवाइज़र') {
      row.push(rec.censusDuty === 'नहीं' ? '' : rec.censusDuty);
    } else if (h === 'जनगणना क्षेत्र') {
      row.push(rec.censusArea);
    } else if (h === 'ईबी नंबर/ सर्कल नंबर') {
      row.push(rec.ebCircleNumber);
    } else if (h === 'निर्वाचन डयूटी के साथ-साथ जनगणना करना चाहते हैं या नहीं') {
      row.push(rec.censusWithElection);
    } else if (h.toLowerCase() === 'timestamp') {
      row.push(rec.timestamp);
    } else {
      row.push('');
    }
  }
  return row;
}

function rowToRecordObject_(headers, row, rowIndex) {
  var censusCombined = getValByHeader_(headers, row, ['जनगणना डयूटी(प्रगणक/सुपरवाइज़र/ नहीं )']);
  var censusYesNo = getValByHeader_(headers, row, ['जनगणना डयूटी(हाँ/ नहीं )']);
  var censusRole = getValByHeader_(headers, row, ['प्रगणक/सुपरवाइज़र']);

  var resolvedCensusDuty = censusCombined;
  if (!resolvedCensusDuty) {
    if (censusYesNo === 'नहीं') {
      resolvedCensusDuty = 'नहीं';
    } else if (censusRole) {
      resolvedCensusDuty = censusRole;
    } else if (censusYesNo === 'हाँ') {
      resolvedCensusDuty = 'प्रगणक';
    }
  }

  return {
    rowIndex: rowIndex,
    udiseCode: normalizeUdise_(getValByHeader_(headers, row, ['UDISE CODE'])),
    schoolName: String(getValByHeader_(headers, row, ['विद्यालय का नाम']) || '').trim(),
    nyayPanchayat: String(getValByHeader_(headers, row, ['न्याय पंचायत']) || '').trim(),
    employeeName: String(getValByHeader_(headers, row, ['कार्मिक का नाम']) || '').trim(),
    designation: String(getValByHeader_(headers, row, ['पद']) || '').trim(),
    mobileNumber: String(getValByHeader_(headers, row, ['मोबाइल नंबर']) || '').trim(),
    manavSampadaId: String(getValByHeader_(headers, row, ['मानव सम्पदा ID']) || '').trim(),
    electionDuty: String(getValByHeader_(headers, row, ['निर्वाचन डयूटी', 'निर्वाचन डयूटी (हाँ/ नहीं )']) || '').trim(),
    assemblyRole: String(getValByHeader_(headers, row, ['विधानसभा बीएलओ/ सुपरवाईजर']) || '').trim(),
    assemblyName: String(getValByHeader_(headers, row, ['विधानसभा का नाम']) || '').trim(),
    boothNumber: String(getValByHeader_(headers, row, ['बूथ संख्या']) || '').trim(),
    censusDuty: String(resolvedCensusDuty || '').trim(),
    censusArea: String(getValByHeader_(headers, row, ['जनगणना क्षेत्र']) || '').trim(),
    ebCircleNumber: String(getValByHeader_(headers, row, ['ईबी नंबर/ सर्कल नंबर']) || '').trim(),
    censusWithElection: String(getValByHeader_(headers, row, ['निर्वाचन डयूटी के साथ-साथ जनगणना करना चाहते हैं या नहीं']) || '').trim(),
    timestamp: String(getValByHeader_(headers, row, ['Timestamp', 'TIMESTAMP', 'timestamp']) || '').trim()
  };
}

function findColIndex_(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var target = candidates[i].trim().toLowerCase();
    for (var j = 0; j < headers.length; j++) {
      if (String(headers[j]).trim().toLowerCase() === target) {
        return j;
      }
    }
  }
  return -1;
}

function getValByHeader_(headers, row, candidates) {
  var idx = findColIndex_(headers, candidates);
  if (idx === -1) return '';
  return row[idx];
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
