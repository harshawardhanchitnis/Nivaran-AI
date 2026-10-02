import { MAX_FILES_PER_CASE, MAX_FILE_BYTES, isAllowedMimeType } from '@shared/limits';

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export interface FileCheck<T extends FileLike> {
  accepted: T[];
  /** Plain sentences, one per refused file, ready to show. */
  problems: string[];
}

/** Applies the upload limits to newly picked files, given how many the case already holds. */
export function checkFiles<T extends FileLike>(picked: readonly T[], alreadyAdded: readonly FileLike[]): FileCheck<T> {
  const accepted: T[] = [];
  const problems: string[] = [];
  const names = new Set(alreadyAdded.map((file) => file.name));
  const maxMb = MAX_FILE_BYTES / (1024 * 1024);

  for (const file of picked) {
    if (!isAllowedMimeType(file.type)) {
      problems.push(`“${file.name}” is not a PNG, JPG or PDF.`);
    } else if (file.size > MAX_FILE_BYTES) {
      problems.push(`“${file.name}” is larger than ${maxMb} MB.`);
    } else if (file.size === 0) {
      problems.push(`“${file.name}” is empty.`);
    } else if (names.has(file.name)) {
      problems.push(`“${file.name}” is already added.`);
    } else if (alreadyAdded.length + accepted.length >= MAX_FILES_PER_CASE) {
      problems.push(`“${file.name}” was left out: a case takes up to ${MAX_FILES_PER_CASE} files.`);
    } else {
      accepted.push(file);
      names.add(file.name);
    }
  }
  return { accepted, problems };
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
