// Policies.jsx
// Terms & Conditions, Privacy Policy, and Cookie Policy.
// One page, three routes: /terms, /privacy, /cookies (the URL picks the tab).
// The text lives in policyContent.js.

import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import { POLICIES, LAST_UPDATED } from "./policyContent.jsx";
import "../../styles/Policies.css";

const POLICY_LIST = Object.values(POLICIES);

// Turns 1 into "01" for the section numbers
const sectionNumber = (index) => String(index + 1).padStart(2, "0");

export default function Policies() {
	const { pathname } = useLocation();
	const policy = POLICY_LIST.find((p) => p.path === pathname) ?? POLICIES.terms;

	// Switching policies starts at the top of the page
	useEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);

	return (
		<>
			<Navbar />

			<main className="policy-page">
				<header className="policy-header">
					<p className="policy-eyebrow">Legal</p>
					<h1 className="policy-title">{policy.title}</h1>
					<p className="policy-updated">Last updated: {LAST_UPDATED}</p>
				</header>

				<nav className="policy-tabs" aria-label="Policies">
					{POLICY_LIST.map((item) => (
						<Link
							key={item.path}
							to={item.path}
							className={`policy-tab ${item.path === policy.path ? "is-active" : ""}`}
							aria-current={item.path === policy.path ? "page" : undefined}
						>
							{item.tab}
						</Link>
					))}
				</nav>

				<div className="policy-layout">
					<aside className="policy-toc" aria-label="On this page">
						<p className="policy-toc-title">On this page</p>
						<ol className="policy-toc-list">
							{policy.sections.map((section, index) => (
								<li key={section.id}>
									<a href={`#${section.id}`}>
										<span className="policy-toc-number">{sectionNumber(index)}</span>
										{section.title}
									</a>
								</li>
							))}
						</ol>
					</aside>

					<article className="policy-content">
						<p className="policy-intro">{policy.intro}</p>

						{policy.sections.map((section, index) => (
							<section key={section.id} id={section.id} className="policy-section">
								<h2 className="policy-section-title">
									<span className="policy-section-number">{sectionNumber(index)}</span>
									{section.title}
								</h2>

								{section.body?.map((paragraph) => (
									<p key={paragraph} className="policy-text">
										{paragraph}
									</p>
								))}

								{section.list && (
									<ul className="policy-list">
										{section.list.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								)}
							</section>
						))}
					</article>
				</div>
			</main>

			<Footer />
		</>
	);
}
