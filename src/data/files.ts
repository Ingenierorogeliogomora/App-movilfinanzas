// Reading and saving text files on iOS, Android and web.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Hands a text file to the person: the share sheet on phones (save to Files,
 * Drive, email…) or a download in the browser. Returns false if the device
 * cannot share files.
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
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: name });
  return true;
}

/** Lets the person pick a file and returns its text, or null if they cancel. */
export async function pickTextFile(webAccept: string): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    // Phones label CSV/JSON files inconsistently, so accept anything and validate the content.
    type: Platform.OS === 'web' ? webAccept : '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  // On web the picker hands back a browser File; on iOS/Android a local copy.
  const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return { name: asset.name, text };
}
