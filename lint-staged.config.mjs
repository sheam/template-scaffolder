export default {
  '*.{ts,mts,js,mjs}': ['prettier --write', 'eslint --fix'],
  '*.{json,md,yml}': ['prettier --write'],
};
