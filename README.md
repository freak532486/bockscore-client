## What is this?
This is an alternative client implementation for [bockscore](https://bockscore.cloneapps.de/), an online app written by my friend for our friend groups' private purposes.

## Why?
While the "official" client looks much nicer and is more feature complete, it is not very mobile-friendly, and my friend (as far as I know) has little interest in _making_ it mobile friendly. So I wrote my own alternative client.

## How to install?

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

## What is the point of this website
Our friend group meets up weekly for couch gaming. We play singleplayer games together, with the intent of experiencing
new games that we have not played yet. Selecting the next game to play so that it feels fair for everyone and is not
overwhelming is quite difficult. We came up with this process some years ago that works exceptionally well.

1. Maintain a list of games in Excel. Every player assigns a score from one to ten to each game, depending on how much they want to play it (the "Bockscore")
2. Every person gets to pick one joker in the table. What this does is explained below.
3. Calculate a final score for each game from all scores given by the players.
  * A simple score function is to simply take the average. But we want to punish the score of games for which some players have a really low score. It is better to play a game where everyone says "Meh" rather than a game where one player hates it.
  * A better score formula is using a [generalized mean](https://en.wikipedia.org/wiki/Generalized_mean) $=\lparen \frac{1}{n} \sum_{i=0}^{n} s_i^e \rparen^\frac{1}{e}$ with $k < 0$. This penalizes games that have strongly different scores. We choose $e = -1.2$ as a pretty good exponent.
4. Select $k$ different games from the table based on a _weighted_ random selection. Then, add all jokers of each player to the list as well.
  * Games with a score of $10$ are ten times as likely to be picked than games with a score of $1$
  * We choose $k = 40$.
5. Start the voting round: Going counter-clockwise, every player votes out one game from the chosen list of games. After the list of remaining games has at least halved, a player can _pass_. If at least half the players have passed, the voting round is over. It is _not_ allowed to vote out a joker.
6. The result of the voting round should be a list of $\leq \frac{k}{2}$ games
7. Input this list into a wheel of fortune website. Spin the wheel and remove the winner. Continue until the final game is determined.
  * Jokers can be removed by the wheel
  * If at any point in this spin the wheel phase the group is in unison on which game is best, then the group can decide to stop the process and play that game.
  * Otherwise, the final remaining game is played.

The entire process takes about an hour and is quite fun in itself. It reliably selects games that both random (so you can be surprised by a good game that you voted as "Meh") _and_ it feels fair for every player.