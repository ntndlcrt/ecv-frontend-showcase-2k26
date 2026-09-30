import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';
import './cursor.scss';

import Nav from '@/components/Nav';

import GooeyFilter from '@/animations/GooeyFilter';
import Cursor from '@/libs/Cursor';
import SmoothScroll from '@/libs/Lenis';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin']
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin']
});

export const metadata = {
	title: 'ECV Frontend Showcase 2k26',
	description: "La vitrine des projets frontend des étudiants M2 Dev de l'ECV Lille — 2026"
};

export default function RootLayout({ children }) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<body className="flex min-h-full flex-col">
				<GooeyFilter />
				<Nav />
				<Cursor />
				<SmoothScroll>{children}</SmoothScroll>
			</body>
		</html>
	);
}
