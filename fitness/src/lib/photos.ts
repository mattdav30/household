// Progress photos live in this app's private folder on the phone. They never upload anywhere,
// and uninstalling the app removes them. Updates over the air keep them.
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

export type Photo = { uri: string; date: string; name: string; pose: Pose };
export type Pose = 'front' | 'side' | 'back';
export const POSES: { value: Pose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
];

function dir() {
  const d = new Directory(Paths.document, 'progress');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** All photos, oldest first. File names look like 2026-10-05_front_1712345.jpg */
export function listPhotos(): Photo[] {
  if (Platform.OS === 'web') return [];
  return dir().list()
    .filter((f): f is File => f instanceof File && f.name.endsWith('.jpg'))
    .map((f) => {
      const [date, pose] = f.name.split('_');
      return { uri: f.uri, date, name: f.name, pose: (['front', 'side', 'back'].includes(pose) ? pose : 'front') as Pose };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePhoto(tempUri: string, date: string, pose: Pose): Promise<Photo> {
  const name = `${date}_${pose}_${Date.now()}.jpg`;
  const target = new File(dir(), name);
  await new File(tempUri).copy(target);
  return { uri: target.uri, date, name, pose };
}

export function deletePhoto(p: Photo) {
  const f = new File(dir(), p.name);
  if (f.exists) f.delete();
}

/** The latest photo for a pose, used as the faint outline when lining up the next one. */
export function lastPhoto(pose: Pose): Photo | null {
  const all = listPhotos().filter((p) => p.pose === pose);
  return all.length ? all[all.length - 1] : null;
}
