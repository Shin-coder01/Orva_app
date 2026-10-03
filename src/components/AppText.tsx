import { Text, type TextProps, type TextStyle } from 'react-native';

import { useSettingsStore } from '../store/settings';
import { colors, fontFamily, typeScale } from '../theme';

type TextVariant = keyof typeof typeScale;

type AppTextProps = TextProps & {
  variant?: TextVariant;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

export function AppText({
  variant = 'body',
  weight = 'regular',
  style,
  ...props
}: AppTextProps) {
  const language = useSettingsStore((state) => state.language) ?? 'en';
  const familyWeight = weight === 'regular' && variant === 'brand' ? 'bold' : weight;

  return (
    <Text
      {...props}
      style={[
        typeScale[variant] as TextStyle,
        { color: colors.ink, fontFamily: fontFamily(language, familyWeight) },
        style,
      ]}
    />
  );
}
