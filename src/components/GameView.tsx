'use client';

/**
 * Screen 4 (Gameplay HUD + Phaser 3 Stage), Screen 5 (Pause Modal), and Screen 6 (Results Screen).
 * Drives the deterministic `Sim` at 10 ticks/sec (100ms per tick) and records the exact action log
 * for server-side replay verification.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Sim } from '@/core/sim';
import { nextAction } from '@/core/bot';
import {
  Act,
  DENOMS,
  TICKS_PER_SEC,
  type Customer,
  type Decision,
  type GameConfig,
  type Lang,
  type Objective,
  type RunResult,
  type SimEvent,
  type TabId,
} from '@/core/types';
import { PRODUCT_MAP, TABS } from '@/content/products';
import { ARCHETYPES } from '@/content/archetypes';
import { CHALLENGE_MAP } from '@/content/challenges';
import { BOSS_NAMES } from '@/content/levels';
import type { CustomizationCategory } from '@/content/customization';
import { digits, hasKey, num, pick, productName, t, taka, tokens } from '@/lib/i18n';
import { characterDataUrl, hotspotBadgeInfo, noteSvg, productDataUrl, svgToDataUrl } from '@/game/art/shop';
import { sound } from '@/game/audio';
import type { SubmitSessionResponse } from '@/server/service';

const PhaserStage = dynamic(() => import('@/game/PhaserStage'), { ssr: false });

export interface GameViewProps {
  sessionId: string;
  config: GameConfig;
  lang: Lang;
  equipped: Record<CustomizationCategory, string>;
  tutorialsSeen: string[];
  musicOn: boolean;
  sfxOn: boolean;
  onToggleMusic: (on: boolean) => void;
  onToggleSfx: (on: boolean) => void;
  onFinishRun: (payload: {
    sessionId: string;
    log: number[][];
    endTick: number;
    quit: boolean;
    localResult: RunResult;
  }) => Promise<SubmitSessionResponse | null>;
  onNextLevel?: () => void;
  onReplay: () => void;
  onExit: () => void;
  onCreateFriendChallenge?: (score: number) => void;
  onHelloKhataClick: (placement: string) => void;
}

function formatObjective(o: Objective, lang: Lang): string {
  if (o.metric.startsWith('arch:')) {
    const archId = o.metric.slice(5) as keyof typeof ARCHETYPES;
    const who = ARCHETYPES[archId] ? pick(ARCHETYPES[archId].name, lang) : archId;
    return t('obj.arch', lang, { n: o.target, who });
  }
  return t(o.label, lang, { n: o.target });
}

export default function GameView({
  sessionId,
  config,
  lang,
  equipped,
  musicOn,
  sfxOn,
  onToggleMusic,
  onToggleSfx,
  onFinishRun,
  onNextLevel,
  onReplay,
  onExit,
  onCreateFriendChallenge,
  onHelloKhataClick,
}: GameViewProps): React.ReactElement {
  const simRef = useRef<Sim>(new Sim(config));
  const [, setTickRender] = useState(0);
  const [stageEvents, setStageEvents] = useState<SimEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [showIntro, setShowIntro] = useState<boolean>(() => config.tutorials.length > 0 || Boolean(config.boss));
  const [activeTab, setActiveTab] = useState<TabId>('mudi');
  const [bulkMode, setBulkMode] = useState(false);
  const [changeCounts, setChangeCounts] = useState<number[]>(() => DENOMS.map(() => 0));
  const [banner, setBanner] = useState<{ text: string; tone: 'warn' | 'info' | 'good' | 'bad' } | null>(null);
  const [speechByCustomer, setSpeechByCustomer] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverResponse, setServerResponse] = useState<SubmitSessionResponse | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [autoAssist, setAutoAssist] = useState(false);
  const submittedRef = useRef(false);

  const sim = simRef.current;

  const availableTabs = useMemo(() => {
    const present = new Set(config.products.map((id) => PRODUCT_MAP[id]?.tab).filter(Boolean));
    return TABS.filter((tb) => present.has(tb.id));
  }, [config.products]);

  // Display order of products on shelves (respects shelfShuffle modifier)
  const shelfProducts = useMemo(() => {
    const list = [...config.products];
    if (config.mods.shelfShuffle) {
      const r = sim.rng(0x54f);
      return r.shuffle(list);
    }
    return list;
  }, [config.products, config.mods.shelfShuffle, sim]);

  const forceRefresh = useCallback(() => {
    setTickRender((n) => n + 1);
  }, []);

  const drainSimEvents = useCallback(() => {
    const s = simRef.current;
    if (s.out.length === 0) return;
    const drained = s.out.splice(0, s.out.length);
    setStageEvents((prev) => [...prev.slice(-20), ...drained]);

    for (const ev of drained) {
      switch (ev.t) {
        case 'spawn':
          sound.play('arrive');
          break;
        case 'tapOk':
          sound.play(ev.done ? 'correct' : 'tap');
          break;
        case 'tapBad':
        case 'payBad':
          sound.play('wrong');
          break;
        case 'served':
          sound.play('cash');
          break;
        case 'banner':
          setBanner({ text: t(ev.key, lang, ev.params), tone: ev.tone });
          if (ev.tone === 'warn' || ev.tone === 'bad') sound.play('warning');
          break;
        case 'say':
          setSpeechByCustomer((prev) => ({
            ...prev,
            [ev.id]: t(ev.key, lang, ev.params, ev.id),
          }));
          break;
        case 'boss':
          if (ev.what === 'intro') sound.play('bossIntro');
          if (ev.what === 'hit') sound.play('bossHit');
          if (ev.what === 'defeated') sound.play('bossDefeat');
          break;
        case 'end':
          sound.play(s.result?.won ? 'win' : 'lose');
          break;
      }
    }
  }, [lang]);

  // Reset change drawer counts whenever the active paying customer changes
  const activePayCustomerId = sim.current?.state === 'paying' ? sim.current.id : -1;
  useEffect(() => {
    setChangeCounts(DENOMS.map(() => 0));
  }, [activePayCustomerId]);

  // Main 10-ticks-per-second deterministic loop
  useEffect(() => {
    if (showIntro || paused || sim.ended) return;
    sound.startMusic();
    const timer = setInterval(() => {
      const s = simRef.current;
      if (s.ended) return;

      const steps = autoAssist ? 4 : 1;
      for (let i = 0; i < steps; i++) {
        if (s.ended) break;
        if (autoAssist) {
          const botAct = nextAction(s);
          if (botAct) {
            s.act(botAct.type, botAct.a, botAct.b, botAct.rest);
          }
        }
        s.step();
      }
      drainSimEvents();
      forceRefresh();
    }, 1000 / TICKS_PER_SEC);

    return () => {
      clearInterval(timer);
    };
  }, [showIntro, paused, sim.ended, autoAssist, drainSimEvents, forceRefresh]);

  useEffect(() => {
    return () => {
      sound.stopMusic();
    };
  }, []);

  // Submit run when sim ends
  useEffect(() => {
    if (!sim.ended || !sim.result || submittedRef.current) return;
    submittedRef.current = true;
    sound.stopMusic();
    setSubmitting(true);
    onFinishRun({
      sessionId,
      log: sim.log,
      endTick: sim.tick,
      quit: sim.result.reason === 'quit',
      localResult: sim.result,
    })
      .then((res) => {
        if (res) setServerResponse(res);
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, [sim.ended, sim.result, sessionId, sim.log, sim.tick, onFinishRun]);

  const performAction = useCallback(
    (type: number, a = 0, b = 0, rest: number[] = []) => {
      const s = simRef.current;
      if (s.ended || paused || showIntro) return;
      s.act(type, a, b, rest);
      drainSimEvents();
      forceRefresh();
    },
    [paused, showIntro, drainSimEvents, forceRefresh],
  );

  // Auto-switch shelf tab when the current customer needs an item on another tab (in guided/early levels)
  const currentCustomer: Customer | undefined = sim.current;
  useEffect(() => {
    if (!currentCustomer || currentCustomer.state !== 'ordering' || config.mods.shelfShuffle) return;
    const nextLine = currentCustomer.order.find((l) => l.wave <= currentCustomer.wave && !l.na && l.got < l.qty);
    if (!nextLine) return;
    const pDef = PRODUCT_MAP[nextLine.p];
    if (pDef && pDef.tab !== activeTab && config.products.length > 10) {
      setActiveTab(pDef.tab);
    }
  }, [currentCustomer, currentCustomer?.id, currentCustomer?.wave, config.mods.shelfShuffle, config.products.length, activeTab]);

  const handleStepHint = () => {
    const a = nextAction(sim);
    if (a) performAction(a.type, a.a, a.b, a.rest);
  };

  const remainingSec =
    config.durationTicks > 0
      ? Math.max(0, Math.ceil((config.durationTicks - sim.tick) / TICKS_PER_SEC))
      : Math.floor(sim.tick / TICKS_PER_SEC);

  const objectives = sim.objectiveResults();
  const activeDecision: Decision | undefined = sim.decision;

  // Filtered products to display on the shelf grid
  const visibleProducts = useMemo(() => {
    if (shelfProducts.length <= 12 || config.mods.shelfShuffle) {
      return shelfProducts;
    }
    return shelfProducts.filter((id) => PRODUCT_MAP[id]?.tab === activeTab);
  }, [shelfProducts, activeTab, config.mods.shelfShuffle]);

  const handleShareScore = async () => {
    if (!sim.result) return;
    const starsStr = '★'.repeat(sim.result.stars) + '☆'.repeat(Math.max(0, 3 - sim.result.stars));
    const shareText =
      lang === 'bn'
        ? `দোকান সামলাও! (${pick(config.title, 'bn')}) — আমার স্কোর: ${num(sim.result.score, 'bn')} ${starsStr} | লাভ: ${taka(sim.result.profit, 'bn')}! আপনিও খেলুন: ${window.location.origin}`
        : `Dokaan Shamlao! (${pick(config.title, 'en')}) — My score: ${sim.result.score} ${starsStr} | Profit: ৳${sim.result.profit}! Play now: ${window.location.origin}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      }
    } catch {
      setShareCopied(true);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-[#FFF8E7] text-[#3B2314] select-none">
      {/* ── TOP HUD BAR ── */}
      <header className="sticky top-0 z-20 border-b-2 border-[#3B2314] bg-[#F4D58D] px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg border-2 border-[#3B2314] bg-[#C9462C] px-2.5 py-0.5 text-sm font-extrabold text-white">
              {config.level ? `${lang === 'bn' ? 'লেভেল' : 'Lv'} ${digits(config.level, lang)}` : pick(config.title, lang)}
            </span>
            <div className="flex items-center gap-1 rounded-lg border-2 border-[#3B2314] bg-white px-2.5 py-0.5 text-sm font-extrabold">
              <span>🏆</span>
              <span data-testid="hud-score">{num(sim.score, lang)}</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border-2 border-[#3B2314] bg-[#E8F5E9] px-2.5 py-0.5 text-sm font-extrabold text-[#1B5E20]">
              <span data-testid="hud-cash">{taka(sim.cash, lang)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              title={t('ui.rep', lang)}
              className="flex items-center gap-1 rounded-lg border-2 border-[#3B2314] bg-white px-2 py-0.5 text-xs font-bold"
            >
              <span>❤️</span>
              <span>{digits(sim.reputation, lang)}%</span>
            </div>

            <div className="flex items-center gap-1 rounded-lg border-2 border-[#3B2314] bg-[#3B2314] px-2.5 py-0.5 text-xs font-extrabold text-[#F6C445]">
              <span>⏱️</span>
              <span data-testid="hud-timer">
                {digits(remainingSec, lang)}
                {t('ui.sec', lang)}
              </span>
            </div>

            {sim.combo >= 2 && (
              <span className="animate-bounce rounded-full border-2 border-[#3B2314] bg-[#F6C445] px-2 py-0.5 text-xs font-extrabold">
                {t('ui.combo', lang, { n: sim.combo })}
              </span>
            )}

            <button
              type="button"
              data-testid="btn-step-assist"
              onClick={handleStepHint}
              title={lang === 'bn' ? 'পরবর্তী সঠিক পদক্ষেপ (সহায়তা)' : 'Perform next best step'}
              className="rounded-lg border-2 border-[#3B2314] bg-[#2A9D8F] px-2 py-1 text-xs font-extrabold text-white active:translate-y-0.5"
            >
              💡 {lang === 'bn' ? 'হিন্ট' : 'Hint'}
            </button>

            <button
              type="button"
              data-testid="btn-auto-assist"
              onClick={() => {
                setShowIntro(false);
                setAutoAssist((v) => !v);
              }}
              className={`rounded-lg border-2 border-[#3B2314] px-2 py-1 text-xs font-extrabold active:translate-y-0.5 ${
                autoAssist ? 'bg-[#E63946] text-white' : 'bg-white text-[#3B2314]'
              }`}
            >
              🤖 {autoAssist ? (lang === 'bn' ? 'অটো চালু' : 'Auto ON') : lang === 'bn' ? 'অটো' : 'Auto'}
            </button>

            <button
              type="button"
              data-testid="btn-pause"
              onClick={() => setPaused(true)}
              aria-label="Pause"
              className="rounded-lg border-2 border-[#3B2314] bg-white px-2.5 py-1 text-xs font-extrabold hover:bg-[#FFF3D6]"
            >
              ⏸
            </button>
          </div>
        </div>

        {/* Objectives & Constraint Indicators */}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {objectives.map((o, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold ${
                  o.done
                    ? 'border-[#1B5E20] bg-[#C8E6C9] text-[#1B5E20]'
                    : 'border-[#3B2314]/40 bg-white/90 text-[#3B2314]'
                }`}
              >
                <span>{o.done ? '✓' : '○'}</span>
                <span>{formatObjective(o.objective, lang)}</span>
                <span className="opacity-75">
                  ({digits(o.value, lang)}/{digits(o.objective.target, lang)})
                </span>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {config.mods.creditLimit !== undefined && (
              <span className="rounded bg-[#EDE7F6] px-1.5 py-0.5 font-bold text-[#4527A0]">
                {t('ui.creditOut', lang, { n: sim.stats.creditOutstanding, m: config.mods.creditLimit })}
              </span>
            )}
            {config.mods.supplierDebt && !sim.stats.debtPaid && !sim.stats.debtFailed && (
              <span className="rounded bg-[#FFEBEE] px-1.5 py-0.5 font-bold text-[#C62828]">
                {t('ui.debtDue', lang, { n: config.mods.supplierDebt })}
              </span>
            )}
            {sim.cartonsLeft >= 0 && (
              <span className="rounded bg-[#FFF3E0] px-1.5 py-0.5 font-bold text-[#E65100]">
                {t('ui.cartons', lang, { n: sim.cartonsLeft })}
              </span>
            )}
          </div>
        </div>

        {/* Boss Health & Strikes Bar */}
        {config.boss && sim.boss && (
          <div
            data-testid="boss-hud-bar"
            className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border-2 border-[#3B2314] bg-[#3B2314] px-3 py-1 text-xs font-extrabold text-white"
          >
            <div className="flex items-center gap-2">
              <span className="text-[#F6C445]">👑 {pick(BOSS_NAMES[config.boss.id].name, lang)}</span>
              <span className="rounded bg-white/15 px-1.5 py-0.5 text-[11px]">
                {t('ui.phase', lang, { n: sim.boss.phase + 1 })}
              </span>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-[#E63946] transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, (sim.boss.hp / config.boss.hp) * 100))}%` }}
                />
              </div>
              <span>
                HP {digits(sim.boss.hp, lang)}/{digits(config.boss.hp, lang)}
              </span>
            </div>
            <div className="text-[#FCA5A5]">
              {t('ui.strikes', lang)}: {'❌'.repeat(sim.boss.strikes)}
              {'⚪'.repeat(Math.max(0, config.boss.maxStrikes - sim.boss.strikes))}
            </div>
          </div>
        )}
      </header>

      {/* ── EVENT BANNER & ACTIVE EMERGENCY FLAGS ── */}
      {(banner || sim.flag('dark') || sim.flag('rain') || sim.flag('outage') || sim.flag('powerOut') || sim.flag('fridge') || sim.flag('closed') || sim.flag('fire')) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3B2314]/20 bg-[#FFF3D6] px-3 py-1.5 text-xs font-bold">
          {banner && (
            <div
              className={`rounded-lg border px-2.5 py-1 font-extrabold ${
                banner.tone === 'bad'
                  ? 'border-[#C62828] bg-[#FFEBEE] text-[#C62828]'
                  : banner.tone === 'good'
                    ? 'border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32]'
                    : 'border-[#E65100] bg-[#FFF3E0] text-[#E65100]'
              }`}
            >
              🔔 {banner.text}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1">
            {sim.flag('dark') && <span className="rounded bg-slate-900 px-2 py-0.5 text-yellow-300">🔦 লোডশেডিং</span>}
            {sim.flag('rain') && <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-900">🌧️ বৃষ্টি</span>}
            {sim.flag('outage') && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">📵 নেট বন্ধ</span>}
            {sim.flag('powerOut') && <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-900">🧮 ক্যালকুলেটর বন্ধ</span>}
            {sim.flag('fridge') && <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-900">❄️ ফ্রিজ নষ্ট</span>}
            {sim.flag('closed') && <span className="rounded bg-red-600 px-2 py-0.5 text-white">{t('ui.closed', lang)}</span>}
          </div>
        </div>
      )}

      {/* ── PHASER 3 ANIMATED SHOP STAGE ── */}
      <div className="px-3 pt-2">
        <PhaserStage
          sim={sim}
          events={stageEvents}
          lang={lang}
          equipped={equipped}
          onSelectCustomer={(cid) => performAction(Act.Select, cid)}
          onTapHotspot={(hid) => performAction(Act.Hotspot, hid)}
        />

        {/* Quick Customer Slot Switcher & Scene Hotspot Strip */}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {sim.customers
              .filter((c) => c.slot >= 0 && c.state !== 'gone' && c.state !== 'leaving')
              .map((c) => {
                const isSel = sim.selected === c.id;
                const pct = Math.max(0, Math.min(100, Math.round((c.patience / c.patienceMax) * 100)));
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`customer-slot-${c.slot}`}
                    onClick={() => performAction(Act.Select, c.id)}
                    className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-extrabold transition ${
                      isSel
                        ? 'border-[#3B2314] bg-[#F6C445] text-[#3B2314] shadow-sm'
                        : 'border-[#3B2314]/50 bg-white text-[#3B2314] hover:bg-[#FFF3D6]'
                    }`}
                  >
                    <img
                      src={characterDataUrl(c.look, 'neutral')}
                      alt=""
                      className="h-6 w-5 object-contain"
                    />
                    <span>{pick(ARCHETYPES[c.arch].name, lang)}</span>
                    <span
                      className={`rounded px-1 text-[10px] ${
                        pct > 50 ? 'bg-emerald-100 text-emerald-900' : pct > 25 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
                      }`}
                    >
                      {digits(pct, lang)}%
                    </span>
                  </button>
                );
              })}

            {sim.line.length > 0 && (
              <span className="rounded-lg border border-[#3B2314]/40 bg-white px-2 py-1 text-xs font-bold">
                🚶 {t('ui.line', lang, { n: sim.line.length })}
              </span>
            )}
          </div>

          {/* Interactive Hotspots Bar (accessible touch buttons synced with Phaser hotspots) */}
          {sim.hotspots.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {sim.hotspots.map((h) => {
                const info = hotspotBadgeInfo(h.kind, h.seq, h.taps);
                const prodLabel = h.p ? ` (${productName(h.p, lang)})` : '';
                return (
                  <button
                    key={h.id}
                    type="button"
                    data-testid={`hotspot-btn-${h.kind}`}
                    onClick={() => performAction(Act.Hotspot, h.id)}
                    style={{ backgroundColor: info.color }}
                    className="animate-pulse rounded-lg border-2 border-[#3B2314] px-2.5 py-1 text-xs font-extrabold text-white shadow-sm active:scale-95"
                  >
                    {info.emoji} {lang === 'bn' ? info.labelBn : info.labelEn}
                    {prodLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CURRENT CUSTOMER ORDER TRAY ── */}
      <section className="mx-3 mt-2 rounded-xl border-2 border-[#3B2314] bg-white p-2.5 shadow-sm">
        {currentCustomer ? (
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-[#3B2314]/15 pb-1.5">
              <div className="flex items-center gap-2">
                <img
                  src={characterDataUrl(currentCustomer.look, currentCustomer.state === 'paying' ? 'happy' : 'talk')}
                  alt=""
                  className="h-10 w-8 rounded border border-[#3B2314]/20 bg-[#FFF3D6] object-contain"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold">{pick(ARCHETYPES[currentCustomer.arch].name, lang)}</span>
                    {currentCustomer.waves > 1 && (
                      <span className="rounded bg-[#EDE7F6] px-1.5 py-0.5 text-[11px] font-bold text-[#4527A0]">
                        {t('ui.phase', lang, { n: `${currentCustomer.wave + 1}/${currentCustomer.waves}` })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#6D4C41]">
                    “{speechByCustomer[currentCustomer.id] || t(`say.order.${currentCustomer.arch}`, lang)}”
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-[#6D4C41]">{t('ui.total', lang)}: </span>
                <span className="text-base font-extrabold text-[#C9462C]">
                  {sim.flag('powerOut') && !currentCustomer.totalChecked
                    ? '৳?'
                    : taka(sim.subtotal(currentCustomer), lang)}
                </span>
              </div>
            </div>

            {/* Order Items List */}
            {currentCustomer.hiddenOrder && !currentCustomer.revealed ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-[#FFF3D6] p-2.5">
                <span className="text-xs font-extrabold">
                  🧠 {lang === 'bn' ? 'আগের বারের অর্ডারটি মনে করে দিন!' : 'Bag their previous order from memory!'}
                </span>
                <button
                  type="button"
                  data-testid="btn-reveal-order"
                  onClick={() => performAction(Act.Reveal)}
                  className="rounded-lg border-2 border-[#3B2314] bg-[#F6C445] px-3 py-1 text-xs font-extrabold"
                >
                  {t('ui.reveal', lang)}
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {currentCustomer.order
                  .map((line, lineIdx) => ({ line, lineIdx }))
                  .filter(({ line }) => line.wave <= currentCustomer.wave)
                  .map(({ line, lineIdx }) => {
                    const pDef = PRODUCT_MAP[line.p]!;
                    const done = line.got >= line.qty || Boolean(line.na);
                    const outOfStock = sim.available(line.p) <= 0 && !done;
                    return (
                      <div
                        key={`${line.p}-${lineIdx}`}
                        data-testid={`order-line-${line.p}`}
                        className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-xs font-extrabold ${
                          line.na
                            ? 'border-slate-400 bg-slate-100 text-slate-500 line-through'
                            : done
                              ? 'border-[#2E7D32] bg-[#E8F5E9] text-[#1B5E20]'
                              : 'border-[#3B2314] bg-[#FFF8E7] text-[#3B2314]'
                        }`}
                      >
                        {line.clue ? (
                          <span className="max-w-[200px] text-[#4527A0]">
                            ❓ “{pDef.clue ? pick(pDef.clue, lang) : productName(line.p, lang)}”
                          </span>
                        ) : (
                          <>
                            <img src={productDataUrl(pDef.id, pDef.icon)} alt="" className="h-7 w-7 object-contain" />
                            <span>{productName(line.p, lang)}</span>
                          </>
                        )}

                        <span className="rounded bg-white px-1.5 py-0.5 text-xs font-black">
                          {done ? '✓' : `${digits(line.got, lang)}/${digits(line.qty, lang)}`}
                        </span>

                        {line.free && (
                          <span className="rounded bg-[#E91E63] px-1.5 py-0.5 text-[10px] text-white">
                            {t('ui.free', lang)}
                          </span>
                        )}

                        {outOfStock && currentCustomer.state === 'ordering' && (
                          <button
                            type="button"
                            data-testid={`btn-na-${line.p}`}
                            onClick={() => performAction(Act.NotAvailable, lineIdx)}
                            className="rounded border border-[#C62828] bg-[#FFEBEE] px-2 py-0.5 text-[11px] font-extrabold text-[#C62828]"
                          >
                            {t('ui.na', lang)}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          <div className="py-3 text-center text-xs font-bold text-[#6D4C41]">
            {lang === 'bn' ? 'কাস্টমার আসছে… তাকের স্টক দেখে রাখুন!' : 'Next customer arriving… check your shelf stock!'}
          </div>
        )}
      </section>

      {/* ── INTERACTIVE BOTTOM AREA: PAYMENT COUNTER OR PRODUCT SHELVES ── */}
      <div className="mx-3 my-2 flex-1">
        {currentCustomer && currentCustomer.state === 'paying' && currentCustomer.pay ? (
          /* ── CASH COUNTER & CHANGE DRAWER ── */
          <div
            data-testid="payment-panel"
            className="rounded-xl border-2 border-[#3B2314] bg-[#FFF3D6] p-3 shadow-md"
          >
            {(() => {
              const pay = currentCustomer.pay!;
              const due = Math.max(0, pay.given - pay.total);
              const givingSum = DENOMS.reduce((s, d, i) => s + d * (changeCounts[i] ?? 0), 0);
              const tillCounts = sim.till ? sim.tillWith(pay.given) : null;

              return (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#3B2314]/15 pb-2.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={svgToDataUrl(noteSvg(pay.given, pay.fake, pay.fakeTell))}
                        alt={`${pay.given} Taka`}
                        className="h-14 w-28 rounded-lg shadow-sm"
                      />
                      <div className="space-y-0.5 text-xs font-bold">
                        <div>
                          {t('ui.total', lang)}: <strong className="text-sm text-[#C9462C]">{taka(pay.total, lang)}</strong>
                        </div>
                        <div>
                          {pay.method === 'mobile' ? (
                            <span className="rounded bg-pink-100 px-2 py-0.5 font-extrabold text-pink-800">
                              📱 {t('ui.mobilePaid', lang)}: {taka(pay.given, lang)}
                            </span>
                          ) : (
                            <span>
                              {t('ui.given', lang)}: <strong className="text-sm text-[#1B5E20]">{taka(pay.given, lang)}</strong>
                            </span>
                          )}
                        </div>
                        {pay.given > pay.total && (
                          <div>
                            {t('ui.changeDue', lang)}:{' '}
                            <strong className="text-sm text-[#1D4ED8]">
                              {config.mods.changeHidden ? '৳?' : taka(due, lang)}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Counterfeit / Underpayment / No Change Flag Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(config.mods.fakeNotePct || pay.fake) && (
                        <button
                          type="button"
                          data-testid="btn-flag-fake"
                          onClick={() => performAction(Act.Flag, 1)}
                          className="rounded-lg border-2 border-[#3B2314] bg-[#E63946] px-2.5 py-1.5 text-xs font-extrabold text-white active:scale-95"
                        >
                          🔍 {t('ui.fake', lang)}
                        </button>
                      )}
                      {pay.given < pay.total && (
                        <button
                          type="button"
                          data-testid="btn-flag-short"
                          onClick={() => performAction(Act.Flag, 2)}
                          className="rounded-lg border-2 border-[#3B2314] bg-[#F59E0B] px-2.5 py-1.5 text-xs font-extrabold text-[#3B2314] active:scale-95"
                        >
                          ⚠️ {t('ui.short', lang)}
                        </button>
                      )}
                      {sim.till && pay.given > pay.total && (
                        <button
                          type="button"
                          data-testid="btn-flag-nochange"
                          onClick={() => performAction(Act.Flag, 3)}
                          className="rounded-lg border-2 border-[#3B2314] bg-amber-200 px-2.5 py-1.5 text-xs font-extrabold text-[#3B2314] active:scale-95"
                        >
                          🪙 {t('ui.noChange', lang)}
                        </button>
                      )}
                    </div>
                  </div>

                  {pay.given <= pay.total ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        data-testid="btn-collect-payment"
                        onClick={() => performAction(Act.Collect)}
                        className="w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-3 text-base font-extrabold text-white shadow hover:bg-[#1B5E20] active:translate-y-0.5"
                      >
                        💵 {t('ui.collect', lang)} ({taka(pay.given, lang)})
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2.5">
                      <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
                        <span>
                          {t('ui.youGive', lang)}: <strong className="text-base text-[#1B5E20]">{taka(givingSum, lang)}</strong>
                        </span>
                        <button
                          type="button"
                          data-testid="btn-clear-change"
                          onClick={() => setChangeCounts(DENOMS.map(() => 0))}
                          className="rounded border border-[#3B2314] bg-white px-2.5 py-0.5 text-xs font-bold"
                        >
                          ↺ {t('ui.clear', lang)}
                        </button>
                      </div>

                      {/* Denomination Note Buttons */}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {DENOMS.map((d, idx) => {
                          const count = changeCounts[idx] ?? 0;
                          const inTill = tillCounts ? tillCounts[idx] ?? 0 : null;
                          const exhausted = inTill !== null && count >= inTill;
                          return (
                            <button
                              key={d}
                              type="button"
                              data-testid={`btn-denom-${d}`}
                              disabled={exhausted}
                              onClick={() => {
                                setChangeCounts((prev) => {
                                  const next = [...prev];
                                  next[idx] = (next[idx] ?? 0) + 1;
                                  return next;
                                });
                              }}
                              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-[#3B2314] py-2 font-extrabold shadow-sm transition active:scale-95 ${
                                exhausted ? 'bg-slate-200 opacity-50' : 'bg-white hover:bg-[#E8F5E9]'
                              }`}
                            >
                              <span className="text-sm text-[#1B5E20]">+৳{digits(d, lang)}</span>
                              {inTill !== null && (
                                <span className="text-[10px] text-[#6D4C41]">
                                  {t('ui.till', lang)}: {digits(Math.max(0, inTill - count), lang)}
                                </span>
                              )}
                              {count > 0 && (
                                <span className="absolute -top-2 -right-2 rounded-full border border-[#3B2314] bg-[#F6C445] px-1.5 text-[11px] font-black">
                                  ×{digits(count, lang)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        data-testid="btn-give-change"
                        disabled={givingSum <= 0}
                        onClick={() =>
                          performAction(Act.Change, changeCounts[0] ?? 0, changeCounts[1] ?? 0, changeCounts.slice(2))
                        }
                        className="mt-3 w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-2.5 text-base font-extrabold text-white shadow disabled:opacity-40 active:translate-y-0.5"
                      >
                        ✅ {t('ui.giveChange', lang)} ({taka(givingSum, lang)})
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          /* ── PRODUCT SHELVES & TABS ── */
          <div className="rounded-xl border-2 border-[#3B2314] bg-[#F4E9D0] p-2.5 shadow-sm">
            {/* Shelf Category Tabs + ×1/×5 Toggle */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
              {shelfProducts.length > 12 && !config.mods.shelfShuffle ? (
                <div className="flex flex-wrap gap-1">
                  {availableTabs.map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      data-testid={`shelf-tab-${tb.id}`}
                      onClick={() => setActiveTab(tb.id)}
                      className={`rounded-lg border-2 border-[#3B2314] px-2.5 py-1 text-xs font-extrabold transition ${
                        activeTab === tb.id ? 'bg-[#C9462C] text-white' : 'bg-white text-[#3B2314]'
                      }`}
                    >
                      {pick(tb.name, lang)}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-extrabold text-[#6D4C41]">
                  🗄️ {lang === 'bn' ? 'দোকানের তাক (পণ্য ট্যাপ করুন)' : 'Shop Shelves (Tap product to bag)'}
                </span>
              )}

              <button
                type="button"
                data-testid="btn-bulk-toggle"
                onClick={() => setBulkMode((v) => !v)}
                className={`rounded-lg border-2 border-[#3B2314] px-3 py-1 text-xs font-extrabold transition ${
                  bulkMode ? 'bg-[#F6C445] text-[#3B2314]' : 'bg-white text-[#3B2314]'
                }`}
              >
                {bulkMode ? t('ui.x5', lang) : t('ui.x1', lang)}
              </button>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visibleProducts.map((pid) => {
                const pDef = PRODUCT_MAP[pid]!;
                const pidx = config.products.indexOf(pid);
                const avail = sim.available(pid);
                const price = sim.unitPrice(pid);
                const disc = sim.discount[pid] ?? 0;
                const isDark = sim.flag('dark');
                const prodHotspot = sim.hotspots.find((h) => h.p === pid && h.kind !== 'box');
                const pendingDelivery = sim.deliveries.some((d) => d.p === pid);
                const buyPct = sim.buyPct[pid] ?? 100;
                const neededByCurrent =
                  currentCustomer?.state === 'ordering' &&
                  currentCustomer.order.some((l) => l.wave <= currentCustomer.wave && !l.na && l.p === pid && l.got < l.qty);

                return (
                  <div
                    key={pid}
                    className={`relative flex flex-col justify-between rounded-xl border-2 p-2 transition ${
                      neededByCurrent && config.guided
                        ? 'border-[#2E7D32] bg-[#E8F5E9] ring-2 ring-[#2E7D32]'
                        : avail <= 0
                          ? 'border-[#C62828]/60 bg-rose-50/80'
                          : 'border-[#3B2314] bg-white hover:bg-[#FFF8E7]'
                    }`}
                  >
                    {disc > 0 && (
                      <span className="absolute -top-2 left-2 rounded-full border border-[#3B2314] bg-[#E63946] px-1.5 text-[10px] font-black text-white">
                        {t('ui.saleTag', lang, { n: disc })}
                      </span>
                    )}

                    <button
                      type="button"
                      data-testid={`shelf-product-${pid}`}
                      onClick={() => performAction(Act.Add, pidx, bulkMode ? 5 : 1)}
                      className="flex flex-col items-center text-center active:scale-95"
                    >
                      <img
                        src={productDataUrl(pDef.id, pDef.icon)}
                        alt={productName(pid, lang)}
                        className={`h-12 w-12 object-contain ${isDark ? 'brightness-50 contrast-125' : ''}`}
                      />
                      <span className="mt-1 line-clamp-1 text-xs font-extrabold">
                        {isDark ? '???' : productName(pid, lang)}
                      </span>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="text-[#C9462C]">{taka(price, lang)}</span>
                        <span
                          className={`rounded px-1 ${
                            avail <= 0
                              ? 'bg-red-100 text-red-800'
                              : avail <= 3
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {config.mods.stockHidden ? '?' : digits(avail, lang)}
                        </span>
                      </div>
                    </button>

                    {/* Shelf Hotspot Action (Expiry / Damaged / Flood) */}
                    {prodHotspot && (
                      <button
                        type="button"
                        data-testid={`shelf-hotspot-${pid}`}
                        onClick={() => performAction(Act.Hotspot, prodHotspot.id)}
                        className="mt-1 w-full animate-pulse rounded-lg border border-[#3B2314] bg-[#EA580C] py-0.5 text-[11px] font-extrabold text-white"
                      >
                        {hotspotBadgeInfo(prodHotspot.kind).emoji}{' '}
                        {lang === 'bn'
                          ? hotspotBadgeInfo(prodHotspot.kind).labelBn
                          : hotspotBadgeInfo(prodHotspot.kind).labelEn}
                      </button>
                    )}

                    {/* Supplier Restock Button */}
                    {config.mods.restock && (
                      <button
                        type="button"
                        data-testid={`btn-restock-${pid}`}
                        disabled={pendingDelivery || sim.cartonsLeft === 0}
                        onClick={() => performAction(Act.Restock, pidx)}
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-[#3B2314] bg-[#FFF3D6] py-0.5 text-[11px] font-extrabold text-[#3B2314] hover:bg-[#F6C445] disabled:opacity-45"
                      >
                        <span>🛒</span>
                        <span>
                          {pendingDelivery
                            ? lang === 'bn'
                              ? 'আসছে…'
                              : 'On way…'
                            : taka(sim.cartonCost(pid), lang)}
                        </span>
                        {config.mods.marketPrices && buyPct !== 100 && (
                          <span className={buyPct < 100 ? 'text-emerald-700' : 'text-red-600'}>
                            {buyPct < 100 ? '▼' : '▲'}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL DECISION CARD OVERLAY ── */}
      {activeDecision && (
        <div
          data-testid="decision-modal"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border-4 border-[#3B2314] bg-[#FFF8E7] p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-[#3B2314]/20 pb-2">
              <h3 className="text-lg font-extrabold text-[#C9462C]">
                {activeDecision.boss ? '👑 ' : '📋 '}
                {t(activeDecision.title, lang, activeDecision.params)}
              </h3>
              <span className="rounded-full border-2 border-[#3B2314] bg-[#F6C445] px-2.5 py-0.5 text-xs font-black">
                ⏱️ {digits(Math.max(0, Math.ceil((activeDecision.deadlineTick - sim.tick) / TICKS_PER_SEC)), lang)}
                {t('ui.sec', lang)}
              </span>
            </div>

            <p className="mt-2.5 text-sm font-bold leading-snug text-[#3B2314]">
              {t(activeDecision.prompt, lang, activeDecision.params)}
            </p>

            {activeDecision.hint && (
              <div className="mt-2 rounded-lg border border-[#3B2314]/30 bg-[#F4D58D] px-3 py-1.5 text-xs font-extrabold">
                💡 {t(activeDecision.hint, lang, activeDecision.params)}
              </div>
            )}

            {/* Decision Table (Rows may be tappable when rowSelect is true) */}
            {activeDecision.rows && activeDecision.rows.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border-2 border-[#3B2314] bg-white">
                {activeDecision.header && (
                  <div
                    className="grid bg-[#3B2314] px-2.5 py-1.5 text-xs font-extrabold text-white"
                    style={{ gridTemplateColumns: `repeat(${activeDecision.header.length}, minmax(0, 1fr))` }}
                  >
                    {activeDecision.header.map((hKey, i) => (
                      <span key={i}>{t(hKey, lang)}</span>
                    ))}
                  </div>
                )}
                <div className="divide-y divide-[#3B2314]/15">
                  {activeDecision.rows.map((row, rIdx) => {
                    const isBest = activeDecision.rowSelect && activeDecision.best === rIdx;
                    if (activeDecision.rowSelect) {
                      return (
                        <button
                          key={rIdx}
                          type="button"
                          data-testid={`decision-option-${rIdx}`}
                          onClick={() => performAction(Act.Decide, activeDecision.id, rIdx)}
                          className={`grid w-full items-center px-2.5 py-2 text-left text-xs font-bold transition hover:bg-[#FFF3D6] ${
                            config.guided && isBest ? 'bg-[#E8F5E9]' : ''
                          }`}
                          style={{ gridTemplateColumns: `repeat(${row.cells.length}, minmax(0, 1fr))` }}
                        >
                          {row.cells.map((cell, cIdx) => (
                            <span key={cIdx}>{tokens(cell, lang)}</span>
                          ))}
                        </button>
                      );
                    }
                    return (
                      <div
                        key={rIdx}
                        className="grid px-2.5 py-1.5 text-xs font-bold"
                        style={{ gridTemplateColumns: `repeat(${row.cells.length}, minmax(0, 1fr))` }}
                      >
                        {row.cells.map((cell, cIdx) => (
                          <span key={cIdx}>{tokens(cell, lang)}</span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Decision Option Buttons */}
            {activeDecision.options.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {activeDecision.options.map((opt, idx) => {
                  const optIndex = (activeDecision.rowSelect ? activeDecision.rows?.length ?? 0 : 0) + idx;
                  const isBest = activeDecision.best === optIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      data-testid={`decision-option-${optIndex}`}
                      onClick={() => performAction(Act.Decide, activeDecision.id, optIndex)}
                      className={`w-full rounded-xl border-2 border-[#3B2314] px-3 py-2.5 text-sm font-extrabold shadow-sm transition active:translate-y-0.5 ${
                        config.guided && isBest
                          ? 'bg-[#2E7D32] text-white'
                          : 'bg-[#F6C445] text-[#3B2314] hover:bg-[#F4A261]'
                      }`}
                    >
                      {t(opt.key, lang, opt.params)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PRE-LEVEL TUTORIAL / BOSS INTRO OVERLAY ── */}
      {showIntro && (
        <div
          data-testid="intro-modal"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border-4 border-[#3B2314] bg-[#FFF8E7] p-5 shadow-2xl">
            <div className="text-center">
              <span className="inline-block rounded-full border-2 border-[#3B2314] bg-[#F6C445] px-3 py-0.5 text-xs font-extrabold">
                {config.level ? `${lang === 'bn' ? 'লেভেল' : 'Level'} ${digits(config.level, lang)}` : pick(config.title, lang)}
              </span>
              <h2 className="mt-2 text-2xl font-extrabold text-[#C9462C]">{pick(config.title, lang)}</h2>
            </div>

            {config.boss && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-[#3B2314] bg-[#3B2314] p-3 text-white">
                <img
                  src={characterDataUrl(BOSS_NAMES[config.boss.id].look, 'angry')}
                  alt=""
                  className="h-20 w-16 object-contain"
                />
                <div>
                  <div className="text-xs font-bold text-[#F6C445]">{t('ui.bossIncoming', lang)}</div>
                  <div className="text-lg font-extrabold">{pick(BOSS_NAMES[config.boss.id].name, lang)}</div>
                  <p className="mt-0.5 text-xs italic text-amber-100">“{pick(BOSS_NAMES[config.boss.id].taunt, lang)}”</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-300">{pick(BOSS_NAMES[config.boss.id].how, lang)}</p>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {config.tutorials.map((tutId) => {
                const ch = CHALLENGE_MAP[tutId];
                if (ch) {
                  return (
                    <div key={tutId} className="rounded-xl border-2 border-[#3B2314] bg-white p-3">
                      <div className="text-xs font-bold text-[#2A9D8F]">{t('ui.newChallenge', lang)}</div>
                      <div className="text-sm font-extrabold">{pick(ch.name, lang)}</div>
                      <p className="mt-0.5 text-xs text-[#6D4C41]">{pick(ch.description, lang)}</p>
                      <p className="mt-1 text-xs font-bold text-[#3B2314]">👉 {pick(ch.howTo, lang)}</p>
                    </div>
                  );
                }
                if (hasKey(`tut.${tutId}.title`, lang)) {
                  return (
                    <div key={tutId} className="rounded-xl border-2 border-[#3B2314] bg-white p-3">
                      <div className="text-sm font-extrabold text-[#C9462C]">{t(`tut.${tutId}.title`, lang)}</div>
                      <p className="mt-1 text-xs font-semibold text-[#3B2314]">{t(`tut.${tutId}.body`, lang)}</p>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <button
              type="button"
              data-testid="btn-start-level"
              onClick={() => setShowIntro(false)}
              className="mt-4 w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-3 text-base font-extrabold text-white shadow-md hover:bg-[#1B5E20]"
            >
              ▶️ {t('ui.start', lang)}
            </button>
          </div>
        </div>
      )}

      {/* ── SCREEN 5: PAUSE MODAL ── */}
      {paused && !sim.ended && (
        <div
          data-testid="pause-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border-4 border-[#3B2314] bg-[#FFF8E7] p-5 shadow-2xl">
            <h2 className="text-center text-xl font-extrabold">⏸ {lang === 'bn' ? 'বিরতি' : 'Paused'}</h2>
            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                data-testid="btn-resume"
                onClick={() => setPaused(false)}
                className="w-full rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-2.5 font-extrabold text-white"
              >
                ▶️ {lang === 'bn' ? 'খেলা চালিয়ে যান' : 'Resume'}
              </button>
              <button
                type="button"
                data-testid="btn-restart"
                onClick={onReplay}
                className="w-full rounded-xl border-2 border-[#3B2314] bg-[#F6C445] py-2.5 font-extrabold text-[#3B2314]"
              >
                🔄 {lang === 'bn' ? 'আবার শুরু করুন' : 'Restart'}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onToggleSfx(!sfxOn)}
                  className="flex-1 rounded-xl border-2 border-[#3B2314] bg-white py-2 text-xs font-extrabold"
                >
                  {sfxOn ? '🔊' : '🔇'} {lang === 'bn' ? 'সাউন্ড' : 'Sound'}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleMusic(!musicOn)}
                  className="flex-1 rounded-xl border-2 border-[#3B2314] bg-white py-2 text-xs font-extrabold"
                >
                  {musicOn ? '🎵' : '🔕'} {lang === 'bn' ? 'মিউজিক' : 'Music'}
                </button>
              </div>
              <button
                type="button"
                data-testid="btn-exit-level"
                onClick={onExit}
                className="w-full rounded-xl border-2 border-[#3B2314] bg-rose-100 py-2.5 font-extrabold text-rose-900"
              >
                🚪 {lang === 'bn' ? 'বাইরে যান' : 'Exit to Menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCREEN 6: RESULTS OVERLAY ── */}
      {sim.ended && sim.result && (
        <div
          data-testid="results-screen"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
        >
          <div className="my-auto w-full max-w-md rounded-2xl border-4 border-[#3B2314] bg-[#FFF8E7] p-5 shadow-2xl">
            <div className="text-center">
              <div className="text-3xl">
                {sim.result.stars > 0
                  ? [1, 2, 3].map((s) => (
                      <span key={s} className={s <= sim.result!.stars ? 'text-[#F6C445]' : 'text-slate-300'}>
                        ★
                      </span>
                    ))
                  : sim.result.won
                    ? '🏆'
                    : '💔'}
              </div>
              <h2
                data-testid="results-heading"
                className={`mt-1 text-2xl font-extrabold ${sim.result.won ? 'text-[#2E7D32]' : 'text-[#C62828]'}`}
              >
                {sim.result.won
                  ? lang === 'bn'
                    ? 'দোকান দারুণ সামলেছেন!'
                    : 'Shop Handled Brilliantly!'
                  : lang === 'bn'
                    ? 'চেষ্টা ভালো ছিল!'
                    : 'Good Try!'}
              </h2>
              <div className="mt-1 text-3xl font-black text-[#3B2314]" data-testid="results-score">
                {num(sim.result.score, lang)}
              </div>
              <p className="text-xs font-bold text-[#6D4C41]">{t('ui.score', lang)}</p>
            </div>

            {/* Metrics Grid */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-extrabold">
              <div className="rounded-xl border-2 border-[#3B2314] bg-white p-2">
                <div className="text-[#6D4C41]">{lang === 'bn' ? 'নির্ভুলতা' : 'Accuracy'}</div>
                <div className="text-base text-[#1B5E20]">{digits(sim.result.accuracy, lang)}%</div>
              </div>
              <div className="rounded-xl border-2 border-[#3B2314] bg-white p-2">
                <div className="text-[#6D4C41]">{lang === 'bn' ? 'সন্তুষ্টি' : 'Satisfaction'}</div>
                <div className="text-base text-[#1D4ED8]">{digits(sim.result.satisfaction, lang)}%</div>
              </div>
              <div className="rounded-xl border-2 border-[#3B2314] bg-white p-2">
                <div className="text-[#6D4C41]">{lang === 'bn' ? 'লাভ' : 'Profit'}</div>
                <div className="text-base text-[#C9462C]">{taka(sim.result.profit, lang)}</div>
              </div>
            </div>

            {/* Completed Objectives */}
            <div className="mt-3 space-y-1 rounded-xl border-2 border-[#3B2314] bg-white p-2.5 text-xs font-bold">
              {sim.result.objectives.map((o, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>
                    {o.done ? '✅' : '❌'} {formatObjective(o.objective, lang)}
                  </span>
                  <span>
                    {digits(o.value, lang)} / {digits(o.objective.target, lang)}
                  </span>
                </div>
              ))}
            </div>

            {/* Rewards & Unlocked Achievements */}
            <div className="mt-3 flex items-center justify-around rounded-xl border-2 border-[#3B2314] bg-[#F4D58D] py-2 text-xs font-extrabold">
              <span>
                🪙 +{digits(serverResponse?.rewardsGranted?.coins ?? (sim.result.won ? config.rewards.coins : 0), lang)}{' '}
                {lang === 'bn' ? 'কয়েন' : 'Coins'}
              </span>
              <span>
                ⭐ +{digits(serverResponse?.rewardsGranted?.xp ?? (sim.result.won ? config.rewards.xp : 0), lang)} XP
              </span>
              {serverResponse?.leaderboardRank && (
                <span>
                  🏅 {lang === 'bn' ? 'র‍্যাঙ্ক' : 'Rank'} #{digits(serverResponse.leaderboardRank, lang)}
                </span>
              )}
            </div>

            {submitting && (
              <div className="mt-2 text-center text-xs font-bold text-[#6D4C41]">
                {lang === 'bn' ? 'স্কোর যাচাই ও সংরক্ষণ হচ্ছে…' : 'Validating and saving score…'}
              </div>
            )}

            {serverResponse?.rewardsGranted?.achievementsUnlocked &&
              serverResponse.rewardsGranted.achievementsUnlocked.length > 0 && (
                <div className="mt-2.5 space-y-1 rounded-xl border-2 border-[#2E7D32] bg-[#E8F5E9] p-2 text-xs font-extrabold text-[#1B5E20]">
                  {serverResponse.rewardsGranted.achievementsUnlocked.map((ach) => (
                    <div key={ach.id}>
                      🎉 {ach.icon} {pick(ach.name, lang)} (+{digits(ach.coins, lang)} 🪙)
                    </div>
                  ))}
                </div>
              )}

            {/* Action Buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="btn-replay"
                onClick={onReplay}
                className="rounded-xl border-2 border-[#3B2314] bg-[#F6C445] py-2.5 text-sm font-extrabold text-[#3B2314]"
              >
                🔄 {lang === 'bn' ? 'আবার খেলুন' : 'Play Again'}
              </button>

              {config.mode === 'story' && sim.result.won && onNextLevel ? (
                <button
                  type="button"
                  data-testid="btn-next-level"
                  onClick={onNextLevel}
                  className="rounded-xl border-2 border-[#3B2314] bg-[#2E7D32] py-2.5 text-sm font-extrabold text-white"
                >
                  ⏭️ {lang === 'bn' ? 'পরের লেভেল' : 'Next Level'}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="btn-results-menu"
                  onClick={onExit}
                  className="rounded-xl border-2 border-[#3B2314] bg-white py-2.5 text-sm font-extrabold text-[#3B2314]"
                >
                  🏠 {lang === 'bn' ? 'মূল মেনু' : 'Main Menu'}
                </button>
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                data-testid="btn-share-score"
                onClick={handleShareScore}
                className="flex-1 rounded-xl border-2 border-[#3B2314] bg-white py-2 text-xs font-extrabold hover:bg-[#FFF3D6]"
              >
                📤 {shareCopied ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : lang === 'bn' ? 'স্কোর শেয়ার করুন' : 'Share Score'}
              </button>
              {onCreateFriendChallenge && (
                <button
                  type="button"
                  onClick={() => onCreateFriendChallenge(sim.result!.score)}
                  className="flex-1 rounded-xl border-2 border-[#3B2314] bg-white py-2 text-xs font-extrabold hover:bg-[#FFF3D6]"
                >
                  🤝 {lang === 'bn' ? 'বন্ধুকে চ্যালেঞ্জ' : 'Challenge Friend'}
                </button>
              )}
            </div>

            {/* Subtle, Non-Intrusive HelloKhata Sponsor CTA (Section 22) */}
            <div className="mt-3 rounded-xl border-2 border-[#0A9396] bg-[#E0F2F1] p-3 text-center">
              <p className="text-xs font-bold text-[#004D40]">
                {lang === 'bn'
                  ? 'গেমে দোকান সামলালেন, এবার বাস্তব দোকানের হিসাব সামলান HelloKhata দিয়ে।'
                  : 'You managed the shop in the game — now manage your real shop accounts with HelloKhata.'}
              </p>
              <a
                href={`${process.env.NEXT_PUBLIC_HELLOKHATA_URL || 'https://hellokhata.com'}?utm_source=dokaan_shamlao&utm_medium=results_cta&utm_campaign=game`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onHelloKhataClick('results_screen')}
                className="mt-1.5 inline-block rounded-lg border border-[#004D40] bg-[#0A9396] px-3 py-1 text-xs font-extrabold text-white hover:bg-[#00695C]"
              >
                📒 {lang === 'bn' ? 'HelloKhata সম্পর্কে জানুন' : 'Learn about HelloKhata'}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
