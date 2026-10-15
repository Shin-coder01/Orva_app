import type { Family, FunctionRecord, Invitation } from './types';

const timestamp = '2026-10-05T00:00:00.000Z';

export const sampleFamilies: Family[] = [
  {
    id: 'sample-ravi',
    familyName: 'Ravi Family',
    primaryPerson: null,
    place: 'Salem',
    relationship: "Mother's brother",
    phone: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    isDirty: true,
  },
  {
    id: 'sample-kumar',
    familyName: 'Kumar Family',
    primaryPerson: null,
    place: null,
    relationship: null,
    phone: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    isDirty: true,
  },
  {
    id: 'sample-suresh',
    familyName: 'Suresh Family',
    primaryPerson: null,
    place: null,
    relationship: null,
    phone: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    isDirty: true,
  },
];

export const sampleRecords: FunctionRecord[] = [
  {
    id: 'sample-ravi-2024', familyId: 'sample-ravi', date: '2024-10-03', datePrecision: 'DAY',
    functionType: 'WEDDING', functionName: 'Their daughter wedding', direction: 'WE_GAVE',
    recordKind: 'MONEY', amount: 5000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp,
    deletedAt: null, isDirty: true,
  },
  {
    id: 'sample-ravi-2025', familyId: 'sample-ravi', date: '2025-01-01', datePrecision: 'YEAR',
    functionType: 'WEDDING', functionName: 'Our sister wedding', direction: 'THEY_GAVE',
    recordKind: 'MONEY', amount: 5000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp,
    deletedAt: null, isDirty: true,
  },
  {
    id: 'sample-ravi-2026-jun', familyId: 'sample-ravi', date: '2026-06-20', datePrecision: 'DAY',
    functionType: 'WEDDING', functionName: 'Their son wedding', direction: 'WE_GAVE',
    recordKind: 'MONEY', amount: 10000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp,
    deletedAt: null, isDirty: true,
  },
  {
    id: 'sample-ravi-2026-oct', familyId: 'sample-ravi', date: '2026-10-03', datePrecision: 'DAY',
    functionType: 'WEDDING', functionName: 'Our brother wedding', direction: 'THEY_GAVE',
    recordKind: 'MONEY', amount: 5000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp,
    deletedAt: null, isDirty: true,
  },
  {
    id: 'sample-kumar-2024', familyId: 'sample-kumar', date: '2024-02-14', datePrecision: 'DAY',
    functionType: 'WEDDING', functionName: null, direction: 'WE_GAVE', recordKind: 'MONEY',
    amount: 5000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, isDirty: true,
  },
  {
    id: 'sample-kumar-2025', familyId: 'sample-kumar', date: '2025-08-02', datePrecision: 'DAY',
    functionType: 'BABY_FUNCTION', functionName: null, direction: 'THEY_GAVE', recordKind: 'MONEY',
    amount: 8000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, isDirty: true,
  },
  {
    id: 'sample-suresh-2023', familyId: 'sample-suresh', date: '2023-05-21', datePrecision: 'DAY',
    functionType: 'WEDDING', functionName: null, direction: 'WE_GAVE', recordKind: 'MONEY',
    amount: 10000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, isDirty: true,
  },
  {
    id: 'sample-suresh-2025', familyId: 'sample-suresh', date: '2025-01-12', datePrecision: 'DAY',
    functionType: 'HOUSEWARMING', functionName: null, direction: 'THEY_GAVE', recordKind: 'MONEY',
    amount: 10000, addedBy: null, notes: null, createdAt: timestamp, updatedAt: timestamp, deletedAt: null, isDirty: true,
  },
];

export const sampleInvitations: Invitation[] = [{
  id: 'sample-ravi-upcoming',
  familyId: 'sample-ravi',
  functionType: 'WEDDING',
  functionName: null,
  functionDate: '2026-11-15',
  functionTime: null,
  remindersEnabled: true,
  reminderOffsets: ['7D', '1D', 'MORNING_OF', 'EVENING_OF', 'NEXT_MORNING'],
  status: 'UPCOMING',
  notes: null,
  notificationIds: [],
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: null,
  isDirty: true,
}];
