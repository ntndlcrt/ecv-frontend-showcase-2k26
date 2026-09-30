'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import Specular from '@/animations/Specular';
import { cn } from '@/libs/cn';

export default function Nav() {
	const pathname = usePathname();

	return (
		// Positionnement sur un wrapper : Specular mesure son hôte, qui doit donc
		// contenir la nav dans le flux (une nav `fixed` le laisse à 0×0).
		<div className="fixed bottom-8 left-1/2 z-100 -translate-x-1/2">
			<Specular
				radius={12}
				lineColor="#ffffff66"
				baseColor="#ffffff33">
				<nav className="flex items-baseline gap-12 rounded-[inherit] bg-[#0d0d0d66] px-12 py-6 text-xl font-medium backdrop-blur-lg">
					<div className="flex gap-6">
						<Link
							href="/"
							className={cn(
								'duration-200 ease-out hover:opacity-80',
								pathname === '/' ? 'pointer-events-none opacity-100' : 'opacity-40'
							)}>
							Projects
						</Link>
						<Link
							href="/a-propos"
							className={cn(
								'duration-200 ease-out hover:opacity-80',
								pathname === '/a-propos' ? 'pointer-events-none opacity-100' : 'opacity-40'
							)}>
							À propos
						</Link>
					</div>
				</nav>
			</Specular>
		</div>
	);
}
