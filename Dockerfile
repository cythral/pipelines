FROM alpine
COPY . /app
WORKDIR /app

# Install Node, 
RUN \
apk add nodejs python3 && \
pip3 install awscli && \
chmod +x /app/entrypoint.sh

ENTRYPOINT /app/entrypoint.sh