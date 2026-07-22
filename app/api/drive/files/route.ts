import { getDriveConfig, notConfigured, readCookie } from "../lib";

type DriveList = { files?: Array<{ id: string; name: string; mimeType: string; size?: string }>; error?: { message?: string } };

export async function GET(request: Request) {
  if (!getDriveConfig()) return notConfigured();
  const token = readCookie(request, "dreamboard_drive_token");
  if (!token) return Response.json({ configured: true, connected: false }, { status: 401 });
  const url = new URL(request.url);
  const search = (url.searchParams.get("q") || "").replace(/['\\]/g, " ").trim();
  const query = ["trashed=false", "mimeType != 'application/vnd.google-apps.folder'", search ? `name contains '${search}'` : ""].filter(Boolean).join(" and ");
  const listUrl = new URL("https://www.googleapis.com/drive/v3/files");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("pageSize", "100");
  listUrl.searchParams.set("fields", "files(id,name,mimeType,size)");
  listUrl.searchParams.set("orderBy", "modifiedTime desc");
  try {
    const response = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as DriveList;
    if (response.status === 401) return Response.json({ configured: true, connected: false }, { status: 401 });
    if (!response.ok) return Response.json({ error: data.error?.message || "Google Drive did not accept the request." }, { status: 502 });
    return Response.json({ configured: true, connected: true, files: data.files || [] });
  } catch {
    return Response.json({ error: "Dreamboard could not reach Google Drive." }, { status: 502 });
  }
}
