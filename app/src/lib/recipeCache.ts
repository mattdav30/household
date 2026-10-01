import type { WebRecipe } from './api';

/** Imported recipes are held here between the import step and the recipe screen. */
export const webRecipes = new Map<string, WebRecipe>();
