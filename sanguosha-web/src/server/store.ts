// Persistence abstraction. Rooms are saved as small JSON snapshots (members, settings, chat and the
// game's config + command log). Games are rebuilt by deterministic replay on startup, so a process
// restart does not destroy active matches. Swap FileRoomStore for Redis/PostgreSQL by implementing RoomStore.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ChatMessage, RoomSettings } from '../shared/protocol';
import type { Answer, GameConfig } from '../game/engine/types';

export interface SavedMember {
  id: string;
  name: string;
  token: string;
  ready: boolean;
  isBot: boolean;
}

export interface SavedRoom {
  code: string;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  debug: boolean;
  members: SavedMember[];
  settings: RoomSettings;
  chat: ChatMessage[];
  game: { config: GameConfig; commands: { player: string; answer: Answer }[] } | null;
}

export interface RoomStore {
  loadAll(): Promise<SavedRoom[]>;
  save(room: SavedRoom): Promise<void>;
  remove(code: string): Promise<void>;
}

export class MemoryRoomStore implements RoomStore {
  rooms = new Map<string, SavedRoom>();
  async loadAll() {
    return [...this.rooms.values()].map((r) => structuredClone(r));
  }
  async save(room: SavedRoom) {
    this.rooms.set(room.code, structuredClone(room));
  }
  async remove(code: string) {
    this.rooms.delete(code);
  }
}

export class FileRoomStore implements RoomStore {
  constructor(private dir: string) {}

  private file(code: string) {
    return path.join(this.dir, `${code.replace(/[^A-Z0-9]/g, '')}.json`);
  }

  async loadAll(): Promise<SavedRoom[]> {
    await fs.mkdir(this.dir, { recursive: true });
    const out: SavedRoom[] = [];
    for (const f of await fs.readdir(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(await fs.readFile(path.join(this.dir, f), 'utf8')));
      } catch (e) {
        console.warn(`[store] skipping unreadable room file ${f}:`, e);
      }
    }
    return out;
  }

  async save(room: SavedRoom) {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${this.file(room.code)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(room));
    await fs.rename(tmp, this.file(room.code));
  }

  async remove(code: string) {
    await fs.rm(this.file(code), { force: true });
  }
}
