# Combat Tracker MVP Manual Test Checklist

- Log in as GM, open `/gm`, create a session, and confirm it appears in "Your Sessions".
- Add at least three combatants with different initiatives; verify sort order updates.
- Edit HP and condition values for a combatant and verify persistence after page refresh.
- Use "Start Encounter" and "Next Turn" repeatedly; verify round/turn progression is correct.
- Open a second browser as a player, join with the GM session UUID on `/player`, and verify live updates.
- Confirm player view is read-only (no mutation controls shown).
- Attempt direct player write operations via client console and verify RLS blocks unauthorized updates.
