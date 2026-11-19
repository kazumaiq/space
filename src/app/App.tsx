import React, { useEffect } from 'react';
import { MainMenuScene } from '@/game/rendering/MainMenuScene';
import { SpaceportScene } from '@/game/rendering/SpaceportScene';
import { FlightScene } from '@/game/rendering/FlightScene';
import { MainMenu } from '@/ui/menus/MainMenu';
import { SpaceportOverlay } from '@/ui/menus/SpaceportOverlay';
import { RocketBuilder } from '@/ui/panels/RocketBuilder';
import { FlightHUD } from '@/ui/hud/FlightHUD';
import { SolarSystemMap } from '@/ui/panels/SolarSystemMap';
import { GameModals } from '@/ui/panels/GameModals';
import { useGameStore } from '@/stores/useGameStore';

export const App: React.FC = () => {
  const screen = useGameStore((s) => s.screen);
  const toasts = useGameStore((s) => s.toasts);
  const initSaves = useGameStore((s) => s.initSaves);

  useEffect(() => {
    initSaves().catch(() => {});
  }, [initSaves]);

  return (
    <>
      {screen === 'main_menu' && (
        <>
          <MainMenuScene />
          <MainMenu />
        </>
      )}

      {screen === 'spaceport' && (
        <>
          <SpaceportScene />
          <SpaceportOverlay />
        </>
      )}

      {screen === 'builder' && <RocketBuilder />}

      {screen === 'flight' && (
        <>
          <FlightScene />
          <FlightHUD />
        </>
      )}

      {screen === 'solar_map' && <SolarSystemMap />}

      <GameModals />

      {/* Global Notification Toasts */}
      <div className="ob-toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`ob-toast ${t.type}`}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.body}</div>
          </div>
        ))}
      </div>
    </>
  );
};
