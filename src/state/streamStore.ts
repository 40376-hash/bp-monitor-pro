// src/state/streamStore.ts
import { create } from "zustand";

export type PpgFrame = {
  fs: number;
  winLen: number;
  ppg: number[];
  hr?: number;
  spo2?: number;
  signalQ?: number;
  ts?: number;
};

type StreamState = {
  connected: boolean;
  lastFrame?: PpgFrame;
  sbp?: number;        // placeholder: รอโมเดลจริง
  dbp?: number;        // placeholder: รอโมเดลจริง
  setConnected: (v: boolean) => void;
  setFrame: (f: PpgFrame) => void;
  setBp: (sbp?: number, dbp?: number) => void;
};

export const useStreamStore = create<StreamState>((set) => ({
  connected: false,
  lastFrame: undefined,
  sbp: undefined,
  dbp: undefined,
  setConnected: (v) => set({ connected: v }),
  setFrame: (f) => set({ lastFrame: f }),
  setBp: (sbp, dbp) => set({ sbp, dbp }),
}));
