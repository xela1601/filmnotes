/**
 * Public API of @filmnotes/exporters.
 *
 * Importing this module registers the built-in targets, so the app only has to import the package
 * once and can then resolve every target through `getExporter` / `listExporters`. A host that
 * wants a different set registers its own exporters on top – the same id replaces an entry.
 */
import { registerExporter } from './registry';
import { shareExporter } from './share';
import { wordPressExporter } from './wordpress';

export * from './types';
export * from './registry';
export * from './share';
export * from './wordpress';

registerExporter(wordPressExporter);
registerExporter(shareExporter);
