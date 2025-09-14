from googletrans import Translator
import requests
from typing import Dict, Any, List
from config import Config
import logging
import json

class TranslationTool:
    def __init__(self):
        self.config = Config()
        self.translator = Translator()
        self.supported_languages = self.config.SUPPORTED_LANGUAGES
        
        # Water-related terminology dictionary for better translations
        self.water_terminology = {
            'en': {
                'groundwater': 'groundwater',
                'water_level': 'water level',
                'aquifer': 'aquifer',
                'extraction': 'extraction',
                'recharge': 'recharge',
                'contamination': 'contamination',
                'safe': 'safe',
                'critical': 'critical',
                'over_exploited': 'over-exploited'
            },
            'hi': {
                'groundwater': 'भूजल',
                'water_level': 'जल स्तर',
                'aquifer': 'जलभृत',
                'extraction': 'निकासी',
                'recharge': 'पुनर्भरण',
                'contamination': 'संदूषण',
                'safe': 'सुरक्षित',
                'critical': 'गंभीर',
                'over_exploited': 'अति-दोहित'
            },
            'te': {
                'groundwater': 'భూగర్భ జలాలు',
                'water_level': 'నీటి మట్టం',
                'aquifer': 'జలచర',
                'extraction': 'వెలికితీత',
                'recharge': 'పునర్భరణ',
                'contamination': 'కలుషితం',
                'safe': 'సురక్షితం',
                'critical': 'క్లిష్టం',
                'over_exploited': 'అధిక వినియోగం'
            }
            # Add more languages as needed
        }
    
    async def translate_text(self, text: str, target_language: str, source_language: str = 'en') -> Dict[str, Any]:
        """Translate text with water terminology awareness"""
        try:
            if target_language not in self.supported_languages:
                return {
                    "success": False,
                    "error": f"Language '{target_language}' not supported. Available: {list(self.supported_languages.keys())}"
                }
            
            if source_language == target_language:
                return {
                    "success": True,
                    "original_text": text,
                    "translated_text": text,
                    "source_language": source_language,
                    "target_language": target_language,
                    "translation_quality": "identical"
                }
            
            # Pre-process text to handle technical terms
            processed_text = self._preprocess_water_terms(text, source_language, target_language)
            
            # Translate using Google Translate
            translation = self.translator.translate(
                processed_text, 
                src=source_language, 
                dest=target_language
            )
            
            # Post-process to ensure correct water terminology
            final_text = self._postprocess_translation(
                translation.text, 
                target_language
            )
            
            # Detect confidence (simplified)
            confidence = self._assess_translation_quality(text, final_text, target_language)
            
            return {
                "success": True,
                "original_text": text,
                "translated_text": final_text,
                "source_language": source_language,
                "target_language": target_language,
                "target_language_name": self.supported_languages[target_language],
                "translation_quality": confidence,
                "technical_terms_handled": len(self._extract_water_terms(text))
            }
            
        except Exception as e:
            logging.error(f"Translation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "original_text": text
            }
    
    def _preprocess_water_terms(self, text: str, source_lang: str, target_lang: str) -> str:
        """Replace water-related terms with proper translations"""
        if source_lang not in self.water_terminology or target_lang not in self.water_terminology:
            return text
        
        processed_text = text
        source_terms = self.water_terminology[source_lang]
        target_terms = self.water_terminology[target_lang]
        
        # Replace known terms
        for key in source_terms:
            if source_terms[key].lower() in processed_text.lower():
                # Mark for special handling
                processed_text = processed_text.replace(
                    source_terms[key], 
                    f"WATER_TERM_{key}_WATER_TERM"
                )
        
        return processed_text
    
    def _postprocess_translation(self, translated_text: str, target_lang: str) -> str:
        """Replace marked terms with correct technical translations"""
        if target_lang not in self.water_terminology:
            return translated_text
        
        processed_text = translated_text
        target_terms = self.water_terminology[target_lang]
        
        # Replace marked terms
        for key in target_terms:
            marker = f"WATER_TERM_{key}_WATER_TERM"
            if marker in processed_text:
                processed_text = processed_text.replace(marker, target_terms[key])
        
        return processed_text
    
    def _extract_water_terms(self, text: str) -> List[str]:
        """Extract water-related terms from text"""
        terms_found = []
        text_lower = text.lower()
        
        for lang_terms in self.water_terminology.values():
            for term in lang_terms.values():
                if term.lower() in text_lower:
                    terms_found.append(term)
        
        return terms_found
    
    def _assess_translation_quality(self, original: str, translated: str, target_lang: str) -> str:
        """Assess translation quality (simplified)"""
        # Simple heuristics for quality assessment
        if len(translated) < len(original) * 0.5:
            return "low"
        elif len(translated) > len(original) * 2:
            return "low"
        elif self._has_technical_terms_preserved(translated, target_lang):
            return "high"
        else:
            return "medium"
    
    def _has_technical_terms_preserved(self, text: str, language: str) -> bool:
        """Check if technical terms are properly preserved"""
        if language not in self.water_terminology:
            return True
        
        target_terms = self.water_terminology[language]
        text_lower = text.lower()
        
        # Check if at least some technical terms are present
        terms_present = sum(1 for term in target_terms.values() if term.lower() in text_lower)
        return terms_present > 0
    
    async def translate_response_with_context(self, 
                                           response: Dict[str, Any], 
                                           target_language: str) -> Dict[str, Any]:
        """Translate complete chatbot response maintaining data integrity"""
        try:
            translated_response = response.copy()
            
            # Translate main answer
            if 'answer' in response:
                translation_result = await self.translate_text(
                    response['answer'], 
                    target_language
                )
                if translation_result["success"]:
                    translated_response['answer'] = translation_result["translated_text"]
                    translated_response['translation_info'] = {
                        'target_language': target_language,
                        'quality': translation_result["translation_quality"]
                    }
            
            # Translate follow-up suggestions
            if 'follow_up_suggestions' in response:
                translated_suggestions = []
                for suggestion in response['follow_up_suggestions']:
                    suggestion_translation = await self.translate_text(
                        suggestion, 
                        target_language
                    )
                    if suggestion_translation["success"]:
                        translated_suggestions.append(suggestion_translation["translated_text"])
                    else:
                        translated_suggestions.append(suggestion)  # Keep original if translation fails
                
                translated_response['follow_up_suggestions'] = translated_suggestions
            
            # Keep data citations and sources in original language for accuracy
            # But add translated labels
            if 'sources' in response:
                for source in translated_response['sources']:
                    source['source_label'] = await self._translate_simple_text("Source", target_language)
                    source['citation_label'] = await self._translate_simple_text("Citation", target_language)
            
            return translated_response
            
        except Exception as e:
            logging.error(f"Response translation failed: {e}")
            return response  # Return original if translation fails
    
    async def _translate_simple_text(self, text: str, target_language: str) -> str:
        """Simple translation for UI labels"""
        try:
            result = await self.translate_text(text, target_language)
            return result["translated_text"] if result["success"] else text
        except:
            return text
    
    async def get_supported_languages(self) -> Dict[str, Any]:
        """Get list of supported languages with metadata"""
        return {
            "supported_languages": self.supported_languages,
            "total_languages": len(self.supported_languages),
            "water_terminology_coverage": {
                lang: len(terms) for lang, terms in self.water_terminology.items()
            },
            "translation_features": {
                "technical_term_preservation": True,
                "context_aware_translation": True,
                "quality_assessment": True,
                "batch_translation": True
            }
        }
