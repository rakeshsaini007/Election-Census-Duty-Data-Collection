export type UserRole = 'user' | 'developer';

export interface SchoolRecord {
  udiseCode: string;
  schoolName: string;
  nyayPanchayat: string;
}

export interface DutyRecord {
  rowIndex?: number;
  udiseCode: string;
  schoolName: string;
  nyayPanchayat: string;
  employeeName: string;
  designation: string;
  mobileNumber: string;
  manavSampadaId: string;
  electionDuty: '' | 'हाँ' | 'नहीं';
  assemblyRole: string;
  assemblyName: string;
  boothNumber: string;
  censusDuty: '' | 'प्रगणक' | 'सुपरवाइज़र' | 'नहीं';
  censusArea: string;
  ebCircleNumber: string;
  censusWithElection: '' | 'हाँ' | 'नहीं';
  timestamp?: string;
}

export const ASSEMBLY_CONSTITUENCIES = [
  '34-स्वार',
  '35-चमरव्वा',
  '36-बिलासपुर',
  '37-रामपुर',
  '38-मिलक',
] as const;

export const CENSUS_AREAS = [
  'स्वार ग्रामीण',
  'स्वार नगर पालिका',
  'टाण्डा ग्रामीण',
  'टाण्डा नगर पालिका',
  'दढियाल',
  'नरपतनगर',
  'मसबासी',
] as const;

export const ELECTION_DUTY_OPTIONS = ['हाँ', 'नहीं'] as const;
export const ASSEMBLY_ROLE_OPTIONS = ['BLO', 'SUPERVISOR'] as const;
export const CENSUS_DUTY_OPTIONS = ['प्रगणक', 'सुपरवाइज़र', 'नहीं'] as const;
export const YES_NO_OPTIONS = ['हाँ', 'नहीं'] as const;

export const EMPTY_DUTY_RECORD: DutyRecord = {
  udiseCode: '',
  schoolName: '',
  nyayPanchayat: '',
  employeeName: '',
  designation: '',
  mobileNumber: '',
  manavSampadaId: '',
  electionDuty: '',
  assemblyRole: '',
  assemblyName: '',
  boothNumber: '',
  censusDuty: '',
  censusArea: '',
  ebCircleNumber: '',
  censusWithElection: '',
  timestamp: '',
};
