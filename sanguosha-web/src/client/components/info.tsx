import { GENERALS_BY_ID, KINGDOM_INFO } from '../../game/generals/definitions';
import { SKILLS_BY_ID } from '../../game/skills/definitions';
import { ROLE_INFO } from '../../game/rules/roles';
import type { Role } from '../../game/engine/types';

export function SkillTip({ id }: { id: string }) {
  const s = SKILLS_BY_ID[id];
  if (!s) return <div>{id}</div>;
  return (
    <div>
      <h4>
        {s.en} <span className="zh">{s.zh}</span> <span className="muted tiny">· {s.gloss}</span>
      </h4>
      <div className="meta">
        {s.lord ? 'Lord skill · ' : ''}
        {s.compulsory ? 'Compulsory · ' : ''}
        {s.type === 'active' ? 'Active (Play phase)' : s.type === 'conversion' ? 'Conversion' : s.type === 'trigger' ? 'Triggered (optional)' : s.type === 'compulsory' ? 'Always on' : 'Lord'}
        {s.limit ? ` · ${s.limit}` : ''} · Timing: {s.timing}
      </div>
      <div>{s.text}</div>
      <div className="meta" style={{ marginTop: 6 }}>
        {s.textZh}
      </div>
    </div>
  );
}

export function GeneralTip({ id }: { id: string }) {
  const g = GENERALS_BY_ID[id];
  return (
    <div>
      <h4>
        {g.en} <span className="zh">{g.zh}</span>
      </h4>
      <div className="meta">
        {KINGDOM_INFO[g.kingdom].en} {KINGDOM_INFO[g.kingdom].zh} · {g.gender} · {g.hp} HP{g.isLord ? ' · Lord general' : ''}
      </div>
      {g.skills.map((s) => (
        <div key={s} className="skill-desc" style={{ marginBottom: 4 }}>
          <b>{SKILLS_BY_ID[s].en}</b> <span className="zh">{SKILLS_BY_ID[s].zh}</span>: {SKILLS_BY_ID[s].text}
        </div>
      ))}
    </div>
  );
}

export function RoleBadge({ role }: { role: Role | null }) {
  if (!role) return <span className="role-badge role-hidden">?</span>;
  return (
    <span className={`role-badge role-${role}`} title={ROLE_INFO[role].goal}>
      {ROLE_INFO[role].en} <span style={{ fontFamily: 'var(--font-zh)' }}>{ROLE_INFO[role].zh}</span>
    </span>
  );
}

export function Emblem({ kingdom }: { kingdom: string | null }) {
  if (!kingdom) return null;
  const k = KINGDOM_INFO[kingdom as keyof typeof KINGDOM_INFO];
  return (
    <span className={`emblem ${kingdom}`} title={`${k.en} (${k.zh})`}>
      {k.zh}
    </span>
  );
}

export function Hp({ hp, max, big }: { hp: number; max: number; big?: boolean }) {
  const ratio = max ? hp / max : 0;
  const tone = ratio > 0.6 ? 'high' : ratio > 0.3 ? 'mid' : 'low';
  return (
    <div className={`hp ${big ? 'big' : ''}`} aria-label={`HP ${hp} of ${max}`}>
      {Array.from({ length: Math.max(max, 0) }, (_, i) => (
        <span key={i} className={`pip ${i < hp ? `on ${tone}` : ''}`} />
      ))}
      <span className="num" style={{ color: hp <= 0 ? 'var(--red)' : undefined }}>
        {hp}/{max}
      </span>
    </div>
  );
}

export const genName = (id: string | null, fallback: string) => (id ? GENERALS_BY_ID[id].en : fallback);
export const genZh = (id: string | null) => (id ? GENERALS_BY_ID[id].zh : '');
