import { useMemo, useState } from 'react';
import { ALL_CARDS, cardLabel } from '../../game/cards/deck';
import { CARD_DEFS } from '../../game/cards/definitions';
import { RULE_SECTIONS } from '../../game/content/rules';
import { SOURCES } from '../../game/content/sources';
import { GENERALS, KINGDOM_INFO } from '../../game/generals/definitions';
import { SKILLS_BY_ID } from '../../game/skills/definitions';
import type { CardName } from '../../game/engine/types';
import { CardView } from './CardView';
import { Emblem } from './info';
import { Portrait } from './Portrait';

export function Sources({ ids }: { ids: string[] }) {
  const uniq = [...new Set(ids)];
  return (
    <div className="sources">
      Source{uniq.length > 1 ? 's' : ''}:{' '}
      {uniq.map((id, i) => {
        const s = SOURCES[id];
        if (!s) return null;
        return (
          <span key={id}>
            {i > 0 && ' · '}
            <a href={s.url} target="_blank" rel="noreferrer" title={s.note ?? s.title}>
              {s.title}
            </a>{' '}
            <span className="tiny">({s.kind})</span>
          </span>
        );
      })}
    </div>
  );
}

type Tab = 'rules' | 'cards' | 'generals' | 'about';

export function Rulebook({ onClose, initialTab = 'rules' }: { onClose(): void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const match = (...parts: string[]) => !query || parts.join(' ').toLowerCase().includes(query);

  const cardNames = useMemo(() => Object.keys(CARD_DEFS) as CardName[], []);
  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <aside className="drawer" data-testid="rulebook">
        <div className="drawer-head">
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--bronze-2)' }}>Rules & Help</b>
          <input className="input" placeholder="Search rules, cards, generals, skills…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          <button className="btn small" onClick={onClose}>✕</button>
        </div>
        <div className="tabs">
          {(['rules', 'cards', 'generals', 'about'] as Tab[]).map((t) => (
            <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t === 'rules' ? 'Rules' : t === 'cards' ? 'Card encyclopedia' : t === 'generals' ? 'Generals' : 'About'}
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {tab === 'rules' &&
            RULE_SECTIONS.filter((s) => match(s.title, s.zh, ...s.body)).map((s) => (
              <section key={s.id} className="rule-section">
                <h3>
                  {s.title} <span className="zh" style={{ fontSize: 16 }}>{s.zh}</span>
                </h3>
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <Sources ids={s.sources} />
              </section>
            ))}
          {tab === 'cards' &&
            cardNames
              .filter((n) => match(CARD_DEFS[n].en, CARD_DEFS[n].zh, CARD_DEFS[n].text, n))
              .map((n) => {
                const def = CARD_DEFS[n];
                const copies = ALL_CARDS.filter((c) => c.name === n);
                return (
                  <div key={n} className="entry">
                    <div className="entry-head">
                      <CardView id={copies[0].id} size="mini" tip={false} />
                      <div>
                        <b style={{ fontSize: 15 }}>{def.en}</b> <span className="zh">{def.zh}</span>
                        <div className="tiny muted">
                          {def.category === 'equipment' ? `Equipment (${def.subtype})` : def.subtype === 'delayedTrick' ? 'Delayed trick' : def.category === 'trick' ? 'Instant trick' : 'Basic'}
                          {def.range ? ` · range ${def.range}` : ''} · {copies.length} cop{copies.length === 1 ? 'y' : 'ies'}: {copies.map((c) => `${cardLabel(c)}${c.ex ? ' (EX)' : ''}`).join(', ')}
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: '8px 0 0' }}>{def.text}</p>
                    {def.notes && <p className="tiny muted">{def.notes}</p>}
                    <Sources ids={def.sources} />
                  </div>
                );
              })}
          {tab === 'generals' &&
            GENERALS.filter((g) => match(g.en, g.zh, g.kingdom, ...g.skills.flatMap((s) => [SKILLS_BY_ID[s].en, SKILLS_BY_ID[s].zh, SKILLS_BY_ID[s].text]))).map((g) => (
              <div key={g.id} className="entry">
                <div className="entry-head">
                  <Portrait general={g.id} w={48} h={60} />
                  <div>
                    <div className="row" style={{ gap: 6 }}>
                      <Emblem kingdom={g.kingdom} />
                      <b style={{ fontSize: 16 }}>{g.en}</b> <span className="zh">{g.zh}</span>
                    </div>
                    <div className="tiny muted">
                      {KINGDOM_INFO[g.kingdom].en} · {g.gender} · {g.hp} HP{g.isLord ? ' · Lord general' : ''} · {g.title}
                    </div>
                  </div>
                </div>
                {g.skills.map((sid) => {
                  const s = SKILLS_BY_ID[sid];
                  return (
                    <div key={sid} style={{ marginTop: 8 }}>
                      <b style={{ color: 'var(--bronze-2)' }}>{s.en}</b> <span className="zh">{s.zh}</span> <span className="tiny muted">({s.gloss}{s.lord ? ', Lord skill' : ''}{s.compulsory ? ', compulsory' : ''} · {s.timing}{s.limit ? ` · ${s.limit}` : ''})</span>
                      <div>{s.text}</div>
                      <div className="tiny muted">{s.textZh}</div>
                      {s.notes && <div className="tiny muted">Note: {s.notes}</div>}
                      <Sources ids={s.sources} />
                    </div>
                  );
                })}
              </div>
            ))}
          {tab === 'about' && <About />}
        </div>
      </aside>
    </>
  );
}

export function About() {
  return (
    <div className="rule-section">
      <h3>About Three Kingdoms Table</h3>
      <p>
        <b>Three Kingdoms Table</b> is a fan-made, San Guo Sha (三国杀 / Legends of the Three Kingdoms) compatible private game simulator for playing
        the classic Standard Identity mode with friends. It is <b>not</b> affiliated with, endorsed by, or a substitute for YOKA Games or the official
        San Guo Sha service, and it does not include any official artwork, logos, music or sound.
      </p>
      <p>
        San Guo Sha was designed by KayaK and is published by YOKA Games (游卡桌游). Character names come from the historical Three Kingdoms period and the
        novel <i>Romance of the Three Kingdoms</i>. All portraits here are generated ink-wash compositions; sounds are synthesized in your browser.
      </p>
      <p>
        Rules were researched from the sources listed in the rulebook and in <code>docs/SOURCES.md</code>. Reference implementations consulted:{' '}
        <a href="https://github.com/wmzy/sanguosha" target="_blank" rel="noreferrer">wmzy/sanguosha</a> (MIT),{' '}
        <a href="https://github.com/Mogara/QSanguosha" target="_blank" rel="noreferrer">Mogara/QSanguosha</a> (GPL-3.0, read only), and{' '}
        <a href="https://github.com/kevinychen/sanguosha" target="_blank" rel="noreferrer">kevinychen/sanguosha</a> (translations reference only). No code was copied from them.
      </p>
      <Sources ids={['wmzy-repo', 'qsgs-repo', 'kevinychen-repo', 'yoka-cards']} />
    </div>
  );
}
