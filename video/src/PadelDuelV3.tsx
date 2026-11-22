import { AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import {
  C,
  CompactContext,
  CourtLines,
  display,
  Duo,
  Flow,
  Headline,
  Hook,
  Logo,
  Placement,
  Pop,
  Rise,
  sans,
  Tiers,
  Avatar,
  lerp,
} from "./PadelDuelUitlegV2";
import VO from "./vo-timings.json";

/**
 * PadelDuel v3 (na de gap-analyse, docs/marketing/08_Videoanalyse.md):
 * - AI-voice-over (Piper, stem "rdh", CC0) draagt de uitleg; in beeld alleen trefwoorden.
 * - Scènewissel = een padelbal die van rechtsonder naar linksboven vliegt en het
 *   volgende scherm "inlaadt" (diagonale wipe achter de bal).
 * - Twee composities: uitleg (website, 52 s) en social (20 s, met ondertitels).
 * - Geen KNLTB-vergelijking meer in beeld; voorbeeldgetallen gemarkeerd.
 */
const W = 1080;
const H = 1920;
const WIPE = 16; // frames
const VO_DELAY = 8; // voice-over start na de bal

type VoKey = keyof typeof VO;
type SceneDef = { key: string; frames: number; vo?: VoKey; node: React.ReactNode };

// ---------------------------------------------------------------------------
// Balwissel
// ---------------------------------------------------------------------------
/** Polygoon van het gebied x + y >= c binnen het frame (onthuld deel rechtsonder). */
function halfPlane(c: number): string {
  const pts: [number, number][] = [];
  const corners: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const fa = a[0] + a[1] - c;
    const fb = b[0] + b[1] - c;
    if (fa >= 0) pts.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  if (pts.length === 0) return "polygon(0 0, 0 0, 0 0)";
  return `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(", ")})`;
}

const BallWipe: React.FC<{ children: React.ReactNode; enabled: boolean }> = ({ children, enabled }) => {
  const frame = useCurrentFrame();
  if (!enabled || frame >= WIPE + 4) return <AbsoluteFill>{children}</AbsoluteFill>;
  const p = lerp(frame, [0, WIPE], [0, 1]);
  const c = (1 - p) * (W + H) - 40;
  const ball = (cc: number) => ({ x: (cc * W) / (W + H), y: (cc * H) / (W + H) });
  const b = ball(c + 40);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: halfPlane(c) }}>{children}</AbsoluteFill>
      {frame < WIPE ? (
        <>
          {[0.16, 0.1, 0.05].map((op, i) => {
            const t = ball(c + 40 + (i + 1) * 110);
            return (
              <div key={i} style={{ position: "absolute", left: t.x - 50, top: t.y - 50, width: 100, height: 100, borderRadius: "50%", background: C.ball, opacity: op * 3 }} />
            );
          })}
          <div style={{ position: "absolute", left: b.x - 60, top: b.y - 60, width: 120, height: 120, borderRadius: "50%", background: C.ball, boxShadow: "0 0 40px rgba(214,242,60,.8), 0 20px 40px rgba(0,0,0,.3)" }}>
            <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden>
              <path d="M18 30 Q60 62 102 30" stroke="#fff" strokeWidth="6" fill="none" opacity="0.85" />
              <path d="M18 90 Q60 58 102 90" stroke="#fff" strokeWidth="6" fill="none" opacity="0.85" />
            </svg>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Nieuwe/aangepaste scènes
// ---------------------------------------------------------------------------
const ProblemV3: React.FC = () => {
  const frame = useCurrentFrame();
  const partner = lerp(frame, [52, 74], [700, 0]);
  return (
    <AbsoluteFill style={{ background: C.glass }}>
      <Headline dark={false} title={<>Je rating meet <span style={{ color: C.primary }}>jóu</span>.</>} />
      <div style={{ position: "absolute", top: 700, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 60 }}>
        <Pop delay={8}>
          <Avatar initials="S" color={C.primary} size={230} />
        </Pop>
        <div style={{ transform: `translateX(${partner}px)` }}>
          <Avatar initials="J" color="#0f7a6a" size={230} />
        </div>
      </div>
      <Rise delay={60} style={{ position: "absolute", top: 1120, left: 90, right: 90 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 110, lineHeight: 0.95, color: C.ink }}>
          Padel speel je <span style={{ background: C.ball, padding: "0 14px" }}>samen.</span>
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

const PhoneShot: React.FC<{ src: string; x: number; y: number; w: number; rot: number; delay: number }> = ({ src, x, y, w, rot, delay }) => {
  const h = Math.round(w * (1688 / 780));
  return (
    <Rise delay={delay} style={{ position: "absolute", left: x, top: y }}>
      <div style={{ transform: `rotate(${rot}deg)`, width: w + 24, height: h + 24, borderRadius: 60, background: "#0b1430", padding: 12, boxShadow: "0 40px 90px rgba(6,15,50,.5)" }}>
        <div style={{ width: w, height: h, borderRadius: 48, overflow: "hidden" }}>
          <Img src={staticFile(src)} style={{ width: w, height: h, display: "block" }} />
        </div>
      </div>
    </Rise>
  );
};

const Screens: React.FC = () => (
  <AbsoluteFill style={{ background: C.court, overflow: "hidden" }}>
    <CourtLines opacity={0.08} />
    <Headline title="Alles in de app" />
    <PhoneShot src="shots/03-dashboard.png" x={70} y={560} w={420} rot={-8} delay={4} />
    <PhoneShot src="shots/06-challenge-sent.png" x={590} y={600} w={420} rot={8} delay={12} />
    <PhoneShot src="shots/04-ladder.png" x={320} y={500} w={440} rot={0} delay={8} />
  </AbsoluteFill>
);

const OutroV3: React.FC<{ social?: boolean }> = ({ social = false }) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 6), [-1, 1], [1, 1.04]);
  return (
    <AbsoluteFill style={{ background: C.court, justifyContent: "center", padding: 90 }}>
      <CourtLines />
      {social ? (
        <Pop delay={4} style={{ transformOrigin: "0% 50%" }}>
          <div style={{ fontFamily: display, fontWeight: 800, fontStyle: "italic", fontSize: 200, lineHeight: 0.9, color: C.ball }}>Bewijs het.</div>
        </Pop>
      ) : (
        <>
          <Rise delay={6}>
            <div style={{ fontFamily: display, fontWeight: 700, fontSize: 88, lineHeight: 1, color: C.courtMuted }}>Je rating zegt hoe goed jíj bent.</div>
          </Rise>
          <Rise delay={50} style={{ marginTop: 30 }}>
            <div style={{ fontFamily: display, fontWeight: 800, fontSize: 124, lineHeight: 0.95, color: C.white }}>
              PadelDuel zegt hoe goed jullie <span style={{ color: C.ball }}>sámen</span> zijn.
            </div>
          </Rise>
        </>
      )}
      <Rise delay={social ? 30 : 120} style={{ marginTop: 80 }}>
        <div style={{ display: "inline-block", transform: `scale(${pulse})`, transformOrigin: "0% 50%", background: C.ball, color: C.ink, fontFamily: sans, fontWeight: 600, fontSize: 50, borderRadius: 28, padding: "28px 44px" }}>
          Probeer de demo → padelduel.vercel.app
        </div>
      </Rise>
      <div style={{ position: "absolute", left: 90, bottom: 120 }}>
        <Logo size={60} />
      </div>
    </AbsoluteFill>
  );
};

/** Kleine markering voor illustratieve getallen. */
const ExampleTag: React.FC = () => (
  <div style={{ position: "absolute", right: 60, bottom: 60, fontFamily: sans, fontWeight: 600, fontSize: 28, color: C.courtMuted, background: "rgba(0,0,0,.25)", borderRadius: 999, padding: "8px 20px" }}>
    voorbeeldgetallen
  </div>
);

const ExampleTagLight: React.FC = () => (
  <div style={{ position: "absolute", right: 60, bottom: 60, fontFamily: sans, fontWeight: 600, fontSize: 28, color: C.muted, background: "rgba(10,23,51,.06)", borderRadius: 999, padding: "8px 20px" }}>
    voorbeeldgetallen
  </div>
);

/** Ondertitels voor de social-versie: de voice-over in korte stukjes. */
const Subtitles: React.FC<{ text: string; seconds: number }> = ({ text, seconds }) => {
  const frame = useCurrentFrame();
  // Breek op zinsdelen (. , ?), en lange zinsdelen nog eens in tweeën.
  const phrases = text
    .replace(/ punt /g, ".")
    .split(/(?<=[.,?])\s+/)
    .flatMap((ph) => {
      const w = ph.split(" ");
      return w.length > 6 ? [w.slice(0, Math.ceil(w.length / 2)).join(" "), w.slice(Math.ceil(w.length / 2)).join(" ")] : [ph];
    });
  // tijd per stukje naar rato van het aantal tekens
  const total = phrases.reduce((n, ph) => n + ph.length, 0);
  const t = Math.max(0, frame - VO_DELAY) / (seconds * 30);
  let acc = 0;
  let idx = phrases.length - 1;
  for (let i = 0; i < phrases.length; i++) {
    acc += phrases[i].length / total;
    if (t <= acc) {
      idx = i;
      break;
    }
  }
  const chunks = phrases;
  if (frame < VO_DELAY || frame > VO_DELAY + seconds * 30 + 10) return null;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 260, display: "flex", justifyContent: "center" }}>
      <span style={{ background: "rgba(10,23,51,.85)", color: C.white, fontFamily: sans, fontWeight: 600, fontSize: 54, lineHeight: 1.2, borderRadius: 20, padding: "14px 26px", textAlign: "center" }}>
        {chunks[idx]}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Samenstellen
