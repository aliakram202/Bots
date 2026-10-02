import { getCard, RANK_LABEL, SUIT_SYMBOL, suitColor } from '../../game/cards/deck';
import { CARD_DEFS } from '../../game/cards/definitions';
import type { EquipSlot } from '../../game/engine/types';
import type { PublicPlayer } from '../../game/engine/view';
import { CardTip } from '../components/CardView';
import { Emblem, GeneralTip, genName, genZh, Hp, RoleBadge } from '../components/info';
import { Portrait } from '../components/Portrait';
import { tipProps } from '../components/Tooltip';
import type { SeatFx } from './fx';

export const SLOT_ICON: Record<EquipSlot, string> = { weapon: '⚔', armor: '⛨', horsePlus: '+1', horseMinus: '−1' };
export const SLOT_ORDER: EquipSlot[] = ['weapon', 'armor', 'horsePlus', 'horseMinus'];

export function EquipLine({ slot, id }: { slot: EquipSlot; id: number }) {
  const c = getCard(id);
  const def = CARD_DEFS[c.name];
  return (
    <div className="equip-line" {...tipProps(<CardTip name={c.name} id={id} />)}>
      <span className="slot">{SLOT_ICON[slot]}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.en}</span>
      <span className={suitColor(c.suit) === 'red' ? 's-red' : ''} style={{ marginLeft: 'auto' }}>
        {SUIT_SYMBOL[c.suit]}
        {RANK_LABEL[c.rank]}
      </span>
    </div>
  );
}

export function JudgeIcons({ p }: { p: PublicPlayer }) {
  if (!p.judge.length) return null;
  return (
    <div className="judge-icons">
      {p.judge.map((j) => (
        <span key={j.card} className={`judge-icon ${j.as}`} {...tipProps(<CardTip name={j.as} id={j.card} />)}>
          {j.as === 'lightning' ? '电' : '乐'}
        </span>
      ))}
    </div>
  );
}

interface Props {
  p: PublicPlayer;
  pos: { left: string; top: string } | null;
  current: boolean;
  waiting: boolean;
  targetable: boolean;
  selected: boolean;
  invalidReason?: string;
  targeting: boolean;
  fx?: SeatFx;
  dist?: number;
  onClick(): void;
  connected: boolean;
}

export function Seat({ p, pos, current, waiting, targetable, selected, invalidReason, targeting, fx, dist, onClick, connected }: Props) {
  const cls = [
    'seat',
    p.kingdom ? `k-${p.kingdom}` : '',
    current ? 'current' : '',
    waiting ? 'waiting' : '',
    targetable ? 'targetable' : '',
    selected ? 'selected' : '',
    targeting && !targetable && !selected ? 'invalid' : '',
    !p.alive ? 'dead' : '',
    fx?.shake ? 'shake' : '',
    fx?.flash ? `flash-${fx.flash}` : '',
  ].join(' ');
  const tip = targeting && invalidReason ? <div><h4>Cannot target</h4>{invalidReason}</div> : p.general ? <GeneralTip id={p.general} /> : <div>{p.name}</div>;
  return (
    <div
      className={cls}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      onClick={onClick}
      data-testid={`seat-${p.id}`}
      key={fx?.key}
      {...tipProps(tip)}
    >
      <div className="waiting-ring" />
      <div className="seat-badges">
        <RoleBadge role={p.role} />
      </div>
      <div className="seat-no">#{p.seat + 1}{dist !== undefined && p.alive ? ` · d${dist}` : ''}</div>
      <div className="k-bar" />
      <div className="seat-top">
        <Portrait general={p.general} w={44} h={56} dead={!p.alive} />
        <div className="seat-info">
          <div className="seat-name">
            {genName(p.general, p.name)} <span className="zh">{genZh(p.general)}</span>
          </div>
          <div className="seat-player">
            {!connected && !p.bot ? '⚠ ' : ''}
            {p.name}
            {p.bot ? ' 🤖' : ''}
          </div>
          <div className="row" style={{ gap: 4 }}>
            <Emblem kingdom={p.kingdom} />
            {p.alive ? <Hp hp={p.hp} max={p.maxHp} /> : <span className="muted tiny">Dead</span>}
          </div>
        </div>
      </div>
      <div className="seat-bottom">
        <span className="hand-count" title="Cards in hand">
          <span className="mini-card" /> {p.handCount}
        </span>
        <JudgeIcons p={p} />
      </div>
      {SLOT_ORDER.some((s) => p.equip[s]) && (
        <div className="equip-strip">
          {SLOT_ORDER.map((s) => (p.equip[s] ? <EquipLine key={s} slot={s} id={p.equip[s]!} /> : null))}
        </div>
      )}
      {fx?.float && (
        <div key={`f${fx.key}`} className={`fx-float ${fx.float.cls}`}>
          {fx.float.text}
        </div>
      )}
      {fx?.toast && (
        <div key={`t${fx.key}`} className="skill-toast">
          {fx.toast}
        </div>
      )}
    </div>
  );
}
