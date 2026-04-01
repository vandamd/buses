import Database from "bun:sqlite";
import { statSync } from "node:fs";

const NAPTAN_URL =
  "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv";
const OUTPUT_PATH = "./assets/data/stops.db";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

async function main() {
  console.log("Downloading NaPTAN data...");
  const response = await fetch(NAPTAN_URL);
  const csv = await response.text();

  console.log("Parsing CSV...");
  const lines = csv.split("\n");
  const header = lines[0].split(",");

  // Find column indices
  const cols = {
    atco: header.indexOf("ATCOCode"),
    name: header.indexOf("CommonName"),
    indicator: header.indexOf("Indicator"),
    locality: header.indexOf("LocalityName"),
    parent: header.indexOf("ParentLocalityName"),
    stopType: header.indexOf("StopType"),
    status: header.indexOf("Status"),
  };

  console.log("Creating database...");
  const db = new Database(OUTPUT_PATH, { create: true });

  db.run(`
    DROP TABLE IF EXISTS stops;
    CREATE TABLE stops (
      atco TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      indicator TEXT,
      locality TEXT NOT NULL
    );
  `);

  const insert = db.prepare(
    "INSERT OR IGNORE INTO stops (atco, name, indicator, locality) VALUES (?, ?, ?, ?)"
  );

  let count = 0;
  const busTypes = new Set(["BCT", "BCS"]);

  db.run("BEGIN TRANSACTION");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }

    const fields = parseCsvLine(line);

    const stopType = fields[cols.stopType];
    const status = fields[cols.status];

    // Only include active bus stops
    if (!busTypes.has(stopType) || status !== "active") {
      continue;
    }

    const atco = fields[cols.atco];
    const name = fields[cols.name];
    const indicator = fields[cols.indicator];
    const locality = fields[cols.locality];
    const parent = fields[cols.parent];

    const fullLocality = parent ? `${locality}, ${parent}` : locality;

    insert.run(atco, name, indicator, fullLocality);
    count++;
  }

  db.run("COMMIT");

  console.log(`Inserted ${count} stops`);
  console.log("Vacuuming...");
  db.run("VACUUM");

  db.close();

  // Check file size
  const sizeMB = (statSync(OUTPUT_PATH).size / 1024 / 1024).toFixed(1);
  console.log(`Database size: ${sizeMB}MB`);
}

main().catch(console.error);
