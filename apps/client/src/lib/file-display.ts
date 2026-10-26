import {
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
} from "lucide-react";

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "heic",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv", "avi"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);
const SHEET_EXTENSIONS = new Set(["xls", "xlsx", "csv", "ods", "numbers"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2"]);
const CODE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "html",
  "css",
  "py",
  "go",
  "rs",
  "sh",
  "yml",
  "yaml",
]);

export function getFileIcon(extension: string, mimeType: string): LucideIcon {
  const ext = extension.toLowerCase();

  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) {
    return FileImage;
  }
  if (VIDEO_EXTENSIONS.has(ext) || mimeType.startsWith("video/")) {
    return FileVideo;
  }
  if (AUDIO_EXTENSIONS.has(ext) || mimeType.startsWith("audio/")) {
    return FileAudio;
  }
  if (SHEET_EXTENSIONS.has(ext)) return FileSpreadsheet;
  if (ARCHIVE_EXTENSIONS.has(ext)) return FileArchive;
  if (CODE_EXTENSIONS.has(ext)) return FileCode;

  return FileText;
}

export function formatFileType(extension: string, mimeType: string): string {
  if (extension) return extension.toUpperCase();

  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim();
  return subtype ? subtype.toUpperCase() : "FILE";
}

export function formatFileDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
