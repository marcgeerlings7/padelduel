import { loadFont as loadBarlow } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadInstrument } from "@remotion/google-fonts/InstrumentSans";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Uitlegvideo PadelDuel v2 (9:16, 52 s). Opgebouwd rond de USP-pijlers
 * (docs/marketing/06_USP.md) met geanimeerde uitleg per stap. Muziek:
 * zelf gecomponeerd en synthetisch gegenereerd (music/compose.py) — rechtenvrij.
 * Scènes vallen op de maat: 120 BPM → 1 maat = 60 frames.
 */
const { fontFamily: display } = loadBarlow("normal", { weights: ["700", "800"], subsets: ["latin"] });
const { fontFamily: sans } = loadInstrument("normal", { weights: ["400", "600"], subsets: ["latin"] });

const C = {
  court: "#132f9a",
  courtDeep: "#0c1f6b",
  courtMuted: "#b8c6f5",
  primary: "#1f45c8",
  primarySoft: "#e6ecfb",
  ball: "#d6f23c",
  ink: "#0a1733",
  muted: "#46557a",
  glass: "#f2f4f8",
  white: "#ffffff",
  win: "#0f7a3d",
  winSoft: "#e3f4ea",
  loss: "#b3232d",
  lossSoft: "#fbe6e7",
};

const BAR = 60;
const SCENES = {
  hook: [0, 2],
  problem: [2, 4],
  duo: [4, 7],
  tiers: [7, 10],
  placement: [10, 13],
  flow: [13, 17],
  montage: [17, 19],
  compare: [19, 22],
  outro: [22, 26],
} as const;
export const TOTAL_FRAMES_V2 = SCENES.outro[1] * BAR;

// ---------------------------------------------------------------------------
// Bouwstenen
// ---------------------------------------------------------------------------
function useSpring(delay = 0, damping = 16) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
}

function lerp(frame: number, input: [number, number], output: [number, number], ease = Easing.inOut(Easing.cubic)) {
  return interpolate(frame, input, output, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  style,
}) => {
  const p = useSpring(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 50}px)`, ...style }}>{children}</div>;
};

const Pop: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  style,
}) => {
  const p = useSpring(delay, 11);
  return <div style={{ transform: `scale(${p})`, opacity: Math.min(1, p * 1.5), ...style }}>{children}</div>;
};

const CourtLines: React.FC<{ opacity?: number }> = ({ opacity = 0.12 }) => (
  <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity }} aria-hidden>
    <g stroke={C.white} strokeWidth={6} fill="none">
      <rect x={90} y={160} width={900} height={1600} />
      <line x1={90} y1={960} x2={990} y2={960} strokeWidth={10} />
      <line x1={90} y1={560} x2={990} y2={560} />
      <line x1={90} y1={1360} x2={990} y2={1360} />
      <line x1={540} y1={560} x2={540} y2={1360} />
    </g>
  </svg>
);

const Logo: React.FC<{ size?: number; color?: string }> = ({ size = 60, color = C.white }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: C.white, position: "relative", boxShadow: "0 0 0 3px rgba(0,0,0,.06)" }}>
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 3, background: C.court }} />
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, background: C.court }} />
      <div style={{ position: "absolute", right: size * 0.14, top: size * 0.14, width: size * 0.26, height: size * 0.26, borderRadius: "50%", background: C.ball }} />
    </div>
    <span style={{ fontFamily: display, fontWeight: 800, fontSize: size * 0.9, color }}>PadelDuel</span>
  </div>
);

const Headline: React.FC<{ kicker?: string; title: React.ReactNode; dark?: boolean; delay?: number }> = ({
  kicker,
  title,
  dark = true,
  delay = 0,
}) => (
  <div style={{ position: "absolute", top: 130, left: 90, right: 90 }}>
    {kicker ? (
      <Rise delay={delay}>
        <span style={{ display: "inline-block", fontFamily: sans, fontWeight: 600, fontSize: 34, color: C.ink, background: C.ball, borderRadius: 999, padding: "8px 26px" }}>
          {kicker}
        </span>
      </Rise>
    ) : null}
    <Rise delay={delay + 5} style={{ marginTop: kicker ? 26 : 0 }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 100, lineHeight: 0.95, color: dark ? C.white : C.ink }}>{title}</div>
    </Rise>
  </div>
);

const Caption: React.FC<{ children: React.ReactNode; delay: number; top: number; dark?: boolean }> = ({
  children,
  delay,
  top,
  dark = true,
}) => (
  <Rise delay={delay} style={{ position: "absolute", left: 90, right: 90, top }}>
    <div style={{ fontFamily: sans, fontSize: 42, lineHeight: 1.3, color: dark ? C.courtMuted : C.muted }}>{children}</div>
  </Rise>
);

const Avatar: React.FC<{ initials: string; color: string; size?: number }> = ({ initials, color, size = 150 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: size * 0.42, color: C.white, border: `6px solid ${C.white}`, boxShadow: "0 20px 40px rgba(0,0,0,.25)" }}>
    {initials}
  </div>
);

const Num: React.FC<{ from: number; to: number; start: number; end: number; prefix?: string }> = ({ from, to, start, end, prefix = "" }) => {
  const frame = useCurrentFrame();
  return <>{prefix + Math.round(lerp(frame, [start, end], [from, to], Easing.out(Easing.cubic)))}</>;
};

/** Pijl die zichzelf tekent (stroke-dashoffset). */
const DrawArrow: React.FC<{ d: string; start: number; color?: string; width?: number; dur?: number }> = ({
  d,
  start,
  color = C.ball,
  width = 10,
  dur = 18,
}) => {
  const frame = useCurrentFrame();
  const p = lerp(frame, [start, start + dur], [0, 1]);
  return (
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
      <defs>
        <marker id={`h-${start}-${color}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={color} />
        </marker>
      </defs>
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} markerEnd={p > 0.95 ? `url(#h-${start}-${color})` : undefined} />
    </svg>
  );
};

