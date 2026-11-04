// Dropdown.jsx — reusable custom select for admin pages.
//
// Used in place of a native <select> so the menu always opens directly
// below the field (a native <select>'s popup position and style are drawn
// by the OS, not by our CSS — on macOS it centers on the current value
// instead) and so options can show a thumbnail (e.g. a movie poster).
//
// Props:
//   options   — [{ value, label, thumbnail? }]
//   value     — the selected option's value
//   onChange  — called with the new value
//   ariaLabel — accessible name for the trigger button

import { useEffect, useRef, useState } from "react";
import "../styles/Dropdown.css";

const IconChevron = ({ open }) => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		className={open ? "dropdown-chevron dropdown-chevron--open" : "dropdown-chevron"}
	>
		<path d="M6 9l6 6 6-6" />
	</svg>
);

const IconCheck = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M20 6L9 17l-5-5" />
	</svg>
);

function Dropdown({ options, value, onChange, ariaLabel }) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef(null);

	// Close on outside click or Escape — only listens while open.
	useEffect(() => {
		if (!isOpen) return undefined;

		const handleClickOutside = (event) => {
			if (containerRef.current && !containerRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		};
		const handleKeyDown = (event) => {
			if (event.key === "Escape") setIsOpen(false);
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	const selected = options.find((option) => option.value === value) ?? options[0];

	return (
		<div className="dropdown" ref={containerRef}>
			<button
				type="button"
				className="dropdown-trigger"
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-label={ariaLabel}
				onClick={() => setIsOpen((open) => !open)}
			>
				<span className="dropdown-trigger-label">
					{selected.thumbnail && <img className="dropdown-thumb" src={selected.thumbnail} alt="" />}
					{selected.label}
				</span>
				<IconChevron open={isOpen} />
			</button>

			{isOpen && (
				<ul className="dropdown-menu" role="listbox">
					{options.map((option) => (
						<li key={option.value} role="option" aria-selected={option.value === value}>
							<button
								type="button"
								className="dropdown-option"
								onClick={() => {
									onChange(option.value);
									setIsOpen(false);
								}}
							>
								{option.thumbnail && <img className="dropdown-thumb" src={option.thumbnail} alt="" />}
								<span>{option.label}</span>
								{option.value === value && <IconCheck />}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export default Dropdown;
