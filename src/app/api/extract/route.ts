import {
  MAX_FILES_PER_REQUEST,
  extractFromFile,
  validateFileBatch,
} from "@/lib/extract";
import type { ExtractedDoc, FileExtractError } from "@/lib/extract";

export const runtime = "nodejs";

/**
 * POST /api/extract — multipart upload of one small batch of CV files.
 *
 * Files are processed fully in memory and dropped immediately after text
 * extraction; nothing is written to disk. The response reports per-file
 * status so the UI can show progress and offer retry for failures.
 */

export interface ExtractResponse {
  docs: ExtractedDoc[];
  errors: FileExtractError[];
}

export async function POST(request: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Permintaan tidak valid: body harus multipart/form-data." },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return Response.json(
      { error: "Tidak ada file yang dikirim." },
      { status: 400 },
    );
  }

  const batchRejection = validateFileBatch(
    files.map((f) => ({ name: f.name, size: f.size })),
  );
  if (batchRejection) {
    return Response.json({ error: batchRejection.message }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return Response.json(
      { error: `Maksimal ${MAX_FILES_PER_REQUEST} file per permintaan.` },
      { status: 400 },
    );
  }

  const docs: ExtractedDoc[] = [];
  const errors: FileExtractError[] = [];

  for (const file of files) {
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      errors.push({
        fileName: file.name,
        code: "unreadable",
        message: `"${file.name}": gagal membaca isi berkas.`,
      });
      continue;
    }

    const result = await extractFromFile({ name: file.name, bytes });
    if (result.ok) docs.push(result.doc);
    else errors.push(result.error);
  }

  return Response.json({ docs, errors } satisfies ExtractResponse);
}
