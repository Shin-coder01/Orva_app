export type MergeChoice<T> = { kind: 'insert' | 'replace'; value: T } | { kind: 'keep-local'; value: T };

export function chooseMergedRow<T extends { updatedAt: string; isDirty: boolean }>(local: T | null, remote: T): MergeChoice<T> {
  if (!local) return { kind: 'insert', value: { ...remote, isDirty: false } };
  if (!local.isDirty) return { kind: 'replace', value: { ...remote, isDirty: false } };
  if (remote.updatedAt >= local.updatedAt) return { kind: 'replace', value: { ...remote, isDirty: false } };
  return { kind: 'keep-local', value: local };
}
