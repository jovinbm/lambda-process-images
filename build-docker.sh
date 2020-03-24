set -e
echo "building in docker"
cd /app
rm -rf node_modules
rm -rf dist
npm install
npm run build