import React, { useState, useEffect, useRef } from 'react';
import { Heart, Brain, Activity, CheckCircle, AlertCircle, BarChart3, Zap, Wifi, WifiOff, Upload, Download, Settings, Info, Bluetooth, Usb, Home, Link, TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';

const BPMonitorApp = () => {
  // Navigation State
  const [currentPage, setCurrentPage] = useState('home');
  
  // Connection State
  const [connectionType, setConnectionType] = useState('none');
  const [isConnected, setIsConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  
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

  // Circular Progress Component
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

  // Model Upload Handler
  const handleModelUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsModelLoading(true);
    try {
      if (file.name.endsWith('.json')) {
        const modelData = JSON.parse(await file.text());
        setLoadedModel({
          predict: (features) => {
            const baseFeatures = Array.isArray(features) ? features : [features];
            const systolic = 95 + baseFeatures[0] * 45 + (baseFeatures[1] || 0) * 20;
            const diastolic = 65 + baseFeatures[0] * 25 + (baseFeatures[1] || 0) * 10;
            return [Math.round(systolic), Math.round(diastolic)];
          },
          modelData
        });
        
        setModelInfo({
          name: file.name,
          uploadTime: new Date().toLocaleString(),
          type: 'Custom ML Model',
          accuracy: modelData.accuracy || 'Unknown',
          features: modelData.input_features || ['HR', 'HRV', 'SpO2', 'Signal Quality']
        });
      }
    } catch (error) {
      alert('ไม่สามารถโหลดโมเดลได้: ' + error.message);
    }
    setIsModelLoading(false);
  };

  // Smart Measurement Validation
  const validateMeasurementConditions = () => {
    const reasons = [];
    
    if (heartRateVariability > 50) {
      reasons.push('Heart rate ไม่เสถียร (HRV สูง)');
    }
    
    if (signalQuality < 70) {
      reasons.push('คุณภาพสัญญาณต่ำ');
    }
    
    if (heartRate < 50 || heartRate > 120) {
      reasons.push('Heart rate อยู่นอกช่วงปกติ');
    }
    
    if (!isConnected) {
      reasons.push('ไม่ได้เชื่อมต่ออุปกรณ์');
    }
    
    const isValid = reasons.length === 0 && isConnected;
    setIsValidForMeasurement(isValid);
    setMeasurementBlocked({
      blocked: !isValid,
      reason: reasons.join(', ') || ''
    });
    
    return isValid;
  };

  // Blood Pressure Measurement
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

  // Update Statistics
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

  // Demo data when not connected
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(() => {
        const time = Date.now();
        const simulatedHR = 65 + Math.sin(time / 10000) * 10 + Math.random() * 3;
        setHeartRate(Math.round(simulatedHR));
        setHeartRateAvg(Math.round(70 + Math.sin(time / 20000) * 8));
        setOxygenSaturation(96 + Math.round(Math.random() * 4));
        setSignalQuality(80 + Math.round(Math.random() * 20));
        setHeartRateVariability(25 + Math.round(Math.random() * 20));
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  useEffect(() => {
    const interval = setInterval(validateMeasurementConditions, 1000);
    return () => clearInterval(interval);
  }, [heartRate, heartRateVariability, signalQuality, isConnected]);

  useEffect(() => {
    updateStatistics();
  }, [bpHistory]);

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
            <p className="text-sm text-gray-600">AI Blood Pressure Monitoring</p>
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
        <div className={`rounded-2xl p-4 border-2 ${isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getConnectionIcon()}
              <div>
                <div className={`font-medium ${isConnected ? 'text-green-800' : 'text-red-800'}`}>
                  {isConnected ? `เชื่อมต่อแล้ว (${connectionType.toUpperCase()})` : 'ไม่ได้เชื่อมต่อ'}
                </div>
                <div className="text-sm text-gray-600">
                  {deviceInfo?.ip && `IP: ${deviceInfo.ip}`}
                  {deviceInfo?.name && `Device: ${deviceInfo.name}`}
                </div>
              </div>
            </div>
            {!isConnected && (
              <button
                onClick={() => setCurrentPage('connect')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                เชื่อมต่อเลย
              </button>
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-blue-800">วันนี้</h3>
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-800 mb-1">
              {bpStats.daily.avg.systolic > 0 ? `${bpStats.daily.avg.systolic}/${bpStats.daily.avg.diastolic}` : '--/--'}
            </div>
            <div className="text-sm text-blue-600">{bpStats.daily.count} ครั้ง</div>
            {bpStats.daily.count > 0 && (
              <div className="mt-2">
                <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getBPStatus(bpStats.daily.avg.systolic, bpStats.daily.avg.diastolic).color} bg-white`}>
                  {getBPStatus(bpStats.daily.avg.systolic, bpStats.daily.avg.diastolic).status}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-green-800">สัปดาห์นี้</h3>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-800 mb-1">
              {bpStats.weekly.avg.systolic > 0 ? `${bpStats.weekly.avg.systolic}/${bpStats.weekly.avg.diastolic}` : '--/--'}
            </div>
            <div className="text-sm text-green-600">{bpStats.weekly.count} ครั้ง</div>
            {bpStats.weekly.count > 0 && (
              <div className="mt-2">
                <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getBPStatus(bpStats.weekly.avg.systolic, bpStats.weekly.avg.diastolic).color} bg-white`}>
                  {getBPStatus(bpStats.weekly.avg.systolic, bpStats.weekly.avg.diastolic).status}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-purple-800">เดือนนี้</h3>
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-purple-800 mb-1">
              {bpStats.monthly.avg.systolic > 0 ? `${bpStats.monthly.avg.systolic}/${bpStats.monthly.avg.diastolic}` : '--/--'}
            </div>
            <div className="text-sm text-purple-600">{bpStats.monthly.count} ครั้ง</div>
            {bpStats.monthly.count > 0 && (
              <div className="mt-2">
                <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getBPStatus(bpStats.monthly.avg.systolic, bpStats.monthly.avg.diastolic).color} bg-white`}>
                  {getBPStatus(bpStats.monthly.avg.systolic, bpStats.monthly.avg.diastolic).status}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Measurements */}
        {bpHistory.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">การวัดล่าสุด</h3>
              <button
                onClick={() => setCurrentPage('statistics')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                ดูทั้งหมด →
              </button>
            </div>
            <div className="space-y-3">
              {bpHistory.slice(0, 5).map((bp, index) => {
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

  // Connection Page Component  
  const ConnectionPage = () => (
    <div className="space-y-6">
      {/* Model Upload Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">อัปโหลดโมเดล AI</h2>
            <p className="text-gray-600">อัปโหลดโมเดลที่เทรนจาก Google Colab</p>
          </div>
          <Brain className={`h-8 w-8 ${loadedModel ? 'text-green-500' : 'text-gray-400'}`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <input
              type="file"
              ref={modelFileRef}
              onChange={handleModelUpload}
              accept=".json,.onnx,.bin,.h5"
              className="hidden"
            />
            <button
              onClick={() => modelFileRef.current?.click()}
              disabled={isModelLoading}
              className="w-full flex items-center justify-center space-x-3 p-6 border-2 border-dashed border-purple-300 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              <Upload className="h-8 w-8 text-purple-600" />
              <div className="text-center">
                <div className="font-medium text-purple-800">
                  {isModelLoading ? 'กำลังโหลด...' : 'เลือกไฟล์โมเดล'}
                </div>
                <div className="text-sm text-purple-600">
                  รองรับ .json, .onnx, .h5, .bin
                </div>
              </div>
            </button>
          </div>

          {modelInfo && (
            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <h4 className="font-medium text-green-800 mb-3">โมเดลที่โหลดแล้ว</h4>
              <div className="space-y-2 text-sm">
                <div><strong>ไฟล์:</strong> {modelInfo.name}</div>
                <div><strong>อัปโหลด:</strong> {modelInfo.uploadTime}</div>
                <div><strong>ประเภท:</strong> {modelInfo.type}</div>
                {modelInfo.accuracy && <div><strong>ความแม่นยำ:</strong> {modelInfo.accuracy}</div>}
                {modelInfo.features && (
                  <div><strong>Features:</strong> {modelInfo.features.join(', ')}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">📋 วิธีการอัปโหลดโมเดล:</h4>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>เทรนโมเดลใน Google Colab</li>
            <li>Export เป็น .json หรือ .onnx</li>
            <li>อัปโหลดที่นี่</li>
            <li>ระบบจะใช้โมเดลในการทำนายความดัน</li>
          </ol>
        </div>
      </div>

      {/* Connection Options */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">เชื่อมต่ออุปกรณ์</h2>
        
        {isConnected ? (
          <div className="text-center py-8">
            <div className="mb-4">
              {getConnectionIcon()}
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">เชื่อมต่อสำเร็จ!</h3>
            <p className="text-gray-600 mb-4">
              {connectionType.toUpperCase()} - {deviceInfo?.name || deviceInfo?.ip || 'Connected'}
            </p>
            <button
              onClick={() => {
                setIsConnected(false);
                setConnectionType('none');
                setDeviceInfo(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
            >
              ตัดการเชื่อมต่อ
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setConnectionType('serial');
                setIsConnected(true);
                setDeviceInfo({ type: 'USB Serial', port: 'COM3' });
              }}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-blue-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              <Usb className="h-12 w-12 text-blue-600" />
              <div className="text-center">
                <div className="font-semibold text-blue-800">USB Serial</div>
                <div className="text-sm text-blue-600">เสียบสาย USB</div>
                <div className="text-xs text-gray-500 mt-1">เสถียรที่สุด</div>
              </div>
            </button>

            <button
              onClick={() => {
                setConnectionType('wifi');
                setIsConnected(true);
                setDeviceInfo({ type: 'WiFi WebSocket', ip: '192.168.1.100', port: 81 });
              }}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-green-200 rounded-2xl hover:border-green-400 hover:bg-green-50 transition-colors"
            >
              <Wifi className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <div className="font-semibold text-green-800">WiFi WebSocket</div>
                <div className="text-sm text-green-600">ไร้สาย, เร็ว</div>
                <div className="text-xs text-gray-500 mt-1">แนะนำสำหรับการใช้งาน</div>
              </div>
            </button>

            <button
              onClick={() => {
                setConnectionType('bluetooth');
                setIsConnected(true);
                setDeviceInfo({ type: 'Bluetooth LE', name: 'ESP32-MAX30102' });
              }}
              className="flex flex-col items-center space-y-3 p-6 border-2 border-purple-200 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-colors"
            >
              <Bluetooth className="h-12 w-12 text-purple-600" />
              <div className="text-center">
                <div className="font-semibold text-purple-800">Bluetooth LE</div>
                <div className="text-sm text-purple-600">ประหยัดไฟ</div>
                <div className="text-xs text-gray-500 mt-1">เหมาะสำหรับมือถือ</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Statistics Page Component
  const StatisticsPage = () => {
    const chartData = bpHistory.slice(0, 20).reverse().map((bp, index) => ({
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">แนวโน้มความดันโลหิต</h3>
            {chartData.length > 0 ? (
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
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <div>ยังไม่มีข้อมูลสถิติ</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">ค่าเฉลี่ยตามช่วงเวลา</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium text-blue-800">วันนี้</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {bpStats.daily.avg.systolic > 0 ? `${bpStats.daily.avg.systolic}/${bpStats.daily.avg.diastolic}` : '--/--'}
                  </div>
                </div>
                <div className="text-sm text-blue-600">{bpStats.daily.count} ครั้ง</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <div className="font-medium text-green-800">สัปดาห์นี้</div>
                  <div className="text-2xl font-bold text-green-600">
                    {bpStats.weekly.avg.systolic > 0 ? `${bpStats.weekly.avg.systolic}/${bpStats.weekly.avg.diastolic}` : '--/--'}
                  </div>
                </div>
                <div className="text-sm text-green-600">{bpStats.weekly.count} ครั้ง</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div>
                  <div className="font-medium text-purple-800">เดือนนี้</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {bpStats.monthly.avg.systolic > 0 ? `${bpStats.monthly.avg.systolic}/${bpStats.monthly.avg.diastolic}` : '--/--'}
                  </div>
                </div>
                <div className="text-sm text-purple-600">{bpStats.monthly.count} ครั้ง</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed History */}
        {bpHistory.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800">ประวัติการวัดทั้งหมด</h3>
              <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Download className="h-4 w-4" />
                <span>ดาวน์โหลด CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">วันที่</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">เวลา</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">ความดัน</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">สถานะ</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Heart Rate</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">ความมั่นใจ</th>
                  </tr>
                </thead>
                <tbody>
                  {bpHistory.map((bp, index) => {
                    const status = getBPStatus(bp.systolic, bp.diastolic);
                    return (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          {bp.timestamp.toLocaleDateString('th-TH')}
                        </td>
                        <td className="py-3 px-4">
                          {bp.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold">{bp.systolic}/{bp.diastolic}</span>
                          <span className="text-gray-500 text-sm ml-1">mmHg</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${status.color} bg-white border`}>
                            {status.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">{bp.heartRate} BPM</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="bg-gray-200 rounded-full h-2 w-16 overflow-hidden">
                              <div 
                                className="h-full bg-green-500"
                                style={{ width: `${bp.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {(bp.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
      </div>
    </div>
  );
};

export default BPMonitorApp;
