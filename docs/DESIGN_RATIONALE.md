# Orva Design Rationale

## Direction

Orva is a quiet, contemporary family notebook. Its paper-tinted background and dark green ink reference a dependable written record, while a small rust accent calls attention to reminders and warnings without making either side of the history feel like a winner. White surfaces separate repeatable tasks and records from the page without decorative depth or nested cards.

The app uses large, direct labels and familiar controls. A family can be added with only a name; optional details stay collapsed. Dates, function types, directions, amounts, and filters use taps instead of typing wherever practical. Edit and delete actions remain visible. We avoid charts, financial metaphors, and color-only meaning so a relative can scan a profile without interpreting a new visual language.

## Type and Color

English uses Noto Sans and Tamil uses Noto Sans Tamil from the Expo Google Fonts packages. They share a straightforward, readable shape and are selected per language. Body copy is 18sp with 29sp line height, section labels are 20sp, and the amount display uses the 32sp heading style. React Native font scaling stays enabled.

The light palette is intentional for daylight phone use and paper-like continuity. Dark mode is omitted so contrast and the app's calm, familiar reading surface stay consistent.

| Token | Value | Use |
|---|---|---|
| `paper` | `#F4F6F2` | Main page background |
| `surface` | `#FFFFFF` | Inputs and grouped records |
| `ink` | `#20332F` | Main text |
| `muted` | `#596A65` | Secondary text |
| `primary` | `#245B52` | Primary actions and selected state |
| `accent` | `#A94F37` | Reminder and warning emphasis |
| `danger` | `#8A3B32` | Destructive actions |
| `border` | `#D8E0DC` | Control and section boundaries |

## Components

The tokens are plain React Native values in `src/theme/colors.ts`, `src/theme/spacing.ts`, and `src/theme/typography.ts`, re-exported from `src/theme/index.ts`. Spacing uses 4, 8, 12, 16, 24, 32, and 40dp. Pressable controls and icon buttons are at least 48dp high; standard action buttons and inputs are 54dp. Surfaces use an 8dp radius. Lucide React Native supplies the icon set.

Family, upcoming, and history rows use wrapped text so Tamil and unusually long names can grow vertically. Amounts are right-aligned where they sit next to action controls; direction is always written as a label. Navigation transitions stay restrained and state-focused.

## Review Checklist

- English and Tamil keys are required to match; automated tests check parity.
- Family names and function labels wrap rather than truncate.
- Body and secondary text contrast are checked against the light surface palette.
- Tap targets meet the 48dp minimum for the app's primary controls.
- Android system text scaling, notification permissions, Face ID, and real-device Tamil clipping still require a release-device pass before publication.
