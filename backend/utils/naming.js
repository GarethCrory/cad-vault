// backend/utils/naming.js
import path from "path";

export function generateCanonicalFilename(projectNumber, typePrefix, partNumber, rev, description, ext) {
  const safeDescription = description.replace(/\s+/g, "-"); // replace spaces with hyphens
  return `${projectNumber}_${typePrefix}${partNumber}_${rev}_${safeDescription}.${ext}`;
}

export const VALID_FILENAME_REGEX =
  /^P\\d{3}_(P|S|A|H|O)\\d{3}_Rev[A-Z]_[A-Za-z0-9\\-\\s]+\\.[A-Za-z0-9]+$/;

export function validateFilename(name) {
  return VALID_FILENAME_REGEX.test(name);
}