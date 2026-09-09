import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UploadFile from "./pages/UploadFile";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./ProtectedRoute";
import Data_cleaning from "./pages/Data_cleaning";
import Outlier_manager from "./pages/Outlier_manager";
import Target_selection from "./pages/Target_selection";
import Group_optimizer from "./pages/Group_optimizer";
import Preprocessing5 from "./pages/Preprocessing5";
import Data_transformation from "./pages/Data_transformation";
import Outlier_manager2 from "./pages/Outlier_manager2";
import UseModel from "./pages/use-model";
import AdminPanel from "./pages/AdminPanel";
import Creat_Model from "./pages/Creat_Model";
import DataPreparation from "./pages/DataPreparation";
import { CssBaseline } from '@mui/material';
import Home from "./pages/Home";

const theme = createTheme({
  palette: {
    primary: { main: "#384850" },
    info: { main: "#384850" },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Navbar />
        <Routes>
          {/* Routes publiques */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          {/* Routes protégées normales */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<UploadFile />} />
            <Route path="/data_cleaning" element={<Data_cleaning />} />
            <Route path="/outlier_manager" element={<Outlier_manager />} />
            <Route path="/target_selection" element={<Target_selection />} />
            <Route path="/data_preparation" element={<DataPreparation />} />
            <Route path="/group_optimizer" element={<Group_optimizer />} />
            <Route path="/preprocessing5" element={<Preprocessing5 />} />
            <Route path="/data_transformation" element={<Data_transformation />} />
            <Route path="/outlier_manager2" element={<Outlier_manager2 />} />
            <Route path="/use-model" element={<UseModel />} />
            <Route path="/creat_model" element={<Creat_Model />} />
            <Route path="/admin-panel" element={<AdminPanel />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;