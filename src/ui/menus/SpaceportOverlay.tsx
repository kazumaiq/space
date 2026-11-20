import React from 'react';
import {
  Rocket,
  Wrench,
  Target,
  FlaskConical,
  Globe,
  Save,
  Settings,
  User,
  Home,
  ArrowUpCircle,
  Zap,
  Coins,
} from 'lucide-react';
import { calculateRocketStats } from '@/game/rocket-builder/rocketMath';
import { flightEngine } from '@/game/physics/flightEngine';
import { useGameStore } from '@/stores/useGameStore';

export const SpaceportOverlay: React.FC = () => {
  const {
    progress,
    blueprints,
    selectedBlueprintId,
    selectBlueprint,
    setScreen,
    setActivePanel,
    upgradeSpaceport,
    pushToast,
  } = useGameStore();

  const selectedBp =
    blueprints.find((b) => b.id === selectedBlueprintId) ?? blueprints[0];
  const stats = calculateRocketStats(selectedBp.parts);

  const handleLaunch = () => {
    if (!stats.hasCommand || !stats.hasEngine) {
      pushToast({
        title: 'Ракета не готова к старту',
        body: 'Добавьте командный модуль и хотя бы один двигатель в конструкторе.',
        type: 'danger',
      });
      return;
    }
    flightEngine.loadBlueprint(selectedBp);
    useGameStore.getState().setTelemetry(flightEngine.getTelemetry());
    useGameStore.getState().setTimeWarp(1);
    setScreen('flight');
  };

  const upgradeCost = progress.spaceportLevel * 15000;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'max(10px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom)) 12px',
        gap: 10,
      }}
    >
      {/* Top Navigation & Resources Bar */}
      <div
        className="ob-panel"
        style={{
          pointerEvents: 'auto',
          padding: '8px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="ob-btn" style={{ padding: '6px 9px' }} onClick={() => setScreen('main_menu')} title="Меню">
            <Home size={15} />
          </button>
          <div>
            <div className="ob-title" style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {progress.agencyName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
              Космодром ур. {progress.spaceportLevel}
            </div>
          </div>
        </div>

        {/* Currencies */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="ob-badge" style={{ padding: '4px 9px', fontSize: 12, color: '#fbbf24' }}>
            <Coins size={13} />
            <span>{progress.credits.toLocaleString()}</span>
          </div>
          <div className="ob-badge" style={{ padding: '4px 9px', fontSize: 12, color: '#38bdf8' }}>
            <Zap size={13} />
            <span>{progress.science}</span>
          </div>
        </div>

        {/* Nav Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button className="ob-btn" style={{ padding: '6px 9px', fontSize: 12 }} onClick={() => setActivePanel('missions')}>
            <Target size={14} color="var(--accent-orange)" />
            <span className="ob-hide-mobile">Контракты</span>
          </button>
          <button className="ob-btn" style={{ padding: '6px 9px', fontSize: 12 }} onClick={() => setActivePanel('tech')}>
            <FlaskConical size={14} color="var(--accent-cyan)" />
            <span className="ob-hide-mobile">Наука</span>
          </button>
          <button className="ob-btn" style={{ padding: '6px 9px', fontSize: 12 }} onClick={() => setScreen('solar_map')}>
            <Globe size={14} color="#a78bfa" />
            <span className="ob-hide-mobile">Система</span>
          </button>
          <button className="ob-btn" style={{ padding: '6px 9px' }} onClick={() => setActivePanel('profile')} title="Профиль">
            <User size={14} />
          </button>
          <button className="ob-btn" style={{ padding: '6px 9px' }} onClick={() => setActivePanel('saves')} title="Сохранения">
            <Save size={14} />
          </button>
          <button className="ob-btn" style={{ padding: '6px 9px' }} onClick={() => setActivePanel('settings')} title="Настройки">
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Bottom Launchpad Control Deck */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        {/* Active Rocket Selector */}
        <div className="ob-panel" style={{ pointerEvents: 'auto', padding: 12, width: 'min(340px, 100%)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: 5 }}>
            РАКЕТА НА ПЛОЩАДКЕ
          </div>
          <select
            value={selectedBp.id}
            onChange={(e) => selectBlueprint(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid var(--border-accent)',
              marginBottom: 9,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {blueprints.map((bp) => (
              <option key={bp.id} value={bp.id}>
                {bp.name}
              </option>
            ))}
          </select>

          <div
            className="ob-mono"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6,
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            <div style={{ background: 'var(--bg-card)', padding: '6px 7px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>МАССА</div>
              <div>{stats.totalWetMass.toFixed(1)} т</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '6px 7px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>TWR</div>
              <div style={{ color: stats.launchTWR >= 1.15 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {stats.launchTWR.toFixed(2)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '6px 7px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>DELTA-V</div>
              <div style={{ color: 'var(--accent-cyan)' }}>{Math.round(stats.totalDeltaV)}</div>
            </div>
          </div>

          {progress.spaceportLevel < 5 && (
            <button
              className="ob-btn"
              style={{ width: '100%', padding: '6px 10px', fontSize: 11 }}
              disabled={progress.credits < upgradeCost}
              onClick={upgradeSpaceport}
            >
              <ArrowUpCircle size={13} color="var(--accent-cyan)" />
              <span>Улучшить космодром ({upgradeCost.toLocaleString()} ₵)</span>
            </button>
          )}
        </div>

        {/* Primary Actions */}
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 8, width: 'min(340px, 100%)', justifyContent: 'flex-end' }}>
          <button
            className="ob-btn ob-btn-primary"
            style={{ flex: 1, padding: '13px 16px', fontSize: 13 }}
            onClick={() => setScreen('builder')}
          >
            <Wrench size={16} />
            <span>КОНСТРУКТОР</span>
          </button>

          <button
            className="ob-btn ob-btn-launch"
            style={{ flex: 1, padding: '13px 20px', fontSize: 14 }}
            onClick={handleLaunch}
          >
            <Rocket size={18} />
            <span>ЗАПУСК</span>
          </button>
        </div>
      </div>
    </div>
  );
};
