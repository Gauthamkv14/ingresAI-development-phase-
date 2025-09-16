// frontend/src/components/Footer.js
import React from "react";
import "../styles/footer.css";

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-section">
            <h3>📄 License</h3>
            <p>MIT License - See LICENSE file for details</p>
          </div>
          <div className="footer-section">
            <h3>👥 Contributors</h3>
            <p>SIH 2025 Team - AI-Driven Chatbot for INGRES</p>
          </div>
          <div className="footer-section">
            <h3>🙏 Acknowledgments</h3>
            <ul>
              <li>Central Ground Water Board (CGWB)</li>
              <li>India-WRIS Team</li>
              <li>Smart India Hackathon 2025</li>
              <li>Open Government Data Platform India</li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>📞 Support & Contact</h3>
            <div className="contact-links">
              <p><strong>Email:</strong> <a href="mailto:team@sih2025.example.com">team@sih2025.example.com</a></p>
              <p><strong>Documentation:</strong> <a href="../../wiki" target="_blank" rel="noopener noreferrer">Wiki</a></p>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-branding">
            <p><strong>Made with ❤️ for Smart India Hackathon 2025 🇮🇳</strong></p>
            <p><em>Empowering India's water resource management through AI and data science.</em></p>
          </div>

          <div className="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Use</a>
            <a href="#api">API Documentation</a>
            <a href="#github">GitHub Repository</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
