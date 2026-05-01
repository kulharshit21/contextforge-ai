import sanitizeFilename from "sanitize-filename";

export function slugify(value: string) {
  return (
    sanitizeFilename(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}
