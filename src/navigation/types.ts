export type RootStackParamList = {
  Language: undefined;
  Tabs: undefined;
  AddFamily: { familyId?: string; returnToRecord?: boolean } | undefined;
  AddRecord: {
    familyId?: string;
    recordId?: string;
    invitationId?: string;
    functionType?: import('../domain/types').FunctionType;
    functionName?: string | null;
    date?: string;
  } | undefined;
  FamilyProfile: { familyId: string };
  AddInvitation: { familyId?: string; invitationId?: string } | undefined;
  InvitationPrompt: { invitationId: string };
  PinLock: { mode?: 'setup' | 'unlock' } | undefined;
  FamilyGroup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Families: undefined;
  Add: undefined;
  Functions: undefined;
  Settings: undefined;
};
