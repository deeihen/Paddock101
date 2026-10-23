import { defineConfig } from 'vite';

// relative base so the build also works from a sub-path such as GitHub Pages (/repo-name/)
export default defineConfig({ base: './' });
