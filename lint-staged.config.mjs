export default {
  '*.{ts,mts,js,mjs}': ['prettier --write', 'eslint --fix --no-warn-ignored'],
  '*.{json,md,yml}': ['prettier --write'],
};