const SceneFade: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6, duration - 6, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

// ---------------------------------------------------------------------------
// Scènes
// ---------------------------------------------------------------------------
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  // bal stuitert op de 'pok's in de muziek (0 s, 1 s, 1,5 s)
  const y = frame < 30 ? lerp(frame, [0, 30], [0, 1]) : frame < 45 ? lerp(frame, [30, 45], [0, 1]) : 1;
  const bounce = Math.abs(Math.sin(y * Math.PI)) * (frame < 30 ? 260 : 140);
  return (
    <AbsoluteFill style={{ background: C.court }}>
      <CourtLines />
      <div style={{ position: "absolute", left: 780, top: 1300 - bounce, width: 110, height: 110, borderRadius: "50%", background: C.ball, boxShadow: "0 30px 60px rgba(0,0,0,.3)" }} />
      <div style={{ position: "absolute", left: 90, right: 90, top: 520 }}>
        <Rise delay={0}>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 112, lineHeight: 0.95, color: C.white }}>
            Jullie denken dat jullie het beste duo zijn?
          </div>
        </Rise>
        <Pop delay={58} style={{ marginTop: 50, transformOrigin: "0% 50%" }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontStyle: "italic", fontSize: 210, lineHeight: 0.9, color: C.ball }}>Bewijs het.</div>
        </Pop>
      </div>
    </AbsoluteFill>
  );
};

