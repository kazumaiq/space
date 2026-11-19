import React from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  FlaskConical,
  Lock,
  Save,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MISSIONS_CATALOG } from '@/data/missions';
import { TECH_TREE } from '@/data/techTree';
import { GraphicsQuality } from '@/game/core/types';
import { useGameStore } from '@/stores/useGameStore';

export const GameModals: React.FC = () => {
  const {
    activePanel,
    setActivePanel,
    progress,
    unlockTech,
    saveSlots,
    saveCurrentSlot,
    loadSlot,
    deleteSlot,
    graphics,
    controls,
    setGraphicsQuality,
    updateGraphics,
    updateControls,
    pushToast,
  } = useGameStore();

  if (activePanel === 'none') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(2, 6, 14, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
      }}
      onClick={() => setActivePanel('none')}
    >
      <div
        className="ob-panel"
        style={{
          width: 'min(760px, 95vw)',
          maxHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div className="ob-title" style={{ fontSize: 15, color: 'var(--accent-cyan)' }}>
            {activePanel === 'missions' && 'КОНТРАКТЫ И МИССИИ'}
            {activePanel === 'tech' && 'ДЕРЕВО ТЕХНОЛОГИЙ'}
            {activePanel === 'saves' && 'УПРАВЛЕНИЕ СОХРАНЕНИЯМИ'}
            {activePanel === 'profile' && 'ПРОФИЛЬ АГЕНТСТВА И ОБРАЗЦЫ'}
            {activePanel === 'settings' && 'НАСТРОЙКИ ГРАФИКИ И УПРАВЛЕНИЯ'}
          </div>
          <button className="ob-btn" style={{ padding: '5px 8px' }} onClick={() => setActivePanel('none')}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* MISSIONS */}
          {activePanel === 'missions' &&
            MISSIONS_CATALOG.map((m) => {
              const done = progress.completedMissions.includes(m.id);
              return (
                <div
                  key={m.id}
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    background: done ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-card)',
                    border: `1px solid ${done ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {done ? (
                      <CheckCircle2 size={20} color="var(--accent-green)" style={{ marginTop: 2 }} />
                    ) : (
                      <Circle size={20} color="var(--accent-orange)" style={{ marginTop: 2 }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                        {m.description}
                      </div>
                      <div className="ob-mono" style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 5 }}>
                        Цель: {m.requirementText}
                      </div>
                    </div>
                  </div>
                  <div className="ob-mono" style={{ textAlign: 'right', flexShrink: 0, fontSize: 12 }}>
                    <div style={{ color: '#fbbf24', fontWeight: 700 }}>+{m.rewardCredits.toLocaleString()} ₵</div>
                    <div style={{ color: '#38bdf8' }}>+{m.rewardScience} ⚡</div>
                  </div>
                </div>
              );
            })}

          {/* TECH TREE */}
          {activePanel === 'tech' && (
            <>
              <div className="ob-badge" style={{ alignSelf: 'flex-start', color: 'var(--accent-cyan)', fontSize: 13 }}>
                Доступно очков науки: {progress.science} ⚡
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {TECH_TREE.map((node) => {
                  const unlocked = progress.unlockedTech.includes(node.id);
                  const prereqsMet = node.prerequisites.every((p) => progress.unlockedTech.includes(p));
                  const canBuy = !unlocked && prereqsMet && progress.science >= node.costScience;

                  return (
                    <div
                      key={node.id}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: unlocked ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-card)',
                        border: `1px solid ${unlocked ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="ob-badge" style={{ fontSize: 10 }}>
                            УРОВЕНЬ {node.tier}
                          </span>
                          {unlocked ? (
                            <CheckCircle2 size={16} color="var(--accent-green)" />
                          ) : !prereqsMet ? (
                            <Lock size={15} color="var(--text-muted)" />
                          ) : (
                            <FlaskConical size={15} color="var(--accent-cyan)" />
                          )}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{node.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          {node.description}
                        </div>
                      </div>
                      {unlocked ? (
                        <div style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 700 }}>ИЗУЧЕНО</div>
                      ) : (
                        <button
                          className={`ob-btn ${canBuy ? 'ob-btn-primary' : ''}`}
                          disabled={!canBuy}
                          onClick={() => unlockTech(node.id)}
                        >
                          Изучить ({node.costScience} ⚡)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* SAVES */}
          {activePanel === 'saves' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Локальное хранилище IndexedDB (готов адаптер Supabase)
                </span>
                <button
                  className="ob-btn ob-btn-primary"
                  onClick={async () => {
                    await saveCurrentSlot();
                    pushToast({ title: 'Игра сохранена', body: 'Прогресс записан в IndexedDB.', type: 'success' });
                  }}
                >
                  <Save size={15} />
                  <span>Сохранить сейчас</span>
                </button>
              </div>
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
                    <div style={{ fontWeight: 700 }}>{slot.progress.agencyName}</div>
                    <div className="ob-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {slot.progress.credits.toLocaleString()} ₵ • {slot.progress.science} ⚡ • {new Date(slot.updatedAt).toLocaleString()}
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
            </>
          )}

          {/* PROFILE & INVENTORY */}
          {activePanel === 'profile' && (
            <>
              <div className="ob-mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ЗАПУСКОВ</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{progress.launchedFlights}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>РЕКОРД ВЫСОТЫ</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {Math.round(progress.maxAltitudeReached / 1000)} км
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>МИССИЙ ВЫПОЛНЕНО</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>
                    {progress.completedMissions.length}/{MISSIONS_CATALOG.length}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Собранные научные образцы ({progress.collectedSamples.length}):
              </div>
              {progress.collectedSamples.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Пока нет собранных образцов. Проведите научный эксперимент на орбите или поверхности Луны!
                </div>
              ) : (
                progress.collectedSamples.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: 'var(--bg-card)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                    }}
                  >
                    <span>{s.name}</span>
                    <span className="ob-mono" style={{ color: 'var(--accent-cyan)' }}>
                      +{s.scienceValue} ⚡
                    </span>
                  </div>
                ))
              )}
            </>
          )}

          {/* SETTINGS */}
          {activePanel === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Качество графики (60 FPS адаптация)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      className={`ob-btn ${graphics.quality === q ? 'ob-btn-primary' : ''}`}
                      onClick={() => setGraphicsQuality(q)}
                    >
                      {q === 'low' ? 'Низкое' : q === 'medium' ? 'Среднее' : q === 'high' ? 'Высокое' : 'Ультра'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  className={`ob-btn ${graphics.clouds ? 'ob-btn-active' : ''}`}
                  onClick={() => updateGraphics({ clouds: !graphics.clouds })}
                >
                  Облака: {graphics.clouds ? 'ВКЛ' : 'ВЫКЛ'}
                </button>
                <button
                  className={`ob-btn ${graphics.particles ? 'ob-btn-active' : ''}`}
                  onClick={() => updateGraphics({ particles: !graphics.particles })}
                >
                  Дым и частицы: {graphics.particles ? 'ВКЛ' : 'ВЫКЛ'}
                </button>
                <button
                  className={`ob-btn ${graphics.audioEnabled ? 'ob-btn-active' : ''}`}
                  onClick={() => updateGraphics({ audioEnabled: !graphics.audioEnabled })}
                >
                  {graphics.audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  <span>Звук: {graphics.audioEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Управление
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    className={`ob-btn ${controls.invertPitch ? 'ob-btn-active' : ''}`}
                    onClick={() => updateControls({ invertPitch: !controls.invertPitch })}
                  >
                    Инверсия тангажа (W/S): {controls.invertPitch ? 'ВКЛ' : 'ВЫКЛ'}
                  </button>
                  <button
                    className={`ob-btn ${controls.showTouchControls === 'always' ? 'ob-btn-active' : ''}`}
                    onClick={() =>
                      updateControls({
                        showTouchControls: controls.showTouchControls === 'always' ? 'auto' : 'always',
                      })
                    }
                  >
                    Экранные кнопки: {controls.showTouchControls === 'always' ? 'ВСЕГДА' : 'АВТО'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
