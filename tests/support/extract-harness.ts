import { POST as extractPOST } from "@/app/api/extract/route";

export interface ExtractResponse {
  docs: {
    fileId: string;
    fileName: string;
    text: string;
    charCount: number;
    pages: number | null;
  }[];
  errors: { fileName: string; code: string; message: string }[];
}

/** Build a multipart upload request and run it through the route handler. */
export async function extractRouteResponse(
  files: { name: string; bytes: Uint8Array }[],
): Promise<Response> {
  const formData = new FormData();
  for (const file of files) {
    // Copy into a fresh ArrayBuffer-backed view so it satisfies BlobPart.
    formData.append("files", new File([new Uint8Array(file.bytes)], file.name));
  }
  const request = new Request("http://test.local/api/extract", {
    method: "POST",
    body: formData,
  });
  return extractPOST(request);
}
