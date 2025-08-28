// src/lib/calibrator.ts
export type Feat = [number, number, number, number, number, number];

export class Calibrator {
  private collecting = false;
  private done = false;
  private buf: Feat[] = [];
  private startedAt = 0;
  private durationMs = 10_000; // เก็บ ~10 วินาที
  private mean: Feat | null = null;
  private std: Feat | null = null;

  constructor(durationSec = 10) {
    this.durationMs = durationSec * 1000;
    // ลองดึงค่าที่เคยคาลิเบรตไว้ก่อนหน้า (persistent)
    try {
      const saved = JSON.parse(localStorage.getItem("feat_norm_v1") || "null");
      if (saved?.mean?.length === 6 && saved?.std?.length === 6) {
        this.mean = saved.mean;
        this.std = saved.std;
        this.done = true;
      }
    } catch {}
  }

  /** เริ่มเก็บข้อมูล */
  start() {
    this.collecting = true;
    this.done = false;
    this.buf = [];
    this.startedAt = performance.now();
  }

  /** ป้อนฟีเจอร์เข้ามาเรื่อย ๆ ระหว่างคาลิเบรต */
  feed(feat: Feat) {
    if (!this.collecting) return;
    if (performance.now() - this.startedAt <= this.durationMs) {
      this.buf.push(feat);
    } else {
      this.finish();
    }
  }

  /** จบและคำนวณ mean/std */
  finish() {
    if (!this.collecting) return;
    this.collecting = false;
    if (this.buf.length < 5) return; // น้อยไปก็ไม่คำนวณ

    const n = this.buf.length;
    const sum = [0,0,0,0,0,0];
    const sum2= [0,0,0,0,0,0];
    for (const f of this.buf) {
      for (let i=0;i<6;i++) { sum[i]+=f[i]; sum2[i]+=f[i]*f[i]; }
    }
    const mean = sum.map(v => v/n) as Feat;
    const std  = sum2.map((v,i)=> {
      const m = mean[i]; const varr = Math.max(v/n - m*m, 1e-12);
      return Math.sqrt(varr);
    }) as Feat;

    this.mean = mean; this.std = std; this.done = true;
    try {
      localStorage.setItem("feat_norm_v1", JSON.stringify({mean, std}));
    } catch {}
  }

  /** แปลงฟีเจอร์ก่อนส่งเข้าโมเดล */
  apply(feat: Feat): Feat {
    if (!this.mean || !this.std) return feat;
    const out = [0,0,0,0,0,0] as Feat;
    for (let i=0;i<6;i++) out[i] = (feat[i]-this.mean[i]) / (this.std[i] || 1e-6);
    return out;
  }

  isCollecting(){ return this.collecting; }
  isReady(){ return this.done; }
  progress(): number {
    if (!this.collecting) return 0;
    return Math.min(1, (performance.now()-this.startedAt)/this.durationMs);
  }
  clear() {
    this.collecting = false; this.done = false;
    this.buf = []; this.mean = null; this.std = null;
    localStorage.removeItem("feat_norm_v1");
  }
}
