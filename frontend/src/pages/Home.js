import React from "react";
import { useNavigate } from "react-router-dom";
import { CircularProgress } from '@mui/material';
import "./Home.css";
import { backendUrl } from "../config";

function Home() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/users/me`, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    fetchUser();
  }, []);

  const handleGetStarted = () => {
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  const keyFeatures = [
    {
      title: "No-code pipeline",
      description: "Go from CSV upload to a trained model without writing code."
    },
    {
      title: "Built for cyber tabular data",
      description: "Works with your own datasets and optional predefined cybersecurity sets."
    },
    {
      title: "Guided data preparation",
      description: "Target selection, cleaning, split, transform, and outliers in one flow. Auto tools when you want them."
    },
    {
      title: "Supervised and anomaly models",
      description: "Ridge, Logistic, Random Forest, SVM, KNN, LightGBM, MLP, Isolation Forest, One-Class SVM, and K-Means."
    },
    {
      title: "Train, validate, reuse",
      description: "Pick a validation method, review metrics, save the model, then run predictions."
    },
    {
      title: "Checkpoints",
      description: "Save or reset your working dataset at each preparation stage."
    }
  ];

  const workflowSteps = [
    { step: "1", title: "Upload", desc: "Import CSV/Excel or copy a predefined dataset." },
    { step: "2", title: "Target & Type", desc: "Choose the prediction target, or work without a target." },
    { step: "3", title: "Prepare data", desc: "Optional groups, then clean, split, transform, and outliers." },
    { step: "4", title: "Train Model", desc: "Select an algorithm, validate, and save." },
    { step: "5", title: "Use Model", desc: "Run predictions on new rows." }
  ];

  return (
    <div className="home-container">
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Build ML models
            <span className="accent-text"> for cybersecurity data,</span>
            <span className="accent-text"> without coding</span>
          </h1>
          
          <p className="hero-description">
            Upload tabular data, prepare it step by step, train a model, and run predictions.
            Aimed at intrusion detection and related security tasks.
          </p>
          
          <button 
            className="cta-button"
            onClick={handleGetStarted}
            disabled={loading}
          >
            {loading ? (
              <>
                <CircularProgress size={20} style={{ color: 'white', marginRight: '10px' }} />
                Loading...
              </>
            ) : (
              'Get Started'
            )}
          </button>
        </div>
      </section>

      <section className="features-section">
        <div className="section-header">
          <h2>What you can do</h2>
        </div>
        
        <div className="features-grid">
          {keyFeatures.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-number">{index + 1}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="workflow-section">
        <div className="section-header">
          <h2>How it works</h2>
          <p className="section-subtitle">One pipeline from data to predictions</p>
        </div>
        
        <div className="workflow-steps">
          {workflowSteps.map((step, index) => (
            <div key={index} className="workflow-step">
              <div className="step-number">{step.step}</div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.desc}</p>
              </div>
              {index < workflowSteps.length - 1 && (
                <div className="step-connector"></div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="tech-section">
        <div className="section-header">
          <h2>Stack</h2>
        </div>
        <div className="tech-stack">
          <span className="tech-item">FastAPI</span>
          <span className="tech-item">React</span>
          <span className="tech-item">Scikit-learn</span>
          <span className="tech-item">PostgreSQL</span>
          <span className="tech-item">LightGBM</span>
          <span className="tech-item">PyTorch</span>
        </div>
      </section>

      <section className="final-cta">
        <h2>Start with your dataset</h2>
        <p>Open the dashboard to upload data or use a predefined set.</p>
        <button 
          className="cta-button secondary"
          onClick={handleGetStarted}
        >
          Go to Dashboard
        </button>
      </section>

      <footer className="home-footer">
        <div className="footer-content">
          <p className="project-info">
            Master's Thesis Project - Cybersecurity Master's Program
          </p>
          <p className="author-info">
            Author: Guettal Mohammed Idir | Supervisor: Esther Lidia Silva Ramírez
          </p>
          <p className="university-info">
            University of Cádiz - School of Engineering
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Home;
