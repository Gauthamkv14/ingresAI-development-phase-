import React, { useState } from 'react';
import './LanguageSelector.css';

const LanguageSelector = ({ selectedLanguage, onLanguageChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
    { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
    { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
    { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'ml', name: 'മലയാളം', flag: '🇮🇳' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  ];

  const currentLanguage = languages.find(lang => lang.code === selectedLanguage) || languages[0];

  const handleLanguageSelect = (langCode) => {
    onLanguageChange(langCode);
    setIsOpen(false);
  };

  return (
    <div className="language-selector">
      <button 
        className="language-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="language-flag">{currentLanguage.flag}</span>
        <span className="language-name">{currentLanguage.name}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="language-dropdown">
          <div className="dropdown-header">
            <span>🌐 Select Language</span>
          </div>
          {languages.map(language => (
            <button
              key={language.code}
              className={`language-option ${selectedLanguage === language.code ? 'selected' : ''}`}
              onClick={() => handleLanguageSelect(language.code)}
            >
              <span className="option-flag">{language.flag}</span>
              <span className="option-name">{language.name}</span>
              {selectedLanguage === language.code && <span className="check-mark">✓</span>}
            </button>
          ))}
          <div className="dropdown-footer">
            <small>Translation powered by Google Translate</small>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="dropdown-overlay" onClick={() => setIsOpen(false)}></div>
      )}
    </div>
  );
};

export default LanguageSelector;
