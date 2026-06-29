# What is this?
This is an alternative client implementation for [bockscore](https://bockscore.cloneapps.de/), an online app written by my friend for our friend groups' private purposes.

# Why?
While the "official" client looks much nicer and is more feature complete, it is not very mobile-friendly, and my friend (as far as I know) has little interest in _making_ it mobile friendly. So I wrote my own alternative client.

# How to install?

First, launch the client server.

1. Clone this repo
2. `npm install && npm run build` to build the client
3. `npm run start`. You can change the port in the `package.json`

Second, you need to set up a reverse proxy that redirects incoming requests to the client server, and incoming requests
to `/api` to `https://bockscore.cloneapps.de/api`.

I recommend nginx as a reverse proxy. It is simple, free, fast and somewhat easy to setup. Here is my server
configuration for forwarding calls to `/` to my client server and calls to `/api` to my friends server:

```
server {
    listen 8080;
    server_name localhost;

    location / {
        proxy_pass http://localhost:3000;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass https://bockscore.cloneapps.de/api/;

        proxy_ssl_server_name on;
        proxy_ssl_name bockscore.cloneapps.de;

        proxy_set_header Origin https://bockscore.cloneapps.de;
        proxy_set_header Referer https://bockscore.cloneapps.de/;

        proxy_set_header Host bockscore.cloneapps.de;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Run nginx (or your reverse proxy of choice). Connect to your reverse proxy port with your web browser and everything
should work.