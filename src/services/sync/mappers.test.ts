import { describe, expect, it } from '@jest/globals';

import { invitationFromCloud, invitationToCloud, recordFromCloud, recordToCloud } from './mappers';
import { sampleInvitations, sampleRecords } from '../../domain/sampleData';

describe('cloud mappers', () => {
  it('round-trips amount zero and addedBy with household_id only in the cloud row', () => {
    const record = { ...sampleRecords[0], amount: 0, addedBy: 'Appa' };
    const cloud = recordToCloud(record, 'group-a');
    expect(cloud).toMatchObject({ household_id: 'group-a', amount: 0, added_by: 'Appa' });
    expect(recordFromCloud(cloud)).toMatchObject({ familyId: record.familyId, amount: 0, addedBy: 'Appa', isDirty: false });
    expect(recordFromCloud(cloud)).not.toHaveProperty('householdId');
  });

  it('round-trips invitation reminder offsets without device notification ids', () => {
    const invitation = sampleInvitations[0];
    const cloud = invitationToCloud(invitation, 'group-a');
    expect(cloud.household_id).toBe('group-a');
    expect(cloud).not.toHaveProperty('notificationIds');
    expect(invitationFromCloud(cloud)).toMatchObject({ familyId: invitation.familyId, reminderOffsets: invitation.reminderOffsets, notificationIds: [] });
  });
});
