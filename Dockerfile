# https://gallery.ecr.aws/docker/library/node
FROM public.ecr.aws/docker/library/node:lts-alpine

WORKDIR /app

# Install FFmpeg
RUN apk add --no-cache ffmpeg

COPY . .

EXPOSE 3000

USER node

CMD ["node", "./src/server.js"]