import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, Settings, Trash2, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const WiFiManagerPage = ({ espIP, setEspIP }) => {
  const [wifiStatus, setWifiStatus] = useState(null);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [localEspIP, setLocalEspIP] = useState(espIP || '');

  // Get WiFi Status
  const getWiFiStatus = async () => {
    if (!localEspIP) {
      setMessage('⚠️ กรุณาใส่ IP Address ของ ESP32 ก่อน');
      return;
    }

    try {
      const response = await fetch(`http://${localEspIP}/api/wifi/status`);
      const data = await response.json();
      setWifiStatus(data);
      setMessage('✅ โหลดสถานะ WiFi สำเร็จ');
    } catch (error) {
      console.error('Failed to get WiFi status:', error);
      setMessage('❌ ไม่สามารถเชื่อมต่อ ESP32 ได้ - ตรวจสอบ IP Address');
      setWifiStatus(null);
    }
  };

  // Scan WiFi Networks
  const scanNetworks = async () => {
    if (!localEspIP) {
      setMessage('⚠️ กรุณาใส่ IP Address ของ ESP32 ก่อน');
      return;
    }

    setIsScanning(true);
    try {
      const response = await fetch(`http://${localEspIP}/api/wifi/scan`);
      const data = await response.json();
      setAvailableNetworks(data.networks || []);
      setMessage(`✅ พบเครือข่าย ${data.networks?.length || 0} เครือข่าย`);
    } catch (error) {
      setMessage('❌ ไม่สามารถสแกนเครือข่ายได้ - ตรวจสอบการเชื่อมต่อ ESP32');
      console.error('Scan failed:', error);
      setAvailableNetworks([]);
    }
    setIsScanning(false);
  };

  // Connect to WiFi
  const connectToWiFi = async () => {
    if (!selectedNetwork || !password) {
      setMessage('⚠️ กรุณาเลือกเครือข่ายและใส่รหัสผ่าน');
      return;
    }

    if (!localEspIP) {
      setMessage('⚠️ กรุณาใส่ IP Address ของ ESP32 ก่อน');
      return;
    }

    setIsConnecting(true);
    setMessage('🔄 กำลังเชื่อมต่อ... (อาจใช้เวลา 20-30 วินาที)');

    try {
      const response = await fetch(`http://${localEspIP}/api/wifi/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: selectedNetwork.ssid,
          password: password
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage(`✅ เชื่อมต่อสำเร็จ! IP ใหม่: ${result.ip}`);
        setPassword('');
        setSelectedNetwork(null);
        
        // อัพเดท IP ใหม่ถ้ามีการเปลี่ยนแปลง
        if (result.ip && result.ip !== localEspIP) {
          setLocalEspIP(result.ip);
          setEspIP(result.ip);
          setMessage(`✅ เชื่อมต่อสำเร็จ! IP ใหม่: ${result.ip} (กรุณาใช้ IP ใหม่นี้)`);
        }
        
        setTimeout(getWiFiStatus, 3000); // Refresh status
      } else {
        setMessage(`❌ เชื่อมต่อไม่สำเร็จ: ${result.message || 'รหัสผ่านผิด'}`);
      }
    } catch (error) {
      setMessage('❌ ไม่สามารถเชื่อมต่อได้ - ตรวจสอบการเชื่อมต่อ ESP32');
      console.error('Connection failed:', error);
    }

    setIsConnecting(false);
  };

  // Reset WiFi Settings
  const resetWiFi = async () => {
    if (!confirm('ต้องการลบการตั้งค่า WiFi ทั้งหมดใช่หรือไม่?\n\nESP32 จะรีสตาร์ทและกลับไปเป็น Access Point Mode')) return;

    if (!localEspIP) {
      setMessage('⚠️ กรุณาใส่ IP Address ของ ESP32 ก่อน');
      return;
    }

    try {
      await fetch(`http://${localEspIP}/api/wifi/reset`, { method: 'POST' });
      setMessage('🔄 รีเซ็ตการตั้งค่าแล้ว ESP32 กำลังรีสตาร์ท...');
      setTimeout(() => {
        setWifiStatus(null);
        setAvailableNetworks([]);
        setMessage('📡 ESP32 รีสตาร์ทแล้ว ให้เชื่อมต่อ WiFi: BP-Monitor-XXXXXX (รหัส: 12345678)');
      }, 3000);
    } catch (error) {
      setMessage('❌ ไม่สามารถรีเซ็ตได้');
    }
  };

  // Get signal strength color
  const getSignalColor = (rssi) => {
    if (rssi > -50) return 'text-green-600';
    if (rssi > -60) return 'text-yellow-600';
    if (rssi > -70) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get signal bars
  const getSignalBars = (rssi) => {
    if (rssi > -50) return 4;
    if (rssi > -60) return 3;
    if (rssi > -70) return 2;
    return 1;
  };

  // Handle IP input change
  const handleIPChange = (e) => {
    const newIP = e.target.value;
    setLocalEspIP(newIP);
    if (setEspIP) setEspIP(newIP);
  };

  useEffect(() => {
    if (localEspIP) {
      getWiFiStatus();
      scanNetworks();
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* ESP32 IP Configuration */}
      <div className="bg-blue-50 rounded-2xl p-6 border-2 border-blue-200">
        <h2 className="text-xl font-semibold text-blue-800 mb-4">🔧 การตั้งค่า ESP32</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-2">
              IP Address ของ ESP32
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                value={localEspIP}
                onChange={handleIPChange}
                placeholder="192.168.1.100"
                className="flex-1 px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => {
                  getWiFiStatus();
                  scanNetworks();
                }}
                disabled={!localEspIP}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                เชื่อมต่อ
              </button>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">💡 วิธีหา IP Address:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li><strong>1.</strong> เปิด Serial Monitor ใน Arduino IDE (baud rate: 115200)</li>
              <li><strong>2.</strong> รีสตาร์ท ESP32 แล้วดู IP ที่แสดงใน Serial Monitor</li>
              <li><strong>3.</strong> หรือเช็คใน Router admin panel ในส่วน Connected Devices</li>
              <li><strong>4.</strong> ถ้าไม่เจอ ให้รีเซ็ต WiFi แล้วเชื่อมต่อใหม่</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Current WiFi Status */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">📶 สถานะ WiFi ESP32</h2>
          <button
            onClick={getWiFiStatus}
            disabled={!localEspIP}
            className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {wifiStatus ? (
          <div className={`p-4 rounded-xl border-2 ${
            wifiStatus.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3 mb-3">
              <Wifi className={`h-6 w-6 ${wifiStatus.connected ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <div className={`font-medium ${wifiStatus.connected ? 'text-green-800' : 'text-red-800'}`}>
                  {wifiStatus.connected ? '✅ ESP32 เชื่อมต่อ WiFi แล้ว' : '❌ ESP32 ไม่ได้เชื่อมต่อ WiFi'}
                </div>
                {wifiStatus.connected && (
                  <div className="text-sm text-gray-600">
                    เครือข่าย: {wifiStatus.ssid} | IP: {wifiStatus.ip} | สัญญาณ: {wifiStatus.rssi} dBm
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Uptime: {Math.floor(wifiStatus.uptime / 60000)} นาที | RAM: {Math.floor(wifiStatus.freeHeap / 1024)} KB
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader className="h-6 w-6 animate-spin mr-2" />
            {localEspIP ? 'กำลังโหลดสถานะ...' : 'กรุณาใส่ IP Address ของ ESP32'}
          </div>
        )}
      </div>

      {/* Available Networks */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">🔍 เครือข่าย WiFi ที่พบ</h2>
          <button
            onClick={scanNetworks}
            disabled={isScanning || !localEspIP}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'กำลังสแกน...' : 'สแกนใหม่'}</span>
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableNetworks.length > 0 ? (
            availableNetworks.map((network, index) => (
              <div
                key={index}
                onClick={() => setSelectedNetwork(network)}
                className={`p-4 border rounded-xl cursor-pointer transition-colors ${
                  selectedNetwork?.ssid === network.ssid
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Wifi className={`h-5 w-5 ${getSignalColor(network.rssi)}`} />
                    <div>
                      <div className="font-medium text-gray-800">{network.ssid}</div>
                      <div className="text-sm text-gray-500">
                        {network.encryption} | ช่อง {network.channel}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`text-sm font-medium ${getSignalColor(network.rssi)}`}>
                      {network.rssi} dBm
                    </div>
                    <div className="flex space-x-1">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-4 rounded ${
                            i < getSignalBars(network.rssi) ? getSignalColor(network.rssi).replace('text-', 'bg-') : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              {localEspIP ? '🔍 กดปุ่ม "สแกนใหม่" เพื่อค้นหาเครือข่าย WiFi' : '⚠️ กรุณาใส่ IP Address ก่อน'}
            </div>
          )}
        </div>
      </div>

      {/* Connect Form */}
      {selectedNetwork && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            🔐 เชื่อมต่อ ESP32 กับ: {selectedNetwork.ssid}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                รหัสผ่าน WiFi
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ใส่รหัสผ่าน WiFi"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={connectToWiFi}
                disabled={isConnecting || !password || !localEspIP}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                <span>{isConnecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ ESP32'}</span>
              </button>
              
              <button
                onClick={() => {
                  setSelectedNetwork(null);
                  setPassword('');
                }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ การจัดการ ESP32</h3>
        
        <button
          onClick={resetWiFi}
          disabled={!localEspIP}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          <span>รีเซ็ต WiFi Settings</span>
        </button>
        
        <p className="text-sm text-gray-500 mt-2">
          จะลบการตั้งค่า WiFi ที่บันทึกไว้ทั้งหมด ESP32 จะรีสตาร์ทและกลับไป AP Mode
        </p>
        
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <h4 className="font-medium text-yellow-800 mb-1">📋 ขั้นตอนหลังรีเซ็ต:</h4>
          <ol className="text-sm text-yellow-700 space-y-1">
            <li>1. ESP32 จะสร้าง WiFi hotspot: <strong>BP-Monitor-XXXXXX</strong></li>
            <li>2. เชื่อมต่อด้วยรหัส: <strong>12345678</strong></li>
            <li>3. เปิดเบราว์เซอร์ไป: <strong>192.168.4.1</strong></li>
            <li>4. เลือก WiFi และใส่รหัสผ่าน</li>
            <li>5. ESP32 จะได้ IP ใหม่แล้วกลับมาใส่ที่นี่</li>
          </ol>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-xl border-2 ${
          message.includes('✅') ? 'bg-green-50 border-green-200 text-green-800' :
          message.includes('❌') ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default WiFiManagerPage;
