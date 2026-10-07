import AnimatedCopy from '@/components/fx/AnimatedCopy';

// Chaque paragraphe a son propre AnimatedCopy : il se révèle ligne par ligne
// (stagger 0.1s) quand il entre dans le viewport, sans casser le gap du flex.
const PARAGRAPHS = [
	"Ce projet a été réalisé en septembre 2026 avec les étudiant·es du M2 Digital Dev Web de l'ECV Lille.",
	"Le principe : partir d'une API externe, avec tous ses défauts, et en tirer un site complet sous Next.js — un site qui ne se contente pas de fonctionner, mais qui donne envie d'être parcouru.",
	"Ce brief prolonge directement le module de création web abordé en M1 : partir d'un design statique pour lui ajouter des animations complexes et des micro-interactions subtiles, jusqu'à construire une expérience immersive et visuellement riche.",
	"Chaque projet est, à mon sens, une réussite à la fois personnelle et collective, qui reflète autant la créativité que la rigueur technique de ses auteur·ices. Toustes se sont emparé·es de l'exercice pour le réinterpréter à leur manière, quitte à explorer des pistes bien au-delà de l'énoncé.",
	"En tant qu'intervenant, je suis fier de mettre ici leur travail en lumière. Vous trouverez pour chacun·e un lien direct vers son projet ainsi que vers son profil."
];

export default function About() {
	return (
		<section className="flex flex-col gap-6 px-4 pt-10 pb-40 text-2xl font-medium desktop:gap-10 desktop:px-10 desktop:py-20 desktop:text-4xl">
			{PARAGRAPHS.map((text, i) => (
				<AnimatedCopy
					key={text}
					delay={i * 0.2}>
					<p>{text}</p>
				</AnimatedCopy>
			))}
			<AnimatedCopy delay={1.6}>
				<p className="mt-4 text-right desktop:mt-10">— Antoine Delcourte</p>
			</AnimatedCopy>
		</section>
	);
}
