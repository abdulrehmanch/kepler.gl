FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy local build folder to nginx html directory
COPY examples/demo-app/dist/ /usr/share/nginx/html/

EXPOSE 80