const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const partner = lerp(frame, [50, 72], [700, 0], Easing.out(Easing.back(1.4)));
  return (
    <AbsoluteFill style={{ background: C.glass }}>
      <Headline dark={false} title={<>Je KNLTB-rating meet <span style={{ color: C.primary }}>jóu</span>.</>} />
      <div style={{ position: "absolute", top: 700, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 60 }}>
        <Pop delay={8}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <Avatar initials="S" color={C.primary} size={210} />
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 60, color: C.ink }}>Sanne</div>
          </div>
        </Pop>
        <div style={{ transform: `translateX(${partner}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <Avatar initials="J" color="#0f7a6a" size={210} />
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: 60, color: C.ink }}>Joris</div>
        </div>
      </div>
      <Rise delay={62} style={{ position: "absolute", top: 1130, left: 90, right: 90 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 96, lineHeight: 0.95, color: C.ink }}>
          Maar padel speel je <span style={{ background: C.ball, padding: "0 12px" }}>met z&apos;n tweeën.</span>
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

const DuoCard: React.FC<{ name: string; players: string; rating: React.ReactNode; accent?: string; style?: React.CSSProperties }> = ({
  name,
  players,
  rating,
  accent = C.primary,
  style,
}) => (
  <div style={{ background: C.white, borderRadius: 40, padding: "34px 40px", boxShadow: "0 30px 60px rgba(6,15,50,.3)", width: 760, display: "flex", alignItems: "center", justifyContent: "space-between", ...style }}>
    <div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 64, color: C.ink, lineHeight: 1 }}>{name}</div>
      <div style={{ fontFamily: sans, fontSize: 34, color: C.muted, marginTop: 8 }}>{players}</div>
    </div>
    <div style={{ textAlign: "right" }}>
      <div style={{ fontFamily: sans, fontSize: 28, color: C.muted }}>Rating</div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 92, color: accent, lineHeight: 1 }}>{rating}</div>
    </div>
  </div>
);

const Duo: React.FC = () => {
  const frame = useCurrentFrame();
  const merge = lerp(frame, [10, 34], [0, 1], Easing.inOut(Easing.cubic));
  const card1 = useSpring(30, 14);
  const card2 = useSpring(84, 14);
  const h2h = useSpring(128, 12);
  return (
    <AbsoluteFill style={{ background: C.court, overflow: "hidden" }}>
      <CourtLines opacity={0.08} />
      <Headline kicker="1 · Het duo staat centraal" title="Elk koppel een eigen rating" />
      {/* twee spelers schuiven samen */}
      <div style={{ position: "absolute", top: 640, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: 1 - card1 }}>
        <div style={{ transform: `translateX(${(1 - merge) * -160}px)` }}><Avatar initials="S" color={C.primary} /></div>
        <div style={{ transform: `translateX(${(1 - merge) * 160 - 40}px)` }}><Avatar initials="J" color="#0f7a6a" /></div>
      </div>
      <div style={{ position: "absolute", left: 160, top: 620, transform: `scale(${card1})`, opacity: card1 }}>
        <DuoCard name="Sanne & Joris" players="Duo 1" rating={<Num from={1200} to={1340} start={36} end={80} />} />
      </div>
      <div style={{ position: "absolute", left: 160, top: 900, transform: `translateY(${(1 - card2) * 200}px)`, opacity: card2 }}>
        <DuoCard name="Sanne & Noor" players="Duo 2 · andere partner" rating={<Num from={1200} to={1250} start={90} end={130} />} accent={C.win} />
      </div>
      <div style={{ position: "absolute", left: 160, top: 1200, transform: `scale(${h2h})`, transformOrigin: "0% 50%", display: "flex", gap: 20 }}>
        {["Onderling 3–1", "Reeks W4", "W–V 9–3"].map((t) => (
          <div key={t} style={{ background: C.ball, color: C.ink, fontFamily: sans, fontWeight: 600, fontSize: 36, borderRadius: 999, padding: "14px 28px" }}>{t}</div>
        ))}
      </div>
      <Caption delay={138} top={1360}>Speel je met meerdere partners? Elke combinatie telt apart — met onderling resultaat en reeksen.</Caption>
    </AbsoluteFill>
  );
};

// Ladder met tiers: gedeelde geometrie voor tiers- en plaatsingsscène
const LADDER_X = 90;
const LADDER_W = 900;
const TIER_TOP = 560;
const TIER_H = 300;
const TIERS = [14, 13, 12];
const tierY = (tier: number) => TIER_TOP + (14 - tier) * TIER_H;

const TierBands: React.FC<{ highlight?: number[] }> = ({ highlight = [] }) => (
  <>
    {TIERS.map((t, i) => (
      <Rise key={t} delay={i * 4} style={{ position: "absolute", left: LADDER_X, top: tierY(t), width: LADDER_W, height: TIER_H - 20 }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 32, background: highlight.includes(t) ? "rgba(214,242,60,.16)" : "rgba(255,255,255,.07)", border: `3px solid ${highlight.includes(t) ? C.ball : "rgba(255,255,255,.18)"}` }}>
          <div style={{ position: "absolute", left: 28, top: 20, fontFamily: display, fontWeight: 800, fontSize: 46, color: C.white }}>Tier {t}</div>
          <div style={{ position: "absolute", left: 28, top: 72, fontFamily: sans, fontSize: 28, color: C.courtMuted }}>{t * 100}–{t * 100 + 99}</div>
        </div>
      </Rise>
    ))}
  </>
);

const Token: React.FC<{ label: string; x: number; y: number; you?: boolean; dim?: boolean; delay?: number; badge?: string }> = ({
  label,
  x,
  y,
  you,
  dim,
  delay = 0,
  badge,
}) => {
  const p = useSpring(delay, 12);
  return (
    <div style={{ position: "absolute", left: x - 70, top: y - 70, width: 140, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${p})`, opacity: dim ? 0.35 : 1, transition: "none" }}>
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: you ? C.ball : C.white, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 44, boxShadow: you ? `0 0 0 10px rgba(214,242,60,.35)` : "0 14px 30px rgba(0,0,0,.25)" }}>
        {label}
      </div>
      {badge ? <div style={{ marginTop: 10, fontFamily: sans, fontWeight: 600, fontSize: 26, color: you ? C.ball : C.white, whiteSpace: "nowrap" }}>{badge}</div> : null}
    </div>
  );
};

