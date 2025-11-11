import fsp from "fs/promises";
import fs from "fs";
import path from "path";
import { candidateProjectDirs } from "./projectService.js";

const FILE_RE = /^[^_]+_(?<type>[PSAHO])(?<part>\d{3})_Rev(?<rev>[A-Z])_(?<desc>.*)\.step$/i;

function revIndex(revStr) {
  const m = /^Rev([A-Z])$/.exec(revStr || "");
  return m ? m[1].charCodeAt(0) : -1;
}

export async function scanProjectCAD(projectNumber, projectName) {
  const candidates = candidateProjectDirs(projectNumber, projectName);
  const parts = [];
  const seen = new Map();

  for (const { cadDir } of candidates) {
    let files = [];
    try {
      files = await fsp.readdir(cadDir);
    } catch {
      continue;
    }
    for (const file of files) {
      const match = FILE_RE.exec(file);
      if (!match) continue;

      const rev = match.groups.rev.toUpperCase();
      const rawDesc = match.groups.desc ?? "";
      const description = rawDesc.replace(/-/g, " ").trim();
      const typePrefix = match.groups.type.toUpperCase();
      const part = match.groups.part;

      const key = typePrefix + part;
      const incoming = {
        typePrefix,
        partNumber: part,
        description,
        latestRev: rev,
        latestFile: file
      };

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, incoming);
        parts.push(incoming);
      } else if (revIndex(`Rev${rev}`) > revIndex(`Rev${existing.latestRev}`)) {
        existing.latestRev = rev;
        existing.latestFile = file;
        existing.description = description;
      }
    }
  }
  
  return { parts };
}
