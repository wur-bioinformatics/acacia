// Triggers a browser download for in-memory content via a transient object URL.
// Kept inside the MSA module so the module stays self-contained (cross-module
// imports are avoided — see CLAUDE.md).
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
