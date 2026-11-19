import React, { useState } from 'react';
import { ArrowLeft, Globe, Sparkles } from 'lucide-react';
import { CELESTIAL_BODIES } from '@/data/solarSystem';
import { useGameStore } from '@/stores/useGameStore';

export const SolarSystemMap: React.FC = () => {
  const { setScreen, progress } = useGameStore();
  const [selectedId, setSelectedId] = useState('earth');

  const selected = CELESTIAL_BODIES.find((b) => b.id === selectedId) ?? CELESTIAL_BODIES[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        background: 'radial-gradient(circle at 50% 45%, #0b162c 0%, #03060d 75%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Bar */}
      <div
        className="ob-panel"
        style={{
          borderRadius: 0,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="ob-btn" onClick={() => setScreen('spaceport')}>
            <ArrowLeft size={16} />
            <span>Космодром</span>
          </button>
          <span className="ob-title" style={{ fontSize: 15, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={17} />
            КАРТА СОЛНЕЧНОЙ СИСТЕМЫ
          </span>
        </div>
        <div className="ob-badge" style={{ color: 'var(--text-secondary)' }}>
          11 НЕБЕСНЫХ ТЕЛ • ПОКОРЕНО ОРБИТ: {progress.orbitedBodies.length}
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', minHeight: 0 }}>
        {/* Left: Interactive Solar System Grid */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, alignContent: 'start' }}>
          {CELESTIAL_BODIES.map((body) => {
            const isSelected = body.id === selectedId;
            const orbited = progress.orbitedBodies.includes(body.id);
            const landed = progress.landedBodies.includes(body.id);

            return (
              <button
                key={body.id}
                onClick={() => setSelectedId(body.id)}
                className="ob-panel"
                style={{
                  padding: 16,
                  textAlign: 'left',
                  borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  background: isSelected ? 'rgba(14, 165, 233, 0.14)' : 'var(--bg-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: `radial-gradient(circle at 30% 30%, ${body.color}, #020617)`,
                      boxShadow: body.atmosphereColor ? `0 0 14px ${body.atmosphereColor}` : 'none',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{body.nameRu}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {body.type === 'moon' ? 'Спутник' : 'Планета'}
                    </div>
                  </div>
                </div>

                <div className="ob-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  g: {body.surfaceGravity} м/с² • R: {Math.round(body.radius / 1000)} км
                </div>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {body.playable ? (
                    <span className="ob-badge" style={{ color: 'var(--accent-green)', borderColor: 'rgba(34,197,94,0.4)' }}>
                      ДОСТУПНО
                    </span>
                  ) : (
                    <span className="ob-badge" style={{ color: 'var(--text-muted)' }}>
                      ДАЛЬНИЙ КОСМОС
                    </span>
                  )}
                  {orbited && <span className="ob-badge" style={{ color: 'var(--accent-cyan)' }}>ОРБИТА</span>}
                  {landed && <span className="ob-badge" style={{ color: 'var(--accent-orange)' }}>ПОСАДКА</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Detailed Body Inspector */}
        <div
          className="ob-panel"
          style={{
            borderRadius: 0,
            borderTop: 'none',
            borderRight: 'none',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: `radial-gradient(circle at 32% 32%, ${selected.color}, #020617)`,
                boxShadow: selected.atmosphereColor ? `0 0 22px ${selected.atmosphereColor}` : 'none',
              }}
            />
            <div>
              <div className="ob-title" style={{ fontSize: 20, fontWeight: 800 }}>
                {selected.nameRu}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.name}</div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {selected.description}
          </p>

          <div className="ob-mono" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ГРАВИТАЦИЯ</div>
              <div>{selected.surfaceGravity} м/с²</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>РАДИУС</div>
              <div>{Math.round(selected.radius / 1000)} км</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>АТМОСФЕРА</div>
              <div>
                {selected.atmosphereHeight > 0
                  ? `${Math.round(selected.atmosphereHeight / 1000)} км`
                  : 'Отсутствует'}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ТЕМПЕРАТУРА</div>
              <div>{selected.surfaceTempK} K</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ОРБИТА</div>
              <div>
                {selected.orbitRadius > 0
                  ? `${Math.round(selected.orbitRadius / 1000).toLocaleString()} км`
                  : 'Центр системы'}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>СФЕРА ВЛИЯНИЯ</div>
              <div>{Math.round(selected.soiRadius / 1000).toLocaleString()} км</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={13} color="var(--accent-cyan)" />
              <span>РЕСУРСЫ И НАУКА</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selected.resources.map((res) => (
                <span key={res} className="ob-badge" style={{ color: 'var(--accent-cyan)' }}>
                  {res}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
