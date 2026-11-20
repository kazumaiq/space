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
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getBodyById } from '@/data/solarSystem';
import { getPartDef } from '@/data/partsCatalog';
import { flightEngine } from '@/game/physics/flightEngine';
import { sharedTouchInputs } from '@/game/controls/useFlightControls';
import { soundEngine } from '@/services/audio/soundEngine';
import { useGameStore } from '@/stores/useGameStore';
import { FlightPhase, FlightTelemetry, SasMode } from '@/game/core/types';

function formatAltitude(m: number): string {
  if (!isFinite(m)) return '∞';
  if (Math.abs(m) >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Мм`;
  if (Math.abs(m) >= 1_000) return `${(m / 1_000).toFixed(1)} км`;
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
  PRELAUNCH: { text: 'СТАРТ', color: '#94a3b8' },
  ASCENT: { text: 'ВЗЛЁТ', color: '#f97316' },
  ATMOSPHERIC: { text: 'АТМОСФЕРА', color: '#38bdf8' },
  SUBORBITAL: { text: 'СУБОРБИТА', color: '#fbbf24' },
  LOW_ORBIT: { text: 'ОРБИТА LEO', color: '#22c55e' },
  HIGH_ORBIT: { text: 'ВЫС. ОРБИТА', color: '#22c55e' },
  ESCAPE: { text: 'УХОД', color: '#a78bfa' },
  LUNAR_TRANSFER: { text: 'СФЕРА ЛУНЫ', color: '#38bdf8' },
  LUNAR_ORBIT: { text: 'ОРБИТА ЛУНЫ', color: '#22c55e' },
  DESCENT: { text: 'СНИЖЕНИЕ', color: '#f97316' },
  LANDED: { text: 'ПОСАДКА', color: '#22c55e' },
  CRASHED: { text: 'АВАРИЯ', color: '#ef4444' },
};

const SAS_MODES: SasMode[] = ['STABILITY', 'PROGRADE', 'RETROGRADE', 'OFF'];

function getFlightHint(t: FlightTelemetry): string {
  if (t.phase === 'PRELAUNCH') {
    return 'Нажмите «ЗАПУСК» внизу (или Space), чтобы зажечь двигатели';
  }
  if (t.phase === 'ASCENT' && t.altitude < 10_000) {
    return 'Набор высоты! После 10 км начните плавный наклон вправо для выхода на орбиту';
  }
  if (t.phase === 'ASCENT' && t.altitude >= 10_000) {
    return 'Наклоняйте ракету к горизонту (D / ▶), чтобы разогнать орбитальную скорость';
  }
  if (t.phase === 'SUBORBITAL') {
    return 'Вы в космосе! Включите SAS → PRO и ускорьтесь возле Апогея (Ap), чтобы замкнуть орбиту';
  }
  if (t.phase === 'LOW_ORBIT' || t.phase === 'HIGH_ORBIT') {
    return 'Стабильная орбита! Проведите научный эксперимент или откройте Карту (M) для полёта к Луне';
  }
  if (t.phase === 'LANDED') {
    return 'Успешная посадка! Выпустите планетоход или соберите образцы грунта';
  }
  if (t.phase === 'DESCENT') {
    return 'Снижение! Раскройте парашют в атмосфере или тормозите в режиме SAS → RETRO';
  }
  return '';
}

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
  const hint = getFlightHint(telemetry);

  const hasScience = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isScience));
  const hasChute = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isParachute));
  const hasLegs = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isLandingLeg));
  const hasSolar = flightEngine.hasPartCapability((id) => Boolean(getPartDef(id)?.isSolarPanel));

  const warps = telemetry.altitude > body.atmosphereHeight ? [1, 2, 5, 10, 50] : [1, 2, 5, 10];

  const handleCycleWarp = () => {
    const idx = warps.indexOf(timeWarp);
    const next = warps[(idx + 1) % warps.length];
    setTimeWarp(next);
    soundEngine.playClick();
  };

  const handleCycleSas = () => {
    const idx = SAS_MODES.indexOf(telemetry.sasMode);
    flightEngine.sasMode = SAS_MODES[(idx + 1) % SAS_MODES.length];
    soundEngine.playClick();
  };

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
      name: isLanded ? `Грунт: ${body.nameRu}` : `Орбитальная телеметрия (${body.nameRu})`,
      scienceValue: sciVal,
      creditValue: credVal,
      collectedAt: Date.now(),
    });
  };

  const handleToggleRover = () => {
    flightEngine.roverDeployed = !flightEngine.roverDeployed;
    soundEngine.playClick();
  };

  const isTouch =
    controls.showTouchControls === 'always' ||
    (controls.showTouchControls === 'auto' &&
      typeof window !== 'undefined' &&
      (window.innerWidth <= 900 || 'ontouchstart' in window));

  return (
    <div className="flight-hud-root">
      {/* TOP BAR + MOBILE COMPACT TELEMETRY */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 6,
            width: '100%',
          }}
        >
          {/* Status Pill */}
          <div
            className="ob-panel"
            style={{
              pointerEvents: 'auto',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <span className="ob-title" style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>
              {body.nameRu}
            </span>
            <span
              className="ob-badge"
              style={{
                borderColor: phaseInfo.color,
                color: phaseInfo.color,
                padding: '2px 6px',
                fontSize: 10,
              }}
            >
              {phaseInfo.text}
            </span>
            <span className="ob-mono ob-hide-mobile" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              T+{formatTime(telemetry.missionTime)}
            </span>
          </div>

          {/* Right Action Controls (never overflows on mobile!) */}
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              className={`ob-btn ${timeWarp > 1 ? 'ob-btn-active' : ''}`}
              style={{ padding: '6px 9px', fontSize: 11 }}
              onClick={handleCycleWarp}
              title="Ускорение времени"
            >
              <FastForward size={13} color="var(--accent-orange)" />
              <span className="ob-mono">{timeWarp}x</span>
            </button>

            <button
              className={`ob-btn ${mapView ? 'ob-btn-primary' : ''}`}
              style={{ padding: '6px 9px', fontSize: 11 }}
              onClick={() => setMapView(!mapView)}
              title="Орбитальная карта (M)"
            >
              <Map size={14} />
              <span className="ob-hide-mobile">{mapView ? 'Ракета' : 'Орбита'}</span>
            </button>

            <button
              className="ob-btn"
              style={{ padding: '6px 8px' }}
              onClick={handleResetFlight}
              title="Перезапуск"
            >
              <RotateCcw size={14} />
            </button>

            <button
              className="ob-btn"
              style={{ padding: '6px 8px' }}
              onClick={() => {
                soundEngine.updateEngineThrust(0, false);
                setScreen('spaceport');
              }}
              title="На космодром"
            >
              <Home size={14} />
            </button>
          </div>
        </div>

        {/* MOBILE SLIM TELEMETRY STRIP (leaves center 3D rocket 100% clear!) */}
        <div className="ob-panel ob-mono flight-mobile-strip">
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ВЫСОТА</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{formatAltitude(telemetry.altitude)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>СКОРОСТЬ</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{Math.round(telemetry.speed)} м/с</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>АПОГЕЙ</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-cyan)' }}>
              {formatAltitude(telemetry.orbital.apoapsis)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>ТОПЛИВО</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: fuelPct < 15 ? 'var(--accent-red)' : '#38bdf8' }}>
              {Math.round(fuelPct)}%
            </div>
          </div>
        </div>

        {/* Dynamic 1-line Flight Guide */}
        {hint && (
          <div
            style={{
              alignSelf: 'center',
              padding: '4px 12px',
              borderRadius: 99,
              background: 'rgba(11, 17, 30, 0.72)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: 11,
              color: '#cbd5e1',
              textAlign: 'center',
              maxWidth: '94%',
            }}
          >
            {hint}
          </div>
        )}
      </div>

      {/* DESKTOP SIDE TELEMETRY PANELS (hidden on mobile <= 900px) */}
      <div className="flight-desktop-panels">
        <div
          className="ob-panel ob-mono"
          style={{
            pointerEvents: 'auto',
            padding: 13,
            width: 228,
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            fontSize: 12,
          }}
        >
          <div className="ob-title" style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>
            ТЕЛЕМЕТРИЯ
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
            <span style={{ color: 'var(--text-secondary)' }}>Тяга / TWR</span>
            <span style={{ color: 'var(--accent-orange)' }}>
              {Math.round(telemetry.thrustKN)} кН ({telemetry.twr.toFixed(2)})
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Масса</span>
            <span>{telemetry.massTons.toFixed(1)} т</span>
          </div>
          <div style={{ marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-secondary)' }}>ТОПЛИВО</span>
              <span>{fuelPct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: 'rgba(30,41,59,0.9)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, fuelPct)}%`,
                  height: '100%',
                  background: fuelPct < 15 ? 'var(--accent-red)' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="ob-panel ob-mono"
          style={{
            pointerEvents: 'auto',
            padding: 13,
            width: 230,
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
            fontSize: 12,
          }}
        >
          <div className="ob-title" style={{ fontSize: 11, color: 'var(--accent-orange)' }}>
            ОРБИТА
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
            <span style={{ color: 'var(--text-secondary)' }}>Период</span>
            <span>{formatTime(telemetry.orbital.orbitalPeriod)}</span>
          </div>
          {trajectory?.encounterBodyId === 'moon' && (
            <div className="ob-badge" style={{ borderColor: '#f97316', color: '#fb923c', justifyContent: 'center' }}>
              ПЕРЕХВАТ ЛУНЫ!
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM CONTROL DECK (100% responsive, fits 360px mobile & desktop!) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
        {/* Landed surface action bar */}
        {telemetry.phase === 'LANDED' && (
          <div
            className="ob-panel"
            style={{
              pointerEvents: 'auto',
              padding: '8px 10px',
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              alignSelf: 'center',
            }}
          >
            <button className="ob-btn ob-btn-primary" style={{ fontSize: 12 }} onClick={handleToggleRover}>
              <Cpu size={14} />
              <span>{telemetry.roverDeployed ? 'Убрать ровер' : 'Выпустить планетоход'}</span>
            </button>
            <button className="ob-btn" style={{ fontSize: 12 }} onClick={handleScienceExperiment}>
              <FlaskConical size={14} color="var(--accent-cyan)" />
              <span>Собрать грунт</span>
            </button>
          </div>
        )}

        {/* Main bottom row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
          }}
        >
          {/* Left: Throttle + Systems */}
          <div
            className="ob-panel"
            style={{
              pointerEvents: 'auto',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              flex: isTouch ? 1 : '0 1 auto',
              minWidth: 0,
            }}
          >
            {/* Throttle row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ob-mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-orange)', minWidth: 38 }}>
                {Math.round(telemetry.throttle * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={telemetry.throttle}
                onChange={(e) => flightEngine.setThrottle(Number(e.target.value))}
                style={{ flex: 1, minWidth: 70, maxWidth: 140, accentColor: '#f97316' }}
              />
              <button
                className="ob-btn"
                style={{ padding: '4px 7px', fontSize: 10 }}
                onClick={() => flightEngine.setThrottle(telemetry.throttle > 0.1 ? 0 : 1)}
              >
                {telemetry.throttle > 0.1 ? 'СТОП' : 'МАКС'}
              </button>
            </div>

            {/* Systems + Primary Launch/Stage button */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
              <button
                className={`ob-btn ${telemetry.sasMode !== 'OFF' ? 'ob-btn-active' : ''}`}
                style={{ padding: '6px 8px', fontSize: 11 }}
                onClick={handleCycleSas}
                title="Переключить режим SAS (T)"
              >
                <Compass size={13} />
                <span>
                  SAS:{' '}
                  {telemetry.sasMode === 'OFF'
                    ? 'OFF'
                    : telemetry.sasMode === 'STABILITY'
                      ? 'STAB'
                      : telemetry.sasMode === 'PROGRADE'
                        ? 'PRO'
                        : 'RETRO'}
                </span>
              </button>

              {hasChute && (
                <button
                  className={`ob-btn ${telemetry.parachutesDeployed ? 'ob-btn-active' : ''}`}
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  onClick={() => flightEngine.toggleParachutes()}
                  title="Парашют (P)"
                >
                  <Umbrella size={13} />
                </button>
              )}

              {hasLegs && (
                <button
                  className={`ob-btn ${telemetry.landingLegsDeployed ? 'ob-btn-active' : ''}`}
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  onClick={() => flightEngine.toggleLandingLegs()}
                  title="Посадочные опоры (G)"
                >
                  <ArrowDownToLine size={13} />
                </button>
              )}

              {hasSolar && (
                <button
                  className={`ob-btn ${telemetry.solarPanelsDeployed ? 'ob-btn-active' : ''}`}
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  onClick={() => flightEngine.toggleSolarPanels()}
                  title="Солнечные панели (L)"
                >
                  <Sun size={13} />
                </button>
              )}

              {hasScience && (
                <button
                  className="ob-btn ob-btn-primary"
                  style={{ padding: '6px 8px', fontSize: 11 }}
                  onClick={handleScienceExperiment}
                  title="Научный эксперимент"
                >
                  <FlaskConical size={13} />
                </button>
              )}

              <button
                className="ob-btn ob-btn-launch"
                style={{ padding: '7px 14px', fontSize: 12, marginLeft: 'auto' }}
                onClick={handleStageButton}
              >
                <Flame size={15} />
                <span>
                  {!flightEngine.ignited
                    ? 'ЗАПУСК'
                    : telemetry.currentStage > 0
                      ? `СТУПЕНЬ ${telemetry.currentStage}`
                      : 'СТУП. 1'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Compact Touch Steering D-pad (only on mobile / touch) */}
          {isTouch && (
            <div
              className="ob-panel"
              style={{
                pointerEvents: 'auto',
                padding: 6,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 34px)',
                gridTemplateRows: 'repeat(2, 34px)',
                gap: 4,
                flexShrink: 0,
              }}
            >
              <div />
              <button
                className="ob-btn"
                style={{ padding: 0 }}
                onPointerDown={() => (sharedTouchInputs.pitch = 1)}
                onPointerUp={() => (sharedTouchInputs.pitch = 0)}
                onPointerLeave={() => (sharedTouchInputs.pitch = 0)}
              >
                <ChevronUp size={16} />
              </button>
              <div />
              <button
                className="ob-btn"
                style={{ padding: 0 }}
                onPointerDown={() => (sharedTouchInputs.yaw = -1)}
                onPointerUp={() => (sharedTouchInputs.yaw = 0)}
                onPointerLeave={() => (sharedTouchInputs.yaw = 0)}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="ob-btn"
                style={{ padding: 0 }}
                onPointerDown={() => (sharedTouchInputs.pitch = -1)}
                onPointerUp={() => (sharedTouchInputs.pitch = 0)}
                onPointerLeave={() => (sharedTouchInputs.pitch = 0)}
              >
                <ChevronDown size={16} />
              </button>
              <button
                className="ob-btn"
                style={{ padding: 0 }}
                onPointerDown={() => (sharedTouchInputs.yaw = 1)}
                onPointerUp={() => (sharedTouchInputs.yaw = 0)}
                onPointerLeave={() => (sharedTouchInputs.yaw = 0)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CRASH MODAL */}
      {telemetry.phase === 'CRASHED' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 4, 8, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div className="ob-panel" style={{ padding: 22, width: 'min(370px, 100%)', textAlign: 'center', borderColor: 'var(--accent-red)' }}>
            <AlertTriangle size={36} color="var(--accent-red)" style={{ marginBottom: 8 }} />
            <div className="ob-title" style={{ fontSize: 17, color: '#fecaca', marginBottom: 8 }}>
              КОРАБЛЬ ПОТЕРЯН
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Слишком высокая скорость при посадке ({body.nameRu}). Используйте парашют или тормозите двигателем в режиме SAS → RETRO.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="ob-btn ob-btn-launch" onClick={handleResetFlight}>
                <RotateCcw size={15} />
                <span>Повторить</span>
              </button>
              <button className="ob-btn" onClick={() => setScreen('builder')}>
                Конструктор
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