// ---------------------------------------------------------------------------
const Timeline: React.FC<{ scenes: SceneDef[]; music: string; subtitles?: boolean }> = ({ scenes, music, subtitles = false }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.court }}>
      <Audio src={staticFile(music)} volume={0.38} />
      <CompactContext.Provider value>
        {scenes.map((scene, i) => {
          const start = from;
          from += scene.frames;
          const last = i === scenes.length - 1;
          return (
            <Sequence key={scene.key} from={start} durationInFrames={scene.frames + (last ? 0 : WIPE + 4)}>
              <BallWipe enabled={i > 0}>
                {scene.node}
                {subtitles && scene.vo ? <Subtitles text={VO[scene.vo].text} seconds={VO[scene.vo].seconds} /> : null}
              </BallWipe>
              {scene.vo ? (
                <Sequence from={VO_DELAY}>
                  <Audio src={staticFile(`audio/vo/${scene.vo}.wav`)} volume={0.92} />
                </Sequence>
              ) : null}
            </Sequence>
          );
        })}
      </CompactContext.Provider>
    </AbsoluteFill>
  );
};

const withTag = (node: React.ReactNode, light = false) => (
  <AbsoluteFill>
    {node}
    {light ? <ExampleTagLight /> : <ExampleTag />}
  </AbsoluteFill>
);

