// src/lib/modelService.ts
import * as tf from "@tensorflow/tfjs";
import * as tflite from "@tensorflow/tfjs-tflite";

type PostProc = {
  mu_w?: number[]; std_w?: number[];
  mu_f?: number[]; std_f?: number[];
  smooth?: { alpha?: number };
};

export class BPModelService {
  private static inst: BPModelService | null = null;
  static get() { if (!this.inst) this.inst = new BPModelService(); return this.inst; }

  private model: tflite.TFLiteModel | null = null;
  private post: PostProc | null = null;
  private featDim = 18;            // ← ฟีเจอร์รวมทั้งหมดที่ป้อนเข้ากิ่ง features (แก้ให้ตรงของเธอ)
  private winLen = 80;             // ← ความยาวหน้าต่าง (80 จุด)
  private ready = false;

  async load(modelUrl: string, postUrl: string) {
    // โหลด post-processing (สถิติ normalize, smoothing params)
    try {
      const res = await fetch(postUrl);
      if (!res.ok) throw new Error("postproc not found");
      this.post = await res.json();
    } catch (e) {
      console.warn("No postproc file yet. Will run raw.", e);
      this.post = null;
    }

    // โหลดโมเดล TFLite
    this.model = await tflite.loadTFLiteModel(modelUrl);
    this.ready = true;
  }

  isReady() { return this.ready && !!this.model; }

  /** ทำ normalize ต่อหน้าต่าง */
  private norm(x: Float32Array, mu?: number[], std?: number[]) {
    if (!mu || !std) return x;
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const s = std[i] ?? 1e-8;
      out[i] = (x[i] - (mu[i] ?? 0)) / (s === 0 ? 1e-8 : s);
    }
    return out;
  }

  /** infer: รับ waveform(80) + features(featDim) → [SBP, DBP] mmHg */
  async predictOnce(ppg80: number[], feat: number[]): Promise<{ sbp: number; dbp: number }> {
    if (!this.model) throw new Error("model not ready");

    // ตรวจรูปทรงอินพุต
    if (ppg80.length !== this.winLen) throw new Error(`waveform must be ${this.winLen} points`);
    if (feat.length !== this.featDim) throw new Error(`feature length must be ${this.featDim}`);

    // แปลงเป็น Float32Array
    let w = new Float32Array(ppg80);
    let f = new Float32Array(feat);

    // normalize ต่อหน้าต่าง (ถ้ามีสถิติ)
    if (this.post?.mu_w && this.post?.std_w) w = this.norm(w, this.post.mu_w, this.post.std_w);
    if (this.post?.mu_f && this.post?.std_f) f = this.norm(f, this.post.mu_f, this.post.std_f);

    // ใส่มิติ batch/channel ให้ตรง TFLite: wave → [1,80,1], feat → [1,featDim]
    const waveInput = tf.tensor(w, [1, this.winLen, 1], "float32");
    const featInput = tf.tensor(f, [1, this.featDim], "float32");

    // เรียกโมเดล (โมเดล split-head จะคืน 2 เอาต์พุต: sbp_pred, dbp_pred)
    // ถ้าโมเดลของเธอคืนเป็น 1 เทนเซอร์ (2 ช่อง) ให้ปรับอ่านค่าให้ถูก
    const outputs = this.model.predict([waveInput, featInput]) as tf.Tensor[] | tf.Tensor;
    let sbp = 0, dbp = 0;

    if (Array.isArray(outputs) && outputs.length >= 2) {
      const sbp_t = outputs[0].dataSync()[0];
      const dbp_t = outputs[1].dataSync()[0];
      sbp = sbp_t; dbp = dbp_t;
    } else {
      // กรณีเอาต์พุตเดียวรูปร่าง [1,2]
      const arr = (outputs as tf.Tensor).dataSync();
      sbp = arr[0]; dbp = arr[1];
    }

    waveInput.dispose(); featInput.dispose();
    if (Array.isArray(outputs)) outputs.forEach(o => o.dispose()); else (outputs as tf.Tensor).dispose();

    // smoothing (ตัวเลือก)
    const alpha = this.post?.smooth?.alpha ?? 0;
    if (alpha > 0) {
      // ตรงนี้ไว้เผื่อ implement smoothing stateful ถ้าต้องการ (ตอนนี้คืนค่าดิบ)
    }

    return { sbp, dbp };
  }
}
