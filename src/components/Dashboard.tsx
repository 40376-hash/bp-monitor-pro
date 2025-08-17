// src/components/Dashboard.tsx
import React from "react";
import { useStreamStore } from "../state/streamStore";

export default function Dashboard() {
  const { lastFrame, sbp, dbp } = useStreamStore();

  return (
    <div className="card">
      <h3>ผลการวัด (เรียลไทม์)</h3>
      <div>HR: {lastFrame?.hr ?? "-"} bpm</div>
      <div>SpO₂: {lastFrame?.spo2 ?? "-"} %</div>
      <div>คุณภาพสัญญาณ: {Math.round((lastFrame?.signalQ ?? 0) * 100)} %</div>
      <hr />
      <div><b>BP (AI):</b> {sbp ? Math.round(sbp) : "-"} / {dbp ? Math.round(dbp) : "-"} mmHg</div>
      <small style={{opacity:0.7}}>
        *ตอนนี้ยังเป็นช่องว่าง รอโมเดล .tflite (.json) พร้อมใช้งาน
      </small>
    </div>
  );
}
