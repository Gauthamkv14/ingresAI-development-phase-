import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Mic, 
  MicOff, 
  Upload, 
  Download,
  BarChart3,
  Map,
  Bot,
  User,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { useMCP } from '../contexts/MCPContext';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'react-toastify';
import MessageBubble from './MessageBubble';
import SuggestedQuestions from './SuggestedQuestions';
import TypingIndicator from './TypingIndicator';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const { callTool } = useMCP();
  const { sessionId, createNewSession } = useSession();
  const { currentLanguage, translate } = useLanguage();

  // Speech recognition setup
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window) {
      const speechRecognition = new window.webkitSpeechRecognition();
      speechRecognition.continuous = true;
      speechRecognition.interimResults = true;
      speechRecognition.lang = currentLanguage;
      
      speechRecognition.onresult = (event) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        setInputValue(text);
      };

      speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast.error('Speech recognition failed');
      };

      speechRecognition.onend = () => {
        setIsListening(false);
      };

      setRecognition(speechRecognition);
    }

    // Add welcome message
    setMessages([{
      id: '1',
      type: 'bot',
      content: translate('Hello! I\'m your INGRES AI Assistant. I can help you with groundwater data, water level analysis, predictions, and visualizations. How can I assist you today?'),
      timestamp: new Date(),
      suggestions: [
        translate('Show groundwater levels in Maharashtra'),
        translate('Create a chart of water quality data'),
        translate('Predict water levels for next 6 months'),
        translate('What is the water status in critical areas?')
      ]
    }]);

    scrollToBottom();
  }, [currentLanguage, translate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageContent = inputValue) => {
    if (!messageContent.trim() && !selectedFile) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
      file: selectedFile
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setSelectedFile(null);
    setIsTyping(true);

    try {
      let response;
      
      // Handle file upload if present
      if (selectedFile) {
        const fileContent = await fileToBase64(selectedFile);
        response = await callTool('upload_csv_data', {
          file_content: fileContent,
          filename: selectedFile.name,
          user_info: `Session: ${sessionId}`
        });
      } else {
        // Regular RAG query
        response = await callTool('rag_query', {
          question: messageContent.trim(),
          session_id: sessionId,
          language: currentLanguage
        });
      }

      const botMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: response.answer || response.message || 'I received your request successfully.',
        timestamp: new Date(),
        sources: response.sources || [],
        confidence: response.confidence || 0,
        suggestions: response.follow_up_suggestions || [],
        visualizations: response.visualizations || [],
        data: response.data || null,
        citation: response.citation || null
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: translate('I apologize, but I encountered an error processing your request. Please try again.'),
        timestamp: new Date(),
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to send message');
    } finally {
      setIsTyping(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data:*/*;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const toggleVoiceInput = () => {
    if (!recognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      toast.success(`File "${file.name}" selected`);
    }
  };

  const createVisualization = async (messageData, chartType) => {
    if (!messageData?.data) {
      toast.warning('No data available for visualization');
      return;
    }

    setIsTyping(true);
    try {
      const response = await callTool('create_interactive_chart', {
        data: messageData.data,
        chart_type: chartType,
        title: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`
      });

      if (response.success) {
        const visualizationMessage = {
          id: Date.now().toString(),
          type: 'bot',
          content: `Here's your ${chartType} visualization:`,
          timestamp: new Date(),
          visualization: {
            type: chartType,
            html: response.chart_html,
            data: messageData.data
          }
        };
        setMessages(prev => [...prev, visualizationMessage]);
      }
    } catch (error) {
      toast.error('Failed to create visualization');
    } finally {
      setIsTyping(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const provideFeedback = async (messageId, feedback) => {
    // Here you could send feedback to your backend
    toast.success(`Thank you for your ${feedback === 'up' ? 'positive' : 'constructive'} feedback!`);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {translate('INGRES AI Assistant')}
              </h2>
              <p className="text-sm text-gray-600">
                {translate('Groundwater Data Expert')}
              </p>
            </div>
          </div>
          
          <button
            onClick={createNewSession}
            className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {translate('New Chat')}
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onCreateVisualization={createVisualization}
              onCopyText={copyToClipboard}
              onProvideFeedback={provideFeedback}
            />
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isTyping && <TypingIndicator />}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {/* File Upload Preview */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">{selectedFile.name}</span>
              <span className="text-xs text-blue-600">
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-end gap-3">
          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title={translate('Upload CSV file')}
          >
            <Upload className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Voice Input Button */}
          <button
            onClick={toggleVoiceInput}
            className={`p-2 transition-colors ${
              isListening 
                ? 'text-red-600 hover:text-red-700' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={translate(isListening ? 'Stop recording' : 'Voice input')}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={translate('Ask about groundwater data, request visualizations, or upload CSV files...')}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              rows={1}
              style={{
                minHeight: '48px',
                maxHeight: '120px',
                resize: 'none'
              }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={() => handleSendMessage()}
            disabled={(!inputValue.trim() && !selectedFile) || isTyping}
            className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isTyping ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <SuggestedQuestions
            suggestions={messages[0].suggestions || []}
            onSuggestionClick={handleSendMessage}
          />
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
