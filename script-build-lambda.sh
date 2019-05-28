rm -rf node_modules dist && \
npm install --arch=x64 --platform=linux --target=10.0.0 && \
npm run code-check && \
npm run build &&
rm archive.zip || true &&
zip -r archive.zip ./*