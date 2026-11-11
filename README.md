# NEXORA — React Native (Expo SDK 58, TypeScript)

## Run in Expo Go
1. Install Node.js 20+ on your PC.
2. In this folder: `npm install`
3. `npx expo start` (if the phone is not on the same Wi-Fi: `npx expo start --tunnel`)
4. Open **Expo Go** on the phone (latest version, SDK 58) and scan the QR code.

Web preview: `npx expo start --web`

## Structure
- `src/game/engine.ts` — physics engine (pure TS, fixed 240 Hz sub-steps, render interpolation, AI)
- `src/game/render.ts` — Skia renderer (GPU sphere shader for the ball, glow, trails, particles)
- `src/screens/*` — Home, Pilot (discs), Armory (balls/arenas), Market, Profile, Settings, Setup, Match, Result
- `src/ui/Backdrop.tsx` — GPU nebula/starfield shader per sector
- `src/store.tsx` — local profile (AsyncStorage)

Online multiplayer/backend from the web build is not part of this version (offline: vs bot + local 2P).

## v3 (NX8 world UI)
- Home is now the 3D gate world from the "Nexora 3D Menu" page: warp intro, swipeable portal ring, holographic draggable panels (profile, shop, discs, settings, mode).
- Performance: match canvas no longer re-renders through React (picture pushed via a Reanimated shared value), pieces drawn from pre-rendered sprites, no per-frame blur, backdrop is baked images animated on the UI thread (no full-screen shader).
- Pieces enlarged (radius 42 -> 49). Ball curve (spin drift) removed: shots travel straight.
- To judge real speed, run without dev mode:  npx expo start --no-dev --minify -c

## v4 (full UI rebuild)
- New app shell: top HUD (level, coins, gems, daily gift, settings) + animated bottom tab bar (Home, Team, Play, Shop, Profile).
- Home hub: hero pedestal art, mascot, quick-play button, league strip, game-mode rail, command-deck menu plates, loadout, missions.
- Play: 3D swipe carousel of game modes (UI-thread scroll animation), league road, rewards.
- Team: discs (10 categories incl. new Elite 36, Emblems 16, Legends 6, Chrome 8), balls, fields, formation preview on a mini pitch.
- Shop: legendary discs, free + royal chests with opening animation, daily -30% deals, gem exchange, full catalogue.
- Profile: editable name, level, league, win-rate ring, stats, 8 achievements with claimable rewards.
- 7-day daily reward calendar, match setup bottom sheet, settings sheet (sound, music, haptics, graphics quality, default AI).
- Performance: expo-image (memory+disk cache), FlatList grids, all animation on the UI thread (Reanimated), "Smooth" graphics mode for weak phones.

## v2.0.0 (NEXORA 2)
**Online / backend (Supabase, `supabase/schema_v3.sql` — idempotent, applied to project `eisstodgncimypdawisy`)**
- Matchmaking rewrite for 1v1 / 2v2 / 3v3: one queue per mode+kind (+arena tier), serialized with an advisory lock (no more two players each creating their own room), re-queueing returns the same room (no double joins), only rooms with a live heartbeat are matched, the server starts the match itself the moment a room fills. Rematches: every player re-confirms, then the 3-2-1 countdown starts.
- Stale cleanup every minute via pg_cron (`_sweep_rooms`): silent players leave waiting rooms after 45 s, matches without any heartbeat for 90 s (or > 40 min) are abandoned and refunded, unfilled matchmade rooms close after 10 min, empty rooms are deleted, hosts are reassigned.
- Removed the ambiguous v1 `quick_match(text)` overload.
- **ARENA DUEL** (`duel_join(tier, mode)`, table `arena_tiers` + escrow `arena_stakes`): entry fee charged server-side when the match starts, prize paid by `report_match`, draws / abandoned / swept matches refunded.
  | Arena | Rule | Entry | Prize |
  |---|---|---|---|
  | BERMUDA ARENA | normal (first to 3) | 100 coins | 200 coins |
  | NEXORA ARENA | first to 3 goals | 250 coins | 500 coins |
  | NX ARENA | 5 minutes, leader wins (golden goal on a tie) | 500 coins | 1000 coins |
  | SPACE ARENA | 3 minutes | 2000 coins | 4000 coins |
  | KAKERO ARENA | first to 5 goals | 50 gems | 100 gems |
- **WORLD CUP** (`wc_tick`, `monthly_ranking`): one cup per month (Tehran calendar), seeded on the 25th from the top 64 of that month's ranking (3 pts win / 1 draw), 16 groups of 4 (3 rounds), top 2 of every group → knockout → final. Winner: 500 gems. Overdue matches are decided automatically (group 0-0, knockout: higher seed). pg_cron runs `wc_tick` hourly.
- Tournament / league rewards are gems only (≤ 30; the World Cup's 500 is the single exception). Custom tournaments: 4 / 8 / 16 / 32 / 64.
- Disc packs (`disc_packs`, `buy_pack`) priced 130–300 gems; single discs 135–300 gems; every disc has power + accuracy on a 1–10 scale that changes shot speed (×0.75–×1.25), aim error and aim-preview length.
- Varied daily challenges (5 per day, all of different kinds; new: quick matches, duels, big wins, follow, messages, club join, club challenges).
- Club team challenges (`club_challenge`, `club_challenge_respond`) → private room + system message in both club chats.
- Room management: host transfer, privacy / voice toggles, social (talk-only) rooms with text + voice chat.
- `livekit-token` edge function reads `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`; when it fails the app shows «چت صوتی هنوز فعال نشده» and everything else keeps working.

**App**
- New screens: Arena Duel, World Cup (qualification table with the top-64 cut line, groups, knockout bracket), Social (inbox, groups/channels, clubs, friends), Chat (realtime, image messages, read state, mute/leave), Club (members & roles, recruiting requests, invites, team challenges), public player profile (follow, private message, block, club invite). Custom profile photo upload (Supabase Storage `avatars` bucket, own-folder RLS).
- **Oracle**: a cheeky offline sidekick on Home (rule-based tips, hints and banter in Persian, 19 expressions).
- Match graphics: goal shockwave + glowing goal line, additive halo on a fast ball (pre-rendered sprites; disabled in the low-quality "Smooth" mode).
- Offline: vs bot (quick, NEXORA Cup — champion now gets 20 gems instead of coins —, galaxy, training) and local 2-player.
- Build: R8 keep rules for LiveKit/WebRTC through `expo-build-properties`; splash via the `expo-splash-screen` plugin; `expo-system-ui`.
