import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/**
 * Point d'entrée GSAP unique
 * --------------------------
 * Enregistre les plugins UNE fois. Tout le projet importe d'ici plutôt que
 * de `gsap` directement → plus de `registerPlugin` éparpillés.
 *
 *   import { gsap, ScrollTrigger, useGSAP } from '@/libs/gsap';
 *
 * Nouveau plugin ? L'importer + l'ajouter à `registerPlugin` + l'exporter.
 */
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, CustomEase);

export { CustomEase, Flip, gsap, ScrollTrigger, SplitText, useGSAP };
