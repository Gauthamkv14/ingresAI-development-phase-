// src/components/Footer.jsx
import React from 'react';
import '../styles/footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-col">
          <h4>License</h4>
          <p>-.</p>
        </div>
        <div className="footer-col">
          <h4>Contributors</h4>
          <p>Team GroundZero: AI-Driven Chatbot for INGRES</p>
        </div>
        <div className="footer-col">
          <h4>🙏Acknowledgements</h4>
          <ul>
            <li>
                <a href="http://cgwb.gov.in" target="_blank" rel="noopener noreferrer">
                     Central Ground Water Board (CGWB)
                </a>
            </li>
            <li>
                <a href="https://indiawris.gov.in" target="_blank" rel="noopener noreferrer">
                    India-WRIS Team
                </a>
            </li>
            <li>
                <a href="https://www.sih.gov.in/" target="_blank" rel="noopener noreferrer">
                    Smart India Hackathon 2025
                </a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Support</h4>
          <p>Email: 1ds23is051.dsce.edu.in</p>
          <p>Github: https://github.com/Gauthamkv14/ingresAI-development-phase-.git </p>
        </div>
      </div>
      <div className="footer-bottom">Made with ❤️ for Smart India Hackathon 2025 — Empowering India's water resource management</div>
    </footer>
  );
}
// src/components/Footer.jsx
import React from 'react';
import './footer.css';

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-col">
          <h4>About</h4>
          <p>INGRES AI Portal — Groundwater Intelligence and Monitoring.</p>
        </div>

        <div className="footer-col">
          <h4>Contributors</h4>
          <ul>
            <li>Team GroundZero - AI-Driven Chatbot for INGRES</li>
             <li>
                <a href="http://cgwb.gov.in" target="_blank" rel="noopener noreferrer">
                     Central Ground Water Board (CGWB)
                </a>
            </li>
            <li>
                <a href="https://indiawris.gov.in" target="_blank" rel="noopener noreferrer">
                    India-WRIS Team
                </a>
            </li>
            <li>
                <a href="https://www.sih.gov.in/" target="_blank" rel="noopener noreferrer">
                    Smart India Hackathon 2025
                </a>
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Support</h4>
          <p>Email: 1ds23is051.dsce.edu.in</p>
        </div>

        <div className="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="/api/download">Download CSV</a></li>
            <li><a href="https://github.com/Gauthamkv14/ingresAI-development-phase-.git">GitHub</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div>© {new Date().getFullYear()} INGRES AI Portal — Built with 💓 for SIH 2025</div>
      </div>
    </footer>
  );
}
