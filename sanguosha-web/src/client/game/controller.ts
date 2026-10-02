// Client-side selection state for the current decision. It only *mirrors* the server's legal
// options for highlighting and button enabling; the server re-validates every answer.
import { useEffect, useMemo, useState } from 'react';
import { getCard } from '../../game/cards/deck';
import { CARD_DEFS } from '../../game/cards/definitions';
import type { Answer, PlayOption, TargetSpec } from '../../game/engine/types';
import type { GameView } from '../../game/engine/view';
import { SKILLS_BY_ID } from '../../game/skills/definitions';
import { net } from '../net';

export interface Controller {
  mine: boolean;
  kind: string | null;
  selectedCards: number[];
  selectedTargets: string[];
  /** Cards in my hand/equipment that can be clicked now. */
  clickable: Set<number>;
  /** Target spec currently active (for highlighting seats). */
  targetSpec: TargetSpec | null;
  validTargetsNow: Set<string>;
  activeOption: PlayOption | null;
  chooser: { cardId: number; options: PlayOption[] } | null;
  respondSkill: string[];
  spearMode: boolean;
  canConfirm: boolean;
  confirmLabel: string;
  cancelLabel: string | null;
  hint: string | null;
  clickCard(id: number): void;
  dblClickCard(id: number): void;
  clickSeat(pid: string): void;
  clickSkill(skill: string): void;
  chooseOption(o: PlayOption): void;
  toggleSpear(): void;
  confirm(): void;
  cancel(): void;
  endPhase(): void;
  send(answer: Answer): void;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

export function useController(view: GameView | null, actAs: string | null): Controller {
  const d = view?.decision ?? null;
  const mine = !!d?.mine;
  const me = view?.players.find((p) => p.id === view.viewer) ?? null;
  const [optionKey, setOptionKey] = useState<string | null>(null);
  const [cards, setCards] = useState<number[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [chooser, setChooser] = useState<Controller['chooser']>(null);
  const [spearMode, setSpearMode] = useState(false);
  const [respondPick, setRespondPick] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const reset = () => {
    setOptionKey(null);
    setCards([]);
    setTargets([]);
    setChooser(null);
    setSpearMode(false);
    setRespondPick(null);
    setHint(null);
  };
  useEffect(() => {
    reset();
    // Convenience: pre-select the only possible response card (still requires a click on Use).
    if (d?.mine && d.kind === 'respond' && d.respond && d.respond.cards.length === 1 && !d.respond.spear) setRespondPick(d.respond.cards[0].cardIds[0]);
    if (d?.mine && d.kind === 'negate' && d.negateCards?.length === 1) setRespondPick(d.negateCards[0]);
  }, [d?.id]);

  const send = (answer: Answer) => {
    if (!d) return;
    net.send({ t: 'answer', decisionId: d.id, answer: answer as never, as: actAs ?? undefined });
    reset();
  };

  const playOpts = d?.playOptions ?? [];
  const activeOption = optionKey ? playOpts.find((o) => o.key === optionKey) ?? null : null;

  const result = useMemo(() => {
    const clickable = new Set<number>();
    let targetSpec: TargetSpec | null = null;
    let canConfirm = false;
    let confirmLabel = 'Confirm';
    let cancelLabel: string | null = null;
    const respondSkill: string[] = [];
    if (!d || !mine || !me) return { clickable, targetSpec, canConfirm, confirmLabel, cancelLabel, respondSkill };
    const own = [...(me.hand ?? []), ...(Object.values(me.equip) as number[])];

    if (d.kind === 'play') {
      if (activeOption?.cardSelect) for (const id of activeOption.cardSelect.from) clickable.add(id);
      else for (const o of playOpts) if (!o.disabled && o.cardIds) o.cardIds.forEach((id) => clickable.add(id));
      if (activeOption) {
        targetSpec = activeOption.targets;
        const cs = activeOption.cardSelect;
        const cardsOk = cs ? cards.length >= cs.min && cards.length <= cs.max : true;
        const tOk = targets.length >= targetSpec.min && targets.length <= targetSpec.max
          && (!targetSpec.secondFor || targets.length < 2 || !!targetSpec.secondFor[targets[0]]?.includes(targets[1]));
        canConfirm = cardsOk && tOk;
        confirmLabel = activeOption.kind === 'skill' ? `Use ${SKILLS_BY_ID[activeOption.skill!]?.en ?? 'skill'}` : `Use ${activeOption.label}`;
        cancelLabel = 'Cancel';
      }
    } else if (d.kind === 'respond' && d.respond) {
      const r = d.respond;
      if (spearMode && r.spear) {
        r.spear.from.forEach((id) => clickable.add(id));
        canConfirm = cards.length === 2;
        confirmLabel = 'Play as Slash (Serpent Spear)';
      } else {
        r.cards.forEach((c) => c.cardIds.forEach((id) => clickable.add(id)));
        canConfirm = respondPick !== null;
        const label = CARD_DEFS[r.card as keyof typeof CARD_DEFS]?.en ?? r.card;
        confirmLabel = r.target ? `Use ${label}` : `${r.usage === 'use' ? 'Use' : 'Play'} ${label}`;
      }
      respondSkill.push(...r.skills);
      cancelLabel = r.cancelLabel ?? 'Pass';
    } else if (d.kind === 'negate') {
      (d.negateCards ?? []).forEach((id) => clickable.add(id));
      canConfirm = respondPick !== null;
      confirmLabel = 'Use Negate';
      cancelLabel = 'Pass';
    } else if (d.kind === 'cards' && d.cards) {
      d.cards.selectable.forEach((id) => clickable.add(id));
      const t = d.cards.targets;
      if (t) targetSpec = { ...t, reasons: (t as TargetSpec).reasons ?? {} };
      canConfirm = cards.length >= d.cards.min && cards.length <= d.cards.max && (!t || (targets.length >= t.min && targets.length <= t.max));
      confirmLabel = d.cards.confirmLabel ?? 'Confirm';
      cancelLabel = d.cards.cancelable ? 'Cancel' : null;
    } else if (d.kind === 'players' && d.players) {
      targetSpec = { min: d.players.min, max: d.players.max, valid: d.players.valid, reasons: {} };
      canConfirm = targets.length >= d.players.min && targets.length <= d.players.max;
      cancelLabel = d.players.cancelable ? 'Cancel' : null;
    }
    void own;
    return { clickable, targetSpec, canConfirm, confirmLabel, cancelLabel, respondSkill };
  }, [d, mine, me, activeOption, cards, targets, spearMode, respondPick, playOpts]);

  const validTargetsNow = new Set<string>();
  const ts = result.targetSpec;
  if (ts) {
    if (ts.secondFor && targets.length === 1) (ts.secondFor[targets[0]] ?? []).forEach((x) => validTargetsNow.add(x));
    else if (!ts.secondFor || targets.length === 0) ts.valid.forEach((x) => validTargetsNow.add(x));
    targets.forEach((x) => validTargetsNow.add(x));
  }

  const selectOption = (o: PlayOption, preCards: number[] = []) => {
    if (o.disabled) {
      setHint(o.disabled);
      return;
    }
    setOptionKey(o.key);
    setCards(o.cardSelect ? preCards.filter((c) => o.cardSelect!.from.includes(c)) : o.cardIds ?? []);
    setTargets([]);
    setChooser(null);
    setHint(o.targets.note ?? null);
  };

  const clickCard = (id: number) => {
    if (!d || !mine) return;
    setHint(null);
    if (d.kind === 'play') {
      if (activeOption?.cardSelect) {
        if (!activeOption.cardSelect.from.includes(id)) return;
        setCards((cs) => (cs.includes(id) ? cs.filter((x) => x !== id) : cs.length < activeOption.cardSelect!.max ? [...cs, id] : cs));
        return;
      }
      if (activeOption && activeOption.cardIds?.includes(id)) {
        reset();
        return;
      }
      const opts = playOpts.filter((o) => o.cardIds && same(o.cardIds, [id]));
      const enabled = opts.filter((o) => !o.disabled);
      if (enabled.length === 1) selectOption(enabled[0]);
      else if (enabled.length > 1) setChooser({ cardId: id, options: enabled });
      else if (opts.length) setHint(opts[0].disabled ?? 'This card cannot be used now.');
      else setHint(`${CARD_DEFS[getCard(id).name].en} cannot be used right now.`);
    } else if (d.kind === 'respond' && d.respond) {
      if (spearMode) {
        if (!d.respond.spear?.from.includes(id)) return;
        setCards((cs) => (cs.includes(id) ? cs.filter((x) => x !== id) : cs.length < 2 ? [...cs, id] : cs));
        return;
      }
      if (d.respond.cards.some((c) => c.cardIds.includes(id))) setRespondPick(respondPick === id ? null : id);
      else setHint(`That card cannot be used as ${CARD_DEFS[d.respond.card as keyof typeof CARD_DEFS]?.en ?? d.respond.card} here.`);
    } else if (d.kind === 'negate') {
      if (d.negateCards?.includes(id)) setRespondPick(respondPick === id ? null : id);
    } else if (d.kind === 'cards' && d.cards) {
      if (!d.cards.selectable.includes(id)) return;
      const max = d.cards.max;
      setCards((cs) => (cs.includes(id) ? cs.filter((x) => x !== id) : cs.length < max ? [...cs, id] : max === 1 ? [id] : cs));
    }
  };

  const confirm = () => {
    if (!d || !result.canConfirm) return;
    if (d.kind === 'play' && activeOption) {
      if (activeOption.kind === 'skill') send({ type: 'skill', skill: activeOption.skill!, cardIds: cards, targets });
      else send({ type: 'useCard', cardIds: cards, as: activeOption.as!, skill: activeOption.skill, targets });
    } else if (d.kind === 'respond' && d.respond) {
      if (spearMode) send({ type: 'card', cardIds: cards, as: 'slash', skill: 'serpentSpear' });
      else {
        const opt = d.respond.cards.find((c) => c.cardIds.includes(respondPick!));
        if (opt) send({ type: 'card', cardIds: opt.cardIds, as: opt.as, skill: opt.skill });
      }
    } else if (d.kind === 'negate') {
      send({ type: 'card', cardIds: [respondPick!], as: 'negate' });
    } else if (d.kind === 'cards') {
      send({ type: 'cards', cardIds: cards, targets: d.cards?.targets ? targets : undefined });
    } else if (d.kind === 'players') {
      send({ type: 'players', targets });
    }
  };

  const dblClickCard = (id: number) => {
    if (d?.kind !== 'play' || !mine) return;
    const opts = playOpts.filter((o) => o.cardIds && same(o.cardIds, [id]) && !o.disabled);
    if (opts.length === 1 && opts[0].targets.max === 0) {
      send({ type: 'useCard', cardIds: opts[0].cardIds!, as: opts[0].as!, skill: opts[0].skill, targets: [] });
    }
  };

  const clickSeat = (pid: string) => {
    if (!d || !mine || !ts) return;
    if (targets.includes(pid)) {
      setTargets(targets.filter((t) => t !== pid));
      return;
    }
    if (!validTargetsNow.has(pid)) {
      setHint(ts.reasons[pid] ?? 'That character cannot be targeted.');
      return;
    }
    setHint(null);
    if (targets.length >= ts.max) setTargets(ts.max === 1 ? [pid] : targets);
    else setTargets([...targets, pid]);
  };

  const clickSkill = (skill: string) => {
    if (!d || !mine) return;
    if (d.kind === 'respond' && result.respondSkill.includes(skill)) {
      send({ type: 'respondSkill', skill });
      return;
    }
    if (d.kind === 'play') {
      const o = playOpts.find((x) => x.kind === 'skill' && x.skill === skill);
      if (!o) return;
      if (activeOption?.key === o.key) reset();
      else selectOption(o);
    }
  };

  const toggleSpear = () => {
    if (d?.kind === 'play') {
      const o = playOpts.find((x) => x.key === 'spear');
      if (o) {
        if (activeOption?.key === 'spear') reset();
        else selectOption(o);
      }
    } else {
      setSpearMode(!spearMode);
      setCards([]);
    }
  };

  const cancel = () => {
    if (!d) return;
    if (d.kind === 'play') {
      reset();
      return;
    }
    if (result.cancelLabel) send({ type: 'pass' });
  };

  return {
    mine,
    kind: d?.kind ?? null,
    selectedCards: d?.kind === 'respond' && !spearMode ? (respondPick !== null ? [respondPick] : []) : d?.kind === 'negate' ? (respondPick !== null ? [respondPick] : []) : cards,
    selectedTargets: targets,
    clickable: result.clickable,
    targetSpec: ts,
    validTargetsNow,
    activeOption,
    chooser,
    respondSkill: result.respondSkill,
    spearMode,
    canConfirm: result.canConfirm,
    confirmLabel: result.confirmLabel,
    cancelLabel: result.cancelLabel,
    hint,
    clickCard,
    dblClickCard,
    clickSeat,
    clickSkill,
    chooseOption: (o) => selectOption(o),
    toggleSpear,
    confirm,
    cancel,
    endPhase: () => send({ type: 'end' }),
    send,
  };
}
