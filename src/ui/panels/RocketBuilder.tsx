import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import {
  ArrowLeft,
  Rocket,
  Save,
  Trash2,
  Plus,
  Lock,
  ArrowUp,
  ArrowDown,
  Layers,
  Copy,
} from 'lucide-react';
import { PARTS_CATALOG, getPartDef } from '@/data/partsCatalog';
import { PartCategory, PlacedPart, RocketBlueprint } from '@/game/core/types';
import { autoStackRocketParts, calculateRocketStats } from '@/game/rocket-builder/rocketMath';
import { RocketMesh } from '@/game/spacecraft/RocketMesh';
import { flightEngine } from '@/game/physics/flightEngine';
import { useGameStore } from '@/stores/useGameStore';

const CATEGORIES: Array<{ id: PartCategory; label: string }> = [
  { id: 'command', label: 'Кабины' },
  { id: 'fuel', label: 'Баки' },
  { id: 'engine', label: 'Двигатели' },
  { id: 'structural', label: 'Ступени' },
  { id: 'aero', label: 'Аэро' },
  { id: 'utility', label: 'Системы' },
  { id: 'science', label: 'Наука' },
];

export const RocketBuilder: React.FC = () => {
  const {
    blueprints,
    selectedBlueprintId,
    progress,
    saveBlueprint,
    deleteBlueprint,
    selectBlueprint,
    setScreen,
    pushToast,
  } = useGameStore();

  const initialBp =
    blueprints.find((b) => b.id === selectedBlueprintId) ?? blueprints[0];

  const [name, setName] = useState(initialBp.name);
  const [editingId, setEditingId] = useState(initialBp.id);
  const [parts, setParts] = useState<PlacedPart[]>(() =>
    initialBp.parts.map((p) => ({ ...p }))
  );
  const [category, setCategory] = useState<PartCategory>('fuel');
  const [selectedUid, setSelectedUid] = useState<string | null>(
    initialBp.parts[0]?.uid ?? null
  );
  const [radialSymmetry, setRadialSymmetry] = useState<2 | 4>(2);

  const stats = useMemo(() => calculateRocketStats(parts), [parts]);
  const selectedPart = parts.find((p) => p.uid === selectedUid) ?? null;

  const loadBlueprintIntoEditor = (bp: RocketBlueprint) => {
    setEditingId(bp.id);
    setName(bp.name);
    setParts(bp.parts.map((p) => ({ ...p })));
    setSelectedUid(bp.parts[0]?.uid ?? null);
    selectBlueprint(bp.id);
  };

  const handleAddPart = (partId: string) => {
    const def = getPartDef(partId);
    if (!def) return;
    if (def.techRequired && !progress.unlockedTech.includes(def.techRequired)) {
      pushToast({
        title: 'Требуется технология',
        body: 'Откройте соответствующую технологию в дереве исследований.',
        type: 'warning',
      });
      return;
    }

    const maxStage = parts.reduce((m, p) => Math.max(m, p.stage), 0);
    const defaultStage = def.isDecoupler || def.isSolidBooster ? maxStage + 1 : maxStage;

    if (def.attachMode === 'radial') {
      const targetY = selectedPart ? selectedPart.position[1] : 2.5;
      const radiusOffset = def.isSolidBooster ? 1.55 : 1.05;
      const added: PlacedPart[] = [];
      for (let i = 0; i < radialSymmetry; i++) {
        const angle = (i / radialSymmetry) * Math.PI * 2;
        added.push({
          uid: `p_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
          partId,
          stage: def.isSolidBooster ? maxStage + 1 : 0,
          position: [
            Number((Math.cos(angle) * radiusOffset).toFixed(2)),
            targetY,
            Number((Math.sin(angle) * radiusOffset).toFixed(2)),
          ],
          rotation: [0, 0, 0],
          scale: 1,
          symmetry: radialSymmetry,
          radialAngle: angle,
        });
      }
      setParts((prev) => [...prev, ...added]);
      setSelectedUid(added[0].uid);
    } else {
      const topY = parts.reduce((m, p) => Math.max(m, p.position[1]), 0);
      const newPart: PlacedPart = {
        uid: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        partId,
        stage: def.isCommand || def.isParachute || def.isScience ? 0 : defaultStage,
        position: [0, topY + def.height, 0],
        rotation: [0, 0, 0],
        scale: 1,
      };
      const next = autoStackRocketParts([...parts, newPart]);
      setParts(next);
      setSelectedUid(newPart.uid);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedUid) return;
    const next = autoStackRocketParts(parts.filter((p) => p.uid !== selectedUid));
    setParts(next);
    setSelectedUid(next[0]?.uid ?? null);
  };

  const handleMoveStack = (dir: 1 | -1) => {
    if (!selectedPart) return;
    const def = getPartDef(selectedPart.partId);
    if (def?.attachMode === 'radial') {
      setParts((prev) =>
        prev.map((p) =>
          p.uid === selectedPart.uid
            ? { ...p, position: [p.position[0], p.position[1] + dir * 0.6, p.position[2]] }
            : p
        )
      );
      return;
    }

    const stack = parts
      .filter((p) => getPartDef(p.partId)?.attachMode === 'stack')
      .sort((a, b) => a.position[1] - b.position[1]);
    const idx = stack.findIndex((p) => p.uid === selectedPart.uid);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= stack.length) return;

    const copy = [...stack];
    const tmp = copy[idx];
    copy[idx] = copy[swapIdx];
    copy[swapIdx] = tmp;

    // Assign monotonic temporary Y so autoStack preserves new order
    const reordered = copy.map((p, i) => ({
      ...p,
      position: [0, i * 2, 0] as [number, number, number],
    }));
    const radials = parts.filter((p) => getPartDef(p.partId)?.attachMode === 'radial');
    setParts(autoStackRocketParts([...reordered, ...radials]));
  };

  const handleUpdateSelected = (patch: Partial<PlacedPart>) => {
    if (!selectedUid) return;
    const updated = parts.map((p) => (p.uid === selectedUid ? { ...p, ...patch } : p));
    setParts(patch.scale !== undefined ? autoStackRocketParts(updated) : updated);
  };

  const handleSave = (asNew = false) => {
    const id = asNew ? `bp_custom_${Date.now()}` : editingId;
    const bp: RocketBlueprint = {
      id,
      name: name.trim() || 'Новая ракета',
      description: `Пользовательский чертёж (${stats.stages.length} ст., ${Math.round(stats.totalDeltaV)} м/с)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parts,
    };
    setEditingId(id);
    saveBlueprint(bp);
  };

  const handleLaunchFromVab = () => {
    if (!stats.hasCommand || !stats.hasEngine) {
      pushToast({
        title: 'Невозможно запустить',
        body: 'Ракете нужен командный модуль и хотя бы один двигатель.',
        type: 'danger',
      });
      return;
    }
    const bp: RocketBlueprint = {
      id: editingId,
      name: name.trim() || 'Ракета',
      description: 'Запуск из VAB',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parts,
    };
    saveBlueprint(bp);
    flightEngine.loadBlueprint(bp);
    useGameStore.getState().setTelemetry(flightEngine.getTelemetry());
    useGameStore.getState().setTimeWarp(1);
    setScreen('flight');
  };

  const handleClear = () => {
    setParts([]);
    setSelectedUid(null);
  };

  const filteredCatalog = PARTS_CATALOG.filter((p) => p.category === category);
  const centerY =
    parts.length > 0
      ? parts.reduce((acc, p) => acc + p.position[1], 0) / parts.length
      : 4;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#070b14' }}>
      {/* Top VAB Bar */}
      <div
        className="ob-panel"
        style={{
          borderRadius: 0,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="ob-btn" onClick={() => setScreen('spaceport')}>
            <ArrowLeft size={16} />
            <span>Космодром</span>
          </button>
          <span className="ob-title" style={{ fontSize: 15, color: 'var(--accent-cyan)' }}>
            ЦЕХ СБОРКИ (VAB)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название ракеты"
            style={{
              padding: '7px 11px',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border-accent)',
              width: 220,
              fontSize: 13,
              fontWeight: 600,
            }}
          />
          <button className="ob-btn" onClick={() => handleSave(false)} title="Сохранить чертёж">
            <Save size={15} />
            <span className="ob-hide-mobile">Сохранить</span>
          </button>
          <button className="ob-btn" onClick={() => handleSave(true)} title="Сохранить как новый">
            <Copy size={15} />
          </button>
          <button className="ob-btn ob-btn-danger" onClick={handleClear} title="Очистить сцену">
            <Trash2 size={15} />
          </button>
          <button className="ob-btn ob-btn-launch" onClick={handleLaunchFromVab}>
            <Rocket size={16} />
            <span>НА СТАРТ</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column VAB Workspace */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 310px', minHeight: 0 }}>
        {/* LEFT: Parts Catalog */}
        <div
          className="ob-panel"
          style={{
            borderRadius: 0,
            borderTop: 'none',
            borderLeft: 'none',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            zIndex: 10,
          }}
        >
          <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 5, borderBottom: '1px solid var(--border-subtle)' }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`ob-btn ${category === c.id ? 'ob-btn-active' : ''}`}
                style={{ padding: '5px 9px', fontSize: 11 }}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span>Боковая симметрия:</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`ob-btn ${radialSymmetry === 2 ? 'ob-btn-active' : ''}`}
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => setRadialSymmetry(2)}
              >
                2x
              </button>
              <button
                className={`ob-btn ${radialSymmetry === 4 ? 'ob-btn-active' : ''}`}
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => setRadialSymmetry(4)}
              >
                4x
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredCatalog.map((part) => {
              const locked = Boolean(
                part.techRequired && !progress.unlockedTech.includes(part.techRequired)
              );
              return (
                <button
                  key={part.id}
                  onClick={() => handleAddPart(part.id)}
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    borderRadius: 8,
                    background: locked ? 'rgba(15, 23, 42, 0.45)' : 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    opacity: locked ? 0.55 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{part.name}</span>
                    {locked ? <Lock size={14} color="var(--accent-amber)" /> : <Plus size={14} color="var(--accent-cyan)" />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {part.description}
                  </div>
                  <div className="ob-mono" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span>Масса: {part.dryMass}т</span>
                    {part.fuelCapacity > 0 && <span style={{ color: '#38bdf8' }}>Топливо: {part.fuelCapacity}т</span>}
                    {part.thrustVac && <span style={{ color: '#f97316' }}>Тяга: {part.thrustVac}кН</span>}
                    {part.ispVac && <span>Isp: {part.ispVac}с</span>}
                    <span style={{ color: '#fbbf24' }}>{part.cost}₵</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER: 3D Assembly Viewport */}
        <div style={{ position: 'relative', minHeight: 0 }}>
          <Canvas shadows camera={{ position: [12, Math.max(6, centerY + 2), 18], fov: 44 }}>
            <color attach="background" args={['#09101e']} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[14, 24, 16]} intensity={2.2} castShadow />
            <directionalLight position={[-12, 10, -10]} intensity={0.7} color="#38bdf8" />
            <Grid
              args={[30, 30]}
              cellSize={1}
              cellColor="#1e293b"
              sectionSize={5}
              sectionColor="#334155"
              position={[0, 0, 0]}
            />
            <RocketMesh
              parts={parts}
              selectedUid={selectedUid}
              onSelectPart={(uid) => setSelectedUid(uid)}
              landingLegsDeployed
              solarPanelsDeployed
            />
            <OrbitControls target={[0, Math.max(3, centerY), 0]} minDistance={6} maxDistance={45} />
          </Canvas>

          {/* Viewport Hint */}
          <div
            className="ob-badge"
            style={{ position: 'absolute', bottom: 12, left: 12, color: 'var(--text-secondary)' }}
          >
            Кликните по детали на ракете для настройки ступени, масштаба или порядка
          </div>
        </div>

        {/* RIGHT: Engineering Telemetry & Inspector */}
        <div
          className="ob-panel"
          style={{
            borderRadius: 0,
            borderTop: 'none',
            borderRight: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 12,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {/* Blueprint switcher */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>
              ЗАГРУЗИТЬ ЧЕРТЁЖ
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={editingId}
                onChange={(e) => {
                  const found = blueprints.find((b) => b.id === e.target.value);
                  if (found) loadBlueprintIntoEditor(found);
                }}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: 6,
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 12,
                }}
              >
                {blueprints.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name}
                  </option>
                ))}
              </select>
              {blueprints.length > 1 && (
                <button
                  className="ob-btn ob-btn-danger"
                  style={{ padding: '6px 9px' }}
                  onClick={() => deleteBlueprint(editingId)}
                  title="Удалить чертёж"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Engineering Metrics */}
          <div style={{ padding: 11, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="ob-title" style={{ fontSize: 12, color: 'var(--accent-cyan)', marginBottom: 8 }}>
              ХАРАКТЕРИСТИКИ РАКЕТЫ
            </div>
            <div className="ob-mono" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, fontSize: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ОБЩАЯ МАССА</div>
                <div>{stats.totalWetMass.toFixed(2)} т</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ТОПЛИВО</div>
                <div style={{ color: '#38bdf8' }}>{stats.totalFuel.toFixed(2)} т</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ТЯГА (ASL)</div>
                <div style={{ color: '#f97316' }}>{Math.round(stats.launchThrustASL)} кН</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>СТАРТ. TWR</div>
                <div style={{ color: stats.launchTWR >= 1.15 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {stats.launchTWR.toFixed(2)} {stats.launchTWR < 1.05 ? '(!)' : ''}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>СУММ. DELTA-V</div>
                <div style={{ color: stats.totalDeltaV >= 2800 ? 'var(--accent-green)' : '#fbbf24' }}>
                  {Math.round(stats.totalDeltaV)} м/с
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>СТОИМОСТЬ</div>
                <div style={{ color: '#fbbf24' }}>{stats.totalCost.toLocaleString()} ₵</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
              Ориентир: Орбита Земли ~3000 м/с • Посадка на Луну ~5200 м/с
            </div>
          </div>

          {/* Selected Part Inspector */}
          {selectedPart && (
            <div style={{ padding: 11, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {getPartDef(selectedPart.partId)?.name}
                </span>
                <button className="ob-btn ob-btn-danger" style={{ padding: '4px 7px' }} onClick={handleDeleteSelected}>
                  <Trash2 size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Позиция:</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="ob-btn" style={{ padding: '4px 9px' }} onClick={() => handleMoveStack(1)}>
                      <ArrowUp size={13} />
                    </button>
                    <button className="ob-btn" style={{ padding: '4px 9px' }} onClick={() => handleMoveStack(-1)}>
                      <ArrowDown size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Ступень активации:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="ob-btn"
                      style={{ padding: '3px 9px' }}
                      onClick={() => handleUpdateSelected({ stage: Math.max(0, selectedPart.stage - 1) })}
                    >
                      -
                    </button>
                    <span className="ob-mono" style={{ width: 22, textAlign: 'center', fontWeight: 700 }}>
                      S{selectedPart.stage + 1}
                    </span>
                    <button
                      className="ob-btn"
                      style={{ padding: '3px 9px' }}
                      onClick={() => handleUpdateSelected({ stage: Math.min(6, selectedPart.stage + 1) })}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <span>Масштаб детали:</span>
                    <span className="ob-mono">{selectedPart.scale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={1.3}
                    step={0.05}
                    value={selectedPart.scale}
                    onChange={(e) => handleUpdateSelected({ scale: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Staging Breakdown */}
          <div style={{ padding: 11, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
              <Layers size={13} color="var(--accent-orange)" />
              <span>СТУПЕНИ (порядок запуска сверху вниз)</span>
            </div>
            <div className="ob-mono" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              {stats.stages.map((st) => (
                <div
                  key={st.stageIndex}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(15, 23, 42, 0.72)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>
                    Ступень {st.stageIndex + 1}
                  </span>
                  <span>Δv {Math.round(st.deltaV)} м/с</span>
                  <span>TWR {st.twrASL.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
