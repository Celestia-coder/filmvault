// App.jsx — all page routes are declared here.
// Do not add page content here — only routing.

import { Routes, Route } from "react-router";
import Home from "./pages/client/Home.jsx";
import SignUp from "./pages/client/SignUp.jsx";
import Login from "./pages/client/Login.jsx";
import AdminLogin from "./pages/client/AdminLogin.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />  
    </Routes>
  );
}

export default App;