const Check: React.FC<{ x: number; y: number; delay: number; ok: boolean }> = ({ x, y, delay, ok }) => (
  <Pop delay={delay} style={{ position: "absolute", left: x - 32, top: y - 32 }}>
    <div style={{ width: 64, height: 64, borderRadius: "50%", background: ok ? C.win : C.loss, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 600, fontSize: 40, border: `4px solid ${C.white}` }}>
      {ok ? "✓" : "✕"}
    </div>
  </Pop>
);

const Tiers: React.FC = () => {
  const yMid13 = tierY(13) + TIER_H / 2;
  return (
    <AbsoluteFill style={{ background: C.courtDeep, overflow: "hidden" }}>
      <Headline kicker="2 · Altijd een eerlijke partij" title="Daag uit binnen je tier" />
      <TierBands highlight={[13]} />
      <Token label="DC" x={520} y={tierY(14) + 150} delay={10} dim />
      <Token label="TT" x={800} y={tierY(14) + 150} delay={12} dim />
      <Token label="Jij" x={330} y={yMid13} you delay={16} badge="jullie duo" />
      <Token label="NN" x={600} y={yMid13} delay={20} />
      <Token label="BB" x={840} y={yMid13} delay={22} />
      <Token label="RR" x={560} y={tierY(12) + 150} delay={14} dim />
      <Token label="LL" x={820} y={tierY(12) + 150} delay={16} dim />
      <DrawArrow d={`M 400 ${yMid13 - 40} Q 500 ${yMid13 - 120} 540 ${yMid13 - 60}`} start={40} />
      <DrawArrow d={`M 400 ${yMid13 - 50} Q 620 ${yMid13 - 200} 790 ${yMid13 - 70}`} start={52} />
      <Check x={650} y={yMid13 - 70} delay={62} ok />
      <Check x={890} y={yMid13 - 70} delay={70} ok />
      <Check x={570} y={tierY(14) + 90} delay={86} ok={false} />
      <Check x={610} y={tierY(12) + 90} delay={92} ok={false} />
      <Caption delay={104} top={1480}>Nooit kansloos, nooit saai. Cluboverstijgend, in je hele regio — en het gamesaldo telt mee.</Caption>
    </AbsoluteFill>
  );
};

const Placement: React.FC = () => {
  const frame = useCurrentFrame();
  // nieuw duo start in tier 12, wint tegen tier 14 en klimt naar tier 13
  const climb = lerp(frame, [110, 140], [0, 1], Easing.out(Easing.back(1.2)));
  const youY = tierY(12) + 150 - climb * TIER_H;
  const left = frame < 110 ? 10 : frame < 150 ? 9 : 8;
  const win = useSpring(96, 10);
  return (
    <AbsoluteFill style={{ background: C.court, overflow: "hidden" }}>
      <CourtLines opacity={0.06} />
      <Headline kicker="Nieuw duo? Klim snel" title="Tot 2 tiers hoger uitdagen" />
      <TierBands highlight={[12, 13, 14]} />
      <Token label="TT" x={760} y={tierY(14) + 150} delay={6} />
      <Token label="NN" x={760} y={tierY(13) + 150} delay={8} />
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <Token label="Jij" x={300} y={youY} you delay={12} badge="nieuw" />
      </div>
      {frame < 110 ? (
        <>
          <DrawArrow d={`M 370 ${tierY(12) + 110} Q 520 ${tierY(13) + 120} 690 ${tierY(13) + 150}`} start={30} />
          <DrawArrow d={`M 360 ${tierY(12) + 90} Q 460 ${tierY(14) + 120} 690 ${tierY(14) + 150}`} start={44} />
        </>
      ) : null}
      <Pop delay={96} style={{ position: "absolute", left: 470, top: tierY(14) + 100 }}>
        <div style={{ background: C.win, color: C.white, fontFamily: display, fontWeight: 800, fontSize: 56, borderRadius: 20, padding: "8px 26px", transform: `rotate(-6deg)`, opacity: win }}>WIN +32</div>
      </Pop>
      <Rise delay={20} style={{ position: "absolute", left: 90, top: 1480 }}>
        <div style={{ display: "inline-block", background: C.white, color: C.ink, fontFamily: sans, fontWeight: 600, fontSize: 40, borderRadius: 999, padding: "16px 34px" }}>
          Plaatsingsperiode: nog <span style={{ fontFamily: display, fontWeight: 800, fontSize: 52, color: C.primary }}>{left}</span> wedstrijden
        </div>
      </Rise>
      <Caption delay={60} top={1600}>Sterk nieuw duo? Dan sta je in een paar wedstrijden op je echte niveau.</Caption>
    </AbsoluteFill>
  );
};

