import { GameApp } from "@/components/game/GameApp";
import { deployedAppVersion } from "@/lib/appVersion";

export default function HomePage() {
  return <GameApp appVersion={deployedAppVersion()} />;
}
