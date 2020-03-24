set -e
docker run -it \
    -v `pwd`:/app \
    node:12-slim \
   /app/build-docker.sh