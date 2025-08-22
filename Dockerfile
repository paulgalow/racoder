# Use the official Node.js LTS image as the base image
FROM node:lts

ENV NODE_ENV=production
ENV HTTP_PORT=3000

# Set the working directory inside the container
WORKDIR /app

# Install ffmpeg and tzdata
RUN apt-get update && \
 apt-get install -y ffmpeg tzdata && \
 rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

USER node

# Expose port 3000
EXPOSE $HTTP_PORT

HEALTHCHECK \
  CMD wget -S --spider http://localhost:${HTTP_PORT}/healthcheck || exit 1

# Start the application
CMD ["node", "src/server.js"]