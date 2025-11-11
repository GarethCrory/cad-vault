export function extractDescFromFilename(name) {
  if (!name) return "";
  // Matches: P001_A001_RevK_Your-Description.step
  const m = name.match(/^[^_]+_[^_]+_Rev[A-Z]+_(.+)\.[^.]+$/);
  return m ? m[1].replace(/-/g, " ") : "";
}
