import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  BookOpenText,
  House,
  Plus,
  Settings2,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AddScreen } from '../screens/AddScreen';
import { FamiliesScreen } from '../screens/FamiliesScreen';
import { FunctionsScreen } from '../screens/FunctionsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors, radii, spacing } from '../theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const icons: Record<keyof MainTabParamList, LucideIcon> = {
  Home: House,
  Families: UsersRound,
  Add: Plus,
  Functions: BookOpenText,
  Settings: Settings2,
};

export function TabNavigator() {
  const { t } = useTranslation();

  const labels: Record<keyof MainTabParamList, string> = {
    Home: t('tabs.home'),
    Families: t('tabs.families'),
    Add: t('tabs.add'),
    Functions: t('tabs.functions'),
    Settings: t('tabs.settings'),
  };
  const accessibility: Record<keyof MainTabParamList, string> = {
    Home: t('tabs.homeAccess'),
    Families: t('tabs.familiesAccess'),
    Add: t('tabs.addAccess'),
    Functions: t('tabs.functionsAccess'),
    Settings: t('tabs.settingsAccess'),
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const Icon = icons[route.name];
        const isAdd = route.name === 'Add';
        return {
          headerShown: false,
          tabBarLabel: labels[route.name],
          tabBarAccessibilityLabel: accessibility[route.name],
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: styles.label,
          tabBarItemStyle: styles.item,
          tabBarStyle: styles.bar,
          tabBarIcon: ({ color, focused }) =>
            isAdd ? (
              <View style={[styles.addButton, focused && styles.addButtonFocused]}>
                <Icon color={colors.white} size={25} strokeWidth={2.5} />
              </View>
            ) : (
              <Icon color={color} size={23} strokeWidth={focused ? 2.3 : 1.9} />
            ),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Families" component={FamiliesScreen} />
      <Tab.Screen name="Add" component={AddScreen} />
      <Tab.Screen name="Functions" component={FunctionsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 82,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
  },
  item: {
    minHeight: 58,
  },
  label: {
    fontSize: 13,
    marginTop: 2,
    paddingBottom: 1,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radii.round,
    borderWidth: 3,
    height: 54,
    justifyContent: 'center',
    marginTop: -22,
    width: 54,
  },
  addButtonFocused: {
    backgroundColor: colors.primaryPressed,
  },
});
