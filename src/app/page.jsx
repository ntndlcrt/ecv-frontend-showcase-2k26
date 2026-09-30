import Spotlight from '@/components/Spotlight';

import WebGLScrollBend from '@/animations/WebGLScrollBend';

export default function Page() {
	return (
		<>
			<WebGLScrollBend />
			<main>
				<Spotlight />
			</main>
		</>
	);
}
