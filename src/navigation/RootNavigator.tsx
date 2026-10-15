import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { LanguageScreen } from '../screens/LanguageScreen';
import { AddFamilyScreen } from '../screens/AddFamilyScreen';
import { AddRecordScreen } from '../screens/AddRecordScreen';
import { FamilyProfileScreen } from '../screens/FamilyProfileScreen';
import { AddInvitationScreen } from '../screens/AddInvitationScreen';
import { InvitationPromptScreen } from '../screens/InvitationPromptScreen';
import { PinLockScreen } from '../screens/PinLockScreen';
import { FamilyGroupScreen } from '../screens/FamilyGroupScreen';
import { useSettingsStore } from '../store/settings';
import { colors } from '../theme';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';
import { flushQueuedNavigation, navigationRef, openInvitationPrompt } from './navigationRef';
import { useSecurityStore } from '../store/security';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    primary: colors.primary,
    border: colors.border,
    notification: colors.accent,
  },
};

export function RootNavigator() {
  const language = useSettingsStore((state) => state.language);
  const locked = useSecurityStore((state) => state.locked);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const invitationId = response.notification.request.content.data?.invitationId;
      if (typeof invitationId === 'string') openInvitationPrompt(invitationId);
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const invitationId = response?.notification.request.content.data?.invitationId;
      if (typeof invitationId === 'string') openInvitationPrompt(invitationId);
    });
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={flushQueuedNavigation}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {locked ? (
          <Stack.Screen name="PinLock" component={PinLockScreen} initialParams={{ mode: 'unlock' }} />
        ) : language === null ? (
          <Stack.Screen name="Language" component={LanguageScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} />
            <Stack.Screen name="AddFamily" component={AddFamilyScreen} />
            <Stack.Screen name="AddRecord" component={AddRecordScreen} />
            <Stack.Screen name="FamilyProfile" component={FamilyProfileScreen} />
            <Stack.Screen name="AddInvitation" component={AddInvitationScreen} />
            <Stack.Screen name="InvitationPrompt" component={InvitationPromptScreen} />
            <Stack.Screen name="PinLock" component={PinLockScreen} />
            <Stack.Screen name="FamilyGroup" component={FamilyGroupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
