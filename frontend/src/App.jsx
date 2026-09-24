// App.jsx — all page routes are declared here.
// Do not add page content here — only routing.

import { Routes, Route } from "react-router";
import Home from "./pages/client/Home.jsx";
import SignUp from "./pages/client/SignUp.jsx";
import Login from "./pages/client/Login.jsx";
import AdminLogin from "./pages/client/AdminLogin.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import ListOfBookings from "./pages/admin/ListOfBookings.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<Dashboard />} />
      <Route path="/admin/bookings" element={<ListOfBookings />} />
    </Routes>
  );
}

export default App;
