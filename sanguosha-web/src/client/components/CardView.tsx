import { getCard, RANK_LABEL, SUIT_SYMBOL, suitColor } from '../../game/cards/deck';
import { CARD_DEFS } from '../../game/cards/definitions';
import type { CardName, Suit } from '../../game/engine/types';
import { SKILLS_BY_ID } from '../../game/skills/definitions';
import { tipProps } from './Tooltip';

export function CardTip({ name, id, via }: { name: CardName; id?: number; via?: string }) {
  const def = CARD_DEFS[name];
  const c = id ? getCard(id) : null;
  return (
    <div>
      <h4>
        {def.en} <span className="zh">{def.zh}</span>
      </h4>
      <div className="meta">
        {def.category === 'equipment' ? `Equipment · ${def.subtype}` : def.subtype === 'delayedTrick' ? 'Delayed trick' : def.category === 'trick' ? 'Trick' : 'Basic'}
        {def.range ? ` · range ${def.range}` : ''}
        {c ? ` · ${SUIT_SYMBOL[c.suit]}${RANK_LABEL[c.rank]}${c.ex ? ' · EX' : ''}` : ''}
      </div>
      <div>{def.text}</div>
      {via && (
        <div className="meta" style={{ marginTop: 6 }}>
          Converted via {SKILLS_BY_ID[via]?.en ?? via}
          {c ? ` from ${CARD_DEFS[c.name].en}` : ''}
        </div>
      )}
    </div>
  );
}

export interface CardViewProps {
  id?: number;
  /** Virtual name override (converted cards). */
  as?: CardName;
  suit?: Suit | null;
  rank?: number | null;
  via?: string;
  back?: boolean;
  size?: 'mini' | 'small' | 'normal';
  className?: string;
  onClick?: () => void;
  tip?: boolean;
  style?: React.CSSProperties;
  testId?: string;
}

export function CardView({ id, as, suit, rank, via, back, size = 'normal', className = '', onClick, tip = true, style, testId }: CardViewProps) {
  if (back) {
    return (
      <div className={`card back ${size !== 'normal' ? size : ''} ${className}`} onClick={onClick} style={style} data-testid={testId}>
        <div className="glyph">杀</div>
      </div>
    );
  }
  const phys = id ? getCard(id) : null;
  const name = (as ?? phys?.name) as CardName;
  const def = CARD_DEFS[name];
  const s = suit !== undefined ? suit : phys?.suit ?? null;
  const r = rank !== undefined ? rank : phys?.rank ?? null;
  const red = suitColor(s) === 'red';
  const zh = def.zh;
  return (
    <div
      className={`card cat-${def.category} ${size !== 'normal' ? size : ''} ${className}`}
      onClick={onClick}
      style={style}
      data-testid={testId}
      data-card={name}
      {...(tip ? tipProps(<CardTip name={name} id={id} via={via} />) : {})}
    >
      <div className="cat-band" />
      {(s || r) && (
        <div className={`corner ${red ? 'red' : ''}`}>
          <span>{r ? RANK_LABEL[r] : ''}</span>
          <span>{s ? SUIT_SYMBOL[s] : ''}</span>
        </div>
      )}
      {via && <div className="via">{SKILLS_BY_ID[via]?.en ?? via}</div>}
      <div className={`glyph ${zh.length > 2 ? 'long' : ''} ${zh.length > 4 ? 'xlong' : ''}`}>{zh.length > 3 ? `${zh.slice(0, zh.length > 4 ? 3 : 2)}\n${zh.slice(zh.length > 4 ? 3 : 2)}` : zh}</div>
      <div className="names">
        <div className="en">{def.en}</div>
        {phys && as && as !== phys.name ? <div className="sub">({CARD_DEFS[phys.name].en})</div> : <div className="sub">{def.category === 'equipment' && def.range ? `Range ${def.range}` : ''}</div>}
      </div>
    </div>
  );
}
