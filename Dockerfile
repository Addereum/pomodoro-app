# ==============================================================================
# Addereums Pomodoro - Lightweight Web Server Container
# Serves the full offline Pomodoro Web Dashboard via Alpine Nginx (~15 MB)
# ==============================================================================

FROM nginx:alpine
LABEL maintainer="addereum <https://github.com/addereum>"
LABEL description="Addereums Pomodoro - Offline Focus & Productivity Dashboard"

# Set working directory
WORKDIR /usr/share/nginx/html

# Clean default nginx files
RUN rm -rf ./*

# Copy web app
COPY app/web/ ./
COPY app/icon.svg ./icon.svg
COPY app/icon.png ./icon.png

# Nginx caching and MIME configuration
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
        add_header Cache-Control "no-cache, must-revalidate";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
