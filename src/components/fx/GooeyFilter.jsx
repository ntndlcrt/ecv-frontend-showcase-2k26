export default function GooeyFilter() {
	return (
		<svg
			aria-hidden="true"
			style={{
				position: 'absolute',
				width: 0,
				height: 0,
				pointerEvents: 'none'
			}}>
			<defs>
				<filter
					id="blur-matrix"
					x="-50%"
					y="-50%"
					width="200%"
					height="200%">
					<feColorMatrix
						in="SourceGraphic"
						type="matrix"
						values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
					/>
				</filter>
			</defs>
		</svg>
	);
}
