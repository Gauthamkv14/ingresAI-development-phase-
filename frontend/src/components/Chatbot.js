import React, { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

const Chatbot = () => {
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: 'Hello! I\'m INGRES AI, your groundwater analysis assistant. How can I help you today?',
      timestamp: new Date(),
      suggestions: ['Show current groundwater levels', 'Find critical areas', 'Compare states']
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage.trim();
    if (!messageToSend) return;

    // Add user message
    const userMessage = {
      type: 'user',
      text: messageToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Add bot response
      const botMessage = {
        type: 'bot',
        text: data.response,
        timestamp: new Date(),
        data: data.data,
        suggestions: data.suggestions || []
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        type: 'bot',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        suggestions: ['Show current groundwater levels', 'Find critical areas']
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h3>🤖 INGRES AI Assistant</h3>
        <p>Ask me about groundwater data, trends, and insights</p>
      </div>
      
      <div className="chatbot-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.type}-message`}>
            <div className="message-content">
              <p>{message.text}</p>
              
              {message.data && (
                <div className="message-data">
                  <h5>Related Data:</h5>
                  <div className="data-cards">
                    {message.data.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="data-card">
                        <strong>{item.district}, {item.state}</strong>
                        <p>Level: {item.level}m</p>
                        <p>Status: <span className={`status ${item.quality}`}>{item.quality}</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="message-suggestions">
                  <p><strong>Quick actions:</strong></p>
                  <div className="suggestion-buttons">
                    {message.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        className="suggestion-btn"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message bot-message">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chatbot-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask about groundwater data, trends, or specific locations..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !inputMessage.trim()}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default Chatbot;
