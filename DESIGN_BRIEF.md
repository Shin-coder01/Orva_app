Act as a senior product designer (UI/UX) with deep experience designing mobile
apps for non-technical and older users, and for Indian and Tamil-speaking
audiences. Design the complete mobile app below. You make ALL visual decisions
yourself: color, typography, iconography, illustration style, shape language,
spacing, elevation and motion. Choose with intent, and explain every major
choice briefly (why it suits these users). Do not ask me which direction to
take. Explore internally, choose the strongest one, and design it fully.

PRODUCT
"Murai Kanakku" is a digital version of the traditional Tamil family notebook.
It records how much our family gave another family at their functions (weddings,
housewarmings and so on) and how much they gave us at ours. For each family it
shows: total we gave, total they gave, the difference, and the full history.
The core promise: before attending someone's function, the user can find that
family and understand the whole history in a few seconds.

USERS
Parents and grandparents with low tech comfort, who dislike typing, plus their
adult children. The design must feel easy to a 60-year-old and modern to a
25-year-old.

NON-NEGOTIABLE RULES
- It must NOT feel like a banking, accounting, stock, expense or investment app.
  It should feel like a modern, warm, trustworthy family notebook.
- Facts only: the app shows recorded amounts and the difference. It never
  recommends an amount, never says "owe", "due" or "pending", and never makes one
  side look like it is winning or losing.
- Minimal typing: anything that can be tapped should be tapped.
- Family-first: the account is a family, not an individual.
- English and Tamil with an in-app language switch. Design every screen for both
  languages. Tamil script is taller than Latin, so avoid fixed heights and never
  truncate names with ellipses; wrap them.
- Never rely on color alone to carry meaning (use labels and icons too).
- Accessibility: strong contrast, text scaling up to 200%, touch targets at least
  48px, large readable numbers, no gesture-only actions (edit/delete must be
  visible buttons).
- Thumb-friendly: primary actions within easy reach.

SCREENS TO DESIGN (phone, 390x844)
1. First-launch language choice (English / தமிழ்)
2. Home: Upcoming invitations (each with the family's totals), recent records,
   a compact summary of 4 numbers (families, functions, total given, total
   received). No charts.
3. Families list with a prominent search box
4. Family Profile (the hero screen): summary (we gave / they gave / difference
   sentence), "last they gave", "last we gave", and the history grouped by year
5. Add Family (name only at first; "More details" collapsed: village, primary
   person, relationship, phone, notes)
6. Add Record: family, function-type chips, date (with "year only" option), two
   big buttons We gave / They gave, amount (quick chips 500 / 1,000 / 2,000 /
   5,000 / 10,000, a "+1" toggle, a number pad), optional notes, Save
7. Add Invitation: family, function type, date, optional time, reminders
8. "Did you go?" prompt for a past invitation (Attended / Skipped)
9. Functions tab: all records with filters (year, type, who gave, family)
10. Settings: language, PIN and biometric lock, cloud backup and sync (email
    sign-in), backup file, about
11. PIN lock screen
12. States: empty states, delete confirmation with undo, offline and sync
    status, a very long family name, Tamil version, largest text size
Do not add screens, charts or features I did not list.

SAMPLE DATA (use this, not lorem ipsum)
- Ravi Family (village: Salem; mother's brother): we gave 15,000, they gave
  10,000, "We gave ₹5,000 more". History: 03 Oct 2026 Our brother wedding (They
  gave 5,000); 20 Jun 2026 Their son wedding (We gave 10,000); 2025 Our sister
  wedding (They gave 5,000, year only); 03 Oct 2024 Their daughter wedding
  (We gave 5,000).
- Kumar Family: we gave 5,000, they gave 8,000, "They gave ₹3,000 more".
- Suresh Family: we gave 10,000, they gave 10,000, "Both gave ₹10,000".
- Upcoming: Ravi Family, wedding, 15 Nov 2026.
- Amounts use Indian digit grouping (₹1,00,000) and Latin digits in both languages.

DELIVERABLES
1. Design rationale: brand personality, design principles, and why your visual
   choices suit these users.
2. A clickable prototype using Sites, mobile-sized, with working flows:
   first launch -> Home -> open a family -> Add Record -> saved -> history
   updated; the language toggle must work.
3. All screens above in English and Tamil, including the states in item 12.
4. A design system: color tokens (light mode, plus dark mode if it improves the
   product), type scale for Latin and Tamil, spacing, radii, shadows, icon set,
   motion rules, and component specs (family card, record row, amount chips,
   direction toggle, summary card, upcoming card, buttons, inputs, tab bar).
5. Developer handoff: provide the tokens as a TypeScript file with plain numbers
   for React Native. Use only layouts that map to React Native (flexbox, no CSS
   grid, no hover states, no backdrop blur). Use free fonts with proper Tamil
   support so the Latin and Tamil fonts look harmonious, and an open-source icon
   set.
6. Before presenting, review your own design against a checklist (contrast,
   touch targets, Tamil clipping, large text, consistency between screens) and
   fix any problems you find.