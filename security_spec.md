# Security Specification — Street Cage 29 Global Leaderboard

## 1. Data Invariants
1. **Identity Ownership**: `/leaderboard/{playerId}` documents MUST have `playerId == request.auth.uid` and `data.uid == request.auth.uid`. Verified Google Sign-In (`email_verified == true`) is required for all writes.
2. **PII Isolation**: No `email`, `phone`, or private tokens are stored in `/leaderboard/{playerId}`.
3. **Score Integrity**: `totalScore` MUST strictly equal `(goalsScored * 400) + (ankleBreakers * 250) + (pannas * 350)`, and `dribblesLanded` MUST strictly equal `ankleBreakers + pannas`.
4. **Monotonic Progression & Anti-Cheat Caps**: On update, `totalScore`, `goalsScored`, `dribblesLanded`, `ankleBreakers`, `pannas`, `wins`, and `bestMatchScore` cannot decrease, `matchesPlayed` increments by exactly `1` on match submission, and single-match deltas are bounded (`goals <= 30`, `ankleBreakers <= 40`, `pannas <= 30`).
5. **Immutable Fields**: `uid` and `createdAt` cannot change after creation.
6. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
7. **Strict Key & Size Bounds**: Exact 14-key allowlist (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly` per action on update); `playerName` 1..32 chars, hex colors exactly 7 chars matching `^#[0-9a-fA-F]{6}$`, IDs matching `^[a-zA-Z0-9_-]+$` up to 128 chars.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Create `/leaderboard/userA` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: Create `/leaderboard/userA` with `email_verified == false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing (Path)**: UserB attempts `create` or `update` on `/leaderboard/userA` -> `PERMISSION_DENIED`.
4. **Identity Spoofing (Payload)**: UserA writes `uid: "userB"` inside `/leaderboard/userA` -> `PERMISSION_DENIED`.
5. **Ghost / Shadow Field Injection**: UserA includes extra key `isAdmin: true` or `verifiedBadge: true` -> `PERMISSION_DENIED`.
6. **Score Inflation / Formula Bypass**: UserA submits `goalsScored: 1, ankleBreakers: 0, pannas: 0, totalScore: 999999` -> `PERMISSION_DENIED`.
7. **Dribble Count Mismatch**: UserA submits `ankleBreakers: 1, pannas: 1, dribblesLanded: 50` -> `PERMISSION_DENIED`.
8. **Impossible Single-Match Spike**: UserA increments `goalsScored` by `+500` in one match -> `PERMISSION_DENIED`.
9. **Score Rollback / Negative Values**: UserA submits `totalScore: -100` or decreases `matchesPlayed` -> `PERMISSION_DENIED`.
10. **Client-Forged Timestamp**: UserA sets `updatedAt` to a client `Timestamp` instead of `request.time` -> `PERMISSION_DENIED`.
11. **Oversized String / Resource Poisoning**: UserA sends a 2KB `playerName` or malformed `jerseyColor: "red"` -> `PERMISSION_DENIED`.
12. **Client Delete Attempt**: UserA attempts `delete` on `/leaderboard/userA` -> `PERMISSION_DENIED`.
