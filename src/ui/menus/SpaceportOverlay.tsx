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
        padding: 18,
      }}
    >
      {/* Top Navigation & Resources Bar */}
      <div
        className="ob-panel"
        style={{
          pointerEvents: 'auto',
          padding: '10px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="ob-btn" onClick={() => setScreen('main_menu')} title="Главное меню">
            <Home size={15} />
          </button>
          <div>
            <div className="ob-title" style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {progress.agencyName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Космодром • Уровень {progress.spaceportLevel}
            </div>
          </div>
        </div>

        {/* Currencies */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ob-badge" style={{ padding: '6px 12px', fontSize: 13, color: '#fbbf24' }}>
            <Coins size={14} />
            <span>{progress.credits.toLocaleString()} ₵</span>
          </div>
          <div className="ob-badge" style={{ padding: '6px 12px', fontSize: 13, color: '#38bdf8' }}>
            <Zap size={14} />
            <span>{progress.science} ⚡</span>
          </div>
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          <button className="ob-btn" onClick={() => setActivePanel('missions')}>
            <Target size={15} color="var(--accent-orange)" />
            <span>Контракты</span>
          </button>
          <button className="ob-btn" onClick={() => setActivePanel('tech')}>
            <FlaskConical size={15} color="var(--accent-cyan)" />
            <span>Технологии</span>
          </button>
          <button className="ob-btn" onClick={() => setScreen('solar_map')}>
            <Globe size={15} color="#a78bfa" />
            <span>Система</span>
          </button>
          <button className="ob-btn" onClick={() => setActivePanel('profile')}>
            <User size={15} />
            <span className="ob-hide-mobile">Профиль</span>
          </button>
          <button className="ob-btn" onClick={() => setActivePanel('saves')}>
            <Save size={15} />
          </button>
          <button className="ob-btn" onClick={() => setActivePanel('settings')}>
            <Settings size={15} />
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
          gap: 16,
        }}
      >
        {/* Left: Active Rocket Selector & Engineering Summary */}
        <div className="ob-panel" style={{ pointerEvents: 'auto', padding: 16, width: 340 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: 6 }}>
            РАКЕТА НА СТАРТОВОЙ ПЛОЩАДКЕ
          </div>
          <select
            value={selectedBp.id}
            onChange={(e) => selectBlueprint(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 10px',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid var(--border-accent)',
              marginBottom: 12,
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
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ background: 'var(--bg-card)', padding: '7px 9px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>МАССА</div>
              <div>{stats.totalWetMass.toFixed(1)} т</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '7px 9px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>СТАРТ. TWR</div>
              <div style={{ color: stats.launchTWR >= 1.15 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {stats.launchTWR.toFixed(2)}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '7px 9px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>DELTA-V</div>
              <div style={{ color: 'var(--accent-cyan)' }}>{Math.round(stats.totalDeltaV)} м/с</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '7px 9px', borderRadius: 6 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>СТУПЕНЕЙ</div>
              <div>{stats.stages.length}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Космодром ур. {progress.spaceportLevel}/5
            </span>
            {progress.spaceportLevel < 5 && (
              <button
                className="ob-btn"
                style={{ padding: '5px 10px', fontSize: 11 }}
                disabled={progress.credits < upgradeCost}
                onClick={upgradeSpaceport}
              >
                <ArrowUpCircle size={13} color="var(--accent-cyan)" />
                <span>Улучшить ({upgradeCost.toLocaleString()} ₵)</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Primary Actions (VAB & LAUNCH) */}
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 12 }}>
          <button
            className="ob-btn ob-btn-primary"
            style={{ padding: '15px 22px', fontSize: 14 }}
            onClick={() => setScreen('builder')}
          >
            <Wrench size={18} />
            <span>КОНСТРУКТОР РАКЕТ (VAB)</span>
          </button>

          <button
            className="ob-btn ob-btn-launch"
            style={{ padding: '15px 30px', fontSize: 16 }}
            onClick={handleLaunch}
          >
            <Rocket size={20} />
            <span>ЗАПУСК</span>
          </button>
        </div>
      </div>
    </div>
  );
};
