# syntax=docker/dockerfile:1

# See https://gallery.ecr.aws/docker/library/node
FROM public.ecr.aws/docker/library/node:24-alpine

ENV NODE_ENV=production
ENV HTTP_PORT=3000

# Install FFmpeg and tzdata for time zone support
RUN apk add --no-cache ffmpeg tzdata && \
  rm -rf /tmp/* /var/cache/apk/*

WORKDIR /app
COPY --chown=node:node package.json .
COPY --chown=node:node ./src .

EXPOSE $HTTP_PORT

USER node

HEALTHCHECK \
  CMD wget -S --spider http://localhost:${HTTP_PORT}/healthcheck || exit 1

CMD ["node", "server.js"]