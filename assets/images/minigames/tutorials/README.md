# Minigame tutorial clips

Each minigame's "Would you like to hear an explanation?" tutorial opens with one
of these short looping clips (animated WebP, 16:9). They're listed in
`core/onboarding/minigameGuides.js`.

| File | Minigame | What it shows |
| --- | --- | --- |
| `hangmans-gambit.webp` | Hangman's Gambit | Bullet Time lighting the spheres, then matching pairs to fill in the anagram |
| `argument-armament.webp` | Argument Armament | Shooting statements in the 3×3 grid and reloading |
| `non-stop-debate.webp` | Non-Stop Debate | Picking a Truth Bullet, silencing White Noise, shooting the weak point (COUNTER!) |
| `mass-panic-debate.webp` | Mass Panic Debate | Three columns at once, clearing White Noise, shooting the weak point |
| `scrum-debate.webp` | Scrum Debate | Cycling Truth Bullets and answering the opposing team's claims |
| `rebuttal-showdown.webp` | Rebuttal Showdown | Choosing a Truth Blade and slashing incoming statements |
| `question-truth.webp` | Question Truth | Reading bullets, using HINT, picking the answer (GOT IT!) |
| `question-time.webp` | Question Time | A wrong answer crossed out, then the right one (GOT IT!) |
| `mind-mine.webp` | Mind Mine | Breaking same-colour groups as neighbours change colour |
| `voting.webp` | Voting Time | Choosing a portrait, pressing VOTE, the tally |

## Using your own recording

Record the minigame in SillyTavern (the `/startNonStopDebateTest…`,
`/startMassPanicDebateTest…`, `/scrumdebate`, `/mindmine`, `/rebuttalshowdown`
and other slash commands start one without a trial), then save it over the
matching file:

- Keep it short (4–10 seconds) and 16:9. It's shown cropped to 16:9.
- Animated WebP is smallest. With ffmpeg:
  `ffmpeg -i clip.mp4 -vf "fps=12,scale=720:-2" -c:v libwebp_anim -loop 0 -quality 60 name.webp`
- A GIF or still PNG also works: save it under the same `.webp` name (browsers
  go by the file's contents), or point the guide's `image` at the new name.

If a clip is missing, Hangman's Gambit and Argument Armament fall back to their
old screenshots, and the other tutorials show text only.

## Re-recording these

`tools/minigame-captures/` holds the page and script that made these. They run
each minigame with sample data in headless Chromium and encode the result:

```
node tools/minigame-captures/capture.mjs            # all of them
node tools/minigame-captures/capture.mjs voting     # just one
```

They need Playwright with Chromium and ffmpeg built with libwebp. Without
SillyTavern there are no character sprites, so the scenes use sample names and
the extension's own art.
