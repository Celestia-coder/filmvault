// App.jsx — all page routes are declared here.
// Do not add page content here — only routing.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/client/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;