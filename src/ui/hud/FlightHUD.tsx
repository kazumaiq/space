import React from 'react';
import {
  Map,
  RotateCcw,
  Home,
  Flame,
  Compass,
  FlaskConical,
  FastForward,
  AlertTriangle,
  Sun,
  ArrowDownToLine,
  Umbrella,
  Cpu,
} from 'lucide-react';
import { getBodyById } from '@/data/solarSystem';
import { getPartDef } from '@/data/partsCatalog';
import { flightEngine } from '@/game/physics/flightEngine';
import { sharedTouchInputs } from '@/game/controls/useFlightControls';
import { soundEngine } from '@/services/audio/soundEngine';
import { useGameStore } from '@/stores/useGameStore';
import { FlightPhase, SasMode } from '@/game/core/types';

function formatAltitude(m: number): string {
  if (!isFinite(m)) return '∞';
  if (Math.abs(m) >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Мм`;
  if (Math.abs(m) >= 1_000) return `${(m / 1_000).toFixed(2)} км`;
  return `${Math.round(m)} м`;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PHASE_LABELS: Record<FlightPhase, { text: string; color: string }> = {
  PRELAUNCH: { text: 'НА СТАРТЕ', color: '#94a3b8' },
  ASCENT: { text: 'НАБОР ВЫСОТЫ', color: '#f97316' },
  ATMOSPHERIC: { text: 'АТМОСФЕРА', color: '#38bdf8' },
  SUBORBITAL: { text: 'СУБОРБИТА', color: '#fbbf24' },
  LOW_ORBIT: { text: 'НИЗКАЯ ОРБИТА', color: '#22c55e' },
  HIGH_ORBIT: { text: 'ВЫСОКАЯ ОРБИТА', color: '#22c55e' },
  ESCAPE: { text: 'УХОД С ОРБИТЫ', color: '#a78bfa' },
  LUNAR_TRANSFER: { text: 'СФЕРА ЛУНЫ', color: '#38bdf8' },
  LUNAR_ORBIT: { text: 'ОРБИТА ЛУНЫ', color: '#22c55e' },
  DESCENT: { text: 'СНИЖЕНИЕ', color: '#f97316' },
  LANDED: { text: 'ПОСАДКА', color: '#22c55e' },
  CRASHED: { text: 'АВАРИЯ', color: '#ef4444' },
};

const SAS_MODES: SasMode[] = ['OFF', 'STABILITY', 'PROGRADE', 'RETROGRADE'];

export const FlightHUD: React.FC = () => {
  const {
    telemetry,
    trajectory,
    timeWarp,
    mapView,
    controls,
    setTimeWarp,
    setMapView,
    setScreen,
    getSelectedBlueprint,
    addSurfaceSample,
    pushToast,
  } = useGameStore();

  if (!telemetry) return null;

  const body = getBodyById(telemetry.soiBodyId);
  const phaseInfo = PHASE_LABELS[telemetry.phase];
  const fuelPct = telemetry.fuelTotal > 0 ? (telemetry.fuelRemaining / telemetry.fuelTotal) * 100 : 0;

  const hasScience = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isScience));
  const hasChute = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isParachute));
  const hasLegs = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isLandingLeg));
  const hasSolar = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isSolarPanel));

  const handleStageButton = () => {
    const res = flightEngine.triggerStage();
    if (res.action === 'ignite') {
      useGameStore.getState().incrementLaunches();
      soundEngine.playStageSeparate();
    } else if (res.action === 'separate') {
      soundEngine.playStageSeparate();
    }
  };

  const handleResetFlight = () => {
    const bp = getSelectedBlueprint();
    flightEngine.loadBlueprint(bp);
    useGameStore.getState().setTelemetry(flightEngine.getTelemetry());
    setTimeWarp(1);
    setMapView(false);
    soundEngine.playClick();
  };

  const handleScienceExperiment = () => {
    if (flightEngine.scienceCollectedHere) {
      pushToast({
        title: 'Данные уже собраны',
        body: 'Переместитесь в другую зону или на другое небесное тело.',
        type: 'info',
      });
      return;
    }
    flightEngine.scienceCollectedHere = true;
    const isMoon = telemetry.soiBodyId === 'moon';
    const isLanded = telemetry.phase === 'LANDED';
    const sciVal = isMoon ? (isLanded ? 120 : 75) : isLanded ? 15 : 45;
    const credVal = isMoon ? 5000 : 1800;

    addSurfaceSample({
      id: `sci_${Date.now()}`,
      bodyId: telemetry.soiBodyId,
      name: isLanded
        ? `Грунт: ${body.nameRu}`
        : `Орбитальная телеметрия (${body.nameRu})`,
      scienceValue: sciVal,
      creditValue: credVal,
      collectedAt: Date.now(),
    });
  };

  const handleToggleRover = () => {
    flightEngine.roverDeployed = !flightEngine.roverDeployed;
    soundEngine.playClick();
    if (flightEngine.roverDeployed) {
      pushToast({
        title: 'Планетоход развёрнут',
        body: `Автономное исследование поверхности (${body.nameRu}) начато.`,
        type: 'success',
      });
    }
  };

  const isTouchDevice =
    controls.showTouchControls === 'always' ||
    (controls.showTouchControls === 'auto' &&
      typeof window !== 'undefined' &&
      'ontouchstart' in window);

  const warps = telemetry.altitude > body.atmosphereHeight ? [1, 2, 5, 10, 50] : [1, 2, 5, 10];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 15,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 14,
      }}
    >
      {/* TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        {/* Left: Phase + SOI + MET */}
        <div
          className="ob-panel"
          style={{
            pointerEvents: 'auto',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>СФЕРА ВЛИЯНИЯ</div>
            <div className="ob-title" style={{ fontSize: 13, color: 'var(--accent-cyan)' }}>
              {body.nameRu}
            </div>
          </div>
          <div
            className="ob-badge"
            style={{
              borderColor: phaseInfo.color,
              color: phaseInfo.color,
              padding: '4px 9px',
            }}
          >
            {phaseInfo.text}
          </div>
          <div className="ob-mono" style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 5 }}>T+</span>
            {formatTime(telemetry.missionTime)}
          </div>
        </div>

        {/* Center: Time Warp */}
        <div
          className="ob-panel"
          style={{
            pointerEvents: 'auto',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <FastForward size={14} color="var(--accent-orange)" />
          {warps.map((w) => (
            <button
              key={w}
              className={`ob-btn ${timeWarp === w ? 'ob-btn-active' : ''}`}
              style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={() => setTimeWarp(w)}
            >
              {w}x
            </button>
          ))}
        </div>

        {/* Right: Map / Reset / Return */}
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: 7 }}>
          <button
            className={`ob-btn ${mapView ? 'ob-btn-primary' : ''}`}
            onClick={() => setMapView(!mapView)}
          >
            <Map size={15} />
            <span>{mapView ? 'Камера ракеты' : 'Орбита (M)'}</span>
          </button>
          <button className="ob-btn" onClick={handleResetFlight} title="Повторить запуск">
            <RotateCcw size={15} />
          </button>
          <button
            className="ob-btn"
            onClick={() => {
              soundEngine.updateEngineThrust(0, false);
              setScreen('spaceport');
            }}
            title="Вернуться на космодром"
          >
            <Home size={15} />
          </button>
        </div>
      </div>

      {/* MIDDLE ROW: Left Telemetry + Right Orbital Data */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {/* LEFT TELEMETRY */}
        <div
          className="ob-panel ob-mono"
          style={{
            pointerEvents: 'auto',
            padding: 13,
            width: 235,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12,
          }}
        >
          <div className="ob-title" style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>
            ТЕЛЕМЕТРИЯ ПОЛЁТА
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Высота</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{formatAltitude(telemetry.altitude)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Скорость</span>
            <span style={{ fontWeight: 700 }}>{Math.round(telemetry.speed)} м/с</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--text-muted)' }}>Верт / Гориз</span>
            <span>
              {Math.round(telemetry.verticalSpeed)} / {Math.round(telemetry.horizontalSpeed)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Ускорение</span>
            <span>
              {telemetry.acceleration.toFixed(1)} м/с² ({telemetry.gForce.toFixed(1)}G)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Тяга / TWR</span>
            <span style={{ color: 'var(--accent-orange)' }}>
              {Math.round(telemetry.thrustKN)} кН ({telemetry.twr.toFixed(2)})
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Масса</span>
            <span>{telemetry.massTons.toFixed(2)} т</span>
          </div>

          {/* Fuel bar */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-secondary)' }}>ТОПЛИВО</span>
              <span>{fuelPct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: 'rgba(30,41,59,0.9)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, fuelPct)}%`,
                  height: '100%',
                  background: fuelPct < 15 ? 'var(--accent-red)' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                }}
              />
            </div>
          </div>

          {/* Electric charge bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-secondary)' }}>ЭНЕРГИЯ</span>
              <span>{Math.round(telemetry.electricCharge)}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 4, background: 'rgba(30,41,59,0.9)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${telemetry.electricCharge}%`,
                  height: '100%',
                  background: '#22c55e',
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT ORBITAL DATA */}
        <div
          className="ob-panel ob-mono ob-hide-mobile"
          style={{
            pointerEvents: 'auto',
            padding: 13,
            width: 240,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12,
          }}
        >
          <div className="ob-title" style={{ fontSize: 11, color: 'var(--accent-orange)' }}>
            ОРБИТАЛЬНЫЕ ПАРАМЕТРЫ
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Апогей (Ap)</span>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
              {formatAltitude(telemetry.orbital.apoapsis)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Перигей (Pe)</span>
            <span
              style={{
                color: telemetry.orbital.periapsis > 70_000 ? 'var(--accent-green)' : 'var(--accent-orange)',
                fontWeight: 700,
              }}
            >
              {formatAltitude(telemetry.orbital.periapsis)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Эксцентриситет</span>
            <span>{telemetry.orbital.eccentricity.toFixed(3)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Наклонение</span>
            <span>{((telemetry.orbital.inclination * 180) / Math.PI).toFixed(1)}°</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Период</span>
            <span>{formatTime(telemetry.orbital.orbitalPeriod)}</span>
          </div>

          {trajectory?.encounterBodyId === 'moon' && (
            <div
              className="ob-badge"
              style={{
                marginTop: 4,
                borderColor: '#f97316',
                color: '#fb923c',
                justifyContent: 'center',
              }}
            >
              ПЕРЕХВАТ ЛУНЫ ОБНАРУЖЕН!
            </div>
          )}

          {/* Contextual Surface Exploration Panel when landed */}
          {telemetry.phase === 'LANDED' && (
            <div
              style={{
                marginTop: 6,
                paddingTop: 8,
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--accent-green)', fontWeight: 700 }}>
                ИССЛЕДОВАНИЕ ПОВЕРХНОСТИ
              </div>
              <button className="ob-btn ob-btn-primary" style={{ fontSize: 11 }} onClick={handleToggleRover}>
                <Cpu size={13} />
                <span>{telemetry.roverDeployed ? 'Вернуть планетоход' : 'Выпустить планетоход'}</span>
              </button>
              <button className="ob-btn" style={{ fontSize: 11 }} onClick={handleScienceExperiment}>
                <FlaskConical size={13} color="var(--accent-cyan)" />
                <span>Собрать образцы грунта</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM CONTROL DECK */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        {/* Left: Throttle Control */}
        <div
          className="ob-panel"
          style={{
            pointerEvents: 'auto',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ТЯГА (SHIFT/CTRL)</div>
            <div className="ob-mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-orange)' }}>
              {Math.round(telemetry.throttle * 100)}%
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={telemetry.throttle}
            onChange={(e) => flightEngine.setThrottle(Number(e.target.value))}
            style={{ width: 110, accentColor: '#f97316' }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="ob-btn" style={{ padding: '4px 7px', fontSize: 11 }} onClick={() => flightEngine.setThrottle(0)}>
              0%
            </button>
            <button className="ob-btn" style={{ padding: '4px 7px', fontSize: 11 }} onClick={() => flightEngine.setThrottle(1)}>
              100%
            </button>
          </div>
        </div>

        {/* Center: SAS + Systems + Stage Trigger */}
        <div
          className="ob-panel"
          style={{
            pointerEvents: 'auto',
            padding: '9px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* SAS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Compass size={15} color="var(--accent-cyan)" />
            {SAS_MODES.map((m) => (
              <button
                key={m}
                className={`ob-btn ${telemetry.sasMode === m ? 'ob-btn-active' : ''}`}
                style={{ padding: '5px 8px', fontSize: 10 }}
                onClick={() => {
                  flightEngine.sasMode = m;
                  soundEngine.playClick();
                }}
              >
                {m === 'OFF' ? 'SAS OFF' : m === 'STABILITY' ? 'STAB' : m === 'PROGRADE' ? 'PRO' : 'RETRO'}
              </button>
            ))}
          </div>

          {hasChute && (
            <button
              className={`ob-btn ${telemetry.parachutesDeployed ? 'ob-btn-active' : ''}`}
              style={{ padding: '6px 10px', fontSize: 11 }}
              onClick={() => flightEngine.toggleParachutes()}
            >
              <Umbrella size={14} />
              <span>Парашют (P)</span>
            </button>
          )}

          {hasLegs && (
            <button
              className={`ob-btn ${telemetry.landingLegsDeployed ? 'ob-btn-active' : ''}`}
              style={{ padding: '6px 10px', fontSize: 11 }}
              onClick={() => flightEngine.toggleLandingLegs()}
            >
              <ArrowDownToLine size={14} />
              <span>Опоры (G)</span>
            </button>
          )}

          {hasSolar && (
            <button
              className={`ob-btn ${telemetry.solarPanelsDeployed ? 'ob-btn-active' : ''}`}
              style={{ padding: '6px 10px', fontSize: 11 }}
              onClick={() => flightEngine.toggleSolarPanels()}
            >
              <Sun size={14} />
              <span>Панели (L)</span>
            </button>
          )}

          {hasScience && (
            <button
              className="ob-btn ob-btn-primary"
              style={{ padding: '6px 10px', fontSize: 11 }}
              onClick={handleScienceExperiment}
            >
              <FlaskConical size={14} />
              <span>Наука</span>
            </button>
          )}

          <button
            className="ob-btn ob-btn-launch"
            style={{ padding: '9px 18px', fontSize: 13 }}
            onClick={handleStageButton}
          >
            <Flame size={16} />
            <span>
              {!flightEngine.ignited
                ? 'ЗАЖИГАНИЕ (SPACE)'
                : telemetry.currentStage > 0
                  ? `СТУПЕНЬ ${telemetry.currentStage}/${telemetry.maxStage + 1} (SPACE)`
                  : 'ПОСЛЕДНЯЯ СТУПЕНЬ'}
            </span>
          </button>
        </div>

        {/* Mobile Virtual Touch Controls */}
        {isTouchDevice && (
          <div
            className="ob-panel"
            style={{
              pointerEvents: 'auto',
              padding: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 40px)',
              gap: 4,
            }}
          >
            <div />
            <button
              className="ob-btn"
              onPointerDown={() => (sharedTouchInputs.pitch = 1)}
              onPointerUp={() => (sharedTouchInputs.pitch = 0)}
              onPointerLeave={() => (sharedTouchInputs.pitch = 0)}
            >
              W
            </button>
            <div />
            <button
              className="ob-btn"
              onPointerDown={() => (sharedTouchInputs.yaw = -1)}
              onPointerUp={() => (sharedTouchInputs.yaw = 0)}
              onPointerLeave={() => (sharedTouchInputs.yaw = 0)}
            >
              A
            </button>
            <button
              className="ob-btn"
              onPointerDown={() => (sharedTouchInputs.pitch = -1)}
              onPointerUp={() => (sharedTouchInputs.pitch = 0)}
              onPointerLeave={() => (sharedTouchInputs.pitch = 0)}
            >
              S
            </button>
            <button
              className="ob-btn"
              onPointerDown={() => (sharedTouchInputs.yaw = 1)}
              onPointerUp={() => (sharedTouchInputs.yaw = 0)}
              onPointerLeave={() => (sharedTouchInputs.yaw = 0)}
            >
              D
            </button>
          </div>
        )}
      </div>

      {/* CRASH MODAL */}
      {telemetry.phase === 'CRASHED' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 4, 8, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 50,
          }}
        >
          <div className="ob-panel" style={{ padding: 26, width: 390, textAlign: 'center', borderColor: 'var(--accent-red)' }}>
            <AlertTriangle size={40} color="var(--accent-red)" style={{ marginBottom: 10 }} />
            <div className="ob-title" style={{ fontSize: 18, color: '#fecaca', marginBottom: 8 }}>
              КОРАБЛЬ ПОТЕРЯН
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
              Слишком высокая скорость столкновения с поверхностью ({body.nameRu}). Используйте
              парашюты в атмосфере или ретроградное торможение двигателями перед посадкой.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="ob-btn ob-btn-launch" onClick={handleResetFlight}>
                <RotateCcw size={15} />
                <span>Повторить запуск</span>
              </button>
              <button className="ob-btn" onClick={() => setScreen('builder')}>
                В конструктор
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
