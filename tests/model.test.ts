import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdit, sortPeople, validateEdit, Person } from '../src/model';
const person: Person = { id: '1', name: 'Test Person', is_on: true, negative_points: 0, note: '', version: 1, updated_at: new Date().toISOString() };
test('admin adds violations and turns a person off', () => {
  const result = applyEdit(person, { isOn: false, note: ' Missed check-in ', points: 3 }, 'admin');
  assert.equal(result.person.negative_points, 3);
  assert.equal(result.person.note, 'Missed check-in');
  assert.equal(result.activity.kind, 'off');
});
test('only Annan can reduce, partial reduction stays off, zero restores on', () => {
  const off = { ...person, is_on: false, negative_points: 3, note: 'Off' };
  assert.throws(() => applyEdit(off, { isOn: true, note: 'Clear', points: -3 }, 'admin'), /Only Annan/);
  const partial = applyEdit(off, { isOn: false, note: 'Resolved one', points: -1 }, 'annan');
  assert.equal(partial.person.negative_points, 2);
  assert.equal(partial.activity.kind, 'points');
  const clear = applyEdit(partial.person, { isOn: true, note: 'Resolved remaining violations', points: -2 }, 'annan');
  assert.equal(clear.person.note, '');
  assert.equal(clear.person.is_on, true);
  assert.equal(clear.activity.note, 'Resolved remaining violations');
});
test('members cannot edit and no role can bypass count or validation rules', () => {
  assert.throws(() => validateEdit(person, { isOn: false, note: 'Off', points: 1 }, 'member'));
  for (const points of [-1, 1.5, 101, NaN]) assert.throws(() => validateEdit(person, { isOn: false, note: 'Reason', points }, 'admin'));
  assert.throws(() => validateEdit(person, { isOn: true, note: 'Reason', points: 1 }, 'annan'));
  assert.throws(() => validateEdit(person, { isOn: false, note: '', points: 1 }, 'annan'));
  assert.throws(() => validateEdit(person, { isOn: false, note: 'a'.repeat(161), points: 1 }, 'annan'));
  assert.throws(() => validateEdit(person, { isOn: true, note: 'Below zero', points: -1 }, 'annan'));
});
test('people sort highest violation count first and alphabetically on ties', () => {
  const people = [{ ...person, name: 'Zoya', negative_points: 2 }, { ...person, name: 'Aarav', negative_points: 2 }, { ...person, name: 'Maya', negative_points: 5 }];
  assert.deepEqual(sortPeople(people).map(p => p.name), ['Maya', 'Aarav', 'Zoya']);
  assert.equal(people[0].name, 'Zoya');
});
