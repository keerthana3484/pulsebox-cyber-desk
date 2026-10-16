// Mock Data and Telemetry State for PulseBox Cyber Desk Simulator

export const initialMockState = {
  system: {
    deviceName: "PULSEBOX-DESK-01",
    chipset: "ESP32-S3 (Dual-Core 240MHz)",
    firmwareVersion: "v0.8.2-alpha",
    display: "2.8\" SPI TFT 320x240 ILI9341",
    uptimeSeconds: 14820,
    coreTempC: 41.6,
    freeHeapBytes: 218450,
    totalHeapBytes: 327680,
    wifiSsid: "CYBER_LAB_5G",
    wifiRssi: -58,
    ipAddress: "192.168.1.142",
    batteryVoltage: 3.96,
    isUsbPowered: true,
    overallHealth: "NOMINAL",
  },
  servers: [
    {
      id: "srv-api",
      name: "API Gateway",
      role: "Public Ingress / Envoy",
      status: "online",
      latencyMs: 24,
      uptime: "99.98%",
      history: [26, 28, 24, 25, 23, 27, 24, 22, 25, 24],
      requestsPerSec: 1420,
    },
    {
      id: "srv-auth",
      name: "Auth Cluster",
      role: "JWT / OAuth2 / Vault",
      status: "online",
      latencyMs: 18,
      uptime: "99.95%",
      history: [19, 21, 18, 17, 19, 20, 18, 18, 17, 18],
      requestsPerSec: 512,
    },
    {
      id: "srv-db",
      name: "PostgreSQL Primary",
      role: "Transactional Store",
      status: "online",
      latencyMs: 12,
      uptime: "99.99%",
      history: [11, 14, 13, 12, 11, 13, 12, 15, 12, 12],
      requestsPerSec: 890,
    },
    {
      id: "srv-redis",
      name: "Redis Cache Cluster",
      role: "In-Memory Session / PubSub",
      status: "online",
      latencyMs: 2,
      uptime: "100.0%",
      history: [2, 3, 2, 2, 1, 2, 2, 3, 2, 2],
      requestsPerSec: 3200,
    },
    {
      id: "srv-mqtt",
      name: "MQTT Broker",
      role: "IoT Telemetry Pipeline",
      status: "online",
      latencyMs: 31,
      uptime: "99.92%",
      history: [29, 34, 30, 31, 35, 32, 30, 31, 29, 31],
      requestsPerSec: 740,
    },
    {
      id: "srv-edge",
      name: "Edge Worker Fleet",
      role: "Global CDN / SSR",
      status: "online",
      latencyMs: 45,
      uptime: "99.90%",
      history: [44, 45, 46, 45, 44, 45, 45, 46, 44, 45],
      requestsPerSec: 2150,
    },
  ],
  incidents: [
    {
      id: "INC-402",
      severity: "P2",
      title: "Edge Fleet Latency Spike",
      service: "Edge Worker Fleet",
      timestamp: "12m ago",
      status: "INVESTIGATING",
      acknowledged: false,
      detail: "Elevated p99 latency observed in US-East-1 region. Traffic rerouted.",
    },
    {
      id: "INC-398",
      severity: "P3",
      title: "Redis Memory Pressure > 85%",
      service: "Redis Cache Cluster",
      timestamp: "1h 45m ago",
      status: "ACKNOWLEDGED",
      acknowledged: true,
      detail: "LRU eviction policy actively purging stale session keys. Stable.",
    },
    {
      id: "INC-391",
      severity: "P1",
      title: "TLS Cert Rotation Renewal Delay",
      service: "API Gateway",
      timestamp: "4h 10m ago",
      status: "RESOLVED",
      acknowledged: true,
      detail: "Automated ACME challenge failed on retry 2. Manual sign executed.",
    },
  ],
  cloudCosts: {
    currency: "USD",
    billingCycle: "October 2026",
    daysRemaining: 15,
    monthlyBudget: 2500.0,
    currentSpend: 1842.6,
    burnRatePerHour: 2.56,
    projectedMonthEnd: 2380.0,
    breakdown: [
      { name: "Compute (K8s/EC2)", amount: 980.4, percentage: 53.2, color: "#FF5722" },
      { name: "Managed DB (RDS)", amount: 462.1, percentage: 25.1, color: "#FFB300" },
      { name: "Storage & Backups", amount: 218.3, percentage: 11.8, color: "#FF8A65" },
      { name: "Network & CDN Egress", amount: 181.8, percentage: 9.9, color: "#FFE082" },
    ],
    dailyTrend: [54, 58, 62, 59, 64, 61, 58, 63, 67, 65, 61, 60, 59, 62, 63],
  },
  deploy: {
    production: {
      version: "v2.4.0",
      commit: "8f3b2a1",
      branch: "main",
      deployedAt: "Yesterday, 17:42 UTC",
      author: "alex@pulsebox.dev",
    },
    staging: {
      version: "v2.4.1-rc3",
      commit: "c19e44f",
      branch: "release/v2.4.1",
      message: "feat: low-overhead ESP32 MQTT binary payload encoder",
      author: "sarah@pulsebox.dev",
      readyToShip: true,
    },
    activeJob: null, // { step: 1, totalSteps: 4, logs: [], status: 'running'|'done'|'idle' }
  },
  companion: {
    city: "Cyber District // Neo-Sector 7",
    tempC: 22,
    tempF: 72,
    condition: "Foggy Neon",
    weatherIcon: "fog",
    humidity: "62%",
    airQuality: "24 AQI (Good)",
    pomodoro: {
      mode: "focus", // 'focus' | 'break'
      durationMinutes: 25,
      remainingSeconds: 25 * 60,
      isRunning: false,
      sessionsCompleted: 3,
    },
  },
  settings: {
    crtScanlines: true,
    scanlineIntensity: 0.18,
    colorTheme: "amber-orange", // 'amber-orange' | 'phosphor-green' | 'cyber-cyan'
    screenBrightness: 100, // 40, 70, 100
    displayScale: "fit", // '1x', '1.5x', '2x', 'fit'
    mascotPersonality: "snarky", // 'snarky' | 'zen' | 'tactical'
    soundEnabled: true,
    liveTelemetryPulse: true,
  },
};

// Deep clone for initial state reset
export function createMockState() {
  return JSON.parse(JSON.stringify(initialMockState));
}
