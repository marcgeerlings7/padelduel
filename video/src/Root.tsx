import { Composition } from "remotion";
import { PadelDuelUitleg, TOTAL_FRAMES } from "./PadelDuelUitleg";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PadelDuelUitleg"
    component={PadelDuelUitleg}
    durationInFrames={TOTAL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
