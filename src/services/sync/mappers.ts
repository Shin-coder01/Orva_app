import type { Family, FunctionRecord, Invitation, ReminderOffset } from '../../domain/types';

export type CloudFamily = {
  id: string; household_id: string; family_name: string; primary_person: string | null; place: string | null;
  relationship: string | null; phone: string | null; notes: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};
export type CloudRecord = {
  id: string; household_id: string; family_id: string; date: string; date_precision: FunctionRecord['datePrecision'];
  function_type: FunctionRecord['functionType']; function_name: string | null; direction: FunctionRecord['direction'];
  record_kind: FunctionRecord['recordKind']; amount: number; added_by: string | null; notes: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
};
export type CloudInvitation = {
  id: string; household_id: string; family_id: string; function_type: Invitation['functionType']; function_name: string | null;
  function_date: string; function_time: string | null; reminders_enabled: boolean; reminder_offsets: ReminderOffset[];
  status: Invitation['status']; notes: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};

export function familyToCloud(family: Family, householdId: string): CloudFamily {
  return {
    id: family.id,
    household_id: householdId,
    family_name: family.familyName,
    primary_person: family.primaryPerson,
    place: family.place,
    relationship: family.relationship,
    phone: family.phone,
    notes: family.notes,
    created_at: family.createdAt,
    updated_at: family.updatedAt,
    deleted_at: family.deletedAt,
  };
}

export function familyFromCloud(row: Record<string, unknown>): Family {
  return {
    id: String(row.id),
    familyName: String(row.family_name),
    primaryPerson: row.primary_person == null ? null : String(row.primary_person),
    place: row.place == null ? null : String(row.place),
    relationship: row.relationship == null ? null : String(row.relationship),
    phone: row.phone == null ? null : String(row.phone),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
    isDirty: false,
  };
}

export function recordToCloud(record: FunctionRecord, householdId: string): CloudRecord {
  return {
    id: record.id,
    household_id: householdId,
    family_id: record.familyId,
    date: record.date,
    date_precision: record.datePrecision,
    function_type: record.functionType,
    function_name: record.functionName,
    direction: record.direction,
    record_kind: record.recordKind,
    amount: record.amount,
    added_by: record.addedBy,
    notes: record.notes,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

export function recordFromCloud(row: Record<string, unknown>): FunctionRecord {
  return {
    id: String(row.id),
    familyId: String(row.family_id),
    date: String(row.date),
    datePrecision: row.date_precision as FunctionRecord['datePrecision'],
    functionType: row.function_type as FunctionRecord['functionType'],
    functionName: row.function_name == null ? null : String(row.function_name),
    direction: row.direction as FunctionRecord['direction'],
    recordKind: row.record_kind as FunctionRecord['recordKind'],
    amount: Number(row.amount),
    addedBy: row.added_by == null ? null : String(row.added_by),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
    isDirty: false,
  };
}

export function invitationToCloud(invitation: Invitation, householdId: string): CloudInvitation {
  return {
    id: invitation.id,
    household_id: householdId,
    family_id: invitation.familyId,
    function_type: invitation.functionType,
    function_name: invitation.functionName,
    function_date: invitation.functionDate,
    function_time: invitation.functionTime,
    reminders_enabled: invitation.remindersEnabled,
    reminder_offsets: invitation.reminderOffsets,
    status: invitation.status,
    notes: invitation.notes,
    created_at: invitation.createdAt,
    updated_at: invitation.updatedAt,
    deleted_at: invitation.deletedAt,
  };
}

export function invitationFromCloud(row: Record<string, unknown>): Invitation {
  const offsets = Array.isArray(row.reminder_offsets) ? row.reminder_offsets : ['7D', '1D', 'MORNING_OF'];
  return {
    id: String(row.id),
    familyId: String(row.family_id),
    functionType: row.function_type as Invitation['functionType'],
    functionName: row.function_name == null ? null : String(row.function_name),
    functionDate: String(row.function_date),
    functionTime: row.function_time == null ? null : String(row.function_time).slice(0, 5),
    remindersEnabled: row.reminders_enabled === true,
    reminderOffsets: offsets.filter((item): item is ReminderOffset => ['7D', '1D', 'MORNING_OF', 'EVENING_OF', 'NEXT_MORNING'].includes(String(item))),
    status: row.status as Invitation['status'],
    notes: row.notes == null ? null : String(row.notes),
    notificationIds: [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at == null ? null : String(row.deleted_at),
    isDirty: false,
  };
}
