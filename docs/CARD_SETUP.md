# Card setup

Bank templates and dated benefit notes are public knowledge. Card ownership, usage and selections belong to the authenticated private wallet; they are never seeded into the GitHub Pages bundle.

## Existing Supabase projects

Apply `supabase/migrations/202610070001_card_preferences.sql` in the Supabase SQL editor after the two existing migrations. It extends the closed wallet schema for separate cap buckets, selected categories and annual qualification; it does not relax membership, RLS or immutable transaction evidence. Keep the existing signup restrictions and invited-user setup in [HOSTING.md](HOSTING.md).

Then add an owned card through Wallet → Add a card. Choose its owner, then open it to set current usage. The application sends changes only through the authenticated, version-checked wallet RPC. Refresh other open devices after setup.

## Bonus setup

- **Maybank XL:** confirm current calendar-month bonus spend and total qualifying spend. S$500 is the minimum; only the listed local MCCs or eligible foreign purchases qualify for 4 mpd. No enhanced new-card cap is assumed.
- **UOB Lady’s standard:** select one category with UOB first. In the app choose that registered category and confirm its current calendar quarter. Changing this selector does not enroll with the bank. Nurul can decide later; until confirmation the engine uses base earn. Reconfirm each quarter to protect against an unrecorded bank change.
- **DBS Woman’s World:** confirm this month’s usage, split previous online spend into SGD and foreign-currency SGD equivalents. The two share one S$1,000 cap, but DBS rounds bonus points independently. Enter merchant settlement dates when reconciling posted purchases.
- **UOB Preferred Visa / PPV:** confirm Online and Mobile contactless independently. Each has S$600. Use Apple Pay, Google Pay or Samsung Pay at the physical reader; ordinary physical card taps do not earn the mobile bonus. Online recurring payments do not earn the online bonus. Unknown generic wallets do not imply bank-approved mobile eligibility.
- **KrisFlyer UOB:** confirm the current membership year starting in the approval month and airline-group spend before app records. Only Singapore Airlines/Scoot/KrisShop count toward the S$1,000 condition; Kris+ and Pelago do not. Select a confirmed partner payment path in What Card? for 3 mpd. Other eligible categories use 2.4 mpd only after the annual condition is known and achieved; extra miles credit after the membership year ends.

Prior spend inputs exclude purchases already recorded in this app. Pending purchases reserve bonus capacity; only confirmed posted spend qualifies minimum/annual conditions. Benefits & things to know in each wallet sheet includes exclusions, fees, expiry, transfer rules and conditional travel/merchant perks with official links. Expired dated offers are filtered from that view. Merchant promotional miles, linked-account boosts, insurance and new-customer gifts are not automatic earn-rate additions.

No card number, CVV, bank password or secret Supabase key is needed. The publicly exposed publishable key is safe only with the configured invitation-only membership and RLS; keep server/admin keys outside the frontend.
