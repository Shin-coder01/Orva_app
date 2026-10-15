import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { Family, FunctionRecord, Invitation } from '../domain/types';
import { listFamilies } from '../db/repositories/familyRepository';
import { listRecords } from '../db/repositories/recordRepository';
import { listInvitations } from '../db/repositories/invitationRepository';
import { getSyncValue } from '../db/repositories/syncStateRepository';

export function useFamilies() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setFamilies(await listFamilies());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { families, loading, error, refresh };
}

export function useRecords(familyId?: string) {
  const [records, setRecords] = useState<FunctionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setRecords(await listRecords(familyId));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [familyId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { records, loading, error, refresh };
}

export function useInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setInvitations(await listInvitations());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return { invitations, loading, error, refresh };
}

export function useFamilyGroupMemberCount() {
  const [memberCount, setMemberCount] = useState(1);
  const refresh = useCallback(async () => {
    try {
      const value = Number(await getSyncValue('memberCount'));
      setMemberCount(Number.isFinite(value) && value > 0 ? value : 1);
    } catch {
      setMemberCount(1);
    }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return memberCount;
}
