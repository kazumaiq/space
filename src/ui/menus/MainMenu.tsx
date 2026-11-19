import React, { useState } from 'react';
import { Rocket, Play, FolderOpen, Settings, Plus, Trash2, Sparkles } from 'lucide-react';
import { useGameStore } from '@/stores/useGameStore';

export const MainMenu: React.FC = () => {
  const {
    saveSlots,
    progress,
    setScreen,
    setActivePanel,
    createNewGame,
    loadSlot,
    deleteSlot,
  } = useGameStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [agencyInput, setAgencyInput] = useState('ORBITAL COMMAND');

  const handleStartNew = async () => {
    const slotId = `slot_${Date.now()}`;
    await createNewGame(slotId, agencyInput);
    setShowNewModal(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px clamp(20px, 5vw, 64px)',
        background:
          'radial-gradient(circle at 70% 50%, transparent 15%, rgba(4, 7, 15, 0.72) 75%)',
        pointerEvents: 'none',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="ob-badge" style={{ color: 'var(--accent-cyan)', borderColor: 'var(--border-accent)' }}>
          <Sparkles size={13} />
          <span>ORBITAL ENGINE v1.0 • KEPLERIAN 3D</span>
        </div>
        <div className="ob-badge" style={{ color: 'var(--text-secondary)' }}>
          <span>EARTH • MOON • MARS SYSTEM</span>
        </div>
      </div>

      {/* Main Left Column */}
      <div
        style={{
          maxWidth: 460,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: '0.28em',
              color: 'var(--accent-orange)',
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            SPACE FLIGHT SIMULATOR
          </div>
          <h1
            className="ob-title"
            style={{
              fontSize: 'clamp(34px, 5vw, 56px)',
              fontWeight: 900,
              lineHeight: 1.04,
              background: 'linear-gradient(135deg, #ffffff 30%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ORBITAL: BEYOND
          </h1>
          <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            Создайте собственную космическую программу: проектируйте многоступенчатые ракеты,
            выходите на орбиту по реальным законам физики и покоряйте Луну и планеты.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, maxWidth: 320 }}>
          <button
            className="ob-btn ob-btn-launch"
            style={{ padding: '14px 20px', fontSize: 15 }}
            onClick={() => setScreen('spaceport')}
          >
            <Play size={18} />
            <span>
              {saveSlots.length > 0 ? `ПРОДОЛЖИТЬ (${progress.agencyName})` : 'НАЧАТЬ ПРОГРАММУ'}
            </span>
          </button>

          <button
            className="ob-btn ob-btn-primary"
            style={{ padding: '12px 18px' }}
            onClick={() => setShowNewModal(true)}
          >
            <Plus size={16} />
            <span>Новая космическая программа</span>
          </button>

          <button
            className="ob-btn"
            style={{ padding: '12px 18px' }}
            onClick={() => setShowSlotsModal(true)}
          >
            <FolderOpen size={16} />
            <span>Сохранения ({saveSlots.length})</span>
          </button>

          <button
            className="ob-btn"
            style={{ padding: '12px 18px' }}
            onClick={() => setActivePanel('settings')}
          >
            <Settings size={16} />
            <span>Настройки графики и управления</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <span>W/S/A/D — ориентация • Shift/Ctrl — тяга • Space — ступени • M — орбитальная карта</span>
        <span className="ob-mono">60 FPS WEBGL2</span>
      </div>

      {/* New Program Modal */}
      {showNewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 5, 12, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 50,
          }}
        >
          <div className="ob-panel" style={{ width: 400, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="ob-title" style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Rocket size={18} color="var(--accent-cyan)" />
              <span>Новое космическое агентство</span>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Название агентства
              </label>
              <input
                value={agencyInput}
                onChange={(e) => setAgencyInput(e.target.value)}
                maxLength={28}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid var(--border-accent)',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ob-btn" onClick={() => setShowNewModal(false)}>
                Отмена
              </button>
              <button className="ob-btn ob-btn-launch" onClick={handleStartNew}>
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Slots Modal */}
      {showSlotsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 5, 12, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 50,
          }}
        >
          <div className="ob-panel" style={{ width: 460, maxHeight: '75vh', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="ob-title" style={{ fontSize: 16 }}>Слоты сохранений (IndexedDB)</div>
            {saveSlots.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '16px 0' }}>
                Сохранённых программ пока нет. Начните новую программу!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {saveSlots.map((slot) => (
                  <div
                    key={slot.slotId}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{slot.progress.agencyName}</div>
                      <div className="ob-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                        {slot.progress.credits.toLocaleString()} ₵ • {slot.progress.science} ⚡ • Миссий: {slot.progress.completedMissions.length}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(slot.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="ob-btn ob-btn-primary" onClick={() => loadSlot(slot.slotId)}>
                        Загрузить
                      </button>
                      <button className="ob-btn ob-btn-danger" onClick={() => deleteSlot(slot.slotId)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="ob-btn" onClick={() => setShowSlotsModal(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
