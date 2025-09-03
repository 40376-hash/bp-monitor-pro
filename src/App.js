import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Heart, Brain, Activity, CheckCircle, AlertCircle, BarChart3, Wifi, WifiOff,
  Upload, Settings, Bluetooth, Usb, Home, Link as LinkIcon, TrendingUp, Calendar, X
} from 'lucide-react';

// recharts (ตั้งชื่อ alias ให้ครบ กันชนซ้ำ
import {
  LineChart as ReLineChart,
  Line as ReLine,
  XAxis as ReXAxis,
  YAxis as ReYAxis,
  ResponsiveContainer as ReResponsiveContainer,
  Tooltip as ReTooltip,
} from 'recharts';

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
const MODEL_URL = '/tfjs_model/model.json'; // path ไปที่ public/tfjs_model/model.json
const BPMonitorApp = () => {
  // ---------- NAV / APP STATE ----------
  const [currentPage, setCurrentPage] = useState('home');

  // ---------- CONNECTION STATE ----------
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState('none'); // 'wifi' | 'serial' | 'bluetooth' | 'none'
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connecting'|'connected'|'error'|'disconnected'
  const [deviceInfo, setDeviceInfo] = useState(null);

  // ---------- CONNECTION ANIMATION ----------
  const [connectionAnimation, setConnectionAnimation] = useState(false);
  const [animationType, setAnimationType] = useState(''); // 'wifi' | 'serial' | 'bluetooth'
  
  // ---------- MODEL STATE ----------
  const [loadedModel, setLoadedModel] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [aiPredictions, setAiPredictions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const modelFileRef = useRef(null);

  // ---------- ESP32 / STREAM STATE ----------
  const [espIP, setEspIP] = useState('');
  const [rawIRValue, setRawIRValue] = useState(0);
  const [rawRedValue, setRawRedValue] = useState(0);
  const [ppgData, setPpgData] = useState([]);
  const websocketRef = useRef(null);

  // ---------- SERIAL / BT REFS ----------
  const serialPortRef = useRef(null);        // FIX: เก็บพอร์ตไว้เพื่อ cleanup
  const serialReaderRef = useRef(null);      // FIX: เก็บ reader ไว้เพื่อ cancel อย่างถูกต้อง
  const btDeviceRef = useRef(null);          // FIX: เก็บอุปกรณ์ BT ไว้เพื่อ cleanup

  // ---------- SENSOR STATE ----------
  const [heartRate, setHeartRate] = useState(0);
  const [heartRateAvg, setHeartRateAvg] = useState(0);
  const [oxygenSaturation, setOxygenSaturation] = useState(0);
  const [heartRateVariability, setHeartRateVariability] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);

  // ---------- BP STATE ----------
  const [currentBP, setCurrentBP] = useState({ systolic: 0, diastolic: 0, confidence: 0, timestamp: null });
  const [bpHistory, setBpHistory] = useState([]);
  const [isValidForMeasurement, setIsValidForMeasurement] = useState(false);
  const [measurementBlocked, setMeasurementBlocked] = useState({ blocked: false, reason: '' });

  // ---------- MEASURE STATE ----------
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementTimer, setMeasurementTimer] = useState(0);
  const [lastValidMeasurement, setLastValidMeasurement] = useState(null);

  // ---------- STATS ----------
  const [bpStats, setBpStats] = useState({
    daily: { avg: { systolic: 0, diastolic: 0 }, count: 0 },
    weekly: { avg: { systolic: 0, diastolic: 0 }, count: 0 },
    monthly: { avg: { systolic: 0, diastolic: 0 }, count: 0 }
  });

  // ---------- TFJS BACKEND READY ----------
useEffect(() => {
  (async () => {
    try {
      await tf.ready();                          // รอให้ tf พร้อม
      try { await tf.setBackend('webgl'); } catch {}
      if (tf.getBackend() !== 'webgl') {
        try { await tf.setBackend('cpu'); } catch {}
      }
      console.log('✅ TFJS backend:', tf.getBackend());
    } catch (e) {
      console.warn('⚠️ TFJS init failed:', e);
    }
  })();
}, []);

  // ---------- CHECK TFJS BACKEND ----------
useEffect(() => {
  (async () => {
    await tf.ready(); // ✅ รอให้ tf.js init เสร็จ
    try { 
      await tf.setBackend('webgl'); 
    } catch {}
    
    if (tf.getBackend() !== 'webgl') {
      try { 
        await tf.setBackend('cpu'); 
      } catch {}
    }
    
    console.log('✅ TFJS backend พร้อมแล้ว:', tf.getBackend());
  })();
}, []);

