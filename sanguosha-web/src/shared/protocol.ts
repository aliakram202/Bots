// Wire protocol shared by client and server. All client messages are validated with zod on the server.
import { z } from 'zod';
import type { GameView } from '../game/engine/view';

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;

export const SettingsSchema = z.object({
  roleVariant: z.enum(['standard', 'doubleRenegade']),
  includeEx: z.boolean(),
  /** Seconds for a Play phase decision; 0 = no timer. */
  turnSeconds: z.number().int().min(0).max(600),
  /** Seconds for responses; 0 = no timer. */
  responseSeconds: z.number().int().min(0).max(300),
  generalChoices: z.number().int().min(2).max(5),
});
export type RoomSettings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: RoomSettings = {
  roleVariant: 'standard',
  includeEx: true,
  turnSeconds: 90,
  responseSeconds: 25,
  generalChoices: 3,
};

const CardNameSchema = z.string().min(1).max(40);

const AnswerSchema = z.union([
  z.object({ type: z.literal('general'), general: z.string().max(40) }),
  z.object({ type: z.literal('useCard'), cardIds: z.array(z.number().int()).max(20), as: CardNameSchema, skill: z.string().max(40).optional(), targets: z.array(z.string().max(40)).max(8) }),
  z.object({ type: z.literal('skill'), skill: z.string().max(40), cardIds: z.array(z.number().int()).max(40), targets: z.array(z.string().max(40)).max(8) }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('card'), cardIds: z.array(z.number().int()).max(4), as: CardNameSchema, skill: z.string().max(40).optional() }),
  z.object({ type: z.literal('respondSkill'), skill: z.string().max(40) }),
  z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('cards'), cardIds: z.array(z.number().int()).max(40), targets: z.array(z.string().max(40)).max(8).optional() }),
  z.object({ type: z.literal('pick'), zone: z.literal('hand') }),
  z.object({ type: z.literal('pick'), cardId: z.number().int() }),
  z.object({ type: z.literal('players'), targets: z.array(z.string().max(40)).max(8) }),
  z.object({ type: z.literal('option'), option: z.string().max(40) }),
  z.object({ type: z.literal('guanxing'), top: z.array(z.number().int()).max(5), bottom: z.array(z.number().int()).max(5) }),
  z.object({ type: z.literal('yiji'), assign: z.record(z.string(), z.string().max(40)) }),
  z.object({ type: z.literal('harvest'), cardId: z.number().int() }),
]);

const DebugSchema = z.union([
  z.object({ action: z.literal('setHp'), player: z.string(), hp: z.number().int() }),
  z.object({ action: z.literal('give'), player: z.string(), card: CardNameSchema }),
  z.object({ action: z.literal('equip'), player: z.string(), card: CardNameSchema }),
  z.object({ action: z.literal('judge'), player: z.string(), card: z.enum(['indulgence', 'lightning']) }),
  z.object({ action: z.literal('deckTop'), card: CardNameSchema }),
  z.object({ action: z.literal('peek') }),
  z.object({ action: z.literal('kill'), player: z.string() }),
  z.object({ action: z.literal('revive'), player: z.string() }),
]);

export const ScenarioSchema = z.object({
  roles: z.record(z.string(), z.enum(['lord', 'loyalist', 'rebel', 'renegade'])).optional(),
  generals: z.record(z.string(), z.string()).optional(),
  hp: z.record(z.string(), z.number().int()).optional(),
  hands: z.record(z.string(), z.array(z.union([z.string(), z.number().int()]))).optional(),
  equips: z.record(z.string(), z.array(z.union([z.string(), z.number().int()]))).optional(),
  judges: z.record(z.string(), z.array(z.union([z.string(), z.number().int()]))).optional(),
  deckTop: z.array(z.union([z.string(), z.number().int()])).optional(),
  startPlayer: z.string().optional(),
  dealStartingHands: z.boolean().optional(),
});

export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('ping'), ts: z.number() }),
  z.object({ t: z.literal('ready'), ready: z.boolean() }),
  z.object({ t: z.literal('settings'), settings: SettingsSchema.partial() }),
  z.object({ t: z.literal('start') }),
  z.object({ t: z.literal('kick'), playerId: z.string() }),
  z.object({ t: z.literal('chat'), text: z.string().min(1).max(300) }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('answer'), decisionId: z.number().int(), answer: AnswerSchema, as: z.string().optional() }),
  z.object({ t: z.literal('pref'), autoUse: z.boolean() }),
  z.object({ t: z.literal('rematch') }),
  z.object({ t: z.literal('addBot') }),
  z.object({ t: z.literal('removeBot') }),
  z.object({ t: z.literal('debug'), op: DebugSchema }),
  z.object({ t: z.literal('debugScenario'), scenario: ScenarioSchema }),
  z.object({ t: z.literal('debugState') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export interface MemberView {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
}

export interface ChatMessage {
  id: number;
  from: string;
  name: string;
  text: string;
  ts: number;
  system?: boolean;
}

export interface RoomView {
  code: string;
  phase: 'lobby' | 'game';
  you: string;
  hostId: string;
  members: MemberView[];
  settings: RoomSettings;
  chat: ChatMessage[];
  debug: boolean;
}

export type ServerMessage =
  | { t: 'room'; room: RoomView }
  | { t: 'game'; view: GameView; deadline: number | null; serverTime: number; seats?: string[]; views?: Record<string, GameView> }
  | { t: 'chat'; msg: ChatMessage }
  | { t: 'error'; message: string }
  | { t: 'pong'; ts: number; serverTime: number }
  | { t: 'kicked'; reason: string }
  | { t: 'debugState'; state: unknown };

export const CreateRoomSchema = z.object({ name: z.string().trim().min(1).max(24), debug: z.boolean().optional() });
export const JoinRoomSchema = z.object({ name: z.string().trim().min(1).max(24) });
