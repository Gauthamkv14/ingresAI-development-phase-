// src/components/Footer.jsx
import React from 'react';
import '../styles/footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-col">
          <h4>License</h4>
          <p>MIT License - See LICENSE file.</p>
        </div>
        <div className="footer-col">
          <h4>Contributors</h4>
          <p>SIH 2025 Team - AI-Driven Chatbot for INGRES</p>
        </div>
        <div className="footer-col">
          <h4>Acknowledgements</h4>
          <ul>
            <li>Central Ground Water Board (CGWB)</li>
            <li>India-WRIS Team</li>
            <li>Smart India Hackathon 2025</li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Support</h4>
          <p>Email: team@sih2025.example.com</p>
          <p>Docs: Wiki</p>
        </div>
      </div>
      <div className="footer-bottom">Made with ❤️ for Smart India Hackathon 2025 — Empowering India's water resource management</div>
    </footer>
  );
}
