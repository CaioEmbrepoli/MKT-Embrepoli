import { NextResponse } from "next/server";
import { getGoogleAccessToken, googleRequestContext } from "@/lib/google-server";

export async function GET(request: Request) {
  try {
    const context = await googleRequestContext(request);
    const token = await getGoogleAccessToken(context, "drive");
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || "root";
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,thumbnailLink,modifiedTime,size)",
      orderBy: "folder,name",
      pageSize: "200"
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message ?? "Erro ao listar arquivos do Google Drive." }, { status: response.status });
    }
    return NextResponse.json({
      files: (data.files ?? []).map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType ?? "",
        thumbnailLink: file.thumbnailLink,
        modifiedTime: file.modifiedTime,
        size: file.size,
        isFolder: file.mimeType === "application/vnd.google-apps.folder"
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao acessar Google Drive." }, { status: 401 });
  }
}
