import { loadFont as loadBarlow } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadInstrument } from "@remotion/google-fonts/InstrumentSans";
import {
  AbsoluteFill,
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
 * Uitlegvideo PadelDuel (9:16, ~33 s, zonder audio). Kleuren en lettertypen
 * volgen het Court-design system van de app (docs/Design_System.md).
 */
const { fontFamily: display } = loadBarlow("normal", { weights: ["700", "800"], subsets: ["latin"] });
const { fontFamily: sans } = loadInstrument("normal", { weights: ["400", "600"], subsets: ["latin"] });

const C = {
  court: "#132f9a",
  courtDeep: "#0c1f6b",
  courtMuted: "#b8c6f5",
  primary: "#1f45c8",
  ball: "#d6f23c",
  ink: "#0a1733",
  glass: "#f2f4f8",
  white: "#ffffff",
};

const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);

type Step = { shot: string; kicker: string; title: string; body: string };
const STEPS: Step[] = [
  {
    shot: "shots/03-dashboard.png",
    kicker: "Stap 1",
    title: "Elk duo een eigen rating",
    body: "Speel je met meerdere partners? Elk duo heeft zijn eigen rating en plek.",
  },
  {
    shot: "shots/04-ladder.png",
    kicker: "Stap 2",
    title: "Daag duo's op jouw niveau uit",
    body: "Binnen je eigen tier, in je hele regio. Nooit kansloos, nooit saai.",
  },
  {
    shot: "shots/05-placement.png",
    kicker: "Stap 3",
    title: "Nieuw? Klim snel",
    body: "In je eerste 10 wedstrijden mag je tot 2 tiers hoger uitdagen.",
  },
  {
    shot: "shots/06-challenge-sent.png",
    kicker: "Stap 4",
    title: "Speel. Uitslag in. Klim.",
    body: "Afspraak is afspraak: een uitdaging wordt echt gespeeld.",
  },
];

const INTRO = s(3.5);
const PROBLEM = s(4);
const STEP = s(5);
const OUTRO = s(6.5);
export const TOTAL_FRAMES = INTRO + PROBLEM + STEP * STEPS.length + OUTRO;

/** Baanlijnen als achtergrond, zoals de court-vlakken in de app. */
const CourtLines: React.FC<{ opacity?: number }> = ({ opacity = 0.14 }) => (
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

const Logo: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: C.white,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 3, background: C.court }} />
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 3, background: C.court }} />
      <div
        style={{
          position: "absolute",
          right: size * 0.14,
          top: size * 0.14,
          width: size * 0.26,
          height: size * 0.26,
          borderRadius: "50%",
          background: C.ball,
        }}
      />
    </div>
    <span style={{ fontFamily: display, fontWeight: 800, fontSize: size * 0.9, color: C.white, letterSpacing: 0.5 }}>
      PadelDuel
    </span>
  </div>
);

function useEnter(delay = 0, damping = 18) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.8 } });
}

