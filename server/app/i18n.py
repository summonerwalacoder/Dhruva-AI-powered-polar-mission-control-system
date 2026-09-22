"""Minimal multilingual support. English + Hindi are fully implemented.

The architecture is dictionary-driven so additional languages can be added by
extending `LANGUAGES` and `TRANSLATIONS`.
"""

# Devanagari range check for Hindi detection
DEVANAGARI = range(0x0900, 0x0980)

LANGUAGES = {
    "en": {"name": "English", "native": "English"},
    "hi": {"name": "Hindi", "native": "हिंदी"},
    "bn": {"name": "Bengali", "native": "বাংলা"},
    "mr": {"name": "Marathi", "native": "मराठी"},
    "ta": {"name": "Tamil", "native": "தமிழ்"},
    "te": {"name": "Telugu", "native": "తెలుగు"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ"},
    "ml": {"name": "Malayalam", "native": "മലയാളം"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી"},
    "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ"},
}

TRANSLATIONS = {
    "en": {
        "app.name": "DHRUVA",
        "app.tagline": "Plan • Track • Predict • Respond",
        "nav.dashboard": "Dashboard",
        "nav.missions": "Missions",
        "nav.personnel": "Personnel",
        "nav.cargo": "Cargo",
        "nav.inventory": "Inventory",
        "nav.assets": "Assets",
        "nav.map": "Map",
        "nav.weather": "Weather",
        "nav.alerts": "Alerts",
        "nav.simulations": "Simulations",
        "nav.ai": "AI Assistant",
        "nav.emergency": "Emergency",
        "nav.reports": "Reports",
        "nav.analytics": "Analytics",
        "nav.settings": "Settings",
        "nav.admin": "Administration",
        "status.online": "ONLINE",
        "status.offline": "OFFLINE",
        "status.syncing": "SYNCING",
        "status.last_sync": "Last sync",
        "common.save": "Save",
        "common.cancel": "Cancel",
        "common.search": "Search",
        "common.add": "Add",
        "common.edit": "Edit",
        "common.delete": "Delete",
        "common.close": "Close",
        "common.loading": "Loading...",
        "common.error": "Something went wrong",
        "common.retry": "Retry",
        "common.actions": "Actions",
        "common.confirm": "Confirm",
        "common.status": "Status",
        "common.yes": "Yes",
        "common.no": "No",
        "emergency.title": "Report Emergency",
        "ai.ask": "Ask DHRUVA AI",
        "ai.quick.mission": "Mission Status",
        "ai.quick.fuel": "Fuel Forecast",
        "ai.quick.food": "Food Forecast",
        "ai.quick.cargo": "Cargo Delays",
        "ai.quick.assets": "Asset Risks",
        "ai.quick.alerts": "Current Alerts",
        "ai.quick.simulate": "Simulate Scenario",
        "ai.quick.emergency": "Emergency Help",
    },
    "hi": {
        "app.name": "ध्रुव",
        "app.tagline": "योजना • ट्रैकिंग • पूर्वानुमान • प्रतिक्रिया",
        "nav.dashboard": "डैशबोर्ड",
        "nav.missions": "मिशन",
        "nav.personnel": "दल",
        "nav.cargo": "कार्गो",
        "nav.inventory": "इन्वेंट्री",
        "nav.assets": "संसाधन",
        "nav.map": "नक्शा",
        "nav.weather": "मौसम",
        "nav.alerts": "अलर्ट",
        "nav.simulations": "सिमुलेशन",
        "nav.ai": "AI सहायक",
        "nav.emergency": "आपातकाल",
        "nav.reports": "रिपोर्ट",
        "nav.analytics": "विश्लेषण",
        "nav.settings": "सेटिंग्स",
        "nav.admin": "प्रशासन",
        "status.online": "ऑनलाइन",
        "status.offline": "ऑफ़लाइन",
        "status.syncing": "सिंक हो रहा है",
        "status.last_sync": "अंतिम सिंक",
        "common.save": "सहेजें",
        "common.cancel": "रद्द करें",
        "common.search": "खोजें",
        "common.add": "जोड़ें",
        "common.edit": "संपादित करें",
        "common.delete": "हटाएं",
        "common.close": "बंद करें",
        "common.loading": "लोड हो रहा है...",
        "common.error": "कुछ गलत हुआ",
        "common.retry": "पुनः प्रयास",
        "common.actions": "कार्य",
        "common.confirm": "पुष्टि करें",
        "common.status": "स्थिति",
        "common.yes": "हाँ",
        "common.no": "नहीं",
        "emergency.title": "आपातकाल की सूचना दें",
        "ai.ask": "ध्रुव AI से पूछें",
        "ai.quick.mission": "मिशन स्थिति",
        "ai.quick.fuel": "ईंधन पूर्वानुमान",
        "ai.quick.food": "भोजन पूर्वानुमान",
        "ai.quick.cargo": "कार्गो विलंब",
        "ai.quick.assets": "संसाधन जोखिम",
        "ai.quick.alerts": "वर्तमान अलर्ट",
        "ai.quick.simulate": "परिदृश्य सिमुलेट",
        "ai.quick.emergency": "आपातकालीन सहायता",
    },
}


def detect_language(text: str) -> str:
    """Detects language from the input text. Supports en/hi fully,
    and falls back to en. Architecture allows easy extension."""
    if not text:
        return "en"
    for ch in text:
        if ord(ch) in DEVANAGARI:
            return "hi"
    t = text.lower()
    # Common Hindi words/phrases (Roman script)
    hindi_words = [
        "kitna", "kab", "kya", "hai", "kitne", "din", "ka", "food", "fuel",
        "bacha", "raha", "nahi", "band", "ho", "gaya", "kharab", "humare",
        "paas", "resupply", "mausam", "risk", "kya hua", "kaise",
    ]
    hits = sum(1 for w in hindi_words if w in t)
    if hits >= 2:
        return "hi"
    return "en"


def translate(lang: str, key: str) -> str:
    d = TRANSLATIONS.get(lang) or TRANSLATIONS.get("en", {})
    return d.get(key, TRANSLATIONS["en"].get(key, key))