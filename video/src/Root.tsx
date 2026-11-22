import { Composition } from "remotion";
import { PadelDuelUitleg, TOTAL_FRAMES } from "./PadelDuelUitleg";
import { PadelDuelUitlegV2, TOTAL_FRAMES_V2 } from "./PadelDuelUitlegV2";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PadelDuelUitlegV2" component={PadelDuelUitlegV2} durationInFrames={TOTAL_FRAMES_V2} fps={30} width={1080} height={1920} />
    <Composition id="PadelDuelUitleg" component={PadelDuelUitleg} durationInFrames={TOTAL_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
