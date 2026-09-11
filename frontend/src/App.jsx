// App.jsx — all page routes are declared here.
// Do not add page content here — only routing.

import { Routes, Route } from "react-router";
import Home from "./pages/client/Home.jsx";
import Movies from "./pages/client/Movies.jsx";
import SignUp from "./pages/client/SignUp.jsx";
import Login from "./pages/client/Login.jsx";
import AdminLogin from "./pages/client/AdminLogin.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />  
      <Route path="/admin/dashboard" element={<Dashboard />} />  
    </Routes>
  );
}

export default App;