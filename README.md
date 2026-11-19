# Happy Smile desk dashboard (fictional demo)

Front-desk view of calls handled by AIVA, HappySmile's AI voice assistant.

Live: https://agrimayadav.github.io/aiva-demo/

- Header shows the one number that matters to staff: callbacks waiting, split by P0 / P1 / P2.
- **Needs a callback**: AIVA hand-offs sorted by urgency, each with the rule that triggered it.
  - Actions: Call, SMS, **Booked by staff** (recovered booking, counted separately from AIVA bookings), Mark complete (resolved without booking), Transcript, and thumbs up/down feedback.
- **Handled by AIVA**: calls AIVA booked, cancelled or closed. Staff can review and give feedback.
- **Handoff rules**: preset rules. Staff can add a rule; it stays grey ("Pending approval") until the front-desk lead approves it.

State is saved in the browser (localStorage). Use "Reset demo" to restore the sample data.
The earlier voice-call prototype is still at `call.html`.

- **Guide**: a how-to-use sheet for reviewers that opens on the first visit and can be reopened from the Guide button.
