export default {
  '*.{ts,tsx}': ['npm run pre-commit:format', 'npm run pre-commit:lint'],
  '*.json': ['npm run pre-commit:format'],
  '*.js': ['npm run pre-commit:format'],
  '*.md': ['npm run pre-commit:format'],
};
