# https://gallery.ecr.aws/docker/library/node
FROM public.ecr.aws/docker/library/node:lts-alpine

WORKDIR /app

# Install FFmpeg and tzdata for time zone support
RUN apk add --no-cache ffmpeg tzdata && \
  rm -rf /tmp/* /var/cache/apk/*

COPY ./src .
COPY package.json .

EXPOSE 3000

USER node

CMD ["node", "server.js"]