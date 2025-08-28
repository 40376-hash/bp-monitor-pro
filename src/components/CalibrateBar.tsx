// src/components/CalibrateBar.tsx
import { useEffect, useMemo, useState } from "react";
import { Calibrator } from "../lib/calibrator";
import { Check, Activity, Trash2 } from "lucide-react";

type Props = {
  calibrator: Calibrator;
  // ให้ parent เรียกใช้ feed() ได้จากท่อรับเฟรมเดิม
};

export default function CalibrateBar({ calibrator }: Props) {
  const [, tick] = useState(0);
  // รีเฟรช progress bar ลื่น ๆ ระหว่างเก็บ
  useEffect(() => {
    let raf: number;
    const loop = () => { tick(v=>v+1); raf = requestAnimationFrame(loop); };
    if (calibrator.isCollecting()) loop();
    return () => cancelAnimationFrame(raf);
  }, [calibrator.isCollecting()]);

  const progress = calibrator.progress();

  return (
    <div className="w-full rounded-2xl border border-gray-200/70 bg-white/70 backdrop-blur p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className={`h-5 w-5 ${calibrator.isCollecting() ? "animate-pulse text-blue-600" : "text-gray-500"}`} />
          <div className="font-medium">Calibrate now</div>
          {calibrator.isReady() && (
            <span className="ml-2 inline-flex items-center text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <Check className="h-4 w-4 mr-1" /> Ready
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!calibrator.isCollecting() ? (
            <button
              onClick={() => calibrator.start()}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Start (≈10s)
            </button>
          ) : (
            <button
              onClick={() => calibrator.finish()}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              Finish
            </button>
          )}

          <button
            onClick={() => { calibrator.clear(); tick(v=>v+1); }}
            className="px-3 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition inline-flex items-center gap-1"
            title="Clear calibration"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-[width] duration-200"
          style={{ width: `${Math.round(progress*100)}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-gray-500">
        กด <b>Start</b> แล้วถือสม่ำเสมอ ~10 วินาที จากนั้นกด <b>Finish</b>. ระบบจะจำค่านี้ไว้ในเบราว์เซอร์ให้อัตโนมัติ
      </p>
    </div>
  );
}
