/**
 * Server-side upload validation.
 *
 * File extension alone is never trusted: PDFs must carry a %PDF header and
 * DOCX files must be ZIP archives (PK magic). Size and count limits are
 * enforced here so the API routes stay thin.
 */

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per file
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 MB per request

export type FileType = "pdf" | "docx";

export interface FileRejection {
  code:
    | "empty_file"
    | "too_large"
    | "unsupported_type"
    | "mismatched_content"
    | "too_many_files";
  message: string;
}

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Look for the %PDF- header within the first KB (some tools prepend junk). */
function hasPdfMagic(bytes: Uint8Array): boolean {
  const window = bytes.subarray(0, 1024);
  outer: for (let i = 0; i + PDF_MAGIC.length <= window.length; i++) {
    for (let j = 0; j < PDF_MAGIC.length; j++) {
      if (window[i + j] !== PDF_MAGIC[j]) continue outer;
    }
    return true;
  }
  return false;
}

function hasZipMagic(bytes: Uint8Array): boolean {
  if (bytes.length < ZIP_MAGIC.length) return false;
  return ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase();
}

/**
 * Determine the real file type from its content.
 * Returns null when the content matches neither known format.
 */
export function detectTypeByContent(bytes: Uint8Array): FileType | null {
  if (hasPdfMagic(bytes)) return "pdf";
  if (hasZipMagic(bytes)) return "docx";
  return null;
}

/**
 * Validate a single file's name, declared type and size.
 * Returns a FileRejection, or the type inferred from the actual content
 * (which may differ from the extension – that mismatch is also a rejection).
 */
export function validateFile(
  fileName: string,
  bytes: Uint8Array,
): { ok: true; type: FileType } | { ok: false; rejection: FileRejection } {
  const ext = getExtension(fileName);

  if (ext !== "pdf" && ext !== "docx") {
    return {
      ok: false,
      rejection: {
        code: "unsupported_type",
        message:
          ext === "doc"
            ? `"${fileName}": format .doc lama. Silakan konversi ke .docx atau .pdf.`
            : `"${fileName}": tipe berkas tidak didukung. Gunakan PDF atau DOCX.`,
      },
    };
  }

  if (bytes.length === 0) {
    return {
      ok: false,
      rejection: { code: "empty_file", message: `"${fileName}": berkas kosong.` },
    };
  }

  if (bytes.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      rejection: {
        code: "too_large",
        message: `"${fileName}": ukuran melebihi batas ${Math.round(
          MAX_FILE_BYTES / (1024 * 1024),
        )} MB.`,
      },
    };
  }

  const actual = detectTypeByContent(bytes);
  if (actual === null) {
    return {
      ok: false,
      rejection: {
        code: "mismatched_content",
        message: `"${fileName}": isi berkas bukan PDF/DOCX yang valid (header tidak dikenali).`,
      },
    };
  }

  const expected: FileType = ext === "pdf" ? "pdf" : "docx";
  if (actual !== expected) {
    return {
      ok: false,
      rejection: {
        code: "mismatched_content",
        message: `"${fileName}": isi berkas tidak sesuai dengan ekstensi .${ext}.`,
      },
    };
  }

  return { ok: true, type: actual };
}

/** Validate a whole request's file list (count + total size). */
export function validateFileBatch(
  files: { name: string; size: number }[],
): FileRejection | null {
  if (files.length > MAX_FILES_PER_REQUEST) {
    return {
      code: "too_many_files",
      message: `Maksimal ${MAX_FILES_PER_REQUEST} file per permintaan. Unggah bertahap.`,
    };
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return {
      code: "too_large",
      message: `Total ukuran file melebihi batas ${Math.round(
        MAX_TOTAL_BYTES / (1024 * 1024),
      )} MB per permintaan.`,
    };
  }
  return null;
}
