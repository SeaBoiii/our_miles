# UOB Preferred Visa / PPV

Checked **7 October 2026**. Nurul's ownership comes from the user; current usage and statement details require confirmation.

The current name is **UOB Preferred Visa**, formerly Preferred Platinum Visa. The [product terms, updated 10 March 2026](https://www.uob.com.sg/web-resources/personal/pdf/personal/cards/credit-cards/rewards-cards/uob-preferred-platinum-visa-card/terms-and-conditions-for-preferred-plat-visa.pdf) govern the calculation:

- Selected, non-recurring online transactions must satisfy the published MCC list.
- In-person mobile taps through Apple Pay, Google Pay or Samsung Pay qualify; a physical card tap does not. In-app wallet transactions use the online rules.
- Each calendar month has **two independent bonus UNI$1,080 caps**, one online and one mobile contactless. Each is equivalent to S$600 of complete bonus earning blocks. Eligible spend earns up to 4 mpd, with 0.4 mpd base after exhaustion.
- Shell/SPC service stations, AMAZE, top-ups, financial transactions and the published excluded MCCs/descriptors earn no UNI$.
- Supplementary spending belongs to the principal account; these are account buckets, not shared household buckets.

The [current product page](https://www.uob.com.sg/personal/cards/rewards/preferred-visa-card.page) dates the split caps to **1 October 2025** and SimplyGo mobile eligibility to **28 August 2025**. Some FAQ text still describes the obsolete combined UNI$2,000 cap. The dated PDF prevails. For physical-card SimplyGo, official descriptions conflict; the app withholds bonus conservatively.

SimplyGo accumulates monthly and shares the mobile cap. Its rounding pool stays separate from ordinary mobile purchases. Small rides can cross a monthly earning block. The [Rewards Programme terms](https://www.uob.com.sg/assets/pdfs/personal/cards/rewardsplus_tnc.pdf) specify transaction-level UNI$ flooring and UNI$1 = 2 miles, 10,000-mile transfer blocks and a **S$27 conversion fee**. The app uses complete S$5 blocks for ordinary PPV transactions; the public documents provide no fractional PPV worked example, so statement reconciliation remains authoritative. Net values omit an unallocated batch fee and disclose it.

The [card agreement's fees table](https://www.uob.com.sg/personal/cards/credit-cards/terms-and-conditions.page) charges **3.25% for non-SGD Visa transactions**. SGD processed overseas may have separate charges and is flagged for review.

Implementation evidence: separate confirmed opening usage for `uob-ppv-online` and `uob-ppv-mobile`; a separate `uob-ppv-simplygo` reward pool; immutable rule/version/source snapshots. Generic mobile wallets, recurring online arrangements and an unconfirmed MCC do not become confirmed eligibility automatically.