export const V3_SCENES: SceneDef[] = [
  { key: "hook", frames: 120, vo: "hook", node: <Hook /> },
  { key: "problem", frames: 120, vo: "problem", node: <ProblemV3 /> },
  { key: "duo", frames: 240, vo: "duo", node: withTag(<Duo />) },
  { key: "tiers", frames: 180, vo: "tiers", node: <Tiers /> },
  { key: "placement", frames: 240, vo: "placement", node: withTag(<Placement />) },
  { key: "flow", frames: 240, vo: "flow", node: withTag(<Flow />, true) },
  { key: "screens", frames: 120, vo: "screens", node: <Screens /> },
  { key: "outro", frames: 300, vo: "outro", node: <OutroV3 /> },
];
export const V3_FRAMES = V3_SCENES.reduce((n, s) => n + s.frames, 0);

export const SOCIAL_SCENES: SceneDef[] = [
  { key: "hook", frames: 120, vo: "s_hook", node: <Hook /> },
  { key: "duo", frames: 120, vo: "s_duo", node: withTag(<Duo />) },
  { key: "tiers", frames: 120, vo: "s_tiers", node: <Tiers /> },
  { key: "outro", frames: 240, vo: "s_outro", node: <OutroV3 social /> },
];
export const SOCIAL_FRAMES = SOCIAL_SCENES.reduce((n, s) => n + s.frames, 0);

export const PadelDuelUitlegV3: React.FC = () => <Timeline scenes={V3_SCENES} music="audio/music-v3.wav" />;
export const PadelDuelSocialV3: React.FC = () => <Timeline scenes={SOCIAL_SCENES} music="audio/music-social.wav" subtitles />;
