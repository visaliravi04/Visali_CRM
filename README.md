# Visali Designer Ledger

An order book for a tailoring business. Built for a phone, used at the counter.

Records what a customer ordered, when it's due, what's been paid, and which
pieces are finished. Shows a month calendar of delivery dates, and sends the
customer a WhatsApp message when their work is ready.

## What it does

**New order** — pick the customer (or type a new one), add services with counts
and prices, set the delivery date and time, record any advance paid. Design
references go in as links, so a Pinterest or WhatsApp photo URL works.

**Calendar** — the month laid out. Each date shows how many orders are due,
coloured red if anything is overdue. Tap a date to see those orders.

**Orders** — grouped by delivery date. Open one to mark pieces finished, record
a payment, add courier details, or message the customer.

**Summary** — this week or this month: orders taken, pieces, delivered, still
pending, and the money billed, collected and outstanding, with names.

**Setup** — the list of services and their default prices, plus the message
templates. Write those in whatever language your customers read.

## Marking pieces finished

An order of 10 blouses shows 10 squares. Tap the third square and three are
done. Tap a filled square to go back. Above 14 pieces it becomes a plus and
minus counter, because squares get too small to tap accurately.

This is the part the shop uses most, so it's built to work with one thumb and
no typing.

## About the WhatsApp messages

The app does **not** send messages by itself. Tapping "Message" opens WhatsApp
with the text already written, and a person taps send.

This is deliberate. The WhatsApp Business API needs approval and costs money per
message. More importantly, a person seeing each message before it goes to a
customer is the right default for a business built on relationships.

The message only mentions the pieces that are actually finished. If 2 of 10
blouses are ready, it says two.

## Setup

**1. Create a Supabase project** at supabase.com. Free tier is plenty.

**2. Run the schema.** SQL Editor → New Query → paste all of `schema.sql` → Run.
This creates the tables and seeds twelve common services.

**3. Get your keys.** Project Settings → API. Copy the Project URL and the
anon public key into a `.env` file (copy `.env.example` first).

**4. Run it.**

```
npm install
npm run dev
```

**5. Create the shop account.** Open the app, choose "Create the shop account",
and sign up with an email and password. Everyone signed in shares the same data,
which is what a family shop wants.

In Supabase, go to Authentication → Providers → Email and turn off "Confirm
email" if you'd rather skip the verification step.

**6. Put it on the phone.** Deploy to Vercel (import the GitHub repo, add the
same two environment variables, deploy). Then open the live URL on the phone and
use "Add to Home Screen". It opens like an app.

## Decisions worth knowing

**Dates are stored as plain YYYY-MM-DD text**, not timestamps. A delivery date
of the 19th should read as the 19th regardless of the phone's timezone.

**Payments are rows, not a single number.** A customer pays an advance, then the
balance on delivery. Keeping each payment means you can see when money actually
came in.

**Service names are copied onto the order.** Renaming "Blouse stitching" later
won't rewrite what old orders say.

**Design references are links, not uploads.** No storage to pay for, and the
photo is usually already on WhatsApp or Pinterest. If you'd rather upload files,
create a public `uploads` bucket in Supabase Storage and swap the URL field for
a file input.

**Everyone signed in sees everything.** This is one shop, not a multi-tenant
product. Per-user isolation would be complexity with no benefit here.

## Not built yet

- No offline mode. Patchy shop internet will interrupt saving.
- No printed bill. The browser's print view is usable but not a designed receipt.
- No automatic reminders. The reminder template exists but nothing sends on a schedule.
- No measurement records. Ledgers usually keep customer measurements; this doesn't yet.
- No photo upload. Links only.

Measurements are probably the most valuable next addition, since that's the one
thing a paper ledger does that this doesn't.
