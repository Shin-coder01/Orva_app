export type DatePrecision = 'DAY' | 'YEAR';

export type FunctionType =
  | 'WEDDING'
  | 'ENGAGEMENT'
  | 'HOUSEWARMING'
  | 'BABY_FUNCTION'
  | 'EAR_PIERCING'
  | 'PUBERTY_CEREMONY'
  | 'BIRTHDAY'
  | 'FUNERAL'
  | 'FESTIVAL'
  | 'OTHER';

export type RecordDirection = 'WE_GAVE' | 'THEY_GAVE';
export type RecordKind = 'MONEY';

export type InvitationStatus = 'UPCOMING' | 'ATTENDED' | 'SKIPPED';
export type ReminderOffset = '7D' | '1D' | 'MORNING_OF' | 'EVENING_OF' | 'NEXT_MORNING';

export type Family = {
  id: string;
  familyName: string;
  primaryPerson: string | null;
  place: string | null;
  relationship: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDirty: boolean;
};

export type FunctionRecord = {
  id: string;
  familyId: string;
  date: string;
  datePrecision: DatePrecision;
  functionType: FunctionType;
  functionName: string | null;
  direction: RecordDirection;
  recordKind: RecordKind;
  amount: number;
  addedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDirty: boolean;
};

export type Invitation = {
  id: string;
  familyId: string;
  functionType: FunctionType;
  functionName: string | null;
  functionDate: string;
  functionTime: string | null;
  remindersEnabled: boolean;
  reminderOffsets: ReminderOffset[];
  status: InvitationStatus;
  notes: string | null;
  notificationIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDirty: boolean;
};

export type DifferenceDirection = 'WE_GAVE_MORE' | 'THEY_GAVE_MORE' | 'EQUAL';

export type FamilyBalance = {
  totalGiven: number;
  totalReceived: number;
  difference: number;
  differenceDirection: DifferenceDirection;
  recordCount: number;
  theirFunctionCount: number;
  ourFunctionCount: number;
};
