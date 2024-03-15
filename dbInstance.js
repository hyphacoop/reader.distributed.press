import { ActivityPubDB } from "./db.js";

export const db = await ActivityPubDB.load();
