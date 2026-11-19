import { useEffect, useRef } from 'react';
import { ControlInputs } from '@/game/physics/flightEngine';
import { useGameStore } from '@/stores/useGameStore';

export interface TouchInputState {
  pitch: number;
  yaw: number;
  roll: number;
  throttleDelta: number;
}

export const sharedTouchInputs: TouchInputState = {
  pitch: 0,
  yaw: 0,
  roll: 0,
  throttleDelta: 0,
};

interface FlightControlCallbacks {
  onStage: () => void;
  onToggleSas: () => void;
  onToggleParachute: () => void;
  onToggleLegs: () => void;
  onToggleSolar: () => void;
  onToggleMap: () => void;
  onCutThrottle: () => void;
  onFullThrottle: () => void;
}

export function useFlightControls(callbacks: FlightControlCallbacks) {
  const keysRef = useRef<Set<string>>(new Set());
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }

      if (!e.repeat) {
        if (code === 'Space') cbRef.current.onStage();
        else if (code === 'KeyT') cbRef.current.onToggleSas();
        else if (code === 'KeyP') cbRef.current.onToggleParachute();
        else if (code === 'KeyG') cbRef.current.onToggleLegs();
        else if (code === 'KeyL') cbRef.current.onToggleSolar();
        else if (code === 'KeyM') cbRef.current.onToggleMap();
        else if (code === 'KeyX') cbRef.current.onCutThrottle();
        else if (code === 'KeyZ') cbRef.current.onFullThrottle();
      }

      keysRef.current.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    const onBlur = () => {
      keysRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const readInputs = (): ControlInputs => {
    const keys = keysRef.current;
    const { invertPitch, sensitivity } = useGameStore.getState().controls;
    const pitchSign = invertPitch ? -1 : 1;

    let pitch = sharedTouchInputs.pitch;
    let yaw = sharedTouchInputs.yaw;
    let roll = sharedTouchInputs.roll;
    let throttleDelta = sharedTouchInputs.throttleDelta;

    if (keys.has('KeyW') || keys.has('ArrowUp')) pitch += 1 * pitchSign;
    if (keys.has('KeyS') || keys.has('ArrowDown')) pitch -= 1 * pitchSign;
    if (keys.has('KeyD') || keys.has('ArrowRight')) yaw += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) yaw -= 1;
    if (keys.has('KeyQ')) roll += 1;
    if (keys.has('KeyE')) roll -= 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttleDelta += 1;
    if (keys.has('ControlLeft') || keys.has('ControlRight')) throttleDelta -= 1;

    return {
      pitch: Math.max(-1, Math.min(1, pitch * sensitivity)),
      yaw: Math.max(-1, Math.min(1, yaw * sensitivity)),
      roll: Math.max(-1, Math.min(1, roll * sensitivity)),
      throttleDelta: Math.max(-1, Math.min(1, throttleDelta)),
    };
  };

  return { readInputs };
}