const FLOW_STEPS: { title: string; sub: string }[] = [
  { title: "Uitdaging verstuurd", sub: "met één tik op de ladder" },
  { title: "Reageren binnen 5 dagen", sub: "accepteren of weigeren (weigeren is gratis)" },
  { title: "Spelen", sub: "baan boek je gewoon bij je club" },
  { title: "Uitslag: 6-4 6-3", sub: "tegenstander bevestigt" },
];

const Flow: React.FC = () => {
  const frame = useCurrentFrame();
  const stepGap = 230;
  const lineP = lerp(frame, [10, 150], [0, 1], Easing.linear);
  const top0 = 600;
  return (
    <AbsoluteFill style={{ background: C.glass, overflow: "hidden" }}>
      <Headline dark={false} kicker="3 · Afspraak is afspraak" title="Van uitdaging tot rating" />
      <div style={{ position: "absolute", left: 150, top: top0 + 40, width: 8, height: stepGap * 3 * lineP, background: C.primary, borderRadius: 4 }} />
      {FLOW_STEPS.map((s, i) => {
        const d = 10 + i * 40;
        return (
          <div key={s.title} style={{ position: "absolute", left: 100, top: top0 + i * stepGap }}>
            <Pop delay={d} style={{ position: "absolute", left: 0, top: 0 }}>
              <div style={{ width: 108, height: 108, borderRadius: "50%", background: C.primary, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: display, fontWeight: 800, fontSize: 56, border: `6px solid ${C.white}`, boxShadow: "0 12px 30px rgba(31,69,200,.35)" }}>{i + 1}</div>
            </Pop>
            <Rise delay={d + 4} style={{ position: "absolute", left: 150, top: 4, width: 760 }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 62, color: C.ink, lineHeight: 1 }}>{s.title}</div>
              <div style={{ fontFamily: sans, fontSize: 34, color: C.muted, marginTop: 8 }}>{s.sub}</div>
            </Rise>
          </div>
        );
      })}
      <Pop delay={170} style={{ position: "absolute", left: 100, top: top0 + 4 * stepGap - 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, background: C.winSoft, border: `4px solid ${C.win}`, borderRadius: 32, padding: "22px 34px" }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 84, color: C.win }}>
            <Num from={1340} to={1358} start={176} end={200} />
          </span>
          <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 38, color: C.win }}>+18 rating · gamesaldo telt mee</span>
        </div>
      </Pop>
      <Pop delay={200} style={{ position: "absolute", left: 100, top: top0 + 4 * stepGap + 150 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, background: C.lossSoft, border: `4px solid ${C.loss}`, borderRadius: 28, padding: "18px 30px" }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 48, color: C.loss }}>Wegduiken?</span>
          <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 36, color: C.loss }}>niet reageren = −10 vaste penalty</span>
        </div>
      </Pop>
    </AbsoluteFill>
  );
};

const Montage: React.FC = () => {
  const shots = ["shots/03-dashboard.png", "shots/04-ladder.png", "shots/06-challenge-sent.png"];
  const w = 420;
  const h = Math.round(w * (1688 / 780));
  return (
    <AbsoluteFill style={{ background: C.court, overflow: "hidden" }}>
      <CourtLines opacity={0.08} />
      <Headline title={<>Zo ziet het eruit</>} />
      {shots.map((src, i) => {
        const rot = [-9, 0, 9][i];
        const x = [80, 330, 580][i];
        return (
          <Rise key={src} delay={6 + i * 8} style={{ position: "absolute", left: x, top: 520 + (i === 1 ? -30 : 40), zIndex: i === 1 ? 2 : 1 }}>
            <div style={{ transform: `rotate(${rot}deg)`, width: w + 24, height: h + 24, borderRadius: 60, background: "#0b1430", padding: 12, boxShadow: "0 40px 90px rgba(6,15,50,.5)" }}>
              <div style={{ width: w, height: h, borderRadius: 48, overflow: "hidden" }}>
                <Img src={staticFile(src)} style={{ width: w, height: h, display: "block" }} />
              </div>
            </div>
          </Rise>
        );
      })}
    </AbsoluteFill>
  );
};

