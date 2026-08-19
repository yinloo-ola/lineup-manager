# Lineup Manager

Team managers submit match lineups; an administrator oversees them. The work is organised around tournaments. The domain is table tennis.

## Language

**Tournament**:
A single competition. Teams, team events, team matches, and lineups all belong to exactly one tournament.
_Avoid_: season, competition, event, league

**Team**:
A club's entry in one tournament. A team belongs to exactly one tournament; the same club in another tournament is a different team.
_Avoid_: club (a club may field several teams), squad

**Player**:
A person who belongs to exactly one team and can be named in that team's lineups.
_Avoid_: member, athlete, roster entry

**Team Event**:
A team competition within a tournament (e.g. Men's Team). A tournament has several team events; each carries its own team match format — its format of play — and its team matches are contested between teams.
_Avoid_: division, group, class

**Team Match**:
A team-versus-team fixture within a team event, composed of several matches. Agreed as the on-screen term in both this app and the organizer's tournament-manager (terminology-only cross-app consistency; visual patterns stay per-app).
_Avoid_: tie, fixture, rubber-set

**Match**:
One individual discipline contest within a team match (e.g. Men's Singles, Mixed Doubles), with its own player constraints. Played as best-of-N games.
_Avoid_: rubber, game, slot

**Bracket Slot**:
One of the two team positions in a knockout team match. Identified by its bracket position (round and slot) before either team is known; filled progressively — the first knockout round after the group stage, later rounds as the previous round completes.
_Avoid_: placeholder, TBD entry, player slot

**Game**:
One scoring game within a match (table tennis: first to 11). Beyond the lineup system, which assigns players to matches — a player plays all games of their match.
_Avoid_: point, set

**Team Match Format**:
The rules for a team event's team matches — its matches (disciplines), their player constraints, the player usage policy, and the submission lead time. One per team event. Frozen once its tournament starts; before that, an edit that would break submitted lineups requires explicit confirmation.
_Avoid_: tie format, ruleset, template

**Lineup**:
One team's player assignments to the matches of one team match.
_Avoid_: submission, roster, selection

**Lineup Status**:
Where a team's lineup stands for one team match: **Submitted** or **Not submitted** — with a **Needs attention** marker in the rare case a pre-start format change broke a submitted lineup. **Locked** is not a status: it marks a team match past its cutoff. A lineup still missing once the cutoff has passed is flagged **Missed cutoff** — the urgent, actionable case (chase the manager, or the admin fills the lineup on the team's behalf).
_Avoid_: invalidated, not-started and draft outside the lineup builder, complete/incomplete (reserved for match results)

**Team Manager**:
A user in charge of exactly one team, who authors that team's lineups.
_Avoid_: coach, captain

**Administrator**:
The single operator who runs tournaments, provisions team managers, authors team match formats, and oversees every lineup.
_Avoid_: superuser, owner
