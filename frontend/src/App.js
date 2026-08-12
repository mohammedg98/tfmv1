import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UploadFile from "./pages/UploadFile";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./ProtectedRoute";
import UseModel from "./pages/use-model";
import AdminPanel from "./pages/AdminPanel";
import DataPreparation from "./pages/DataPreparation";
import { CssBaseline } from '@mui/material';
import Home from "./pages/Home";

const theme = createTheme();

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<UploadFile />} />
            <Route path="/data_preparation" element={<DataPreparation />} />
            <Route path="/use-model" element={<UseModel />} />
            <Route path="/admin-panel" element={<AdminPanel />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
