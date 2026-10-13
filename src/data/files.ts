// Reading and saving text files on iOS, Android and web.

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { withLockSuspended } from './deviceLock';

/** Exports are named "salda-…" so they can be found and cleaned up later. */
const EXPORT_PREFIX = 'salda-';

/**
 * Hands a text file to the person: the share sheet on phones (save to Files,
 * Drive, email…) or a download in the browser. Returns false if the device
 * cannot share files. On phones the share sheet does not say whether the
 * file was actually saved.
 */
export async function saveTextFile(name: string, content: string, mimeType: string, uti?: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  const file = new File(Paths.cache, name.startsWith(EXPORT_PREFIX) ? name : `${EXPORT_PREFIX}${name}`);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) return false;
  // The file stays in the cache until the next start: the receiving app may
  // still be reading it after the share sheet closes (Android).
  await withLockSuspended(() => Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name }));
  return true;
}

/**
 * Lets the person pick a file and returns its text, or null if they cancel.
 * `onPicked` runs once a file is chosen, before it is read (to show progress).
 */
export async function pickTextFile(webAccept: string, onPicked?: () => void): Promise<{ name: string; text: string } | null> {
  const res = await withLockSuspended(() =>
    DocumentPicker.getDocumentAsync({
      // Phones label CSV/JSON files inconsistently, so accept anything and validate the content.
      type: Platform.OS === 'web' ? webAccept : '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    }),
  );
  if (res.canceled || !res.assets?.[0]) return null;
  onPicked?.();
  const asset = res.assets[0];
  // On web the picker hands back a browser File; on iOS/Android a local copy.
  if (asset.file) return { name: asset.name, text: await asset.file.text() };
  const copy = new File(asset.uri);
  try {
    return { name: asset.name, text: await copy.text() };
  } finally {
    // The copy may be a full bank statement or backup: do not leave it behind.
    try {
      copy.delete();
    } catch {
      // Already gone.
    }
  }
}

/**
 * Removes exported files and picker copies from the cache (financial data
 * in plain text). Runs at startup and when the person deletes their data.
 */
export function cleanupTempFiles(): void {
  if (Platform.OS === 'web') return;
  try {
    for (const entry of Paths.cache.list()) {
      try {
        if (entry instanceof File && entry.name.startsWith(EXPORT_PREFIX)) entry.delete();
        else if (entry instanceof Directory && entry.name === 'DocumentPicker') entry.delete();
      } catch {
        // Skip files we cannot remove.
      }
    }
  } catch {
    // Cache not readable; nothing to clean.
  }
}
