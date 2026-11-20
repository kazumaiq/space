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
  Wand2,
  CheckCircle2,
  XCircle,
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

type MobileTab = 'catalog' | 'assembly' | 'stats';

/**
 * Automatically computes logical staging from top to bottom based on decouplers and radial SRBs.
 */
function autoAssignStages(parts: PlacedPart[]): PlacedPart[] {
  const stackTopDown = parts
    .filter((p) => getPartDef(p.partId)?.attachMode === 'stack')
    .sort((a, b) => b.position[1] - a.position[1]);

  let currentStage = 0;
  const stageByUid = new Map<string, number>();

  for (const p of stackTopDown) {
    const def = getPartDef(p.partId);
    if (def?.isDecoupler) {
      currentStage += 1;
    }
    stageByUid.set(p.uid, currentStage);
  }

  const maxStackStage = currentStage;

  return parts.map((p) => {
    const def = getPartDef(p.partId);
    if (def?.attachMode === 'stack') {
      return { ...p, stage: stageByUid.get(p.uid) ?? 0 };
    }
    if (def?.isSolidBooster) {
      return { ...p, stage: maxStackStage + 1 };
    }
    return { ...p, stage: 0 };
  });
}

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
  const [mobileTab, setMobileTab] = useState<MobileTab>('catalog');

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
        body: 'Откройте эту технологию в меню «Технологии».',
        type: 'warning',
      });
      return;
    }

    if (def.attachMode === 'radial') {
      const stackParts = parts
        .filter((p) => getPartDef(p.partId)?.attachMode === 'stack')
        .sort((a, b) => a.position[1] - b.position[1]);

      // Smart height placement: SRB & legs near lower body, solar near upper body
      let targetY = 2.4;
      if (stackParts.length > 0) {
        if (def.isSolarPanel) {
          targetY = stackParts[Math.max(0, stackParts.length - 2)].position[1];
        } else if (def.isLandingLeg) {
          targetY = stackParts[Math.min(1, stackParts.length - 1)].position[1];
        } else {
          targetY = stackParts[Math.min(1, stackParts.length - 1)].position[1] + 0.5;
        }
      }

      const radiusOffset = def.isSolidBooster ? 1.55 : 1.08;
      const added: PlacedPart[] = [];
      for (let i = 0; i < radialSymmetry; i++) {
        const angle = (i / radialSymmetry) * Math.PI * 2;
        added.push({
          uid: `p_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
          partId,
          stage: 0,
          position: [
            Number((Math.cos(angle) * radiusOffset).toFixed(2)),
            Number(targetY.toFixed(2)),
            Number((Math.sin(angle) * radiusOffset).toFixed(2)),
          ],
          rotation: [0, 0, 0],
          scale: 1,
          symmetry: radialSymmetry,
          radialAngle: angle,
        });
      }
      const next = autoAssignStages([...parts, ...added]);
      setParts(next);
      setSelectedUid(added[0].uid);
      return;
    }

    // Smart vertical snapping for stack parts
    const stackSorted = parts
      .filter((p) => getPartDef(p.partId)?.attachMode === 'stack')
      .sort((a, b) => a.position[1] - b.position[1]);

    const topY = stackSorted.length > 0 ? stackSorted[stackSorted.length - 1].position[1] + 5 : 5;
    const bottomY = stackSorted.length > 0 ? stackSorted[0].position[1] - 5 : -5;

    let insertY = topY;
    if (def.category === 'engine') {
      // Engines snap to the bottom by default
      insertY = bottomY;
    } else if (def.category === 'fuel' || def.isDecoupler) {
      // Fuel tanks & decouplers snap right above the lowest engine if one exists
      const lowest = stackSorted[0];
      if (lowest && getPartDef(lowest.partId)?.category === 'engine') {
        insertY = lowest.position[1] + 0.01;
      } else {
        insertY = bottomY;
      }
    } else {
      // Capsules, parachutes, fairings, science snap to the top
      insertY = topY;
    }

    const newPart: PlacedPart = {
      uid: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      partId,
      stage: 0,
      position: [0, insertY, 0],
      rotation: [0, 0, 0],
      scale: 1,
    };

    const stacked = autoStackRocketParts([...parts, newPart]);
    setParts(autoAssignStages(stacked));
    setSelectedUid(newPart.uid);
  };

  const handleDeletePart = (uid: string) => {
    const next = autoAssignStages(autoStackRocketParts(parts.filter((p) => p.uid !== uid)));
    setParts(next);
    if (selectedUid === uid) {
      setSelectedUid(next[0]?.uid ?? null);
    }
  };

  const handleMoveStack = (uid: string, dir: 1 | -1) => {
    const target = parts.find((p) => p.uid === uid);
    if (!target) return;
    const def = getPartDef(target.partId);

    if (def?.attachMode === 'radial') {
      setParts((prev) =>
        prev.map((p) =>
          p.uid === uid
            ? { ...p, position: [p.position[0], Number((p.position[1] + dir * 0.6).toFixed(2)), p.position[2]] }
            : p
        )
      );
      return;
    }

    const stack = parts
      .filter((p) => getPartDef(p.partId)?.attachMode === 'stack')
      .sort((a, b) => a.position[1] - b.position[1]);
    const idx = stack.findIndex((p) => p.uid === uid);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= stack.length) return;

    const copy = [...stack];
    [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];

    const reordered = copy.map((p, i) => ({
      ...p,
      position: [0, i * 2, 0] as [number, number, number],
    }));
    const radials = parts.filter((p) => getPartDef(p.partId)?.attachMode === 'radial');
    setParts(autoAssignStages(autoStackRocketParts([...reordered, ...radials])));
  };

  const handleUpdateSelected = (patch: Partial<PlacedPart>) => {
    if (!selectedUid) return;
    const updated = parts.map((p) => (p.uid === selectedUid ? { ...p, ...patch } : p));
    setParts(patch.scale !== undefined ? autoStackRocketParts(updated) : updated);
  };

  const handleAutoStage = () => {
    setParts((prev) => autoAssignStages(autoStackRocketParts(prev)));
    pushToast({
      title: 'Ступени настроены',
      body: 'Порядок активации и стыковка выровнены автоматически.',
      type: 'success',
    });
  };

  const handleSave = () => {
    const bp: RocketBlueprint = {
      id: editingId,
      name: name.trim() || 'Новая ракета',
      description: `Пользовательская ракета (${stats.stages.length} ст., ${Math.round(stats.totalDeltaV)} м/с)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parts,
    };
    saveBlueprint(bp);
  };

  const handleLaunchFromVab = () => {
    if (!stats.hasCommand || !stats.hasEngine) {
      pushToast({
        title: 'Ракета не готова',
        body: 'Добавьте кабину/спутник и хотя бы один двигатель.',
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

  const filteredCatalog = PARTS_CATALOG.filter((p) => p.category === category);
  const centerY =
    parts.length > 0
      ? parts.reduce((acc, p) => acc + p.position[1], 0) / parts.length
      : 4;
  const sortedPartsTopDown = [...parts].sort((a, b) => b.position[1] - a.position[1]);

  // Catalog Panel JSX
  const catalogContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4, borderBottom: '1px solid var(--border-subtle)' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`ob-btn ${category === c.id ? 'ob-btn-active' : ''}`}
            style={{ padding: '5px 8px', fontSize: 11 }}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
        <span>Симметрия боковых деталей:</span>
        <div style={{ display: 'flex', gap: 5 }}>
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

      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
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
                padding: '9px 10px',
                borderRadius: 8,
                background: locked ? 'rgba(15, 23, 42, 0.45)' : 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                opacity: locked ? 0.55 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{part.name}</span>
                {locked ? (
                  <Lock size={14} color="var(--accent-amber)" />
                ) : (
                  <span className="ob-badge" style={{ color: 'var(--accent-cyan)', borderColor: 'var(--border-accent)' }}>
                    <Plus size={12} /> Добавить
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                {part.description}
              </div>
              <div className="ob-mono" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                <span>{part.dryMass} т</span>
                {part.fuelCapacity > 0 && <span style={{ color: '#38bdf8' }}>Топливо {part.fuelCapacity}т</span>}
                {part.thrustVac && <span style={{ color: '#f97316' }}>Тяга {part.thrustVac}кН</span>}
                <span style={{ color: '#fbbf24' }}>{part.cost}₵</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Assembly & Inspector JSX
  const assemblyContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
          ДЕТАЛИ РАКЕТЫ ({parts.length})
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <button className="ob-btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={handleAutoStage}>
            <Wand2 size={12} color="var(--accent-cyan)" />
            <span>Авто-ступени</span>
          </button>
          <button
            className="ob-btn ob-btn-danger"
            style={{ padding: '4px 8px', fontSize: 11 }}
            onClick={() => {
              setParts([]);
              setSelectedUid(null);
            }}
          >
            Очистить
          </button>
        </div>
      </div>

      {/* Selected Part Controls */}
      {selectedPart && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--border-accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{getPartDef(selectedPart.partId)?.name}</span>
            <button className="ob-btn ob-btn-danger" style={{ padding: '4px 7px' }} onClick={() => handleDeletePart(selectedPart.uid)}>
              <Trash2 size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Порядок:</span>
              <button className="ob-btn" style={{ padding: '4px 8px' }} onClick={() => handleMoveStack(selectedPart.uid, 1)}>
                <ArrowUp size={13} />
              </button>
              <button className="ob-btn" style={{ padding: '4px 8px' }} onClick={() => handleMoveStack(selectedPart.uid, -1)}>
                <ArrowDown size={13} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Ступень:</span>
              <button
                className="ob-btn"
                style={{ padding: '3px 8px' }}
                onClick={() => handleUpdateSelected({ stage: Math.max(0, selectedPart.stage - 1) })}
              >
                -
              </button>
              <span className="ob-mono" style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                {selectedPart.stage + 1}
              </span>
              <button
                className="ob-btn"
                style={{ padding: '3px 8px' }}
                onClick={() => handleUpdateSelected({ stage: Math.min(5, selectedPart.stage + 1) })}
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual list of all placed parts top-to-bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sortedPartsTopDown.map((p) => {
          const def = getPartDef(p.partId);
          const isSel = p.uid === selectedUid;
          return (
            <div
              key={p.uid}
              onClick={() => setSelectedUid(p.uid)}
              style={{
                padding: '7px 9px',
                borderRadius: 6,
                background: isSel ? 'rgba(56, 189, 248, 0.16)' : 'var(--bg-card)',
                border: `1px solid ${isSel ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {def?.name}
                </div>
                <div className="ob-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Ступень {p.stage + 1} {def?.attachMode === 'radial' ? '• Боковой' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="ob-btn"
                  style={{ padding: '3px 6px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveStack(p.uid, 1);
                  }}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  className="ob-btn"
                  style={{ padding: '3px 6px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveStack(p.uid, -1);
                  }}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  className="ob-btn ob-btn-danger"
                  style={{ padding: '3px 6px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePart(p.uid);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Stats & Blueprints JSX
  const statsContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 10, overflowY: 'auto', height: '100%' }}>
      {/* Blueprints */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5 }}>
          ГОТОВЫЕ И СОХРАНЁННЫЕ ЧЕРТЕЖИ
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
              background: 'rgba(15, 23, 42, 0.92)',
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
            <button className="ob-btn ob-btn-danger" style={{ padding: '6px 9px' }} onClick={() => deleteBlueprint(editingId)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Readiness Checklist */}
      <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="ob-title" style={{ fontSize: 11, color: 'var(--accent-cyan)', marginBottom: 7 }}>
          ГОТОВНОСТЬ К ПОЛЁТУ
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
          {[
            { ok: stats.hasCommand, label: 'Командная кабина / спутник' },
            { ok: stats.hasEngine, label: 'Двигатель установлен' },
            { ok: stats.launchTWR >= 1.15, label: `Стартовая тяга TWR ≥ 1.15 (${stats.launchTWR.toFixed(2)})` },
            { ok: stats.totalDeltaV >= 2800, label: `Запас Δv для орбиты (${Math.round(stats.totalDeltaV)} / 3000 м/с)` },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {item.ok ? (
                <CheckCircle2 size={14} color="var(--accent-green)" />
              ) : (
                <XCircle size={14} color="var(--accent-amber)" />
              )}
              <span style={{ color: item.ok ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Numeric Specs */}
      <div className="ob-mono" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, fontSize: 12 }}>
        <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>МАССА</div>
          <div>{stats.totalWetMass.toFixed(1)} т</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ТОПЛИВО</div>
          <div style={{ color: '#38bdf8' }}>{stats.totalFuel.toFixed(1)} т</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ТЯГА</div>
          <div style={{ color: '#f97316' }}>{Math.round(stats.launchThrustASL)} кН</div>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '8px 10px', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ЦЕНА</div>
          <div style={{ color: '#fbbf24' }}>{stats.totalCost.toLocaleString()} ₵</div>
        </div>
      </div>

      {/* Stages */}
      <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
          <Layers size={13} color="var(--accent-orange)" />
          <span>СТУПЕНИ (сверху вниз)</span>
        </div>
        <div className="ob-mono" style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11 }}>
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
              <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>Ст. {st.stageIndex + 1}</span>
              <span>Δv {Math.round(st.deltaV)} м/с</span>
              <span>TWR {st.twrASL.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#070b14' }}>
      {/* Top VAB Bar (responsive, compact on mobile) */}
      <div
        className="ob-panel"
        style={{
          borderRadius: 0,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <button className="ob-btn" style={{ padding: '7px 10px' }} onClick={() => setScreen('spaceport')}>
            <ArrowLeft size={16} />
            <span className="ob-hide-mobile">Космодром</span>
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название ракеты"
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border-accent)',
              width: 'min(200px, 38vw)',
              fontSize: 13,
              fontWeight: 600,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="ob-btn" style={{ padding: '7px 10px' }} onClick={handleSave} title="Сохранить">
            <Save size={15} />
            <span className="ob-hide-mobile">Сохранить</span>
          </button>
          <button className="ob-btn ob-btn-launch" style={{ padding: '7px 14px', fontSize: 12 }} onClick={handleLaunchFromVab}>
            <Rocket size={15} />
            <span>ЗАПУСК</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Workspace */}
      <div className="vab-workspace">
        {/* Desktop Left Catalog */}
        <div className="ob-panel ob-hide-mobile" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', minHeight: 0 }}>
          {catalogContent}
        </div>

        {/* 3D Rocket Viewport (Always visible on top for mobile, center for desktop!) */}
        <div className="vab-viewport" style={{ position: 'relative', minHeight: 0, width: '100%' }}>
          <Canvas shadows camera={{ position: [12, Math.max(6, centerY + 1), 19], fov: 44 }}>
            <color attach="background" args={['#09101e']} />
            <ambientLight intensity={0.65} />
            <directionalLight position={[14, 24, 16]} intensity={2.2} castShadow />
            <directionalLight position={[-12, 10, -10]} intensity={0.75} color="#38bdf8" />
            <Grid
              args={[30, 30]}
              cellSize={1}
              cellColor="#1e293b"
              sectionSize={5}
              sectionColor="#334155"
            />
            <RocketMesh
              parts={parts}
              selectedUid={selectedUid}
              onSelectPart={(uid) => {
                setSelectedUid(uid);
                setMobileTab('assembly');
              }}
              landingLegsDeployed
              solarPanelsDeployed
            />
            <OrbitControls target={[0, Math.max(3, centerY), 0]} minDistance={7} maxDistance={45} />
          </Canvas>

          {/* Floating quick specs badge on 3D canvas */}
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6, flexWrap: 'wrap', pointerEvents: 'none' }}>
            <span className="ob-badge" style={{ color: stats.launchTWR >= 1.15 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              TWR {stats.launchTWR.toFixed(2)}
            </span>
            <span className="ob-badge" style={{ color: 'var(--accent-cyan)' }}>
              Δv {Math.round(stats.totalDeltaV)} м/с
            </span>
            <span className="ob-badge">{stats.totalWetMass.toFixed(1)} т</span>
          </div>
        </div>

        {/* Desktop Right Inspector + Stats */}
        <div className="ob-panel ob-hide-mobile" style={{ borderRadius: 0, borderTop: 'none', borderRight: 'none', display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
          <div style={{ flex: '0 0 auto' }}>{statsContent}</div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', flex: 1 }}>{assemblyContent}</div>
        </div>

        {/* Mobile Tab Switcher + Active Drawer */}
        <div className="vab-mobile-tabs">
          <button
            className={`ob-btn ${mobileTab === 'catalog' ? 'ob-btn-primary' : ''}`}
            style={{ flex: 1, padding: '7px 6px', fontSize: 12 }}
            onClick={() => setMobileTab('catalog')}
          >
            + Детали
          </button>
          <button
            className={`ob-btn ${mobileTab === 'assembly' ? 'ob-btn-primary' : ''}`}
            style={{ flex: 1, padding: '7px 6px', fontSize: 12 }}
            onClick={() => setMobileTab('assembly')}
          >
            Состав ({parts.length})
          </button>
          <button
            className={`ob-btn ${mobileTab === 'stats' ? 'ob-btn-primary' : ''}`}
            style={{ flex: 1, padding: '7px 6px', fontSize: 12 }}
            onClick={() => setMobileTab('stats')}
          >
            Чертежи / Δv
          </button>
        </div>

        <div className="ob-only-mobile vab-drawer-pane" style={{ background: '#0b1221', flexDirection: 'column' }}>
          {mobileTab === 'catalog' && catalogContent}
          {mobileTab === 'assembly' && assemblyContent}
          {mobileTab === 'stats' && statsContent}
        </div>
      </div>
    </div>
  );
};
