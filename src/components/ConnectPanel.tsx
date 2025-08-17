// src/components/ConnectPanel.tsx
import React, { useMemo, useState } from "react";
import { useStreamStore } from "../state/streamStore";
import { WsClient } from "../services/wsClient";

export default function ConnectPanel() {
  const connected = useStreamStore((s) => s.connected);
  const [ip, setIp] = useState("ws://192.168.4.1:81"); // เปลี่ยนเป็น IP ของ ESP32

  const client = useMemo(() => new WsClient(ip), [ip]);

  return (
    <div className="card">
      <h3>การเชื่อมต่อ (Wi-Fi WebSocket)</h3>
      <div className="row">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="ws://<ESP32-IP>:<PORT>"
          style={{ width: "100%" }}
        />
      </div>
      <div className="row">
        {!connected ? (
          <button onClick={() => client.connect()}>เชื่อมต่อ</button>
        ) : (
          <button onClick={() => client.disconnect()}>ตัดการเชื่อมต่อ</button>
        )}
        <span style={{ marginLeft: 8 }}>
          สถานะ: {connected ? "ออนไลน์ ✅" : "ออฟไลน์ ⛔️"}
        </span>
      </div>
    </div>
  );
}
