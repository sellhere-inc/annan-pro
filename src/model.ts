export type Role = 'member' | 'annan' | 'admin';
export type Profile = { user_id: string; full_name: string; email: string; role: Role; status: 'payment' | 'pending' | 'approved' | 'rejected'; payment_reference: string; rejection_reason: string; created_at: string; approved_at: string | null };
export type Person = { id: string; name: string; is_on: boolean; note: string; negative_points: number; updated_at: string; version: number };
export type Activity = { id: string; person_id: string; person_name: string; kind: 'off' | 'on' | 'points' | 'note' | 'added'; note: string; points: number; created_at: string; actor_name?: string; actor_role?: Role };
export type Comment = { id: string; person_id: string; author_name: string; author_role: Role; body: string; created_at: string; activity_id: string | null };
export type Snapshot = { people: Person[]; activity: Activity[]; comments: Comment[] };
export type Edit = { isOn: boolean; note: string; points: number };
export function validateEdit(person: Person, edit: Edit, role: Role) {
  if (role === 'member') throw new Error('Only admin and Annan can edit people.');
  if (!Number.isInteger(edit.points) || Math.abs(edit.points) > 100) throw new Error('Enter a whole number from −100 to 100.');
  if (edit.points < 0 && role !== 'annan') throw new Error('Only Annan can reduce violations.');
  const total = person.negative_points + edit.points;
  if (total < 0) throw new Error('You cannot remove more violations than the current count.');
  if (edit.isOn !== (total === 0)) throw new Error('A person stays off until Annan clears all violations.');
  if (!person.is_on && edit.isOn && !(role === 'annan' && edit.points < 0)) throw new Error('Only a reduction by Annan can turn this person on.');
  if (!edit.note.trim()) throw new Error('Add a comment explaining this change.');
  if (edit.note.trim().length > 160) throw new Error('Keep the comment under 160 characters.');
}
export function applyEdit(person: Person, edit: Edit, role: Role, actor: string = role): { person: Person; activity: Activity } {
  validateEdit(person, edit, role);
  const date = new Date().toISOString();
  return {
    person: { ...person, is_on: edit.isOn, note: edit.isOn ? '' : edit.note.trim(), negative_points: person.negative_points + edit.points, updated_at: date, version: person.version + 1 },
    activity: { id: Date.now() + '-' + Math.random(), person_id: person.id, person_name: person.name, kind: person.is_on !== edit.isOn ? (edit.isOn ? 'on' : 'off') : edit.points ? 'points' : 'note', note: edit.note.trim(), points: edit.points, created_at: date, actor_name: actor, actor_role: role },
  };
}
export function sortPeople(people: Person[]) { return [...people].sort((a, b) => b.negative_points - a.negative_points || a.name.localeCompare(b.name)); }
export function timeAgo(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : minutes < 60 ? minutes + 'm ago' : minutes < 1440 ? Math.floor(minutes / 60) + 'h ago' : Math.floor(minutes / 1440) + 'd ago';
}