const ROWS = ["Rating per duo", "Hele regio, cluboverstijgend", "Uitdagen op niveau", "Afspraak is afspraak"];
const COLS: { name: string; marks: boolean[]; highlight?: boolean }[] = [
  { name: "PadelDuel", marks: [true, true, true, true], highlight: true },
  { name: "WhatsApp-ladder", marks: [true, false, false, false] },
  { name: "Individuele rating", marks: [false, true, false, false] },
];

const Compare: React.FC = () => {
  const rowH = 190;
  const top = 640;
  const colX = [560, 740, 910];
  return (
    <AbsoluteFill style={{ background: C.glass }}>
      <Headline dark={false} title={<>Waarom <span style={{ color: C.primary }}>PadelDuel</span>?</>} />
      <div style={{ position: "absolute", left: colX[0] - 85, top: top - 140, width: 170, height: rowH * ROWS.length + 160, borderRadius: 36, background: C.primarySoft, border: `4px solid ${C.primary}` }} />
      {COLS.map((c, ci) => (
        <Rise key={c.name} delay={4 + ci * 4} style={{ position: "absolute", left: colX[ci] - 85, top: top - 120, width: 170, textAlign: "center" }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontSize: c.highlight ? 40 : 32, color: c.highlight ? C.primary : C.muted, lineHeight: 1 }}>{c.name}</div>
        </Rise>
      ))}
      {ROWS.map((r, ri) => (
        <div key={r}>
          <Rise delay={14 + ri * 10} style={{ position: "absolute", left: 90, top: top + ri * rowH + 20, width: 380 }}>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 50, color: C.ink, lineHeight: 1 }}>{r}</div>
          </Rise>
          {COLS.map((c, ci) => (
            <Check key={c.name} x={colX[ci]} y={top + ri * rowH + 50} delay={20 + ri * 10 + ci * 5} ok={c.marks[ri]} />
          ))}
        </div>
      ))}
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 6), [-1, 1], [1, 1.04]);
  return (
    <AbsoluteFill style={{ background: C.court, justifyContent: "center", padding: 90 }}>
      <CourtLines />
      <Rise delay={0}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: C.courtMuted }}>Je KNLTB-rating zegt hoe goed jíj bent.</div>
      </Rise>
      <Rise delay={20} style={{ marginTop: 30 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 120, lineHeight: 0.95, color: C.white }}>
          PadelDuel zegt hoe goed jullie <span style={{ color: C.ball }}>sámen</span> zijn.
        </div>
      </Rise>
      <Rise delay={60} style={{ marginTop: 80 }}>
        <div style={{ display: "inline-block", transform: `scale(${pulse})`, transformOrigin: "0% 50%", background: C.ball, color: C.ink, fontFamily: sans, fontWeight: 600, fontSize: 48, borderRadius: 28, padding: "28px 44px" }}>
          Probeer de demo → padelduel.vercel.app
        </div>
      </Rise>
      <Rise delay={72} style={{ marginTop: 26 }}>
        <div style={{ fontFamily: sans, fontSize: 36, color: C.courtMuted }}>Gratis · geen app nodig · demo-accounts op de inlogpagina</div>
      </Rise>
      <div style={{ position: "absolute", left: 90, bottom: 120 }}>
        <Logo size={56} />
      </div>
    </AbsoluteFill>
  );
};

const SCENE_COMPONENTS: Record<keyof typeof SCENES, React.FC> = {
  hook: Hook,
  problem: Problem,
  duo: Duo,
  tiers: Tiers,
  placement: Placement,
  flow: Flow,
  montage: Montage,
  compare: Compare,
  outro: Outro,
};

export const PadelDuelUitlegV2: React.FC = () => (
  <AbsoluteFill style={{ background: C.court }}>
    <Audio src={staticFile("audio/music.wav")} />
    {(Object.keys(SCENES) as (keyof typeof SCENES)[]).map((key) => {
      const [a, b] = SCENES[key];
      const Scene = SCENE_COMPONENTS[key];
      const duration = (b - a) * BAR;
      return (
        <Sequence key={key} from={a * BAR} durationInFrames={duration}>
          <SceneFade duration={duration}>
            <Scene />
          </SceneFade>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
