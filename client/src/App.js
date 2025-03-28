import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import StartupPage from "./components/Startup";
import Signin from "./components/Signin";
import Signup from "./components/Signup";
import MarkAttendance from "./components/MarkAttendance";
import Dashboard from "./components/Dashboard";
import NewUser from "./components/NewUser";
import ViewAttendance from "./components/ViewAttendance";
import AccountSettings from "./components/AccountSettings";
import ForgotPassword from "./components/ForgotPassword";
import ManageUsers from "./components/ManageUsers";
import Analytics from "./components/Analytics";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartupPage />} /> {/*This is the default route*/}
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/MarkAttendance" element={<MarkAttendance />} />
        <Route path="/Dashboard" element={<Dashboard />} />
        <Route path="/NewUser" element={<NewUser />} />
        <Route path="/ViewAttendance" element={<ViewAttendance />} />
        <Route path="/AccountSettings" element={<AccountSettings />} />
        <Route path="/ForgotPassword" element={<ForgotPassword />} />
        <Route path="/ManageUsers" element={<ManageUsers />} />
        <Route path="/Analytics" element={<Analytics />} />
      </Routes>
    </Router>
  );
}

export default App;
