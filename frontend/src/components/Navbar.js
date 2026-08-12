import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";
import { backendUrl } from "../config";

function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Vérifier l'authentification de base
  const checkAuth = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/users/me`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        setIsLoggedIn(true);
        await checkAdminStatus();
      } else {
        setIsLoggedIn(false);
        setIsAdmin(false);
      }
    } catch (error) {
      setIsLoggedIn(false);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/users/check-admin`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Ré-écouter les changements de route
  useEffect(() => {
    checkAuth();
  }, [location.pathname]);

  // Écouter les événements de login/logout depuis d'autres composants
  useEffect(() => {
    const handleAuthChange = () => {
      checkAuth();
    };

    // Écouter les événements personnalisés
    window.addEventListener('userLoggedIn', handleAuthChange);
    window.addEventListener('userLoggedOut', handleAuthChange);

    return () => {
      window.removeEventListener('userLoggedIn', handleAuthChange);
      window.removeEventListener('userLoggedOut', handleAuthChange);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/users/logout`, {
        method: "POST",
        credentials: "include",
      });

      setIsLoggedIn(false);
      setIsAdmin(false);
      window.dispatchEvent(new Event("userLoggedOut"));

      if (response.ok) {
        navigate("/login", {
          state: { message: "You have been logged out successfully." },
        });
      } else {
        navigate("/login", {
          state: { message: "Session cleared. Please log in again." },
        });
      }
    } catch (error) {
      setIsLoggedIn(false);
      setIsAdmin(false);
      window.dispatchEvent(new Event("userLoggedOut"));
      navigate("/login", {
        state: {
          message: "Logout request failed. If you stay signed in, try again.",
        },
      });
    }
  };

  const handleAdminPanel = () => {
    navigate("/admin-panel");
  };

  if (isLoading) {
    return (
      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="nav-logo">AI Security Platform</Link>
          <div className="nav-links">Loading...</div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          AI Security Platform
        </Link>

        <div className="nav-links">
          {!isLoggedIn ? (
            <>
              <Link to="/signup" className="nav-link">Sign Up</Link>
              <Link to="/login" className="nav-link">Login</Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="nav-link">Dashboard</Link>
              <Link to="/upload" className="nav-link">Upload</Link>
              
              {/* Bouton Admin Panel - visible seulement pour l'admin */}
              {isAdmin && (
                <button 
                  onClick={handleAdminPanel} 
                  className="nav-link-button admin-panel-btn"
                  title="Admin Panel"
                >
                  Admin Panel
                </button>
              )}
              
              <button onClick={handleLogout} className="nav-link-button">
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;