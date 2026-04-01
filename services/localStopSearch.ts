import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

const PUNCTUATION_PATTERN = /[''`\-.,]/g;
const WHITESPACE_PATTERN = /\s+/;
const STOPS_DB_ASSET = require("@/assets/data/stops.db");

export interface LocalStopResult {
  atco_code: string;
  common_name: string;
  indicator: string;
  locality: string;
}

let db: SQLiteDatabase | null = null;

async function initDatabase(): Promise<SQLiteDatabase> {
  if (db) {
    return db;
  }

  const dbFile = new File(Paths.document, "stops.db");

  // Check if DB already exists in document directory
  if (!dbFile.exists) {
    // Copy from assets
    const asset = Asset.fromModule(STOPS_DB_ASSET);
    await asset.downloadAsync();

    if (asset.localUri) {
      const assetFile = new File(asset.localUri);
      assetFile.copy(dbFile);
    }
  }

  db = await openDatabaseAsync(dbFile.uri);
  return db;
}

// Strip punctuation for fuzzy matching
function normalize(str: string): string {
  return str.toLowerCase().replace(PUNCTUATION_PATTERN, "");
}

// Generate LIKE patterns for a word (handles apostrophe variants)
function likePatterns(word: string): string[] {
  // For "tyndalls", also match "tyndall's" by inserting optional apostrophe positions
  const patterns = [`%${word}%`];

  // Add pattern with apostrophe before 's' ending (e.g., "tyndalls" -> "tyndall's")
  if (word.endsWith("s") && word.length > 2) {
    const withApostrophe = `${word.slice(0, -1)}_s`;
    patterns.push(`%${withApostrophe}%`);
  }

  return patterns;
}

export async function searchStopsLocal(
  query: string,
  limit = 50
): Promise<LocalStopResult[]> {
  const database = await initDatabase();

  const trimmed = normalize(query.trim());
  if (!trimmed) {
    return [];
  }

  const words = trimmed.split(WHITESPACE_PATTERN).filter((w) => w.length > 0);
  if (words.length === 0) {
    return [];
  }

  // Build WHERE: each word matches name OR locality
  const conditions: string[] = [];
  const whereParams: string[] = [];

  for (const word of words) {
    const patterns = likePatterns(word);
    const orClauses: string[] = [];

    for (const pattern of patterns) {
      orClauses.push("LOWER(name) LIKE ?", "LOWER(locality) LIKE ?");
      whereParams.push(pattern, pattern);
    }

    conditions.push(`(${orClauses.join(" OR ")})`);
  }

  const sql = `
    SELECT atco as atco_code, name as common_name, indicator, locality
    FROM stops
    WHERE ${conditions.join(" AND ")}
    ORDER BY
      CASE WHEN LOWER(name) = ? THEN 0 ELSE 1 END,
      CASE WHEN LOWER(name) LIKE ? THEN 0 ELSE 1 END,
      LENGTH(name) ASC
    LIMIT ?
  `;

  const params = [...whereParams, trimmed, `${words[0]}%`, String(limit)];

  const results = await database.getAllAsync<LocalStopResult>(sql, params);
  return results;
}
