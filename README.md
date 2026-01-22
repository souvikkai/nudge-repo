Nudge — Turn Saved Content Into Weekly Learning

Nudge is a consumer AI web app that helps people revisit and extract value from content they save across platforms like LinkedIn, Reddit, and Substack etc. Instead of bookmarking posts and articles and never returning to them, Nudge turns saved links and notes into a weekly, topic-based digest with key takeaways, nudging users back to the ideas — and original sources — they actually wanted to think about.
The goal of Nudge is not to replace reading, but to make reflection easier and more intentional.


Problem Statement

People save articles and posts with the intention of learning from them later, but most saved content is never meaningfully revisited. Today’s “save” and bookmark features act as passive storage, not as tools for reflection. Without structure or synthesis, valuable ideas disappear into long lists, creating a gap between what users want to engage with and what they actually reflect on.


How Nudge Helps?

Nudge closes this gap by:

* collecting what users save,
* organizing saved content by topic, and
* surfacing weekly insights that encourage deeper engagement — and nudge users back to original content when more context is needed.

Instead of treating saving as the end of the journey, Nudge treats it as the start of a reflection loop.


Core Product Loop

1. User saves content into Nudge (via link or text)
2. System processes and stores saved items during the week
3. Items are clustered by topic using embeddings
4. A weekly digest is generated with:
   * topic clusters
   * key takeaways
   * links to original sources
5. User revisits content they care about


MVP Scope

In Scope:
* User authentication
* Save content via:
  * article URL (via “copy link to post”, best-effort extraction)
  * pasted text
* Background processing pipeline
* Embedding-based topic clustering
* Weekly digest UI with:
  * topic labels
  * short summaries
  * original content links
* View past weekly digests

Out of Scope (V1)
* Native mobile apps
* Share extensions
* Browser extensions
* Social features
* Personalized recommendations
* Source reputation weighting
* Multi-modal content (video/audio)

These are considered future extensions after the core reflection loop is validated.


How AI Is Used (MVP)

Nudge uses AI for:
* generating text embeddings
* grouping saved items by topic
* summarizing clusters into key takeaways

AI is not used for:
* ranking content importance
* making strong opinions or judgments
* predicting user behavior

The goal is to organize and synthesize, not to replace human judgment.

System Architecture (High Level)

```
[Web Client]
     |
     v
[FastAPI Backend]  --->  [PostgreSQL + pgvector]
     |
     v
[Background Workers]
     |
     v
[Text Extraction + Embeddings + Clustering]
```

* Requests are handled synchronously by the API
* Heavy processing is done asynchronously by workers
* Results are persisted and surfaced in the weekly digest UI


Tech Stack

### Frontend

* React / Next.js
* TypeScript

### Backend

* FastAPI (Python)
* Background workers (RQ or Celery)
* Redis (job queue)

### Data

* PostgreSQL
* pgvector for embeddings

### AI

* OpenAI embeddings + summarization



Getting Started (Local Dev)

>  Setup instructions will be added as services stabilize.


What Success Looks Like for MVP

We consider the MVP successful if:

* Users can save content easily
* Weekly digests are generated reliably
* Topic clusters are understandable
* Users say: “This actually helps me revisit what I saved”

Retention and growth optimization are not goals for V1.



Future Roadmap (Post-MVP):
* Native mobile sharing via iOS / Android share flows for supported apps
(users can share posts or articles directly into Nudge instead of copying links)

* Browser extensions for one-click saving on desktop

* Weekly email digest (e.g., Saturday review) to reinforce reflection habits

* Estimated read time for clusters and individual items to help users plan their review

* Calendar integrations to suggest or auto-block time for weekly content review

* Smarter extraction for dynamic or paywalled pages

* Long-term interest tracking and trend visualization

* Personalized recommendations based on saved content themes

Note: Platform support will vary based on app-level sharing permissions, so native capture will be implemented where technically feasible.


👥 Team

Built collaboratively by:

* Product & UX: Souvik
* Backend & Data Pipeline: Arpan

This project focuses on building a real, end-to-end AI product with production-style system design.
