/**
 * GCIT Arena — optional cross-device sync for cosmetic gamification state
 * (visit streak, "seen achievement" list).
 *
 * This is 100% view-side. It only ever calls CTFd's existing, unmodified
 * API — `GET/PATCH /api/v1/users/me` — the same endpoint CTFd already
 * exposes for a user to read/edit their own custom profile fields.
 * No backend route, model, or schema is touched or added.
 *
 * To turn syncing on, an admin creates ONE custom User Field from the
 * existing admin UI (no code involved):
 *
 *   Admin -> Config -> Fields -> Add User Field
 *     Name:      GCIT Progress
 *     Type:      Text
 *     Public:    off
 *     Editable:  on
 *
 * If that field doesn't exist (or the request fails for any reason),
 * every function below silently no-ops and callers fall back to
 * localStorage-only behaviour, exactly like before this module existed.
 */

const SYNC_FIELD_NAME = "GCIT Progress";

// undefined = not looked up yet this page load, null = confirmed absent
let cachedField;

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

async function findSyncField() {
  if (cachedField !== undefined) return cachedField;

  try {
    const res = await CTFd.fetch("/api/v1/users/me");
    if (!res.ok) {
      cachedField = null;
      return cachedField;
    }

    const { data } = await res.json();
    const match = (data.fields || []).find(f => f.name === SYNC_FIELD_NAME);

    cachedField = match
      ? { fieldId: match.field_id, state: safeParse(match.value) }
      : null;
  } catch (e) {
    cachedField = null;
  }

  return cachedField;
}

/**
 * Returns the visitor's synced cosmetic state object, or null if no
 * sync field is configured / reachable.
 */
export async function readSyncedProfile() {
  const field = await findSyncField();
  return field ? field.state : null;
}

/**
 * Best-effort write of the visitor's cosmetic state. Never throws —
 * this backs a purely decorative feature and must never block the UI.
 */
export async function writeSyncedProfile(nextState) {
  const field = await findSyncField();
  if (!field) return;

  field.state = nextState;

  try {
    await CTFd.fetch("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        fields: [{ field_id: field.fieldId, value: JSON.stringify(nextState) }],
      }),
    });
  } catch (e) {
    // Cosmetic only — swallow errors.
  }
}
