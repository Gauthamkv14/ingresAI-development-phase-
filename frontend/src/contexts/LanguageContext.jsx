import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState({});

  const supportedLanguages = {
    'en': 'English',
    'hi': 'हिंदी (Hindi)',
    'te': 'తెలుగు (Telugu)', 
    'ta': 'தமிழ் (Tamil)',
    'kn': 'ಕನ್ನಡ (Kannada)',
    'ml': 'മലയാളം (Malayalam)',
    'gu': 'ગુજરાતી (Gujarati)',
    'mr': 'मराठी (Marathi)',
    'bn': 'বাংলা (Bengali)'
  };

  // Basic translations for UI elements
  const defaultTranslations = {
    en: {
      'Dashboard': 'Dashboard',
      'AI Assistant': 'AI Assistant', 
      'Chat': 'Chat',
      'Upload Data': 'Upload Data',
      'Export Data': 'Export Data',
      'View Map': 'View Map',
      'Groundwater Data': 'Groundwater Data',
      'Water Level': 'Water Level',
      'Safe': 'Safe',
      'Semi-Critical': 'Semi-Critical',
      'Critical': 'Critical',
      'Over-Exploited': 'Over-Exploited',
      'All States': 'All States',
      'All Categories': 'All Categories',
      'Create Chart': 'Create Chart',
      'Download': 'Download',
      'Upload': 'Upload',
      'Processing...': 'Processing...',
      'Loading...': 'Loading...',
      'Error': 'Error',
      'Success': 'Success',
      'Cancel': 'Cancel',
      'Save': 'Save',
      'Close': 'Close',
      'Search': 'Search',
      'Filter': 'Filter',
      'Export': 'Export',
      'Import': 'Import',
      'Settings': 'Settings',
      'Help': 'Help',
      'About': 'About',
      'Logout': 'Logout',
      'Login': 'Login',
      'Register': 'Register',
      'Hello! I\'m your INGRES AI Assistant. I can help you with groundwater data, water level analysis, predictions, and visualizations. How can I assist you today?': 'Hello! I\'m your INGRES AI Assistant. I can help you with groundwater data, water level analysis, predictions, and visualizations. How can I assist you today?',
      'Show groundwater levels in Maharashtra': 'Show groundwater levels in Maharashtra',
      'Create a chart of water quality data': 'Create a chart of water quality data',
      'Predict water levels for next 6 months': 'Predict water levels for next 6 months',
      'What is the water status in critical areas?': 'What is the water status in critical areas?',
      'INGRES AI Assistant': 'INGRES AI Assistant',
      'Groundwater Data Expert': 'Groundwater Data Expert',
      'New Chat': 'New Chat',
      'Upload CSV file': 'Upload CSV file',
      'Ask about groundwater data, request visualizations, or upload CSV files...': 'Ask about groundwater data, request visualizations, or upload CSV files...',
      'I apologize, but I encountered an error processing your request. Please try again.': 'I apologize, but I encountered an error processing your request. Please try again.'
    },
    hi: {
      'Dashboard': 'डैशबोर्ड',
      'AI Assistant': 'AI सहायक',
      'Chat': 'चैट',
      'Upload Data': 'डेटा अपलोड करें',
      'Export Data': 'डेटा निर्यात करें',
      'View Map': 'नक्शा देखें',
      'Groundwater Data': 'भूजल डेटा',
      'Water Level': 'जल स्तर',
      'Safe': 'सुरक्षित',
      'Semi-Critical': 'अर्ध-गंभीर',
      'Critical': 'गंभीर',
      'Over-Exploited': 'अति-दोहित',
      'All States': 'सभी राज्य',
      'All Categories': 'सभी श्रेणियां',
      'Create Chart': 'चार्ट बनाएं',
      'Download': 'डाउनलोड',
      'Upload': 'अपलोड',
      'Processing...': 'प्रसंस्करण...',
      'Loading...': 'लोड हो रहा है...',
      'Error': 'त्रुटि',
      'Success': 'सफलता',
      'Cancel': 'रद्द करें',
      'Save': 'सेव करें',
      'Close': 'बंद करें',
      'Search': 'खोजें',
      'Filter': 'फ़िल्टर',
      'Export': 'निर्यात',
      'Import': 'आयात',
      'Settings': 'सेटिंग्स',
      'Help': 'सहायता',
      'About': 'के बारे में',
      'Logout': 'लॉगआउट',
      'Login': 'लॉगिन',
      'Register': 'पंजीकरण',
      'Hello! I\'m your INGRES AI Assistant. I can help you with groundwater data, water level analysis, predictions, and visualizations. How can I assist you today?': 'नमस्ते! मैं आपका INGRES AI सहायक हूँ। मैं भूजल डेटा, जल स्तर विश्लेषण, भविष्यवाणियों और विज़ुअलाइज़ेशन में आपकी सहायता कर सकता हूँ। आज मैं आपकी कैसे सहायता कर सकता हूँ?',
      'Show groundwater levels in Maharashtra': 'महाराष्ट्र में भूजल स्तर दिखाएं',
      'Create a chart of water quality data': 'जल गुणवत्ता डेटा का चार्ट बनाएं',
      'Predict water levels for next 6 months': 'अगले 6 महीनों के लिए जल स्तर की भविष्यवाणी करें',
      'What is the water status in critical areas?': 'गंभीर क्षेत्रों में पानी की स्थिति क्या है?',
      'INGRES AI Assistant': 'INGRES AI सहायक',
      'Groundwater Data Expert': 'भूजल डेटा विशेषज्ञ',
      'New Chat': 'नई चैट',
      'Upload CSV file': 'CSV फ़ाइल अपलोड करें',
      'Ask about groundwater data, request visualizations, or upload CSV files...': 'भूजल डेटा के बारे में पूछें, विज़ुअलाइज़ेशन का अनुरोध करें, या CSV फ़ाइलें अपलोड करें...',
      'I apologize, but I encountered an error processing your request. Please try again.': 'मुझे खुशी है, लेकिन मुझे आपके अनुरोध को संसाधित करने में त्रुटि का सामना करना पड़ा। कृपया पुनः प्रयास करें।'
    }
    // Add more languages as needed
  };

  useEffect(() => {
    // Load saved language from localStorage
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && supportedLanguages[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
    
    setTranslations(defaultTranslations);
  }, []);

  const changeLanguage = async (languageCode) => {
    if (!supportedLanguages[languageCode]) {
      console.warn(`Language ${languageCode} not supported`);
      return;
    }

    setCurrentLanguage(languageCode);
    localStorage.setItem('preferred-language', languageCode);

    // Here you could also call your MCP server to get better translations
    // const response = await callTool('get_translations', { language: languageCode });
  };

  const translate = (key, fallback = null) => {
    const currentTranslations = translations[currentLanguage] || translations.en || {};
    return currentTranslations[key] || fallback || key;
  };

  const value = {
    currentLanguage,
    supportedLanguages,
    changeLanguage,
    translate,
    translations
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
