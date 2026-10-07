import Cursor from '@/components/layout/Cursor';
import Nav from '@/components/layout/Nav';
import SmoothScroll from '@/components/layout/SmoothScroll';

// Chrome du site (nav, curseur, Lenis). Hors de ce groupe : /og, capturé tel quel.
export default function SiteLayout({ children }) {
	return (
		<>
			<Nav />
			<Cursor />
			<SmoothScroll>{children}</SmoothScroll>
		</>
	);
}