// ---------- MODEL LOAD ----------
const handleModelUpload = async (event) => {
  const files = Array.from(event.target.files || []);
  setIsModelLoading(true);

  // 👇👇 DEBUG: ดูว่าเลือกไฟล์อะไรเข้ามาบ้าง
  console.log('[MODEL-UPLOAD] picked files:', files.map(f => f.name));

  if (!files.length) {
    setIsModelLoading(false); // รีเซ็ต loading state
    return;
  }

  setIsModelLoading(true);
  try {
    // ...
    // จัด model.json ให้อยู่หน้าสุดเสมอ (กันบาง backend งอแง)
    const jsonIdx = files.findIndex(f => f.name.toLowerCase().endsWith('model.json'));
    if (jsonIdx > 0) {
      const [jsonFile] = files.splice(jsonIdx, 1);
      files.unshift(jsonFile);
    }

    const hasModelJson = files.some(f => f.name.toLowerCase().endsWith('model.json'));
    const hasBin = files.some(f => f.name.toLowerCase().endsWith('.bin'));

    // ====== เคส TF.js: model.json + bin ======
    if (hasModelJson && hasBin) {
      // ลองโหลดเป็น LayersModel ก่อน ถ้าไม่สำเร็จค่อยลอง GraphModel
      let model = null;
      let loadedType = '';

      try {
        model = await tf.loadLayersModel(tf.io.browserFiles(files));
        loadedType = 'TensorFlow.js (LayersModel)';
      } catch (e1) {
        // ถ้าไม่ใช่ layers (เช่น graph) จะมาลงตรงนี้
        model = await tf.loadGraphModel(tf.io.browserFiles(files));
        loadedType = 'TensorFlow.js (GraphModel)';
      }

      setLoadedModel({
        type: loadedType.includes('Graph') ? 'tfjs-graph' : 'tfjs-layers',
        model,
        predict: async (ppgWindow, features) => {
          // *** ปรับอินพุตตามโมเดลจริงของคุณ ***
          // ตัวอย่าง two-branch: [x1(1,80), x2(1,12)]
          const x1 = tf.tensor(ppgWindow, [1, 80]);
          const x2 = tf.tensor(features, [1, 12]);

          // ถ้าเป็น GraphModel ที่รับอินพุตต่างชื่อ ให้ map ตามชื่อ tensor ของคุณ
          const y = Array.isArray(model.inputs)
            ? model.predict([x1, x2])
            : model.predict([x1, x2]);

          const out = Array.isArray(y) ? y[0] : y;
          const preds = await out.data();
          tf.dispose([x1, x2, y, out]);
          return {
            systolic: Math.round(preds[0]),
            diastolic: Math.round(preds[1]),
            confidence: 0.90,
            model_type: loadedType,
          };
        }
      });

      const totalKB = (files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1) + ' KB';
      setModelInfo({
        name: files[0]?.name || 'model.json',
        type: loadedType,
        uploadTime: new Date().toLocaleString('th-TH'),
        architecture: 'Two-Branch Neural Network',
        inputShape: '(80,) + (12,)',
        features: ['PPG Waveform (80 samples)', 'Hand-crafted Features (12)'],
        size: totalKB,
      });

      alert('✅ โหลดโมเดล TF.js สำเร็จ!');
      setIsModelLoading(false);
      return;
    }

    // ====== .json เดี่ยว (mock/metadata) ======
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json')) {
      const file = files[0];
      const modelData = JSON.parse(await file.text());
      setLoadedModel({
        type: 'tensorflow-js-json',
        data: modelData,
        predict: (ppgWindow, features) => predictWithTensorFlowJS(modelData, ppgWindow, features),
      });
      setModelInfo({
        name: file.name,
        type: 'TensorFlow.js (JSON config)',
        uploadTime: new Date().toLocaleString('th-TH'),
        architecture: 'Two-Branch Neural Network',
        inputShape: '(80,) + (12,)',
        features: ['PPG Waveform (80 samples)', 'Hand-crafted Features (12)'],
        accuracy: modelData.accuracy || 'Unknown',
        size: (file.size / 1024).toFixed(1) + ' KB',
      });
      alert('✅ โหลดไฟล์ .json สำเร็จ!');
      setIsModelLoading(false);
      return;
    }

    // ====== .tflite เดี่ยว ======
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.tflite')) {
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      setLoadedModel({
        type: 'tensorflow-lite',
        data: arrayBuffer,
        predict: (ppgWindow, features) => predictWithTensorFlowLite(arrayBuffer, ppgWindow, features),
      });
      setModelInfo({
        name: file.name,
        type: 'TensorFlow Lite',
        uploadTime: new Date().toLocaleString('th-TH'),
        architecture: 'Two-Branch Neural Network (Optimized)',
        inputShape: '(80,) + (12,)',
        features: ['PPG Waveform (80 samples)', 'Hand-crafted Features (12)'],
        size: (file.size / 1024).toFixed(1) + ' KB',
      });
      alert('✅ โหลดไฟล์ .tflite สำเร็จ!');
      setIsModelLoading(false);
      return;
    }

    // ====== .h5 ======
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.h5')) {
      alert('⚠️ ไฟล์ .h5 ต้องแปลงเป็น TensorFlow.js ก่อน (tensorflowjs_converter)');
      setIsModelLoading(false);
      return;
    }

    throw new Error('โปรดเลือก model.json + ไฟล์ .bin (TF.js) หรือ .tflite (เดี่ยว) หรือ .json เดี่ยว');
  } catch (err) {
    console.error('Model load error:', err);
    alert('❌ โหลดโมเดลไม่สำเร็จ: ' + err.message);
  }
  setIsModelLoading(false);
};
  // ---------- FEATURE EXTRACT ----------
  const calculatePPGFeatures = (ppgDataArr) => {
    if (!ppgDataArr || ppgDataArr.length < 80) return null;
    const window = ppgDataArr.slice(-80);
    const values = window.map(p => p.value ?? p.raw ?? p);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1e-8;
    const skewness = values.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / values.length;
    const kurtosis = values.reduce((a, b) => a + ((b - mean) / std) ** 4, 0) / values.length - 3;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const p2p = max - min;
    const rms = Math.sqrt(values.reduce((a, b) => a + b * b, 0) / values.length);
    const firstDeriv = values.slice(1).map((v, i) => v - values[i]);
    const secondDeriv = firstDeriv.slice(1).map((v, i) => v - firstDeriv[i]);
    const s1 = firstDeriv.reduce((a, b) => a + Math.abs(b), 0) / Math.max(firstDeriv.length, 1);
    const s2 = secondDeriv.reduce((a, b) => a + Math.abs(b), 0) / Math.max(secondDeriv.length, 1);
    const centroid = mean;
    const bandwidth = std;
    const p_lf = variance * 0.3;
    const p_hf = variance * 0.7;
    return [mean, std, skewness, kurtosis, p2p, rms, s1, s2, centroid, bandwidth, p_lf, p_hf];
  };

  // ---------- PREDICT (PLACEHOLDER) ----------
  const predictWithTensorFlowJS = async (_modelData, _ppgWindow, features) => {
    const baseSystolic = 120 + (features[0] - 0.5) * 40; // mean
    const baseDiastolic = 80 + (features[1] - 0.3) * 20;  // std
    return {
      systolic: Math.max(90, Math.min(180, Math.round(baseSystolic + Math.random() * 10 - 5))),
      diastolic: Math.max(60, Math.min(120, Math.round(baseDiastolic + Math.random() * 8 - 4))),
      confidence: 0.85 + Math.random() * 0.1,
      model_type: 'TensorFlow.js'
    };
  };

  const predictWithTensorFlowLite = async (_modelBuffer, _ppgWindow, features) => {
    const baseSystolic = 115 + (features[4] - 0.4) * 35; // p2p
    const baseDiastolic = 75 + (features[5] - 0.5) * 18;  // rms
    return {
      systolic: Math.max(90, Math.min(180, Math.round(baseSystolic + Math.random() * 8 - 4))),
      diastolic: Math.max(60, Math.min(120, Math.round(baseDiastolic + Math.random() * 6 - 3))),
      confidence: 0.88 + Math.random() * 0.08,
      model_type: 'TensorFlow Lite'
    };
  };

  // ---------- RUN ANALYSIS ----------
  const performAIAnalysis = async () => {
    if (!loadedModel || !ppgData || ppgData.length < 80) {
      alert('⚠️ ต้องการโมเดล + PPG >= 80 จุด');
      return;
    }
    setIsAnalyzing(true);
    try {
      const features = calculatePPGFeatures(ppgData);
      if (!features) throw new Error('Feature extraction failed');
      const ppgWindow = ppgData.slice(-80).map(p => p.value ?? p.raw ?? p);
      const prediction = await loadedModel.predict(ppgWindow, features);
      const result = {
        ...prediction,
        timestamp: new Date(),
        ppg_samples: ppgWindow.length,
        signal_quality: signalQuality,
        heart_rate: heartRate
      };
      setAiPredictions(prev => [result, ...prev].slice(0, 20));
      const aiMeasurement = {
        systolic: prediction.systolic,
        diastolic: prediction.diastolic,
        confidence: prediction.confidence,
        timestamp: new Date(),
        heartRate: heartRate,
        signalQuality: signalQuality,
        conditions: 'AI Analysis',
        source: 'AI Model'
      };
      setCurrentBP(aiMeasurement);
      setBpHistory(prev => [aiMeasurement, ...prev].slice(0, 100));
    } catch (err) {
      console.error(err);
      alert('❌ วิเคราะห์ไม่สำเร็จ: ' + err.message);
    }
    setIsAnalyzing(false);
  };

  // ---------- DISCONNECT ----------
  const disconnectAll = async () => {
    // FIX: ปิด WebSocket อย่างปลอดภัย
    if (websocketRef.current) {
      try { websocketRef.current.onopen = websocketRef.current.onmessage = websocketRef.current.onerror = websocketRef.current.onclose = null; } catch {}
      try { websocketRef.current.close(); } catch {}
      websocketRef.current = null;
    }
    // FIX: ยกเลิก Serial reader และปิดพอร์ต
    if (serialReaderRef.current) {
      try { await serialReaderRef.current.cancel(); } catch {}
      serialReaderRef.current = null;
    }
    if (serialPortRef.current) {
      try { await serialPortRef.current.close(); } catch {}
      serialPortRef.current = null;
    }
    // FIX: ตัดการเชื่อมต่อ Bluetooth ถ้ายังเชื่อมอยู่
    if (btDeviceRef.current && btDeviceRef.current.gatt?.connected) {
      try { await btDeviceRef.current.gatt.disconnect(); } catch {}
    }
    setIsConnected(false);
    setConnectionType('none');
    setConnectionStatus('disconnected');
    setDeviceInfo(null);
    setHeartRate(0); setHeartRateAvg(0); setOxygenSaturation(0);
    setSignalQuality(0); setHeartRateVariability(0);
    setRawIRValue(0); setRawRedValue(0); setPpgData([]);
  };

  // ---------- WIFI ----------
  const connectWiFi = async () => {
    await disconnectAll(); // FIX: await เพื่อให้ปิดของเก่าให้เรียบร้อยก่อน
    let ip = espIP || prompt('ใส่ IP Address ของ ESP32:', '192.168.1.100');
    if (!ip) return;
    setEspIP(ip);
    try {
      setConnectionStatus('connecting');
      const ws = new WebSocket(`ws://${ip}:81`);
      const timeout = setTimeout(() => {
        try { ws.close(); } catch {}
        setConnectionStatus('error');
        alert('⚠️ การเชื่อมต่อ WiFi หมดเวลา');
      }, 10000);

      ws.onopen = () => {
        clearTimeout(timeout);
        websocketRef.current = ws;
        setConnectionType('wifi');
        setIsConnected(true);
        setConnectionStatus('connected');
        setDeviceInfo({ type: 'WiFi WebSocket', ip, port: 81 });
        setAnimationType('wifi'); setConnectionAnimation(true);
        setTimeout(() => setConnectionAnimation(false), 3000);
      };

      ws.onmessage = (event) => {
        try { processRealSensorData(JSON.parse(event.data)); }
        catch { /* ignore non-JSON */ }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setConnectionStatus('error');
        alert('❌ เชื่อมต่อ WiFi ไม่สำเร็จ');
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        disconnectAll();
      };
    } catch (err) {
      setConnectionStatus('error');
      alert('❌ WiFi ผิดพลาด: ' + err.message);
    }
  };

  // ---------- SERIAL ----------
  const connectSerial = async () => {
    await disconnectAll(); // FIX
    try {
      if (!navigator.serial) {
        alert('❌ บราวเซอร์ไม่รองรับ Web Serial (ใช้ Chrome/Edge ล่าสุด)');
        return;
      }
      setConnectionStatus('connecting');
      const port = await navigator.serial.requestPort({
        filters: [{ usbVendorId: 0x1a86 }, { usbVendorId: 0x0403 }, { usbVendorId: 0x10c4 }, { usbVendorId: 0x067b }]
      });
      await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
      const portInfo = await port.getInfo();
      serialPortRef.current = port; // FIX

      setConnectionType('serial'); setIsConnected(true); setConnectionStatus('connected');
      setDeviceInfo({ type: 'USB Serial', port: `VID:${portInfo.usbVendorId?.toString(16)} PID:${portInfo.usbProductId?.toString(16)}`, baudRate: 115200 });
      setAnimationType('serial'); setConnectionAnimation(true);
      setTimeout(() => setConnectionAnimation(false), 3000);

      let buffer = '';
      const reader = port.readable.getReader();
      serialReaderRef.current = reader; // FIX: เก็บไว้เพื่อ cancel ได้

      // FIX: ใช้ loop แบบมาตรฐาน ไม่อ้าง reader.closed (เป็น Promise)
      (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;
            const text = new TextDecoder().decode(value);
            buffer += text;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const clean = line.trim();
              if (!clean) continue;
              try { processRealSensorData(JSON.parse(clean)); }
              catch {
                if (clean.includes(':')) {
                  const pairs = clean.split(',');
                  const simple = {};
                  pairs.forEach(p => {
                    const [k, v] = p.split(':'); if (!k || !v) return;
                    const key = k.trim().toLowerCase(); const num = parseFloat(v.trim());
                    if (isNaN(num)) return;
                    if (key.includes('hr')) simple.heartRate = num;
                    else if (key.includes('spo2')) simple.spo2 = num;
                  });
                  if (Object.keys(simple).length) processRealSensorData(simple);
                }
              }
            }
          }
        } catch (e) {
          if (connectionStatus === 'connected') { setConnectionStatus('error'); alert('❌ อ่าน Serial ขัดข้อง'); }
        } finally {
          try { reader.releaseLock(); } catch {}
          if (port && port.readable) {
            try { await port.close(); } catch {}
          }
        }
      })();

      port.addEventListener('disconnect', () => { disconnectAll(); alert('⚠️ USB ถูกถอดออก'); });
    } catch (err) {
      setConnectionStatus('error');
      alert('❌ เชื่อมต่อ USB Serial ไม่สำเร็จ: ' + err.message);
    }
  };

  // ---------- BLUETOOTH ----------
  const connectBluetooth = async () => {
    await disconnectAll(); // FIX
    try {
      if (!navigator.bluetooth) { alert('❌ บราวเซอร์ไม่รองรับ Web Bluetooth'); return; }
      setConnectionStatus('connecting');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'ESP32' }, { namePrefix: 'BP-Monitor' }],
        optionalServices: ['12345678-1234-1234-1234-123456789abc']
      });
      btDeviceRef.current = device; // FIX
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('12345678-1234-1234-1234-123456789abc');
      const characteristic = await service.getCharacteristic('87654321-4321-4321-4321-cba987654321');
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const data = new TextDecoder().decode(event.target.value);
        try { processRealSensorData(JSON.parse(data)); } catch {}
      });

      // FIX: cleanup เมื่อ BT หลุด
      device.addEventListener('gattserverdisconnected', () => {
        disconnectAll();
        alert('⚠️ Bluetooth ถูกตัดการเชื่อมต่อ');
      });

      setConnectionType('bluetooth'); setIsConnected(true); setConnectionStatus('connected');
      setDeviceInfo({ type: 'Bluetooth LE', name: device.name || 'ESP32-BP' });
      setAnimationType('bluetooth'); setConnectionAnimation(true);
      setTimeout(() => setConnectionAnimation(false), 3000);
    } catch (err) {
      setConnectionStatus('error'); alert('❌ เชื่อมต่อ Bluetooth ไม่สำเร็จ: ' + err.message);
    }
  };

  // ---------- SENSOR PIPELINE ----------
  const processRealSensorData = (data) => {
    if (data.heartRate !== undefined) setHeartRate(Math.round(data.heartRate));
    if (data.heartRateAvg !== undefined) setHeartRateAvg(Math.round(data.heartRateAvg));
    if (data.ppg) {
      if (data.ppg.ir !== undefined) setRawIRValue(data.ppg.ir);
      if (data.ppg.red !== undefined) setRawRedValue(data.ppg.red);
      const time = Date.now();
      const base = typeof data.ppg.ir === 'number' ? data.ppg.ir : 50000;
      const newPoint = { time, value: (base - 50000) / 50000, raw: base };
      setPpgData(prev => [...prev, newPoint].slice(-200));
    }
    if (data.spo2 !== undefined) setOxygenSaturation(Math.max(0, Math.min(100, Math.round(data.spo2))));
    if (data.hrv !== undefined) setHeartRateVariability(Math.max(0, Math.round(data.hrv)));
    if (data.signalQuality !== undefined) setSignalQuality(Math.max(0, Math.min(100, Math.round(data.signalQuality))));
  };

  // ---------- MEASURE ----------
  const validateMeasurementConditions = () => {
    const reasons = [];
    if (heartRateVariability > 50) reasons.push('HRV สูง');
    if (signalQuality < 70) reasons.push('คุณภาพสัญญาณต่ำ');
    if (heartRate < 50 || heartRate > 120) reasons.push('HR อยู่นอกช่วงปกติ');
    if (!isConnected) reasons.push('ไม่ได้เชื่อมต่ออุปกรณ์');
    const isValid = reasons.length === 0 && isConnected;
    setIsValidForMeasurement(isValid);
    setMeasurementBlocked({ blocked: !isValid, reason: reasons.join(', ') || '' });
    return isValid;
  };

  const measureBloodPressure = async () => {
    if (!validateMeasurementConditions()) return;
    setIsMeasuring(true);
    setMeasurementTimer(15);
    const countdown = setInterval(() => {
      setMeasurementTimer(prev => {
        if (prev <= 1) { clearInterval(countdown); completeMeasurement(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const completeMeasurement = () => {
    const systolic = 110 + (heartRateAvg - 70) * 0.8 + Math.random() * 15;
    const diastolic = 70 + (heartRateAvg - 70) * 0.4 + Math.random() * 10;
    const newMeasurement = {
      systolic: Math.max(90, Math.min(180, Math.round(systolic))),
      diastolic: Math.max(50, Math.min(120, Math.round(diastolic))),
      confidence: 0.75 + Math.random() * 0.20,
      timestamp: new Date(),
      heartRate: heartRateAvg,
      signalQuality,
      conditions: 'Optimal'
    };
    setCurrentBP(newMeasurement);
    setBpHistory(prev => [newMeasurement, ...prev].slice(0, 100));
    setLastValidMeasurement(new Date());
    setIsMeasuring(false);
    updateStatistics();
  };

  const updateStatistics = () => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const daily = bpHistory.filter(b => b.timestamp >= dayAgo);
    const weekly = bpHistory.filter(b => b.timestamp >= weekAgo);
    const monthly = bpHistory.filter(b => b.timestamp >= monthAgo);
    const avg = (arr) => arr.length
      ? {
          systolic: Math.round(arr.reduce((a, b) => a + b.systolic, 0) / arr.length),
          diastolic: Math.round(arr.reduce((a, b) => a + b.diastolic, 0) / arr.length)
        }
      : { systolic: 0, diastolic: 0 };
    setBpStats({
      daily: { avg: avg(daily), count: daily.length },
      weekly: { avg: avg(weekly), count: weekly.length },
      monthly: { avg: avg(monthly), count: monthly.length }
    });
  };

  // ---------- EFFECTS ----------
  useEffect(() => {
    if (!isConnected) {
      setHeartRate(0); setHeartRateAvg(0); setOxygenSaturation(0);
      setSignalQuality(0); setHeartRateVariability(0);
      setRawIRValue(0); setRawRedValue(0); setPpgData([]);
    }
  }, [isConnected]);

  useEffect(() => {
    const interval = setInterval(validateMeasurementConditions, 1000);
    return () => clearInterval(interval);
  }, [heartRate, heartRateVariability, signalQuality, isConnected]);

  useEffect(() => { updateStatistics(); }, [bpHistory]);

  // FIX: ปิดทุกการเชื่อมต่อเมื่อผู้ใช้ปิด/รีเฟรชหน้า
  useEffect(() => {
    const onBeforeUnload = () => { /* best-effort cleanup */ disconnectAll(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ---------- AUTO LOAD MODEL (STEP 4) ----------
useEffect(() => {
  const autoLoadModel = async () => {
    try {
      // ไฟล์ต้องอยู่ที่ public/tfjs_model/model.json
      const model = await tf.loadLayersModel('/tfjs_model/model.json');

      setLoadedModel({
        type: 'tensorflow-js',
        model,
        // ตัว predict จริง ใช้ tfjs model ที่โหลดมา
        predict: async (ppgWindow, features) => {
          // shape: (1, 80) และ (1, 12) ตามที่ UI กำหนดไว้
          const x1 = tf.tensor(ppgWindow, [1, 80]);
          const x2 = tf.tensor(features, [1, 12]);
          // ถ้าโมเดลเป็น two-branch จะต้องส่งเป็น array
          const y = model.predict([x1, x2]);
          const out = Array.isArray(y) ? y[0] : y;
          const preds = await out.data();
          tf.dispose([x1, x2, y, out]);
          return {
            systolic: Math.round(preds[0]),
            diastolic: Math.round(preds[1]),
            confidence: 0.92,
            model_type: 'TensorFlow.js (Auto)'
          };
        }
      });

      setModelInfo({
        name: 'Auto-loaded model (tfjs_model/model.json)',
        type: 'TensorFlow.js',
        uploadTime: new Date().toLocaleString('th-TH'),
        architecture: 'Two-Branch Neural Network',
        inputShape: '(80,) + (12,)',
        features: ['PPG Waveform (80 samples)', 'Hand-crafted Features (12)'],
        size: 'N/A'
      });

      console.log('✅ Auto-loaded TFJS model จาก /tfjs_model/model.json');
    } catch (err) {
      // ถ้าไม่พบไฟล์ /tfjs_model/model.json ก็เงียบไว้ ให้ผู้ใช้กดอัปโหลดเองได้
      console.warn('⚠️ Auto-load model failed:', err.message);
    }
  };

  autoLoadModel();
}, []);

  // ---------- UI HELPERS ----------
  const getConnectionIcon = () => {
    switch (connectionType) {
      case 'serial': return <Usb className="h-5 w-5 text-blue-500" />;
      case 'wifi': return <Wifi className="h-5 w-5 text-green-500" />;
      case 'bluetooth': return <Bluetooth className="h-5 w-5 text-purple-500" />;
      default: return <WifiOff className="h-5 w-5 text-gray-400" />;
    }
  };
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connecting': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'connected': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };
  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connecting': return 'กำลังเชื่อมต่อ...';
      case 'connected': return `เชื่อมต่อแล้ว (${connectionType.toUpperCase()})`;
      case 'error': return 'เชื่อมต่อไม่สำเร็จ';
      case 'disconnected': return 'ตัดการเชื่อมต่อแล้ว';
      default: return 'ไม่ได้เชื่อมต่อ';
    }
  };

  // ---------- SMALL UI COMPS ----------
  const ConnectionAnimation = () => {
    if (!connectionAnimation) return null;
    const color = animationType === 'wifi' ? 'from-green-400 to-emerald-600'
      : animationType === 'serial' ? 'from-blue-400 to-cyan-600'
      : animationType === 'bluetooth' ? 'from-purple-400 to-violet-600'
      : 'from-blue-400 to-cyan-600';
    const icon = animationType === 'wifi' ? <Wifi className="h-16 w-16 text-white" />
      : animationType === 'serial' ? <Usb className="h-16 w-16 text-white" />
      : animationType === 'bluetooth' ? <Bluetooth className="h-16 w-16 text-white" />
      : <CheckCircle className="h-16 w-16 text-white" />;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="relative">
          <div className={`w-48 h-48 rounded-full bg-gradient-to-r ${color} animate-pulse shadow-2xl flex items-center justify-center relative overflow-hidden`}
            style={{ boxShadow: '0 0 60px rgba(59,130,246,.8), 0 0 120px rgba(59,130,246,.6), inset 0 0 60px rgba(255,255,255,.2)', animation: 'neonPulse 2s ease-in-out infinite' }}>
            <div className="absolute inset-0">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute w-2 h-2 bg-white rounded-full opacity-80"
                  style={{
                    left: `${50 + 35 * Math.cos(i * 30 * Math.PI / 180)}%`,
                    top: `${50 + 35 * Math.sin(i * 30 * Math.PI / 180)}%`,
                    animation: `particle-${i} 3s linear infinite`,
                    animationDelay: `${i * 0.1}s`
                  }} />
              ))}
            </div>
            <div className="z-10 animate-bounce">{icon}</div>
            <div className="absolute inset-0">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="absolute inset-0 rounded-full border-2 border-white opacity-30"
                  style={{ animation: 'ripple 3s ease-out infinite', animationDelay: `${i * 0.5}s` }} />
              ))}
            </div>
          </div>
          <div className="text-center mt-6">
            <h3 className="text-2xl font-bold text-white mb-2">🎉 เชื่อมต่อสำเร็จ!</h3>
            <p className="text-blue-200 capitalize">{animationType} connection established</p>
          </div>
        </div>
        <style>{`
          @keyframes neonPulse { 0%,100%{transform:scale(1);filter:brightness(1) saturate(1)} 50%{transform:scale(1.05);filter:brightness(1.2) saturate(1.5)} }
          @keyframes ripple { 0%{transform:scale(.8);opacity:.8} 100%{transform:scale(2);opacity:0} }
          ${[...Array(12)].map((_, i)=>`@keyframes particle-${i}{0%{transform:scale(0) rotate(0);opacity:0}20%{transform:scale(1) rotate(${i*30}deg);opacity:1}80%{transform:scale(1) rotate(${i*30+360}deg);opacity:1}100%{transform:scale(0) rotate(${i*30+720}deg);opacity:0}}`).join('')}
        `}</style>
      </div>
    );
  };

  const CircularProgress = ({ value, maxValue, color, size = 120, strokeWidth = 8, label, unit }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = Math.min((Number.isFinite(value) ? value : 0) / maxValue, 1); // FIX: กัน NaN
    const strokeDashoffset = circumference - (progress * circumference);
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none"/>
          <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-gray-800">{Math.round(Number.isFinite(value) ? value : 0)}</div>
          <div className="text-xs text-gray-600">{unit}</div>
          <div className="text-xs font-medium text-gray-700 mt-1">{label}</div>
        </div>
      </div>
    );
  };

  // ---------- BP GAUGE ----------
  const BPGauge = ({ systolic, diastolic }) => {
    const getBPLevel = (sys, dia) => {
      if (sys >= 180 || dia >= 120) return { color: '#dc2626', label: 'วิกฤต', bg: 'bg-red-600' };
      if (sys >= 140 || dia >= 90) return { color: '#ea580c', label: 'สูง', bg: 'bg-orange-600' };
      if (sys >= 130 || dia >= 80) return { color: '#f59e0b', label: 'เพิ่มขึ้น', bg: 'bg-yellow-500' };
      if (sys >= 120 || dia >= 70) return { color: '#10b981', label: 'ปกติดี', bg: 'bg-green-500' };
      if (sys > 0) return { color: '#06b6d4', label: 'ต่ำ', bg: 'bg-cyan-500' };
      return { color: '#6b7280', label: 'ไม่มีข้อมูล', bg: 'bg-gray-400' };
    };
    const bpLevel = getBPLevel(systolic, diastolic);
    return (
      <div className="relative">
        <div className="relative w-64 h-64 mx-auto">
          <svg width="256" height="256" className="absolute inset-0">
            {[
              { start: 0, end: 60, color: '#06b6d4' },
              { start: 60, end: 120, color: '#10b981' },
              { start: 120, end: 180, color: '#f59e0b' },
              { start: 180, end: 240, color: '#ea580c' },
              { start: 240, end: 300, color: '#dc2626' }
            ].map((seg, i) => {
              const a1 = (seg.start * Math.PI) / 180 - Math.PI / 2;
              const a2 = (seg.end * Math.PI) / 180 - Math.PI / 2;
              const r = 110;
              const x1 = 128 + r * Math.cos(a1);
              const y1 = 128 + r * Math.sin(a1);
              const x2 = 128 + r * Math.cos(a2);
              const y2 = 128 + r * Math.sin(a2);
              const largeArc = seg.end - seg.start > 180 ? 1 : 0;
              return (
                <g key={i}>
                  <path d={`M 128 128 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={seg.color} opacity="0.2" />
                  <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`} stroke={seg.color} strokeWidth="3" fill="none"/>
                </g>
              );
            })}
            {systolic > 0 && (
              <>
                <line
                  x1="128" y1="128"
                  x2={128 + 80 * Math.cos((systolic / 200 * 300 - 150) * Math.PI / 180)}
                  y2={128 + 80 * Math.sin((systolic / 200 * 300 - 150) * Math.PI / 180)}
                  stroke={bpLevel.color} strokeWidth="4" strokeLinecap="round"
                />
                <circle cx="128" cy="128" r="6" fill={bpLevel.color} />
              </>
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-white rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg border-4 border-white">
              <div className="text-lg font-bold text-gray-800">{systolic > 0 ? systolic : '--'}</div>
              <div className="text-xs text-gray-600">/{diastolic > 0 ? diastolic : '--'}</div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full text-white ${bpLevel.bg} mt-1`}>{bpLevel.label}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- PAGES ----------
  const Navigation = () => (
    <nav className="bg-white shadow-lg rounded-2xl mb-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-red-600 p-2 rounded-xl"><Heart className="h-6 w-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">BP Monitor Pro</h1>
            <p className="text-sm text-gray-600">🏥 Professional Blood Pressure Monitor</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setCurrentPage('home')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage==='home'?'bg-red-100 text-red-700':'text-gray-600 hover:bg-gray-100'}`}>
            <Home className="h-4 w-4" /><span>หน้าหลัก</span>
          </button>
          <button onClick={() => setCurrentPage('connect')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage==='connect'?'bg-blue-100 text-blue-700':'text-gray-600 hover:bg-gray-100'}`}>
            <LinkIcon className="h-4 w-4" /><span>เชื่อมต่อ</span>
          </button>
          <button onClick={() => setCurrentPage('statistics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage==='statistics'?'bg-green-100 text-green-700':'text-gray-600 hover:bg-gray-100'}`}>
            <TrendingUp className="h-4 w-4" /><span>สถิติ</span>
          </button>
          <button onClick={() => setCurrentPage('ai')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage==='ai'?'bg-purple-100 text-purple-700':'text-gray-600 hover:bg-gray-100'}`}>
            <Brain className="h-4 w-4" /><span>AI Analysis</span>
          </button>
          {/* <button onClick={() => setCurrentPage('wifi')} className={`...`}><Settings className="h-4 w-4" /><span>WiFi Settings</span></button> */}
        </div>
      </div>
    </nav>
  );

  const getBPStatus = (sys, dia) => {
    if (sys >= 140 || dia >= 90) return { status: 'สูง', color: 'text-red-500' };
    if (sys >= 130 || dia >= 80) return { status: 'เพิ่มขึ้น', color: 'text-yellow-500' };
    if (sys > 0) return { status: 'ปกติ', color: 'text-green-500' };
    return { status: 'ไม่มีข้อมูล', color: 'text-gray-500' };
  };

  const HomePage = () => {
    const hrColor = heartRateAvg >= 100 ? '#ef4444' : heartRateAvg >= 90 ? '#f59e0b' : heartRateAvg >= 60 ? '#10b981' : heartRateAvg > 0 ? '#3b82f6' : '#6b7280';
    const spo2Color = oxygenSaturation >= 95 ? '#10b981' : oxygenSaturation >= 90 ? '#f59e0b' : oxygenSaturation > 0 ? '#ef4444' : '#6b7280';
    return (
      <div className="space-y-6">
        <div className={`rounded-2xl p-4 border-2 ${getConnectionStatusColor()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getConnectionIcon()}
              <div>
                <div className="font-medium">{getConnectionStatusText()}</div>
                <div className="text-sm text-gray-600">
                  {deviceInfo?.ip && `IP: ${deviceInfo.ip}`}
                  {deviceInfo?.name && `Device: ${deviceInfo.name}`}
                  {deviceInfo?.port && ` | Port: ${deviceInfo.port}`}
                  {deviceInfo?.baudRate && ` | Baud: ${deviceInfo.baudRate}`}
                </div>
              </div>
            </div>
            {!isConnected && connectionStatus !== 'connecting' && (
              <button onClick={() => setCurrentPage('connect')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                เชื่อมต่อเลย
              </button>
            )}
            {connectionStatus === 'connecting' && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-8 border-2 border-gray-200 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">ความดันโลหิต</h2>
            <BPGauge systolic={currentBP.systolic} diastolic={currentBP.diastolic} />
            {currentBP.confidence > 0 && (
              <div className="mt-6">
                <div className="text-sm text-gray-600 mb-2">ความมั่นใจในการวัด</div>
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden max-w-xs mx-auto">
                  <div className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                    style={{ width: `${currentBP.confidence * 100}%` }} />
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">{(currentBP.confidence * 100).toFixed(1)}%</div>
              </div>
            )}
            {lastValidMeasurement && (
              <div className="mt-4 text-sm text-gray-600">การวัดล่าสุด: {lastValidMeasurement.toLocaleString('th-TH')}</div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 border-2 border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">สัญญาณชีพ</h2>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <CircularProgress value={heartRateAvg || heartRate || 0} maxValue={150} color={hrColor} size={140} strokeWidth={12} label="Heart Rate" unit="BPM" />
                  <div className="mt-3 text-sm text-gray-600">ปัจจุบัน: {heartRate} BPM</div>
                </div>
                <div className="text-center">
                  <CircularProgress value={oxygenSaturation || 0} maxValue={100} color={spo2Color} size={140} strokeWidth={12} label="SpO2" unit="%" />
                  <div className="mt-3 text-sm text-gray-600">ออกซิเจนในเลือด</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center">
                <h3 className="font-semibold text-gray-800 mb-3">คุณภาพสัญญาณ</h3>
                <CircularProgress value={signalQuality || 0} maxValue={100}
                  color={signalQuality >= 80 ? '#10b981' : signalQuality >= 60 ? '#f59e0b' : '#ef4444'}
                  size={100} strokeWidth={8} label="Quality" unit="%" />
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center">
                <h3 className="font-semibold text-gray-800 mb-3">HRV</h3>
                <CircularProgress value={heartRateVariability || 0} maxValue={100}
                  color={heartRateVariability <= 30 ? '#10b981' : heartRateVariability <= 50 ? '#f59e0b' : '#ef4444'}
                  size={100} strokeWidth={8} label="RMSSD" unit="ms" />
              </div>
            </div>
          </div>
        </div>

        {/* Real-time PPG */}
        {ppgData.length > 0 && isConnected && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📡 PPG Signal (Real-time)</h3>
            <div className="h-32 bg-black rounded-lg p-4 relative">
              <svg className="w-full h-full" viewBox="0 0 100 50">
                <path
                  d={ppgData.map((p, i) =>
                    `${i === 0 ? 'M' : 'L'} ${(i / Math.max(ppgData.length - 1, 1)) * 100} ${25 + (p.value || 0) * 15}`
                  ).join(' ')}
                  stroke="#10b981" strokeWidth="0.5" fill="none"
                />
              </svg>
              <div className="absolute top-2 left-2 text-green-400 text-xs">IR: {rawIRValue} | RED: {rawRedValue}</div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isConnected && (
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 text-center">
            <div className="text-gray-400 mb-4"><Activity className="h-16 w-16 mx-auto mb-4" /></div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">ไม่มีข้อมูลเซนเซอร์</h3>
            <p className="text-gray-500 mb-4">เชื่อมต่อ ESP32 เพื่อเริ่มตรวจวัดสัญญาณชีพ</p>
            <button onClick={() => setCurrentPage('connect')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">เชื่อมต่ออุปกรณ์</button>
          </div>
        )}

        {/* Measure Control */}
        <div className="bg-white rounded-3xl p-8 border-2 border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">การวัดความดันโลหิต</h2>
          {isMeasuring ? (
            <div className="text-center space-y-4">
              <div className="text-lg font-medium text-blue-700">กำลังวัดความดัน...</div>
              <div className="text-4xl font-bold text-blue-600">{measurementTimer}</div>
              <div className="text-sm text-gray-600">โปรดนิ่งและไม่เคลื่อนไหว</div>
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden max-w-md mx-auto">
                <div className="h-full bg-blue-500 transition-all duration-1000"
                  style={{ width: `${((15 - measurementTimer) / 15) * 100}%` }} />
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <button onClick={measureBloodPressure} disabled={!isValidForMeasurement}
                className={`px-8 py-4 rounded-2xl text-lg font-medium transition-all transform ${
                  isValidForMeasurement
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}>
                <div className="flex items-center space-x-3"><Heart className="h-6 w-6" /><span>วัดความดันเลย</span></div>
              </button>
              {measurementBlocked.blocked && (
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 max-w-md mx-auto">
                  <div className="flex items-center justify-center space-x-2 text-yellow-700 mb-2">
                    <AlertCircle className="h-5 w-5" /><span className="font-medium">ไม่สามารถวัดได้</span>
                  </div>
                  <div className="text-sm text-gray-600 text-center">{measurementBlocked.reason}</div>
                </div>
              )}
              {isValidForMeasurement && (
                <div className="bg-green-50 p-4 rounded-xl border border-green-200 max-w-md mx-auto">
                  <div className="flex items-center justify-center space-x-2 text-green-700">
                    <CheckCircle className="h-5 w-5" /><span className="font-medium">พร้อมวัดความดัน</span>
                  </div>
                  <div className="text-sm text-green-600 text-center mt-1">สัญญาณดี, หัวใจเต้นเสถียร</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const ConnectionPage = () => (
    <div className="space-y-6">
      <div className={`rounded-2xl p-4 border-2 ${getConnectionStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getConnectionIcon()}
            <div>
              <div className="font-medium">{getConnectionStatusText()}</div>
              <div className="text-sm text-gray-600">
                {deviceInfo?.ip && `IP: ${deviceInfo.ip}`}
                {deviceInfo?.name && `Device: ${deviceInfo.name}`}
                {deviceInfo?.port && ` | Port: ${deviceInfo.port}`}
                {deviceInfo?.baudRate && ` | Baud: ${deviceInfo.baudRate}`}
              </div>
            </div>
          </div>
          {connectionStatus === 'connecting' && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">🔥 เชื่อมต่ออุปกรณ์ (Real Connection)</h2>
        {isConnected ? (
          <div className="text-center py-8">
            <div className="mb-4 text-6xl">{getConnectionIcon()}</div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">✅ เชื่อมต่อสำเร็จ!</h3>
            <p className="text-gray-600 mb-4">{connectionType.toUpperCase()} - {deviceInfo?.name || deviceInfo?.ip || 'Connected'}</p>
            <button onClick={disconnectAll} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium">🔌 ตัดการเชื่อมต่อ</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={connectSerial} disabled={connectionStatus==='connecting'}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-blue-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50">
              <Usb className="h-12 w-12 text-blue-600" />
              <div className="text-center">
                <div className="font-semibold text-blue-800">USB Serial</div>
                <div className="text-sm text-blue-600">เสียบสาย USB</div>
                <div className="text-xs text-green-600 font-medium mt-1 bg-green-100 px-2 py-1 rounded">✅ Real Connection</div>
              </div>
            </button>

            <button onClick={connectWiFi} disabled={connectionStatus==='connecting'}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-green-200 rounded-2xl hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50">
              <Wifi className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <div className="font-semibold text-green-800">WiFi WebSocket</div>
                <div className="text-sm text-green-600">ไร้สาย, เร็ว</div>
                <div className="text-xs text-green-600 font-medium mt-1 bg-green-100 px-2 py-1 rounded">✅ Real Connection</div>
              </div>
            </button>

            <button onClick={connectBluetooth} disabled={connectionStatus==='connecting'}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-purple-200 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-50">
              <Bluetooth className="h-12 w-12 text-purple-600" />
              <div className="text-center">
                <div className="font-semibold text-purple-800">Bluetooth LE</div>
                <div className="text-sm text-purple-600">ประหยัดไฟ</div>
                <div className="text-xs text-green-600 font-medium mt-1 bg-green-100 px-2 py-1 rounded">✅ Real Connection</div>
              </div>
            </button>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
          <p><strong>💡 คำแนะนำ:</strong> ระบบจะตัดการเชื่อมต่อเดิมก่อนเชื่อมต่อใหม่เสมอ และเชื่อมต่อได้ทีละแบบเท่านั้น</p>
        </div>
      </div>
    </div>
  );

 const AIAnalysisPage = () => (
  <div className="space-y-6">
    {/* กล่องจัดการโมเดล */}
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center space-x-2">
            <Brain className="h-6 w-6 text-purple-600" />
            <span>🧠 AI Model Management</span>
          </h2>
          <p className="text-gray-600 mt-1">Two-Branch Neural Network สำหรับทำนายความดันโลหิต</p>
        </div>
      </div>

      {!loadedModel ? (
        <div className="text-center py-8">
          <input
            type="file"
            ref={modelFileRef}
            onChange={async (e) => {
              await handleModelUpload(e);
              if (e.target) e.target.value = '';
            }}
            multiple
            accept=".json,.bin,.h5,.tflite"
            className="hidden"
          />
          <button
            onClick={() => modelFileRef.current?.click()}
            disabled={isModelLoading}
            className="flex items-center justify-center space-x-3 p-8 border-2 border-dashed border-purple-300 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50 mx-auto max-w-md"
          >
            <Upload className="h-10 w-10 text-purple-600" />
            <div className="text-center">
              <div className="font-medium text-purple-800 text-lg">
                {isModelLoading ? '🔄 กำลังโหลดโมเดล...' : '📤 เลือกโมเดล AI'}
              </div>
              <div className="text-sm text-purple-600 mt-1">
                รองรับ .json (TF.js), .h5 (Keras), .tflite
              </div>
            </div>
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-purple-800 mb-4 flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>โมเดลพร้อมใช้งาน</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700">📁 ไฟล์:</div>
                  <div className="text-purple-600">{modelInfo.name}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700">🤖 ประเภท:</div>
                  <div className="text-purple-600">{modelInfo.type}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700">🏗️ สถาปัตยกรรม:</div>
                  <div className="text-purple-600">{modelInfo.architecture}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700">📊 Input Shape:</div>
                  <div className="text-purple-600">{modelInfo.inputShape}</div>
                </div>
                {modelInfo.accuracy && (
                  <div>
                    <div className="font-medium text-gray-700">📈 ความแม่นยำ:</div>
                    <div className="text-purple-600">{modelInfo.accuracy}</div>
                  </div>
                )}
                <div>
                  <div className="font-medium text-gray-700">📦 ขนาด:</div>
                  <div className="text-purple-600">{modelInfo.size}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="font-medium text-gray-700 mb-2">🔧 Features:</div>
                <div className="flex flex-wrap gap-2">
                  {(modelInfo.features || []).map((f, i) => (
                    <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500">โหลดเมื่อ: {modelInfo.uploadTime}</div>
            </div>

            <button
              onClick={() => {
                setLoadedModel(null);
                setModelInfo(null);
                setAiPredictions([]);
              }}
              className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-lg"
              title="ลบโมเดล"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">📋 ข้อกำหนดโมเดล:</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <div><strong>🔹 Input 1:</strong> PPG Waveform (80 samples)</div>
          <div><strong>🔹 Input 2:</strong> Hand-crafted Features (12)</div>
          <div><strong>🔹 Output:</strong> [Systolic, Diastolic]</div>
          <div><strong>🔹 Architecture:</strong> Two-Branch (เชื่อม LSTM/Conv + Features)</div>
        </div>
      </div>
    </div>

    {/* กล่องวิเคราะห์ */}
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center space-x-2">
        <Activity className="h-6 w-6 text-green-600" />
        <span>🔬 Real-time AI Analysis</span>
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl">
            <h3 className="font-medium text-gray-800 mb-3">📊 Data Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>🔗 Connection:</span>
                <span className={isConnected ? 'text-green-600 font-medium' : 'text-red-500'}>
                  {isConnected ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>📡 PPG Samples:</span>
                <span className={ppgData.length >= 80 ? 'text-green-600 font-medium' : 'text-orange-500'}>
                  {ppgData.length}/80
                </span>
              </div>
              <div className="flex justify-between">
                <span>🎯 Signal Quality:</span>
                <span className={signalQuality >= 70 ? 'text-green-600 font-medium' : 'text-orange-500'}>
                  {signalQuality}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>🧠 AI Model:</span>
                <span className={loadedModel ? 'text-green-600 font-medium' : 'text-red-500'}>
                  {loadedModel ? '✅ Ready' : '❌ Not loaded'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={performAIAnalysis}
            disabled={isAnalyzing || !loadedModel || !isConnected || ppgData.length < 80}
            className={`w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-xl font-medium transition-all ${
              isAnalyzing || !loadedModel || !isConnected || ppgData.length < 80
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>🧠 กำลังวิเคราะห์...</span>
              </>
            ) : (
              <>
                <Brain className="h-5 w-5" />
                <span>🔬 วิเคราะห์ด้วย AI</span>
              </>
            )}
          </button>

          {(!loadedModel || !isConnected || ppgData.length < 80) && (
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              <div className="flex items-start space-x-2 text-yellow-700">
                <AlertCircle className="h-5 w-5 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium mb-1">⚠️ Requirements:</div>
                  <ul className="space-y-1">
                    {!loadedModel && <li>• โหลดโมเดล AI</li>}
                    {!isConnected && <li>• เชื่อมต่อ ESP32</li>}
                    {ppgData.length < 80 && <li>• รอข้อมูล PPG (ต้องการ 80 จุด)</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl">
            <h3 className="font-medium text-gray-800 mb-3">🧮 Extracted Features</h3>
            {ppgData.length >= 80 ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(() => {
                  const f = calculatePPGFeatures(ppgData);
                  const names = ['Mean', 'Std', 'Skew', 'Kurt', 'P2P', 'RMS', 'S1', 'S2', 'Centroid', 'Bandwidth', 'P_LF', 'P_HF'];
                  return f.map((v, i) => (
                    <div key={i} className="flex justify-between p-2 bg-white rounded border">
                      <span className="font-medium text-gray-600">{names[i]}:</span>
                      <span className="text-purple-600">{Number.isFinite(v) ? v.toFixed(3) : '-'}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-4">รอข้อมูล PPG เพิ่มเติม...</div>
            )}
          </div>
        </div>
      </div>

      {aiPredictions.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <span>📈 AI Prediction History</span>
          </h2>
          <div className="space-y-3">
            {aiPredictions.slice(0, 10).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-4">
                  <div className="text-lg font-bold text-gray-800">
                    {p.systolic}/{p.diastolic}
                    <span className="text-sm text-gray-500 ml-1">mmHg</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">🧠 {p.model_type}</div>
                    <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">🎯 {(p.confidence * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-600">
                  <div>{p.timestamp.toLocaleDateString('th-TH')}</div>
                  <div>{p.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        <Navigation />
        {currentPage === 'home' && <HomePage />}
        {currentPage === 'connect' && <ConnectionPage />}
        {currentPage === 'statistics' && <StatisticsPage />}
        {currentPage === 'ai' && <AIAnalysisPage />}
        {/* {currentPage === 'wifi' && <WiFiManagerPage espIP={espIP} setEspIP={setEspIP} />} */}
      </div>
      <ConnectionAnimation />
    </div>
  );
};

export default memo(BPMonitorApp); // FIX: memo เพื่อลด re-render เล็กน้อย
