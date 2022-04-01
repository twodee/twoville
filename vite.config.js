import {searchForWorkspaceRoot} from 'vite';

export default {
  esbuild: {
    keepNames: true,
  },
  build: {
    // minify: 'terser',
    // terserOptions: {
      // mangle: false,
      // keep_classnames: true,
      // keep_fnames: true,
    // },
  },
  optimizeDeps: {
    esbuildOptions: {
      keepNames: true,
    },
  },
  // base: '/apps/toast/',
  // server: {
    // fs: {
      // allow: [
        // searchForWorkspaceRoot(process.cwd()),
        // '/Users/twodee/checkouts/twodeejs/'
      // ],
    // },
  // },
};
