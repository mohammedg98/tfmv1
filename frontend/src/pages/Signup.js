import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./Signup.css";
import { backendUrl } from "../config";

const MIN_PASSWORD_LENGTH = 8;

function Signup() {
  const [user, setUser] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (nameInputRef.current) nameInputRef.current.focus();
  }, []);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (user.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (user.password !== user.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${backendUrl}/api/users/signup`, {
        name: user.name,
        email: user.email,
        password: user.password,
      });
      navigate("/login", {
        state: { message: "Account created successfully. Please log in." },
      });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 429) {
        setError("Too many attempts. Please try again in a few minutes.");
      } else if (status === 409) {
        setError(
          typeof detail === "string"
            ? detail
            : "An account with this email already exists. Please log in."
        );
      } else if (status === 400 && typeof detail === "string") {
        setError(detail);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <h2 className="form-title">Create an account</h2>
      <form className="signup-form" onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <input
            ref={nameInputRef}
            type="text"
            name="name"
            placeholder="Full name"
            className="form-input"
            value={user.name}
            onChange={handleChange}
            required
            disabled={loading}
            autoComplete="name"
          />
        </div>
        <div className="form-group">
          <input
            type="email"
            name="email"
            placeholder="Email address"
            className="form-input"
            value={user.email}
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
            placeholder="Password (min. 8 characters)"
            className="form-input"
            value={user.password}
            onChange={handleChange}
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={loading}
            autoComplete="new-password"
          />
          <span
            className="password-toggle-icon"
            onClick={() => !loading && setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </span>
        </div>
        <div className="form-group password-group">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="Confirm password"
            className="form-input"
            value={user.confirmPassword}
            onChange={handleChange}
            required
            minLength={MIN_PASSWORD_LENGTH}
            disabled={loading}
            autoComplete="new-password"
          />
          <span
            className="password-toggle-icon"
            onClick={() => !loading && setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </span>
        </div>
        <button type="submit" className="form-button" disabled={loading}>
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="login-link">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

export default Signup;