/** Tekstregel die van onder in beeld schuift. */
const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  style,
}) => {
  const p = useEnter(delay);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 60}px)`, ...style }}>{children}</div>
  );
};

/** Fade-out aan het einde van een scène, zodat overgangen zacht zijn. */
const SceneFade: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [duration - 8, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const ball = useEnter(4, 10);
  const ballY = interpolate(frame, [0, 40], [-300, 0], { easing: Easing.bounce, extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.court, justifyContent: "center", padding: 96 }}>
      <CourtLines />
      <div
        style={{
          position: "absolute",
          right: 150,
          top: 420 + ballY,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: C.ball,
          transform: `scale(${ball})`,
          boxShadow: "0 30px 60px rgba(0,0,0,.25)",
        }}
      />
      <Rise delay={0}>
        <Logo size={72} />
      </Rise>
      <Rise delay={10} style={{ marginTop: 56 }}>
        <div
          style={{
            fontFamily: display,
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: 150,
            lineHeight: 0.92,
            color: C.white,
          }}
        >
          Wie is het
          <br />
          beste duo
          <br />
          van <span style={{ color: C.ball }}>jouw regio?</span>
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

const Problem: React.FC = () => (
  <AbsoluteFill style={{ background: C.glass, justifyContent: "center", padding: 96, gap: 48 }}>
    <Rise delay={0}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 112, lineHeight: 0.95, color: C.ink }}>
        Altijd tegen
        <br />
        dezelfde vier.
      </div>
    </Rise>
    <Rise delay={30}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 112, lineHeight: 0.95, color: C.primary }}>
        Nooit weten hoe
        <br />
        goed jullie
        <br />
        sámen zijn.
      </div>
    </Rise>
    <Rise delay={60}>
      <div style={{ fontFamily: sans, fontSize: 46, color: "#46557a", maxWidth: 820, lineHeight: 1.3 }}>
        PadelDuel is de regioladder voor padelduo's.
      </div>
    </Rise>
  </AbsoluteFill>
);

/** Telefoon met een echte schermafbeelding uit de app. */
const Phone: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const enter = useEnter(6, 16);
  const zoom = interpolate(frame, [0, STEP], [1, 1.04]);
  const width = 660;
  const height = Math.round(width * (1688 / 780));
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - width - 36) / 2,
        top: 640 + (1 - enter) * 500,
        width: width + 36,
        height: height + 36,
        borderRadius: 88,
        background: "#0b1430",
        padding: 18,
        boxShadow: "0 60px 120px rgba(6,15,50,.45)",
        transform: `scale(${zoom})`,
        transformOrigin: "50% 0%",
      }}
    >
      <div style={{ width, height, borderRadius: 72, overflow: "hidden", background: C.glass }}>
        <Img src={staticFile(src)} style={{ width, height, display: "block" }} />
      </div>
    </div>
  );
};

const StepScene: React.FC<{ step: Step; index: number }> = ({ step, index }) => (
  <AbsoluteFill style={{ background: index % 2 === 0 ? C.court : C.courtDeep, overflow: "hidden" }}>
    <CourtLines opacity={0.08} />
    <div style={{ position: "absolute", top: 120, left: 96, right: 96 }}>
      <Rise delay={0}>
        <span
          style={{
            display: "inline-block",
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 36,
            color: C.ink,
            background: C.ball,
            borderRadius: 999,
            padding: "8px 26px",
          }}
        >
          {step.kicker}
        </span>
      </Rise>
      <Rise delay={6} style={{ marginTop: 28 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 104, lineHeight: 0.95, color: C.white }}>
          {step.title}
        </div>
      </Rise>
      <Rise delay={14} style={{ marginTop: 24 }}>
        <div style={{ fontFamily: sans, fontSize: 40, lineHeight: 1.3, color: C.courtMuted }}>{step.body}</div>
      </Rise>
    </div>
    <Phone src={step.shot} />
  </AbsoluteFill>
);

const Outro: React.FC = () => {
  const pulse = interpolate(Math.sin(useCurrentFrame() / 6), [-1, 1], [1, 1.04]);
  return (
    <AbsoluteFill style={{ background: C.court, justifyContent: "center", padding: 96 }}>
      <CourtLines />
      <Rise delay={0}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 84, lineHeight: 1, color: C.courtMuted }}>
          Je KNLTB-rating zegt hoe goed jíj bent.
        </div>
      </Rise>
      <Rise delay={18} style={{ marginTop: 32 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 118, lineHeight: 0.95, color: C.white }}>
          PadelDuel zegt hoe goed jullie <span style={{ color: C.ball }}>sámen</span> zijn.
        </div>
      </Rise>
      <Rise delay={50} style={{ marginTop: 90 }}>
        <div
          style={{
            display: "inline-block",
            transform: `scale(${pulse})`,
            transformOrigin: "0% 50%",
            background: C.ball,
            color: C.ink,
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 48,
            borderRadius: 28,
            padding: "28px 44px",
          }}
        >
          Probeer de demo: padelduel.vercel.app
        </div>
      </Rise>
      <Rise delay={62} style={{ marginTop: 28 }}>
        <div style={{ fontFamily: sans, fontSize: 36, color: C.courtMuted }}>
          Demo-accounts staan op de inlogpagina.
        </div>
      </Rise>
      <div style={{ position: "absolute", left: 96, bottom: 120 }}>
        <Logo size={56} />
      </div>
    </AbsoluteFill>
  );
};

export const PadelDuelUitleg: React.FC = () => {
  let from = 0;
  const seq = (duration: number, node: React.ReactNode, key: string) => {
    const el = (
      <Sequence key={key} from={from} durationInFrames={duration}>
        <SceneFade duration={duration}>{node}</SceneFade>
      </Sequence>
    );
    from += duration;
    return el;
  };
  return (
    <AbsoluteFill style={{ background: C.court }}>
      {seq(INTRO, <Intro />, "intro")}
      {seq(PROBLEM, <Problem />, "problem")}
      {STEPS.map((step, i) => seq(STEP, <StepScene step={step} index={i} />, `step-${i}`))}
      {seq(OUTRO, <Outro />, "outro")}
    </AbsoluteFill>
  );
};
