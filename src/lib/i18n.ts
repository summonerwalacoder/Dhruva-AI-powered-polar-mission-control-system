export type Lang = 'en' | 'hi'

const T: Record<string, { en: string; hi: string }> = {
  appName: { en: 'DHRUVA', hi: 'ध्रुव' },
  appSub: { en: 'AI-Powered Polar Mission Control', hi: 'एआई-संचालित ध्रुव मिशन नियंत्रण' },
  dashboard: { en: 'Dashboard', hi: 'डैशबोर्ड' },
  missions: { en: 'Missions', hi: 'मिशन' },
  personnel: { en: 'Personnel', hi: 'दल / कार्मिक' },
  cargo: { en: 'Cargo', hi: 'कार्गो' },
  inventory: { en: 'Inventory', hi: 'स्टॉक / भंडार' },
  assets: { en: 'Assets', hi: 'संसाधन' },
  map: { en: 'Map', hi: 'मैप' },
  weather: { en: 'Weather', hi: 'मौसम' },
  alerts: { en: 'Alerts', hi: 'अलर्ट' },
  simulations: { en: 'Simulations', hi: 'सिमुलेशन' },
  assistant: { en: 'AI Assistant', hi: 'एआई सहायक' },
  emergency: { en: 'Emergency', hi: 'आपातकाल' },
  reports: { en: 'Reports', hi: 'रिपोर्ट' },
  analytics: { en: 'Analytics', hi: 'विश्लेषण' },
  admin: { en: 'Admin', hi: 'प्रशासन' },
  login: { en: 'Sign in', hi: 'साइन इन' },
  logout: { en: 'Sign out', hi: 'साइन आउट' },
  online: { en: 'Online', hi: 'ऑनलाइन' },
  offline: { en: 'Offline mode', hi: 'ऑफ़लाइन मोड' },
  retryingSync: { en: 'Replaying queued changes…', hi: 'कतारबद्ध बदलाव पुनः भेजे जा रहे हैं…' },
  users: { en: 'Users', hi: 'उपयोगकर्ता' },
  roles: { en: 'Roles & Permissions', hi: 'भूमिका व अनुमतियाँ' },
  system: { en: 'System Monitoring', hi: 'सिस्टम निगरानी' },
  auditLogs: { en: 'Audit Logs', hi: 'ऑडिट लॉग' },
  integrations: { en: 'Integrations', hi: 'एकीकरण' },
  security: { en: 'Security', hi: 'सुरक्षा' },
  settings: { en: 'Settings', hi: 'सेटिंग्स' },
  missionControl: { en: 'Mission Control', hi: 'मिशन नियंत्रण' },
  hqOverview: { en: 'HQ Overview', hi: 'मुख्यालय अवलोकन' },
  stations: { en: 'Stations', hi: 'स्टेशन' },
  emergencies: { en: 'Emergencies', hi: 'आपात स्थितियाँ' },
  logisticsDashboard: { en: 'Logistics Dashboard', hi: 'लॉजिस्टिक्स डैशबोर्ड' },
  shipments: { en: 'Shipments', hi: 'शिपमेंट' },
  containers: { en: 'Containers', hi: 'कंटेनर' },
  resupply: { en: 'Resupply', hi: 'पुनः आपूर्ति' },
  qrScanner: { en: 'QR Scanner', hi: 'क्यूआर स्कैनर' },
  logisticsAlerts: { en: 'Logistics Alerts', hi: 'लॉजिस्टिक्स अलर्ट' },
  myMission: { en: 'My Mission', hi: 'मेरा मिशन' },
  researchTasks: { en: 'Research Tasks', hi: 'अनुसंधान कार्य' },
  equipment: { en: 'Equipment', hi: 'उपकरण' },
  locationMap: { en: 'Location / Map', hi: 'स्थान / मैप' },
  medicalDashboard: { en: 'Medical Dashboard', hi: 'चिकित्सा डैशबोर्ड' },
  medicalCases: { en: 'Medical Cases', hi: 'चिकित्सा मामले' },
  medicalInventory: { en: 'Medical Inventory', hi: 'चिकित्सा भंडार' },
  emergencyMap: { en: 'Emergency Map', hi: 'आपातकालीन मैप' },
  aiEmergency: { en: 'AI Emergency Assistant', hi: 'एआई आपात सहायक' },
  myTasks: { en: 'My Tasks', hi: 'मेरे कार्य' },
  myEquipment: { en: 'My Equipment', hi: 'मेरे उपकरण' },
  profile: { en: 'Profile', hi: 'प्रोफ़ाइल' },
}

export function t(key: string, lang: Lang): string {
  const row = T[key]
  if (!row) return key
  return row[lang] || row.en
}

export function detectLang(hint: Lang | string | null | undefined): Lang {
  if (hint === 'hi') return 'hi'
  return 'en'
}