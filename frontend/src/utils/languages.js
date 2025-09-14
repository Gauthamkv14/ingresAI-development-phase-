// Language utilities and constants

export const supportedLanguages = {
  'en': { name: 'English', nativeName: 'English', rtl: false },
  'hi': { name: 'Hindi', nativeName: 'हिंदी', rtl: false },
  'te': { name: 'Telugu', nativeName: 'తెలుగు', rtl: false },
  'ta': { name: 'Tamil', nativeName: 'தமிழ்', rtl: false },
  'kn': { name: 'Kannada', nativeName: 'ಕನ್ನಡ', rtl: false },
  'ml': { name: 'Malayalam', nativeName: 'മലയാളം', rtl: false },
  'gu': { name: 'Gujarati', nativeName: 'ગુજરાતી', rtl: false },
  'mr': { name: 'Marathi', nativeName: 'मराठी', rtl: false },
  'bn': { name: 'Bengali', nativeName: 'বাংলা', rtl: false }
};

// Technical terms that should be preserved in translations
export const technicalTerms = {
  en: {
    'groundwater': 'groundwater',
    'water_level': 'water level',
    'aquifer': 'aquifer',
    'extraction': 'extraction',
    'recharge': 'recharge',
    'contamination': 'contamination',
    'safe': 'safe',
    'critical': 'critical',
    'over_exploited': 'over-exploited',
    'semi_critical': 'semi-critical',
    'cgwb': 'CGWB',
    'ingres': 'INGRES',
    'wris': 'WRIS'
  },
  hi: {
    'groundwater': 'भूजल',
    'water_level': 'जल स्तर',
    'aquifer': 'जलभृत',
    'extraction': 'निकासी',
    'recharge': 'पुनर्भरण',
    'contamination': 'संदूषण',
    'safe': 'सुरक्षित',
    'critical': 'गंभीर',
    'over_exploited': 'अति-दोहित',
    'semi_critical': 'अर्ध-गंभीर',
    'cgwb': 'सीजीडब्ल्यूबी',
    'ingres': 'इंग्रेस',
    'wris': 'डब्ल्यूआरआईएस'
  }
  // Add more languages as needed
};

// Common UI translations
export const uiTranslations = {
  en: {
    'dashboard': 'Dashboard',
    'chat': 'Chat',
    'upload': 'Upload',
    'download': 'Download',
    'export': 'Export',
    'import': 'Import',
    'search': 'Search',
    'filter': 'Filter',
    'settings': 'Settings',
    'help': 'Help',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    'cancel': 'Cancel',
    'save': 'Save',
    'delete': 'Delete',
    'edit': 'Edit',
    'create': 'Create',
    'update': 'Update',
    'view': 'View',
    'close': 'Close',
    'back': 'Back',
    'next': 'Next',
    'previous': 'Previous',
    'yes': 'Yes',
    'no': 'No',
    'ok': 'OK',
    'confirm': 'Confirm',
    'submit': 'Submit',
    'reset': 'Reset',
    'clear': 'Clear',
    'select': 'Select',
    'choose': 'Choose',
    'browse': 'Browse',
    'upload_file': 'Upload File',
    'drag_drop': 'Drag & Drop',
    'click_to_select': 'Click to select',
    'file_selected': 'File selected',
    'processing': 'Processing...',
    'completed': 'Completed',
    'failed': 'Failed',
    'retry': 'Retry',
    'refresh': 'Refresh',
    'reload': 'Reload'
  },
  hi: {
    'dashboard': 'डैशबोर्ड',
    'chat': 'चैट',
    'upload': 'अपलोड',
    'download': 'डाउनलोड',
    'export': 'निर्यात',
    'import': 'आयात',
    'search': 'खोजें',
    'filter': 'फ़िल्टर',
    'settings': 'सेटिंग्स',
    'help': 'सहायता',
    'loading': 'लोड हो रहा है...',
    'error': 'त्रुटि',
    'success': 'सफलता',
    'cancel': 'रद्द करें',
    'save': 'सेव करें',
    'delete': 'हटाएं',
    'edit': 'संपादित करें',
    'create': 'बनाएं',
    'update': 'अपडेट करें',
    'view': 'देखें',
    'close': 'बंद करें',
    'back': 'वापस',
    'next': 'अगला',
    'previous': 'पिछला',
    'yes': 'हाँ',
    'no': 'नहीं',
    'ok': 'ठीक है',
    'confirm': 'पुष्टि करें',
    'submit': 'जमा करें',
    'reset': 'रीसेट करें',
    'clear': 'साफ़ करें',
    'select': 'चुनें',
    'choose': 'चुनें',
    'browse': 'ब्राउज़ करें',
    'upload_file': 'फ़ाइल अपलोड करें',
    'drag_drop': 'ड्रैग और ड्रॉप',
    'click_to_select': 'चुनने के लिए क्लिक करें',
    'file_selected': 'फ़ाइल चुनी गई',
    'processing': 'प्रसंस्करण...',
    'completed': 'पूर्ण',
    'failed': 'असफल',
    'retry': 'पुनः प्रयास',
    'refresh': 'ताज़ा करें',
    'reload': 'पुनः लोड करें'
  }
  // Add more languages as needed
};

// Utility functions
export const getLanguageName = (code) => {
  return supportedLanguages[code]?.name || code;
};

export const getNativeLanguageName = (code) => {
  return supportedLanguages[code]?.nativeName || code;
};

export const isRTLLanguage = (code) => {
  return supportedLanguages[code]?.rtl || false;
};

export const detectBrowserLanguage = () => {
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0]; // Get language without region
  
  return supportedLanguages[langCode] ? langCode : 'en';
};

export const formatMessage = (template, values = {}) => {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] || match;
  });
};

export const pluralize = (count, singular, plural) => {
  return count === 1 ? singular : plural;
};

// Language-specific number formatting
export const formatNumber = (number, language = 'en') => {
  try {
    return new Intl.NumberFormat(language).format(number);
  } catch (error) {
    return number.toString();
  }
};

// Language-specific date formatting
export const formatDate = (date, language = 'en', options = {}) => {
  try {
    return new Intl.DateTimeFormat(language, options).format(new Date(date));
  } catch (error) {
    return new Date(date).toLocaleDateString();
  }
};

export default {
  supportedLanguages,
  technicalTerms,
  uiTranslations,
  getLanguageName,
  getNativeLanguageName,
  isRTLLanguage,
  detectBrowserLanguage,
  formatMessage,
  pluralize,
  formatNumber,
  formatDate
};
