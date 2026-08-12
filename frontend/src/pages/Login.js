import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./Login.css";
import { backendUrl } from "../config";

function Login() {
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const emailInputRef = useRef(null);

  useEffect(() => {
    if (emailInputRef.current) emailInputRef.current.focus();
  }, []);

  useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    if (error) setError("");
    if (info) setInfo("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/api/users/login`, credentials, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      });
      if (response.data.message) {
        window.dispatchEvent(new Event("userLoggedIn"));
        navigate("/dashboard");
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setError(
          err.response.data?.detail ||
            "Too many login attempts. Please try again in a few minutes."
        );
      } else if (err.response?.status === 401) {
        setError("Invalid email or password. Please check your credentials.");
      } else {
        setError("Connection error. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2 className="form-title">Login</h2>
      {info && <p className="info-message">{info}</p>}
      {error && <p className="error-message">{error}</p>}
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            ref={emailInputRef}
            type="email"
            name="email"
            placeholder="Email"
            className="form-input"
            value={credentials.email}
            onChange={handleChange}
            required
            disabled={loading}
            autoComplete="email"
          />
        </div>
        <div className="form-group password-group">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            className="form-input"
            value={credentials.password}
            onChange={handleChange}
            required
            disabled={loading}
            autoComplete="current-password"
          />
          <span
            className="password-toggle-icon"
            onClick={() => !loading && setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </span>
        </div>
        <button type="submit" className="form-button" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
      <p className="signup-link">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}

export default Login;
