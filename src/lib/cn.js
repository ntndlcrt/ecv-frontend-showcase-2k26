import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn — classes conditionnelles + fusion Tailwind
 * ----------------------------------------------
 * `clsx` assemble (strings, objets, tableaux, falsy ignorés), puis `twMerge`
 * résout les conflits : la DERNIÈRE classe d'un même groupe gagne.
 *
 *   cn('w-8 p-4', isWide && 'w-full')   // → 'p-4 w-full'
 *   cn('px-2 py-1', { 'p-6': big })     // → 'p-6' si big
 *   cn('w-8 h-8', 'size-12')            // → 'size-12'
 *   cn('w-8', 'hover:w-12')             // → 'w-8 hover:w-12' (variants distincts)
 */
export function cn(...inputs) {
	return twMerge(clsx(inputs));
}
