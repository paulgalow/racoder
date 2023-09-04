# https://gallery.ecr.aws/docker/library/node
FROM public.ecr.aws/docker/library/node:lts-alpine

ENV NODE_ENV=production
ENV HTTP_PORT=3000

WORKDIR /app

# Install FFmpeg and tzdata for time zone support
RUN apk add --no-cache ffmpeg tzdata && \
  rm -rf /tmp/* /var/cache/apk/*

COPY ./src .
COPY package.json .

EXPOSE $HTTP_PORT

USER node

HEALTHCHECK \
  CMD wget -q --spider http://localhost:${HTTP_PORT}/healthcheck || exit 1

CMD ["node", "server.js"]