# english-grammar-quiz

Interactive English grammar practice quizzes covering the **complete A1 (beginner) course** —
from the verb *to be* through the past simple, comparatives and the future.

**Live:** https://sundriedcorn.github.io/english-grammar-quiz/

## What's in it

41 topic quizzes grouped into 10 sections that follow the order of the lessons:

| # | Section | Topics |
|---|---------|--------|
| 1 | Who you are & what things are | to be, this/that/these/those, a/an + plurals, possessive adjectives, it's vs its, adjectives |
| 2 | Routines & questions | present simple, adverbs of frequency, object pronouns, questions, word order |
| 3 | Time & place | prepositions of time, prepositions of place, position words, there is/are, there/this/it |
| 4 | Things, amounts & owners | a/the/no article, much/many/little/few, a/some/any, whose + possessive 's, have got |
| 5 | Wants, abilities & orders | can/can't, the imperative, would like, verb + to / verb + -ing |
| 6 | Right now | present continuous, simple vs continuous, adverbs of manner |
| 7 | The past | was/were, past simple, past negatives & questions, conjunctions |
| 8 | Comparing | comparatives, superlatives |
| 9 | The future | be going to, will and shall |
| 10 | Finishing touches | before/after/until, ordinals & dates, one/ones, very/quite/a bit, adjective order |

Plus **mixed tests**: one per section, and a **Full A1 Test** drawing 30 random questions from
every topic. Mixed tests are assembled at runtime, so they always cover whatever is in the bank.

## Features

- Two question types: multiple choice and fill-in-the-blank (accepts contractions and full forms)
- An explanation after every answer, right or wrong
- Wrong answers collected at the end, with a **Review Mistakes Only** re-run
- Best score per topic, saved in the browser
- Answer multiple choice with the **number keys**, advance with **Enter**
- Search box to jump to a topic
- Works offline, no build step, no dependencies, light and dark themes

## Editing the questions

All content lives in [`questions.js`](questions.js) as one `TOPICS` array. A topic looks like:

```js
{
  id: "have-got",                 // stable — best scores are saved against it
  name: "Have Got",
  icon: "🎒",
  group: "Things, amounts & owners",   // which home-screen section it appears in
  lesson: "have-got.html",             // matching lesson page
  description: "I've got, she's got, have you got?",
  questions: [
    { type: "mc", q: "She ___ a new bike.", options: ["has got", "have got"], answer: "has got", exp: "she -> has got." },
    { type: "fill", q: "___ you ___ (have) a pen?", answers: ["have you got"], exp: "Question: Have you got...?" }
  ]
}
```

Two things to watch:

- **Options are shuffled at runtime**, so never write an option like "both" or "all of the above".
- **`fill` answers must list every acceptable form** — `["don't watch", "do not watch"]`. Matching
  ignores case, extra spaces and curly apostrophes.

Adding a topic to a new `group` creates a new section automatically.
