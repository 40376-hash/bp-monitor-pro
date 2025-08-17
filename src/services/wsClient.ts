// src/services/wsClient.ts
import { useStreamStore } from "../state/streamStore";

export class WsClient {
  private ws?: WebSocket;
  constructor(private url: string) {}

  connect() {
    const { setConnected, setFrame } = useStreamStore.getState();
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => setConnected(true);
    this.ws.onclose = () => setConnected(false);
    this.ws.onerror = () => setConnected(false);

    this.ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        // ตรวจโครงสร้างแบบหยาบ ๆ
        if (Array.isArray(obj?.ppg) && typeof obj?.winLen === "number") {
          setFrame({
            fs: obj.fs ?? 62.5,
            winLen: obj.winLen,
            ppg: obj.ppg,
            hr: obj.hr,
            spo2: obj.spo2,
            signalQ: obj.signalQ,
            ts: obj.ts,
          });
        }
      } catch (_) {}
    };
  }

  disconnect() {
    this.ws?.close();
  }
}
