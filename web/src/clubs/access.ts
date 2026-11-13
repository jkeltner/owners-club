// Who sees what inside a club (docs/concept.md, "Organizers see the club").
// Every screen that shows another player's portfolio asks here first.

export type Viewer = { id: string; clubId: string; role: "organizer" | "member"; plays: boolean };

export type View =
  | "none" // not in the same club: nothing
  | "own" // your own portfolio: dollars, live
  | "organizer" // a non-playing organizer: dollars, live, for every player
  | "clubmate"; // anyone else in the club: shares of the whole, a week late

export function viewOf(viewer: Viewer | null | undefined, target: { id: string; clubId: string }): View {
  if (!viewer || viewer.clubId !== target.clubId) return "none";
  if (viewer.id === target.id) return "own";
  // An organizer who also plays sees what any player sees, so they can't copy trades.
  if (viewer.role === "organizer" && !viewer.plays) return "organizer";
  return "clubmate";
}

export const seesDollars = (view: View) => view === "own" || view === "organizer";
export const canManageClub = (viewer: Viewer | null | undefined) => viewer?.role === "organizer";
