// เพิ่มใน React App
import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, Settings, Trash2, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const WiFiManagerPage = () => {
  const [wifiStatus, setWifiStatus] = useState(null);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('');

  // Get WiFi Status
  const getWiFiStatus = async () => {
    try {
      const response = await fetch(`http://${espIP}:80/api/wifi/status`);
      const data = await response.json();
      setWifiStatus(data);
    } catch (error) {
      console.error('Failed to get WiFi status:', error);
    }
  };

  // Scan WiFi Networks
  const scanNetworks = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`http://${espIP}:80/api/wifi/scan`);
      const data = await response.json();
      setAvailableNetworks(data.networks);
      setMessage('✅ สแกนเครือข่ายสำเร็จ');
    } catch (error) {
      setMessage('❌ ไม่สามารถสแกนเครือข่ายได้');
      console.error('Scan failed:', error);
    }
    setIsScanning(false);
  };

  // Connect to WiFi
  const connectToWiFi = async () => {
    if (!selectedNetwork || !password) {
      setMessage('⚠️ กรุณาเลือกเครือข่ายและใส่รหัสผ่าน');
      return;
    }

    setIsConnecting(true);
    setMessage('🔄 กำลังเชื่อมต่อ...');

    try {
      const response = await fetch(`http://${espIP}:80/api/wifi/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: selectedNetwork.ssid,
          password: password
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage(`✅ เชื่อมต่อสำเร็จ! IP: ${result.ip}`);
        setPassword('');
        setSelectedNetwork(null);
        setTimeout(getWiFiStatus, 2000); // Refresh status
      } else {
        setMessage(`❌ เชื่อมต่อไม่สำเร็จ: ${result.message}`);
      }
    } catch (error) {
      setMessage('❌ ไม่สามารถเชื่อมต่อได้');
      console.error('Connection failed:', error);
    }

    setIsConnecting(false);
  };

  // Reset WiFi Settings
  const resetWiFi = async () => {
    if (!confirm('ต้องการลบการตั้งค่า WiFi ทั้งหมดใช่หรือไม่?')) return;

    try {
      await fetch(`http://${espIP}:80/api/wifi/reset`, { method: 'POST' });
      setMessage('🔄 รีเซ็ตการตั้งค่าแล้ว ESP32 จะรีสตาร์ท');
      setTimeout(() => {
        setWifiStatus(null);
        setAvailableNetworks([]);
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

  useEffect(() => {
    getWiFiStatus();
    scanNetworks();
  }, []);

  return (
    <div className="space-y-6">
      {/* Current WiFi Status */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">📶 สถานะ WiFi</h2>
          <button
            onClick={getWiFiStatus}
            className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-100"
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
                  {wifiStatus.connected ? '✅ เชื่อมต่อแล้ว' : '❌ ไม่ได้เชื่อมต่อ'}
                </div>
                {wifiStatus.connected && (
                  <div className="text-sm text-gray-600">
                    {wifiStatus.ssid} | IP: {wifiStatus.ip} | สัญญาณ: {wifiStatus.rssi} dBm
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader className="h-6 w-6 animate-spin mr-2" />
            กำลังโหลดสถานะ...
          </div>
        )}
      </div>

      {/* Available Networks */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">🔍 เครือข่ายที่พบ</h2>
          <button
            onClick={scanNetworks}
            disabled={isScanning}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'กำลังสแกน...' : 'สแกนใหม่'}</span>
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableNetworks.map((network, index) => (
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
          ))}
        </div>
      </div>

      {/* Connect Form */}
      {selectedNetwork && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            🔐 เชื่อมต่อ: {selectedNetwork.ssid}
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
                disabled={isConnecting || !password}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                <span>{isConnecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ'}</span>
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
        <h3 className="text-lg font-semibold text-gray-800 mb-4">⚙️ การจัดการ</h3>
        
        <button
          onClick={resetWiFi}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
          <span>ลบการตั้งค่า WiFi ทั้งหมด</span>
        </button>
        
        <p className="text-sm text-gray-500 mt-2">
          จะลบการตั้งค่า WiFi ที่บันทึกไว้ทั้งหมด และ ESP32 จะรีสตาร์ท
        </p>
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
