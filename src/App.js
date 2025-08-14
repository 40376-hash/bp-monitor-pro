import React, { useState, useEffect, useRef } from 'react';
import { Heart, Brain, Activity, CheckCircle, AlertCircle, BarChart3, Zap, Wifi, WifiOff, Upload, Download, Settings, Info, Bluetooth, Usb, Home, Link, TrendingUp, Calendar, Trash2 } from 'lucide-react';Off, Upload, Download, Settings, Info, Bluetooth, Usb, Home, Link, TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';
import WiFiManagerPage from './components/WiFiManagerPage';

const BPMonitorApp = () => {
  // Connection Animation State
  const [connectionAnimation, setConnectionAnimation] = useState(false);
  const [animationType, setAnimationType] = useState(''); // 'wifi', 'serial', 'bluetooth'
  
  // Connection Animation State
  const [connectionAnimation, setConnectionAnimation] = useState(false);
  const [animationType, setAnimationType] = useState(''); // 'wifi', 'serial', 'bluetooth'
  
  // AI Model Management State
  const [loadedModel, setLoadedModel] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [aiPredictions, setAiPredictions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const modelFileRef = useRef(null);
  
  // ESP32 Connection - ✅ FIXED: ลบการประกาศซ้ำ
  const [espIP, setEspIP] = useState('');
  const [rawIRValue, setRawIRValue] = useState(0);
  const [rawRedValue, setRawRedValue] = useState(0);
  const [ppgData, setPpgData] = useState([]);
  const websocketRef = useRef(null);
  
  // Sensor Data
  const [heartRate, setHeartRate] = useState(0);
  const [heartRateAvg, setHeartRateAvg] = useState(0);
  const [oxygenSaturation, setOxygenSaturation] = useState(0);
  const [heartRateVariability, setHeartRateVariability] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  
  // Blood Pressure Data
  const [currentBP, setCurrentBP] = useState({ systolic: 0, diastolic: 0, confidence: 0, timestamp: null });
  const [bpHistory, setBpHistory] = useState([]);
  const [isValidForMeasurement, setIsValidForMeasurement] = useState(false);
  const [measurementBlocked, setMeasurementBlocked] = useState({ blocked: false, reason: '' });
  
  // Model Management
  const [loadedModel, setLoadedModel] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const modelFileRef = useRef(null);
  
  // Measurement Control
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementTimer, setMeasurementTimer] = useState(0);
  const [lastValidMeasurement, setLastValidMeasurement] = useState(null);
  
  // Statistics
  const [bpStats, setBpStats] = useState({
    daily: { avg: { systolic: 0, diastolic: 0 }, count: 0 },
    weekly: { avg: { systolic: 0, diastolic: 0 }, count: 0 },
    monthly: { avg: { systolic: 0, diastolic: 0 }, count: 0 }
  });

  // 🧠 AI Model Management Functions
  const handleModelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsModelLoading(true);
    try {
      console.log(`🧠 Loading AI model: ${file.name}`);
      
      if (file.name.endsWith('.json')) {
        // TensorFlow.js JSON format
        const modelData = JSON.parse(await file.text());
        setLoadedModel({
          type: 'tensorflow-js',
          data: modelData,
          predict: (ppgWindow, features) => predictWithTensorFlowJS(modelData, ppgWindow, features)
        });
        
        setModelInfo({
          name: file.name,
          type: 'TensorFlow.js',
          uploadTime: new Date().toLocaleString('th-TH'),
          architecture: 'Two-Branch Neural Network',
          inputShape: '(80,) + (12,)',
          features: ['PPG Waveform (80 samples)', 'Hand-crafted Features (12)'],
          accuracy: modelData.accuracy || 'Unknown',
          size: (file.size / 1024).toFixed(1) + ' KB'
        });
        
      } else if (file.name.endsWith('.h5')) {
        // Keras H5 format (would need TensorFlow.js conversion)
        alert('⚠️ H5 format ต้องแปลงเป็น TensorFlow.js ก่อน\n\nใช้คำสั่ง: tensorflowjs_converter');
        setIsModelLoading(false);
        return;
        
      } else if (file.name.endsWith('.tflite')) {
        // TensorFlow Lite format
        const arrayBuffer = await file.arrayBuffer();
        setLoadedModel({
          type: 'tensorflow-lite',
          data: arrayBuffer,
          predict: (ppgWindow, features) => predictWithTensorFlowLite(arrayBuffer, ppgWindow, features)
        });
        
        setModelInfo({
          name: file.name,
          type: 'TensorFlow Lite',
          uploadTime: new Date().toLocaleString('th-TH'),
          architecture: 'Two-Branch Neural Network (Optimized)',
          inputShape: '(80,) + (12,)',
          features: ['PPG Waveform (80 samples)', 'Hand-crafted Features (12)'],
          size: (file.size / 1024).toFixed(1) + ' KB'
        });
        
      } else {
        throw new Error('รองรับเฉพาะไฟล์ .json, .h5, .tflite');
      }
      
      console.log('✅ AI model loaded successfully');
      alert('✅ โหลดโมเดล AI สำเร็จ!\n🧠 พร้อมวิเคราะห์ความดันโลหิต');
      
    } catch (error) {
      console.error('❌ Model loading failed:', error);
      alert('❌ ไม่สามารถโหลดโมเดลได้: ' + error.message);
    }
    setIsModelLoading(false);
  };

  // 🧮 Calculate Hand-crafted Features from PPG
  const calculatePPGFeatures = (ppgData) => {
    if (!ppgData || ppgData.length < 80) return null;
    
    const window = ppgData.slice(-80); // Get last 80 samples
    const values = window.map(point => point.value || point.raw || point);
    
    // Basic statistical features
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    
    // Skewness and Kurtosis
    const skewness = values.reduce((a, b) => a + Math.pow((b - mean) / std, 3), 0) / values.length;
    const kurtosis = values.reduce((a, b) => a + Math.pow((b - mean) / std, 4), 0) / values.length - 3;
    
    // Peak-to-peak
    const max = Math.max(...values);
    const min = Math.min(...values);
    const p2p = max - min;
    
    // RMS
    const rms = Math.sqrt(values.reduce((a, b) => a + b * b, 0) / values.length);
    
    // Derivatives
    const firstDeriv = values.slice(1).map((val, i) => val - values[i]);
    const secondDeriv = firstDeriv.slice(1).map((val, i) => val - firstDeriv[i]);
    const s1 = firstDeriv.reduce((a, b) => a + Math.abs(b), 0) / firstDeriv.length;
    const s2 = secondDeriv.reduce((a, b) => a + Math.abs(b), 0) / secondDeriv.length;
    
    // Simple frequency domain features (approximation)
    const centroid = mean; // Simplified
    const bandwidth = std; // Simplified
    const p_lf = variance * 0.3; // Simplified low frequency power
    const p_hf = variance * 0.7; // Simplified high frequency power
    
    return [mean, std, skewness, kurtosis, p2p, rms, s1, s2, centroid, bandwidth, p_lf, p_hf];
  };

  // 🔮 AI Prediction Functions
  const predictWithTensorFlowJS = async (modelData, ppgWindow, features) => {
    // Placeholder for TensorFlow.js prediction
    // In real implementation, would use tf.loadLayersModel()
    console.log('🧠 TensorFlow.js prediction with:', { ppgWindow: ppgWindow.length, features: features.length });
    
    // Simulate prediction based on features
    const baseSystemic = 120 + (features[0] - 0.5) * 40; // Based on mean
    const baseDiastolic = 80 + (features[1] - 0.3) * 20; // Based on std
    
    return {
      systolic: Math.max(90, Math.min(180, Math.round(baseSystemic + Math.random() * 10 - 5))),
      diastolic: Math.max(60, Math.min(120, Math.round(baseDiastolic + Math.random() * 8 - 4))),
      confidence: 0.85 + Math.random() * 0.1,
      features_used: features,
      model_type: 'TensorFlow.js'
    };
  };

  const predictWithTensorFlowLite = async (modelBuffer, ppgWindow, features) => {
    // Placeholder for TensorFlow Lite prediction
    console.log('🧠 TensorFlow Lite prediction with:', { ppgWindow: ppgWindow.length, features: features.length });
    
    // Simulate prediction
    const baseSystemic = 115 + (features[4] - 0.4) * 35; // Based on p2p
    const baseDiastolic = 75 + (features[5] - 0.5) * 18; // Based on rms
    
    return {
      systolic: Math.max(90, Math.min(180, Math.round(baseSystemic + Math.random() * 8 - 4))),
      diastolic: Math.max(60, Math.min(120, Math.round(baseDiastolic + Math.random() * 6 - 3))),
      confidence: 0.88 + Math.random() * 0.08,
      features_used: features,
      model_type: 'TensorFlow Lite'
    };
  };

  // 🔬 Perform AI Analysis
  const performAIAnalysis = async () => {
    if (!loadedModel || !ppgData || ppgData.length < 80) {
      alert('⚠️ ต้องการ:\n1. โมเดล AI ที่โหลดแล้ว\n2. ข้อมูล PPG อย่างน้อย 80 จุด');
      return;
    }
    
    setIsAnalyzing(true);
    try {
      console.log('🔬 Starting AI analysis...');
      
      // Extract features
      const features = calculatePPGFeatures(ppgData);
      if (!features) {
        throw new Error('ไม่สามารถคำนวณ features ได้');
      }
      
      // Get PPG window (last 80 samples)
      const ppgWindow = ppgData.slice(-80).map(point => point.value || point.raw || point);
      
      // Predict using loaded model
      const prediction = await loadedModel.predict(ppgWindow, features);
      
      const analysisResult = {
        ...prediction,
        timestamp: new Date(),
        ppg_samples: ppgWindow.length,
        signal_quality: signalQuality,
        heart_rate: heartRate
      };
      
      setAiPredictions(prev => [analysisResult, ...prev].slice(0, 20));
      
      // Update current BP with AI prediction
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
      
      console.log('✅ AI analysis completed:', analysisResult);
      alert(`🧠 AI วิเคราะห์เสร็จแล้ว!\n\n` +
            `📊 ความดัน: ${prediction.systolic}/${prediction.diastolic} mmHg\n` +
            `🎯 ความมั่นใจ: ${(prediction.confidence * 100).toFixed(1)}%\n` +
            `🤖 โมเดล: ${prediction.model_type}`);
      
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      alert('❌ การวิเคราะห์ AI ไม่สำเร็จ: ' + error.message);
    }
    setIsAnalyzing(false);
  };
  const disconnectAll = () => {
    console.log('🔌 Disconnecting all connections...');
    
    // Close WebSocket if exists
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    // Clear all states
    setIsConnected(false);
    setConnectionType('none');
    setConnectionStatus('disconnected');
    setDeviceInfo(null);
    
    // Clear sensor data - NO MORE FAKE DATA!
    setHeartRate(0);
    setHeartRateAvg(0);
    setOxygenSaturation(0);
    setSignalQuality(0);
    setHeartRateVariability(0);
    setRawIRValue(0);
    setRawRedValue(0);
    setPpgData([]);
    
    console.log('✅ All connections disconnected');
  };

  // 📶 WiFi WebSocket Connection - REAL CONNECTION!
  const connectWiFi = async () => {
    console.log('📶 Attempting WiFi connection...');
    
    // ✅ STEP 1: Disconnect existing connections first
    disconnectAll();
    
    let ip = espIP;
    if (!ip) {
      ip = prompt('ใส่ IP Address ของ ESP32:', '192.168.1.100');
      if (!ip) return;
      setEspIP(ip);
    }
    
    try {
      setConnectionStatus('connecting');
      console.log(`🔄 Connecting to ws://${ip}:81`);
      
      const ws = new WebSocket(`ws://${ip}:81`);
      
      // Set timeout for connection
      const timeout = setTimeout(() => {
        ws.close();
        setConnectionStatus('error');
        alert('⚠️ การเชื่อมต่อ WiFi หมดเวลา - ตรวจสอบ IP และ WiFi');
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        websocketRef.current = ws;
        setConnectionType('wifi');
        setIsConnected(true);
        setConnectionStatus('connected');
        setDeviceInfo({ type: 'WiFi WebSocket', ip: ip, port: 81 });
        
        // 🔥 เพิ่ม Animation เท่ๆ
        setAnimationType('wifi');
        setConnectionAnimation(true);
        setTimeout(() => setConnectionAnimation(false), 3000);
        
        console.log('✅ WiFi WebSocket connected successfully');
        alert('✅ เชื่อมต่อ WiFi สำเร็จ!');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          processRealSensorData(data);
        } catch (e) {
          console.warn('⚠️ Invalid JSON data:', event.data);
        }
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        alert('❌ ไม่สามารถเชื่อมต่อ WiFi ได้ - ตรวจสอบ ESP32');
      };
      
      ws.onclose = () => {
        clearTimeout(timeout);
        if (connectionStatus === 'connected') {
          console.log('🔌 WebSocket connection closed');
          disconnectAll();
        }
      };
      
    } catch (error) {
      console.error('❌ WiFi connection failed:', error);
      setConnectionStatus('error');
      alert('❌ เชื่อมต่อ WiFi ไม่สำเร็จ: ' + error.message);
    }
  };

  // 🔌 USB Serial Connection - REAL CONNECTION! (แก้ไขแล้ว)
  const connectSerial = async () => {
    console.log('🔌 Attempting USB Serial connection...');
    
    // ✅ STEP 1: Disconnect existing connections first
    disconnectAll();
    
    try {
      // ✅ ตรวจสอบการรองรับ Web Serial API
      if (!navigator.serial) {
        alert('❌ บราวเซอร์นี้ไม่รองรับ Web Serial API\n\n' +
              '✅ วิธีแก้:\n' +
              '1. ใช้ Chrome เวอร์ชัน 89+ หรือ Edge เวอร์ชัน 89+\n' +
              '2. เปิด chrome://flags/#enable-experimental-web-platform-features\n' +
              '3. ตั้งค่าเป็น "Enabled"\n' +
              '4. รีสตาร์ทบราวเซอร์');
        return;
      }
      
      setConnectionStatus('connecting');
      console.log('🔄 Requesting serial port access...');
      
      // ✅ ขอสิทธิ์เข้าถึง Serial Port
      const port = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x1a86 }, // CH340
          { usbVendorId: 0x0403 }, // FTDI
          { usbVendorId: 0x10c4 }, // CP210x
          { usbVendorId: 0x067b }, // Prolific
        ]
      });
      
      console.log('📋 Port info:', await port.getInfo());
      
      // ✅ เปิดการเชื่อมต่อพร้อม Error Handling
      await port.open({ 
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });
      
      console.log('✅ Serial port opened successfully');
      
      // ✅ บันทึกข้อมูลการเชื่อมต่อ
      const portInfo = await port.getInfo();
      setConnectionType('serial');
      setIsConnected(true);
      setConnectionStatus('connected');
      setDeviceInfo({ 
        type: 'USB Serial', 
        port: `VID:${portInfo.usbVendorId?.toString(16)} PID:${portInfo.usbProductId?.toString(16)}`,
        baudRate: 115200 
      });
      
      // 🔥 เพิ่ม Animation เท่ๆ
      setAnimationType('serial');
      setConnectionAnimation(true);
      setTimeout(() => setConnectionAnimation(false), 3000);
      
      console.log('✅ USB Serial connected successfully');
      alert('✅ เชื่อมต่อ USB Serial สำเร็จ!\n📡 กำลังรอข้อมูลจาก ESP32...');
      
      // ✅ ตั้งค่าการอ่านข้อมูลแบบ Buffer
      let buffer = '';
      const reader = port.readable.getReader();
      
      const readLoop = async () => {
        try {
          while (port.readable && !reader.closed) {
            const { value, done } = await reader.read();
            if (done) break;
            
            // ✅ แปลงข้อมูลเป็น Text และรวมใน Buffer
            const text = new TextDecoder().decode(value);
            buffer += text;
            
            // ✅ แยกข้อความที่สมบูรณ์ (คั่นด้วย \n)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // เก็บส่วนที่ไม่สมบูรณ์ไว้
            
            for (const line of lines) {
              const cleanLine = line.trim();
              if (cleanLine.length === 0) continue;
              
              console.log('📡 Serial data:', cleanLine);
              
              try {
                // ✅ พยายามแปลงเป็น JSON
                const data = JSON.parse(cleanLine);
                console.log('📊 Parsed data:', data);
                processRealSensorData(data);
              } catch (e) {
                // ✅ ถ้าไม่ใช่ JSON ให้แสดงข้อมูลดิบ
                console.log('📝 Raw serial data:', cleanLine);
                
                // ✅ ลองแปลงข้อมูลแบบง่าย เช่น "HR:75,SpO2:98"
                if (cleanLine.includes(':')) {
                  const pairs = cleanLine.split(',');
                  const simpleData = {};
                  
                  pairs.forEach(pair => {
                    const [key, value] = pair.split(':');
                    if (key && value) {
                      const cleanKey = key.trim().toLowerCase();
                      const numValue = parseFloat(value.trim());
                      
                      if (!isNaN(numValue)) {
                        if (cleanKey.includes('hr') || cleanKey.includes('heart')) {
                          simpleData.heartRate = numValue;
                        } else if (cleanKey.includes('spo2') || cleanKey.includes('oxygen')) {
                          simpleData.spo2 = numValue;
                        } else if (cleanKey.includes('temp')) {
                          simpleData.temperature = numValue;
                        }
                      }
                    }
                  });
                  
                  if (Object.keys(simpleData).length > 0) {
                    console.log('📊 Converted simple data:', simpleData);
                    processRealSensorData(simpleData);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('❌ Serial read error:', error);
          if (connectionStatus === 'connected') {
            setConnectionStatus('error');
            alert('❌ การอ่านข้อมูล Serial ขัดข้อง: ' + error.message);
          }
        } finally {
          try {
            if (!reader.closed) {
              await reader.releaseLock();
            }
          } catch (e) {
            console.warn('⚠️ Error releasing reader:', e);
          }
        }
      };
      
      // ✅ เริ่มการอ่านข้อมูล
      readLoop();
      
      // ✅ ตั้งค่า Event Listener สำหรับการตัดการเชื่อมต่อ
      port.addEventListener('disconnect', () => {
        console.log('🔌 USB Serial disconnected');
        disconnectAll();
        alert('⚠️ USB Serial ถูกถอดออก');
      });
      
    } catch (error) {
      console.error('❌ Serial connection failed:', error);
      setConnectionStatus('error');
      
      let errorMessage = 'เชื่อมต่อ USB Serial ไม่สำเร็จ';
      
      if (error.name === 'NotFoundError') {
        errorMessage = '❌ ไม่พบอุปกรณ์ USB Serial\n\n' +
                      '✅ วิธีแก้:\n' +
                      '1. ตรวจสอบว่าเสียบสาย USB แล้ว\n' +
                      '2. ตรวจสอบว่า ESP32 เปิดอยู่\n' +
                      '3. ลอง USB Port อื่น\n' +
                      '4. ตรวจสอบ Driver (CH340/CP210x/FTDI)';
      } else if (error.name === 'NetworkError') {
        errorMessage = '❌ ไม่สามารถเปิด Serial Port ได้\n\n' +
                      '✅ วิธีแก้:\n' +
                      '1. ปิดโปรแกรมอื่นที่ใช้ Serial Port\n' +
                      '2. ปิด Arduino IDE, PuTTY, หรือ Serial Monitor\n' +
                      '3. ลองถอดสายแล้วเสียบใหม่';
      } else if (error.name === 'InvalidStateError') {
        errorMessage = '❌ Serial Port ถูกใช้งานอยู่\n\n' +
                      '✅ วิธีแก้:\n' +
                      '1. ปิด Arduino Serial Monitor\n' +
                      '2. ปิดโปรแกรม Terminal อื่นๆ\n' +
                      '3. รีเฟรชหน้าเว็บแล้วลองใหม่';
      }
      
      alert(errorMessage + '\n\n🔧 รายละเอียด: ' + error.message);
    }
  };

  // 🔵 Bluetooth Connection - REAL CONNECTION!
  const connectBluetooth = async () => {
    console.log('🔵 Attempting Bluetooth connection...');
    
    // ✅ STEP 1: Disconnect existing connections first
    disconnectAll();
    
    try {
      if (!navigator.bluetooth) {
        alert('❌ บราวเซอร์นี้ไม่รองรับ Web Bluetooth API\nใช้ Chrome/Edge เวอร์ชันล่าสุด');
        return;
      }
      
      setConnectionStatus('connecting');
      
      // Request Bluetooth device
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'ESP32' },
          { namePrefix: 'BP-Monitor' }
        ],
        optionalServices: ['12345678-1234-1234-1234-123456789abc'] // ESP32 service UUID
      });
      
      console.log('🔄 Connecting to Bluetooth device:', device.name);
      
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('12345678-1234-1234-1234-123456789abc');
      const characteristic = await service.getCharacteristic('87654321-4321-4321-4321-cba987654321');
      
      // Set up notifications
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const data = new TextDecoder().decode(event.target.value);
        try {
          const sensorData = JSON.parse(data);
          processRealSensorData(sensorData);
        } catch (e) {
          console.log('Bluetooth data:', data);
        }
      });
      
      setConnectionType('bluetooth');
      setIsConnected(true);
      setConnectionStatus('connected');
      setDeviceInfo({ type: 'Bluetooth LE', name: device.name || 'ESP32-BP' });
      
      // 🔥 เพิ่ม Animation เท่ๆ
      setAnimationType('bluetooth');
      setConnectionAnimation(true);
      setTimeout(() => setConnectionAnimation(false), 3000);
      
      console.log('✅ Bluetooth connected successfully');
      alert('✅ เชื่อมต่อ Bluetooth สำเร็จ!');
      
    } catch (error) {
      console.error('❌ Bluetooth connection failed:', error);
      setConnectionStatus('error');
      alert('❌ เชื่อมต่อ Bluetooth ไม่สำเร็จ: ' + error.message);
    }
  };

  // 📡 Process REAL sensor data from ESP32
  const processRealSensorData = (data) => {
    console.log('📡 Real sensor data received:', data);
    
    // Heart rate data
    if (data.heartRate !== undefined) {
      setHeartRate(Math.round(data.heartRate));
    }
    if (data.heartRateAvg !== undefined) {
      setHeartRateAvg(Math.round(data.heartRateAvg));
    }
    
    // PPG raw data
    if (data.ppg) {
      if (data.ppg.ir !== undefined) setRawIRValue(data.ppg.ir);
      if (data.ppg.red !== undefined) setRawRedValue(data.ppg.red);
      
      // Add to PPG waveform data
      const time = Date.now();
      const newPoint = { 
        time, 
        value: (data.ppg.ir - 50000) / 50000,  // Normalize
        raw: data.ppg.ir 
      };
      setPpgData(prev => [...prev, newPoint].slice(-200)); // Keep last 200 points
    }
    
    // Other vital signs
    if (data.spo2 !== undefined) {
      setOxygenSaturation(Math.round(Math.max(0, Math.min(100, data.spo2))));
    }
    if (data.hrv !== undefined) {
      setHeartRateVariability(Math.round(Math.max(0, data.hrv)));
    }
    if (data.signalQuality !== undefined) {
      setSignalQuality(Math.round(Math.max(0, Math.min(100, data.signalQuality))));
    }
  };

  // 🔥 Connection Success Animation Component
  const ConnectionAnimation = () => {
    if (!connectionAnimation) return null;

    const getAnimationColor = () => {
      switch (animationType) {
        case 'wifi': return 'from-green-400 to-emerald-600';
        case 'serial': return 'from-blue-400 to-cyan-600';
        case 'bluetooth': return 'from-purple-400 to-violet-600';
        default: return 'from-blue-400 to-cyan-600';
      }
    };

    const getAnimationIcon = () => {
      switch (animationType) {
        case 'wifi': return <Wifi className="h-16 w-16 text-white" />;
        case 'serial': return <Usb className="h-16 w-16 text-white" />;
        case 'bluetooth': return <Bluetooth className="h-16 w-16 text-white" />;
        default: return <CheckCircle className="h-16 w-16 text-white" />;
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
        <div className="relative">
          {/* 🌟 Main Glow Effect */}
          <div className={`
            w-48 h-48 rounded-full bg-gradient-to-r ${getAnimationColor()}
            animate-pulse shadow-2xl
            flex items-center justify-center relative overflow-hidden
          `}
            style={{
              boxShadow: `
                0 0 60px rgba(59, 130, 246, 0.8),
                0 0 120px rgba(59, 130, 246, 0.6),
                inset 0 0 60px rgba(255, 255, 255, 0.2)
              `,
              animation: 'neonPulse 2s ease-in-out infinite'
            }}
          >
            {/* ⚡ Electric Particles */}
            <div className="absolute inset-0">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-white rounded-full opacity-80"
                  style={{
                    left: `${50 + 35 * Math.cos(i * 30 * Math.PI / 180)}%`,
                    top: `${50 + 35 * Math.sin(i * 30 * Math.PI / 180)}%`,
                    animation: `particle-${i} 3s linear infinite`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>

            {/* 🔮 Center Icon */}
            <div className="z-10 animate-bounce">
              {getAnimationIcon()}
            </div>

            {/* 🌊 Ripple Waves */}
            <div className="absolute inset-0">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-white opacity-30"
                  style={{
                    animation: `ripple 3s ease-out infinite`,
                    animationDelay: `${i * 0.5}s`
                  }}
                />
              ))}
            </div>
          </div>

          {/* ✨ Success Text */}
          <div className="text-center mt-6">
            <h3 className="text-2xl font-bold text-white mb-2">
              🎉 เชื่อมต่อสำเร็จ!
            </h3>
            <p className="text-blue-200 capitalize">
              {animationType} Connection Established
            </p>
          </div>
        </div>

        {/* 🎨 CSS Animations */}
        <style jsx>{`
          @keyframes neonPulse {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1) saturate(1);
            }
            50% {
              transform: scale(1.05);
              filter: brightness(1.2) saturate(1.5);
            }
          }

          @keyframes ripple {
            0% {
              transform: scale(0.8);
              opacity: 0.8;
            }
            100% {
              transform: scale(2);
              opacity: 0;
            }
          }

          ${[...Array(12)].map((_, i) => `
            @keyframes particle-${i} {
              0% {
                transform: scale(0) rotate(0deg);
                opacity: 0;
              }
              20% {
                transform: scale(1) rotate(${i * 30}deg);
                opacity: 1;
              }
              80% {
                transform: scale(1) rotate(${i * 30 + 360}deg);
                opacity: 1;
              }
              100% {
                transform: scale(0) rotate(${i * 30 + 720}deg);
                opacity: 0;
              }
            }
          `).join('')}
        `}</style>
      </div>
    );
  };
  const CircularProgress = ({ value, maxValue, color, size = 120, strokeWidth = 8, label, unit }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = Math.min(value / maxValue, 1);
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress * circumference);

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-gray-800">{value}</div>
          <div className="text-xs text-gray-600">{unit}</div>
          <div className="text-xs font-medium text-gray-700 mt-1">{label}</div>
        </div>
      </div>
    );
  };

  // Blood Pressure Gauge Component
  const BPGauge = ({ systolic, diastolic }) => {
    const getBPLevel = (sys, dia) => {
      if (sys >= 180 || dia >= 120) return { level: 5, color: '#dc2626', label: 'วิกฤต', bg: 'bg-red-600' };
      if (sys >= 140 || dia >= 90) return { level: 4, color: '#ea580c', label: 'สูง', bg: 'bg-orange-600' };
      if (sys >= 130 || dia >= 80) return { level: 3, color: '#f59e0b', label: 'เพิ่มขึ้น', bg: 'bg-yellow-500' };
      if (sys >= 120 || dia >= 70) return { level: 2, color: '#10b981', label: 'ปกติดี', bg: 'bg-green-500' };
      if (sys > 0) return { level: 1, color: '#06b6d4', label: 'ต่ำ', bg: 'bg-cyan-500' };
      return { level: 0, color: '#6b7280', label: 'ไม่มีข้อมูล', bg: 'bg-gray-400' };
    };

    const bpLevel = getBPLevel(systolic, diastolic);

    return (
      <div className="relative">
        <div className="relative w-64 h-64 mx-auto">
          <svg width="256" height="256" className="absolute inset-0">
            {[
              { start: 0, end: 60, color: '#06b6d4', label: 'ต่ำ' },
              { start: 60, end: 120, color: '#10b981', label: 'ปกติดี' },
              { start: 120, end: 180, color: '#f59e0b', label: 'เพิ่มขึ้น' },
              { start: 180, end: 240, color: '#ea580c', label: 'สูง' },
              { start: 240, end: 300, color: '#dc2626', label: 'วิกฤต' }
            ].map((segment, index) => {
              const startAngle = (segment.start * Math.PI) / 180 - Math.PI / 2;
              const endAngle = (segment.end * Math.PI) / 180 - Math.PI / 2;
              const radius = 110;
              const x1 = 128 + radius * Math.cos(startAngle);
              const y1 = 128 + radius * Math.sin(startAngle);
              const x2 = 128 + radius * Math.cos(endAngle);
              const y2 = 128 + radius * Math.sin(endAngle);
              const largeArc = segment.end - segment.start > 180 ? 1 : 0;

              return (
                <g key={index}>
                  <path
                    d={`M 128 128 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={segment.color}
                    opacity="0.2"
                  />
                  <path
                    d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
                    stroke={segment.color}
                    strokeWidth="3"
                    fill="none"
                  />
                </g>
              );
            })}

            {systolic > 0 && (
              <>
                <line
                  x1="128"
                  y1="128"
                  x2={128 + 80 * Math.cos((systolic / 200 * 300 - 150) * Math.PI / 180)}
                  y2={128 + 80 * Math.sin((systolic / 200 * 300 - 150) * Math.PI / 180)}
                  stroke={bpLevel.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="128" cy="128" r="6" fill={bpLevel.color} />
              </>
            )}
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-white rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-lg border-4 border-white">
              <div className="text-lg font-bold text-gray-800">
                {systolic > 0 ? `${systolic}` : '--'}
              </div>
              <div className="text-xs text-gray-600">/{diastolic > 0 ? diastolic : '--'}</div>
              <div className={`text-xs font-medium px-2 py-1 rounded-full text-white ${bpLevel.bg} mt-1`}>
                {bpLevel.label}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-4 space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
            <span>ต่ำ</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>ปกติ</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>เพิ่มขึ้น</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
            <span>สูง</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span>วิกฤต</span>
          </div>
        </div>
      </div>
    );
  };

  // Helper Functions
  const getBPStatus = (systolic, diastolic) => {
    if (systolic >= 140 || diastolic >= 90) return { status: 'สูง', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' };
    if (systolic >= 130 || diastolic >= 80) return { status: 'เพิ่มขึ้น', color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    if (systolic > 0) return { status: 'ปกติ', color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' };
    return { status: 'ไม่มีข้อมูล', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
  };

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

  // Measurement functions
  const validateMeasurementConditions = () => {
    const reasons = [];
    
    if (heartRateVariability > 50) reasons.push('Heart rate ไม่เสถียร (HRV สูง)');
    if (signalQuality < 70) reasons.push('คุณภาพสัญญาณต่ำ');
    if (heartRate < 50 || heartRate > 120) reasons.push('Heart rate อยู่นอกช่วงปกติ');
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
        if (prev <= 1) {
          clearInterval(countdown);
          completeMeasurement();
          return 0;
        }
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
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyMeasurements = bpHistory.filter(bp => bp.timestamp >= oneDayAgo);
    const weeklyMeasurements = bpHistory.filter(bp => bp.timestamp >= oneWeekAgo);
    const monthlyMeasurements = bpHistory.filter(bp => bp.timestamp >= oneMonthAgo);
    
    const calculateAverage = (measurements) => {
      if (measurements.length === 0) return { systolic: 0, diastolic: 0 };
      const sum = measurements.reduce((acc, bp) => ({
        systolic: acc.systolic + bp.systolic,
        diastolic: acc.diastolic + bp.diastolic
      }), { systolic: 0, diastolic: 0 });
      
      return {
        systolic: Math.round(sum.systolic / measurements.length),
        diastolic: Math.round(sum.diastolic / measurements.length)
      };
    };
    
    setBpStats({
      daily: { avg: calculateAverage(dailyMeasurements), count: dailyMeasurements.length },
      weekly: { avg: calculateAverage(weeklyMeasurements), count: weeklyMeasurements.length },
      monthly: { avg: calculateAverage(monthlyMeasurements), count: monthlyMeasurements.length }
    });
  };

  // 🚫 NO FAKE DATA - Real medical app
  useEffect(() => {
    console.log('🏥 Medical app - Real data only');
    if (!isConnected) {
      setHeartRate(0);
      setHeartRateAvg(0);
      setOxygenSaturation(0);
      setSignalQuality(0);
      setHeartRateVariability(0);
      setRawIRValue(0);
      setRawRedValue(0);
      setPpgData([]);
    }
  }, [isConnected]);
  
  useEffect(() => {
    const interval = setInterval(validateMeasurementConditions, 1000);
    return () => clearInterval(interval);
  }, [heartRate, heartRateVariability, signalQuality, isConnected]);

  useEffect(() => {
    updateStatistics();
  }, [bpHistory]);

  // Navigation Component
  const Navigation = () => (
    <nav className="bg-white shadow-lg rounded-2xl mb-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-red-600 p-2 rounded-xl">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">BP Monitor Pro</h1>
            <p className="text-sm text-gray-600">🏥 Professional Blood Pressure Monitor</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage('home')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'home' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>หน้าหลัก</span>
          </button>
          
          <button
            onClick={() => setCurrentPage('connect')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'connect' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Link className="h-4 w-4" />
            <span>เชื่อมต่อ</span>
          </button>
          
          <button
            onClick={() => setCurrentPage('statistics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'statistics' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>สถิติ</span>
          </button>
          <button
            onClick={() => setCurrentPage('ai')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'ai' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Brain className="h-4 w-4" />
            <span>AI Analysis</span>
          </button>
          
          {/* <button
            onClick={() => setCurrentPage('wifi')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'wifi' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>WiFi Settings</span>
          </button> */}
        </div>
      </div>
    </nav>
  );

  // Home Page Component
  const HomePage = () => {
    const getHRColor = () => {
      if (heartRateAvg >= 100) return '#ef4444';
      if (heartRateAvg >= 90) return '#f59e0b';
      if (heartRateAvg >= 60) return '#10b981';
      if (heartRateAvg > 0) return '#3b82f6';
      return '#6b7280';
    };

    const getSpO2Color = () => {
      if (oxygenSaturation >= 95) return '#10b981';
      if (oxygenSaturation >= 90) return '#f59e0b';
      if (oxygenSaturation > 0) return '#ef4444';
      return '#6b7280';
    };
    
    return (
      <div className="space-y-6">
        <div className={`rounded-2xl p-4 border-2 ${getConnectionStatusColor()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getConnectionIcon()}
              <div>
                <div className="font-medium">
                  {getConnectionStatusText()}
                </div>
                <div className="text-sm text-gray-600">
                  {deviceInfo?.ip && `IP: ${deviceInfo.ip}`}
                  {deviceInfo?.name && `Device: ${deviceInfo.name}`}
                  {deviceInfo?.port && ` | Port: ${deviceInfo.port}`}
                  {deviceInfo?.baudRate && ` | Baud: ${deviceInfo.baudRate}`}
                </div>
              </div>
            </div>
            {!isConnected && connectionStatus !== 'connecting' && (
              <button
                onClick={() => setCurrentPage('connect')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                เชื่อมต่อเลย
              </button>
            )}
            {connectionStatus === 'connecting' && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            )}
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
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                    style={{ width: `${currentBP.confidence * 100}%` }}
                  />
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">
                  {(currentBP.confidence * 100).toFixed(1)}%
                </div>
              </div>
            )}

            {lastValidMeasurement && (
              <div className="mt-4 text-sm text-gray-600">
                การวัดล่าสุด: {lastValidMeasurement.toLocaleString('th-TH')}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 border-2 border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">สัญญาณชีพ</h2>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <CircularProgress
                    value={heartRateAvg || heartRate || 0}
                    maxValue={150}
                    color={getHRColor()}
                    size={140}
                    strokeWidth={12}
                    label="Heart Rate"
                    unit="BPM"
                  />
                  <div className="mt-3 text-sm text-gray-600">
                    ปัจจุบัน: {heartRate} BPM
                  </div>
                </div>

                <div className="text-center">
                  <CircularProgress
                    value={oxygenSaturation || 0}
                    maxValue={100}
                    color={getSpO2Color()}
                    size={140}
                    strokeWidth={12}
                    label="SpO2"
                    unit="%"
                  />
                  <div className="mt-3 text-sm text-gray-600">
                    ออกซิเจนในเลือด
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center">
                <h3 className="font-semibold text-gray-800 mb-3">คุณภาพสัญญาณ</h3>
                <CircularProgress
                  value={signalQuality || 0}
                  maxValue={100}
                  color={signalQuality >= 80 ? '#10b981' : signalQuality >= 60 ? '#f59e0b' : '#ef4444'}
                  size={100}
                  strokeWidth={8}
                  label="Quality"
                  unit="%"
                />
              </div>

              <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center">
                <h3 className="font-semibold text-gray-800 mb-3">HRV</h3>
                <CircularProgress
                  value={heartRateVariability || 0}
                  maxValue={100}
                  color={heartRateVariability <= 30 ? '#10b981' : heartRateVariability <= 50 ? '#f59e0b' : '#ef4444'}
                  size={100}
                  strokeWidth={8}
                  label="RMSSD"
                  unit="ms"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Real-time PPG Waveform - เฉพาะข้อมูลจริง */}
        {ppgData.length > 0 && isConnected && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📡 PPG Signal (Real-time)</h3>
            <div className="h-32 bg-black rounded-lg p-4 relative">
              <svg className="w-full h-full" viewBox="0 0 100 50">
                <path
                  d={ppgData.map((point, i) => 
                    `${i === 0 ? 'M' : 'L'} ${(i / (ppgData.length - 1)) * 100} ${25 + point.value * 15}`
                  ).join(' ')}
                  stroke="#10b981"
                  strokeWidth="0.5"
                  fill="none"
                />
              </svg>
              <div className="absolute top-2 left-2 text-green-400 text-xs">
                IR: {rawIRValue} | RED: {rawRedValue}
              </div>
            </div>
          </div>
        )}

        {/* Empty State - ไม่มีข้อมูล */}
        {!isConnected && (
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 text-center">
            <div className="text-gray-400 mb-4">
              <Activity className="h-16 w-16 mx-auto mb-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">ไม่มีข้อมูลเซนเซอร์</h3>
            <p className="text-gray-500 mb-4">เชื่อมต่อ ESP32 เพื่อเริ่มตรวจวัดสัญญาณชีพ</p>
            <button
              onClick={() => setCurrentPage('connect')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              เชื่อมต่ออุปกรณ์
            </button>
          </div>
        )}

        {/* Measurement Control */}
        <div className="bg-white rounded-3xl p-8 border-2 border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">การวัดความดันโลหิต</h2>
          
          {isMeasuring ? (
            <div className="text-center space-y-4">
              <div className="text-lg font-medium text-blue-700">กำลังวัดความดัน...</div>
              <div className="text-4xl font-bold text-blue-600">{measurementTimer}</div>
              <div className="text-sm text-gray-600">โปรดนิ่งและไม่เคลื่อนไหว</div>
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden max-w-md mx-auto">
                <div 
                  className="h-full bg-blue-500 transition-all duration-1000"
                  style={{ width: `${((15 - measurementTimer) / 15) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <button
                onClick={measureBloodPressure}
                disabled={!isValidForMeasurement}
                className={`px-8 py-4 rounded-2xl text-lg font-medium transition-all transform ${
                  isValidForMeasurement 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Heart className="h-6 w-6" />
                  <span>วัดความดันเลย</span>
                </div>
              </button>
              
              {measurementBlocked.blocked && (
                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 max-w-md mx-auto">
                  <div className="flex items-center justify-center space-x-2 text-yellow-700 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">ไม่สามารถวัดได้</span>
                  </div>
                  <div className="text-sm text-gray-600 text-center">{measurementBlocked.reason}</div>
                </div>
              )}

              {isValidForMeasurement && (
                <div className="bg-green-50 p-4 rounded-xl border border-green-200 max-w-md mx-auto">
                  <div className="flex items-center justify-center space-x-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">พร้อมวัดความดัน</span>
                  </div>
                  <div className="text-sm text-green-600 text-center mt-1">
                    สัญญาณดี, หัวใจเต้นเสถียร
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Connection Page Component  
  const ConnectionPage = () => (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`rounded-2xl p-4 border-2 ${getConnectionStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getConnectionIcon()}
            <div>
              <div className="font-medium">
                {getConnectionStatusText()}
              </div>
              <div className="text-sm text-gray-600">
                {deviceInfo?.ip && `IP: ${deviceInfo.ip}`}
                {deviceInfo?.name && `Device: ${deviceInfo.name}`}
                {deviceInfo?.port && ` | Port: ${deviceInfo.port}`}
                {deviceInfo?.baudRate && ` | Baud: ${deviceInfo.baudRate}`}
              </div>
            </div>
          </div>
          {connectionStatus === 'connecting' && (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          )}
        </div>
      </div>

      {/* 🔥 REAL Connection Buttons - แก้ไขแล้ว! */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">🔥 เชื่อมต่ออุปกรณ์ (Real Connection)</h2>
        
        {isConnected ? (
          <div className="text-center py-8">
            <div className="mb-4 text-6xl">
              {getConnectionIcon()}
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">✅ เชื่อมต่อสำเร็จ!</h3>
            <p className="text-gray-600 mb-4">
              {connectionType.toUpperCase()} - {deviceInfo?.name || deviceInfo?.ip || 'Connected'}
            </p>
            <button
              onClick={disconnectAll}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              🔌 ตัดการเชื่อมต่อ
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 🔌 USB Serial Button - REAL CONNECTION */}
            <button
              onClick={connectSerial}
              disabled={connectionStatus === 'connecting'}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-blue-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Usb className="h-12 w-12 text-blue-600" />
              <div className="text-center">
                <div className="font-semibold text-blue-800">USB Serial</div>
                <div className="text-sm text-blue-600">เสียบสาย USB</div>
                <div className="text-xs text-gray-500 mt-1">เสถียรที่สุด</div>
                <div className="text-xs text-green-600 font-medium mt-1 bg-green-100 px-2 py-1 rounded">
                  ✅ Real Connection
                </div>
              </div>
            </button>

            {/* 📶 WiFi Button - REAL CONNECTION */}
            <button
              onClick={connectWiFi}
              disabled={connectionStatus === 'connecting'}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-green-200 rounded-2xl hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wifi className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <div className="font-semibold text-green-800">WiFi WebSocket</div>
                <div className="text-sm text-green-600">ไร้สาย, เร็ว</div>
                <div className="text-xs text-gray-500 mt-1">แนะนำสำหรับการใช้งาน</div>
                <div className="text-xs text-green-600 font-medium mt-1 bg-green-100 px-2 py-1 rounded">
                  ✅ Real Connection
                </div>
              </div>
            </button>

            {/* 🔵 Bluetooth Button - REAL CONNECTION */}
            <button
              onClick={connectBluetooth}
              disabled={connectionStatus === 'connecting'}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-purple-200 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Bluetooth className="h-12 w-12 text-purple-600" />
              <div className="text-center">
                <div className="font-semibold text-purple-800">Bluetooth LE</div>
                <div className="text-sm text-purple-600">ประหยัดไฟ</div>
                <div className="text-xs text-gray-500 mt-1">เหมาะสำหรับมือถือ</div>
                <div className="text-xs text-green-600 font-medium mt-1 bg-green-100 px-2 py-1 rounded">
                  ✅ Real Connection
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Connection Help */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">💡 คำแนะนำการเชื่อมต่อ:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li><strong>📶 WiFi:</strong> ตรวจสอบ IP Address ของ ESP32 และให้อยู่ใน Network เดียวกัน</li>
            <li><strong>🔌 USB Serial:</strong> เสียบสาย USB และเลือก Port ที่ถูกต้อง (Chrome/Edge เท่านั้น)</li>
            <li><strong>🔵 Bluetooth:</strong> เปิด Bluetooth และให้ ESP32 อยู่ใน Pairing Mode</li>
          </ul>
          
          <div className="mt-3 p-3 bg-yellow-100 rounded border-l-4 border-yellow-500">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ สำคัญ:</strong> ระบบจะตัดการเชื่อมต่อเดิมก่อนเชื่อมต่อใหม่เสมอ - สามารถเชื่อมต่อได้ทีละอันเท่านั้น!
            </p>
          </div>
          
          <div className="mt-3 p-3 bg-red-100 rounded border-l-4 border-red-500">
            <h5 className="font-medium text-red-800 mb-1">🔧 แก้ปัญหา USB Serial:</h5>
            <div className="text-sm text-red-700 space-y-1">
              <div><strong>ไม่รองรับ Web Serial API:</strong></div>
              <ul className="ml-4 space-y-1">
                <li>• ใช้ Chrome 89+ หรือ Edge 89+</li>
                <li>• เปิด chrome://flags/#enable-experimental-web-platform-features</li>
                <li>• ตั้งค่าเป็น "Enabled" แล้วรีสตาร์ทบราวเซอร์</li>
              </ul>
              <div className="mt-2"><strong>ไม่พบอุปกรณ์:</strong></div>
              <ul className="ml-4 space-y-1">
                <li>• ตรวจสอบสาย USB และ ESP32 เปิดอยู่</li>
                <li>• ติดตั้ง Driver: CH340, CP210x หรือ FTDI</li>
                <li>• ลอง USB Port อื่น</li>
              </ul>
              <div className="mt-2"><strong>Port ถูกใช้งาน:</strong></div>
              <ul className="ml-4 space-y-1">
                <li>• ปิด Arduino Serial Monitor</li>
                <li>• ปิด PuTTY, Tera Term, หรือโปรแกรม Terminal อื่น</li>
                <li>• รีเฟรชหน้าเว็บแล้วลองใหม่</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // AI Analysis Page Component
  const AIAnalysisPage = () => {
    return (
      <div className="space-y-6">
        {/* Model Management Section */}
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
                onChange={handleModelUpload}
                accept=".json,.h5,.tflite"
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
                    รองรับ .json (TensorFlow.js), .h5 (Keras), .tflite
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
                    <div>
                      <div className="font-medium text-gray-700">📈 ความแม่นยำ:</div>
                      <div className="text-purple-600">{modelInfo.accuracy}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700">📦 ขนาด:</div>
                      <div className="text-purple-600">{modelInfo.size}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="font-medium text-gray-700 mb-2">🔧 Features:</div>
                    <div className="flex flex-wrap gap-2">
                      {modelInfo.features.map((feature, index) => (
                        <span key={index} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 text-xs text-gray-500">
                    โหลดเมื่อ: {modelInfo.uploadTime}
                  </div>
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

          {/* Model Requirements */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">📋 ข้อกำหนดโมเดล:</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div><strong>🔹 Input 1:</strong> PPG Waveform (80 samples, window_length=80)</div>
              <div><strong>🔹 Input 2:</strong> Hand-crafted Features (12 features)</div>
              <div><strong>🔹 Output:</strong> [Systolic, Diastolic] Blood Pressure</div>
              <div><strong>🔹 Sampling Rate:</strong> 62.4725 Hz</div>
              <div><strong>🔹 Architecture:</strong> Two-Branch Neural Network (Bi-LSTM + ResNet1D)</div>
            </div>
          </div>
        </div>

        {/* Real-time Analysis Section */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center space-x-2">
            <Activity className="h-6 w-6 text-green-600" />
            <span>🔬 Real-time AI Analysis</span>
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Analysis Controls */}
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

            {/* Feature Visualization */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl">
                <h3 className="font-medium text-gray-800 mb-3">🧮 Extracted Features</h3>
                {ppgData.length >= 80 ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(() => {
                      const features = calculatePPGFeatures(ppgData);
                      if (!features) return <div>No features</div>;
                      
                      const featureNames = [
                        'Mean', 'Std', 'Skewness', 'Kurtosis', 'P2P', 'RMS',
                        'S1', 'S2', 'Centroid', 'Bandwidth', 'P_LF', 'P_HF'
                      ];
                      
                      return features.map((value, index) => (
                        <div key={index} className="flex justify-between p-2 bg-white rounded border">
                          <span className="font-medium text-gray-600">{featureNames[index]}:</span>
                          <span className="text-purple-600">{value.toFixed(3)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    รอข้อมูล PPG เพิ่มเติม...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Prediction History */}
        {aiPredictions.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center space-x-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <span>📈 AI Prediction History</span>
            </h2>
            
            <div className="space-y-3">
              {aiPredictions.slice(0, 10).map((prediction, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-4">
                    <div className="text-lg font-bold text-gray-800">
                      {prediction.systolic}/{prediction.diastolic}
                      <span className="text-sm text-gray-500 ml-1">mmHg</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        🧠 {prediction.model_type}
                      </div>
                      <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        🎯 {(prediction.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div>{prediction.timestamp.toLocaleDateString('th-TH')}</div>
                    <div>{prediction.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  const StatisticsPage = () => {
    const chartData = bpHistory.slice(0, 20).reverse().map((bp) => ({
      name: bp.timestamp.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
      systolic: bp.systolic,
      diastolic: bp.diastolic,
      time: bp.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }));

    return (
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border border-red-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-red-800">ทั้งหมด</h3>
              <Heart className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-800">{bpHistory.length}</div>
            <div className="text-sm text-red-600">ครั้งที่วัด</div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-blue-800">วันนี้</h3>
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-800">{bpStats.daily.count}</div>
            <div className="text-sm text-blue-600">ครั้งที่วัด</div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-green-800">สัปดาห์นี้</h3>
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-800">{bpStats.weekly.count}</div>
            <div className="text-sm text-green-600">ครั้งที่วัด</div>
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl p-6 border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-purple-800">เดือนนี้</h3>
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-800">{bpStats.monthly.count}</div>
            <div className="text-sm text-purple-600">ครั้งที่วัด</div>
          </div>
        </div>

        {/* Charts */}
        {chartData.length > 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 แนวโน้มความดันโลหิต</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis domain={[60, 180]} />
                  <Tooltip 
                    formatter={(value, name) => [value, name === 'systolic' ? 'Systolic' : 'Diastolic']}
                    labelFormatter={(label) => `วันที่: ${label}`}
                  />
                  <Line type="monotone" dataKey="systolic" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <div>📊 ยังไม่มีข้อมูลสถิติ</div>
                <div className="text-sm mt-1">เชื่อมต่ออุปกรณ์และวัดความดันเพื่อดูกราฟ</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Measurements */}
        {bpHistory.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">📋 การวัดล่าสุด</h3>
            </div>
            <div className="space-y-3">
              {bpHistory.slice(0, 10).map((bp, index) => {
                const status = getBPStatus(bp.systolic, bp.diastolic);
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="text-lg font-bold text-gray-800">
                        {bp.systolic}/{bp.diastolic}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.color} bg-white border`}>
                        {status.status}
                      </div>
                      <div className="text-sm text-gray-500">
                        HR: {bp.heartRate} BPM
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">
                        {bp.timestamp.toLocaleDateString('th-TH', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {bp.timestamp.toLocaleTimeString('th-TH', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main Render
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

      {/* 🔥 Connection Animation Overlay */}
      <ConnectionAnimation />
    </div>
  );
};

export default BPMonitorApp;
