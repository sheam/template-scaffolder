export default {
  '*.{ts,tsx}': ['npm run format:pre-commit', 'npm run lint:pre-commit'],
  '*.json': ['npm run format:pre-commit'],
  '*.js': ['npm run format:pre-commit'],
  '*.md': ['npm run format:pre-commit'],
};
