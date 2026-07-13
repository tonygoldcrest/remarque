export interface FileLabel {
  name: string;
  dir: string;
  gap: string;
}

function truncate(text: string, room: number): string {
  if (text.length <= room) {
    return text;
  }

  return room > 1 ? `${text.slice(0, room - 1)}…` : "";
}

export function fileLabel(file: string, room: number): FileLabel {
  const slash = file.lastIndexOf("/");
  const base = slash === -1 ? file : file.slice(slash + 1);
  const name = truncate(base, room);
  const dirRoom = room - name.length - 1;
  const dir = slash === -1 || dirRoom < 2 ? "" : truncate(file.slice(0, slash), dirRoom);
  const used = name.length + (dir ? dir.length + 1 : 0);

  return { name, dir, gap: " ".repeat(Math.max(0, room - used)) };
}
