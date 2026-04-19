FROM node:24-alpine

WORKDIR /app

# Copy root manifest files
COPY package*.json ./

# Copy all workspace packages
COPY packages ./packages

# Install dependencies and build all workspaces
RUN npm install
RUN npm run build

# Prune developer dependencies to keep the image lightweight
RUN npm prune --production

# Create explicit directories that require persistent volume mounting
RUN mkdir -p /app/data /app/tenants

# The Express backend API and Widget Server port
EXPOSE 3001

# Start the built backend server
CMD ["node", "packages/server/dist/server.js"]
