import { getDriveConfig, notConfigured, readCookie } from "../lib";

// Streams one file's bytes to the signed-in browser session so it can be
// secured into the creator's private Supabase storage. Google Docs formats
// are exported as plain text (their binary form isn't downloadable).
const GOOGLE_DOC_EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

export async function GET(request: Request) {
  if (!getDriveConfig()) return notConfigured();
  const token = readCookie(request, "dreamboard_drive_token");
  if (!token) return Response.json({ configured: true, connected: false }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const mimeType = url.searchParams.get("mimeType") || "";
  if (!id || !/^[\w-]+$/.test(id)) return Response.json({ error: "Provide a valid Drive file id." }, { status: 400 });
  const exportMime = GOOGLE_DOC_EXPORTS[mimeType];
  const target = exportMime
    ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
  try {
    const response = await fetch(target, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) return Response.json({ configured: true, connected: false }, { status: 401 });
    if (!response.ok || !response.body) return Response.json({ error: "Google Drive did not return that file." }, { status: 502 });
    return new Response(response.body, { headers: { "Content-Type": exportMime || response.headers.get("content-type") || "application/octet-stream" } });
  } catch {
    return Response.json({ error: "Dreamboard could not reach Google Drive." }, { status: 502 });
  }
}
