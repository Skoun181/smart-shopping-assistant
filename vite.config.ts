import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter(),
      csrf: { trustedOrigins: [] },
      csp: {
        mode: 'auto',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          'connect-src': ['self'],
          'font-src': ['self'],
          'object-src': ['none'],
          'frame-ancestors': ['none'],
          'base-uri': ['self'],
          'form-action': ['self']
        }
      }
    })
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});
