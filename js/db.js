// db.js, IndexedDB persistence via Dexie.
// Browser storage is a CONVENIENCE CACHE. Exported JSON files are the durable
// source of truth (see spec 1.2 and the storage-durability note in 1.8).

import Dexie from 'https://cdn.jsdelivr.net/npm/dexie/dist/dexie.mjs';

const db = new Dexie('quizforge');
db.version(1).stores({
  // primary key `id` + indexes used for sorting/listing
  quizzes: 'id, title, updatedAt'
});

/** Save (insert or replace) a whole quiz object. */
export async function saveQuiz(quiz) {
  await db.quizzes.put(quiz);
  return quiz;
}

/** Return all quizzes, most-recently-updated first. */
export async function getAllQuizzes() {
  const all = await db.quizzes.toArray();
  all.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return all;
}

/** Return a single quiz by id, or undefined. */
export async function getQuiz(id) {
  return db.quizzes.get(id);
}

/** Delete a quiz by id. */
export async function deleteQuiz(id) {
  await db.quizzes.delete(id);
}

/** True if a quiz with this id already exists (used by import to detect collisions). */
export async function quizExists(id) {
  return (await db.quizzes.get(id)) !== undefined;
}

export default db;
