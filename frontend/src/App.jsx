import { Routes, Route } from "react-router";

{/* CLIENT SIDE */}
import Home from "./pages/client/Home.jsx";
import SignUp from "./pages/client/SignUp.jsx";
import Login from "./pages/client/Login.jsx";
import Movies from "./pages/client/Movies.jsx";
import MovieDetails from "./pages/client/MovieDetails.jsx";
import Branches from "./pages/client/Branches.jsx";
import ShowtimeSelection from "./pages/client/ShowtimeSelection.jsx";
import SeatSelection from "./pages/client/SeatSelection.jsx";
import Tickets from "./pages/client/Tickets.jsx";

{/* ADMIN SIDE */}
import AdminLogin from "./pages/client/AdminLogin.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import ScheduleManagement from "./pages/admin/ScheduleManagement.jsx";
import MovieManagement from "./pages/admin/MovieManagement.jsx";

function App() {
	return (
		<Routes>
			{/* CLIENT SIDE */}
			<Route path="/" element={<Home />} />
			<Route path="/signup" element={<SignUp />} />
			<Route path="/login" element={<Login />} />
			<Route path="/movies" element={<Movies />} />
			<Route path="/movies/:movieId" element={<MovieDetails />} />
			<Route path="/cinemas" element={<Branches />} />
			<Route path="/booking/:movieId" element={<ShowtimeSelection />} />
			<Route path="/booking/:movieId/seats" element={<SeatSelection />} />
			<Route path="/tickets" element={<Tickets />} />

			{/* ADMIN SIDE */}
			<Route path="/admin/login" element={<AdminLogin />} />
			<Route path="/admin/dashboard" element={<Dashboard />} />
			<Route path="/admin/movies" element={<MovieManagement />} />
			<Route path="/admin/schedule" element={<ScheduleManagement />} />
		</Routes>
	);
}
export default App;
