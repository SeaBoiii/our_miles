# Card artwork

The wallet and recommendations show authentic issuer artwork, downloaded from the official public sources below on **7 October 2026**. The assets are local WebP files in `public/cards/`, rather than remote hotlinks. They work with the GitHub Pages base path and the app's existing offline cache without an image optimisation service.

Copyright and card designs belong to the respective issuers and payment networks. These files are included to identify the two users' existing cards in this private application; this document does not grant a licence to redistribute the designs for unrelated products. Logos, typography, colours and sample card details have not been redrawn or generated.

| Template | Issuer source | Artwork used | Local image |
| --- | --- | --- | --- |
| Maybank XL | [Maybank Singapore card promotion](https://cardspromo.maybank2u.com.sg/msia) | **XL Rewards**, the front card in Maybank's combined XL Rewards / Cashback image; portrait | `cards/maybank-xl.webp` |
| Citi Rewards | [Citi Singapore card catalogue](https://www.citibank.com.sg/credit-cards) | Mastercard design shown in the issuer catalogue | `cards/citi-rewards.webp` |
| HSBC Revolution | [HSBC Revolution](https://www.hsbc.com.sg/credit-cards/products/revolution/) | Current Visa Signature design | `cards/hsbc-revolution.webp` |
| Trust Freedom | [Trust Freedom Miles](https://trustbank.sg/freedom-credit-card/miles/) | Front card cropped from the issuer's Freedom illustration | `cards/trust-freedom.webp` |
| DBS Esso | [DBS Esso Platinum](https://www.dbs.com.sg/personal/cards/credit-cards/dbs-esso-platinum-card) | Platinum Mastercard | `cards/dbs-esso.webp` |
| Mari Credit Card | [Mari Credit Card](https://www.maribank.sg/product/mari-credit-card) | Digital card cropped from MariBank's app illustration | `cards/mari.webp` |
| UOB One | [UOB One](https://www.uob.com.sg/personal/cards/cashback/one-card.page) | Portrait Visa Signature credit card from the issuer catalogue | `cards/uob-one.webp` |
| UOB Lady's | [UOB Lady's Card](https://www.uob.com.sg/personal/cards/rewards/ladys-card/index.page) | Standard Lady's World Mastercard | `cards/uob-ladys.webp` |
| DBS Woman's World | [DBS Woman's cards](https://www.dbs.com.sg/personal/cards/credit-cards/dbs-woman-mastercard-card) | Woman's **World** Mastercard | `cards/dbs-wwmc.webp` |
| UOB Preferred Visa | [UOB Preferred Visa](https://www.uob.com.sg/personal/cards/rewards/preferred-visa-card.page) | Current refreshed blue Visa Signature design, cropped from the official product masthead | `cards/uob-ppv.webp` |
| KrisFlyer UOB | [KrisFlyer UOB Credit Card](https://www.uob.com.sg/personal/cards/travel/krisflyer-card.page) | Gold Credit Mastercard | `cards/uob-krisflyer.webp` |

`src/lib/card-artwork.ts` records each original asset URL, issuer page, dimensions, verification date and relevant variant. Maybank's artwork is served from the S3 asset URL referenced by its official `cardspromo.maybank2u.com.sg` page. UOB's card faces were verified against its official product pages, including the standard Lady's card and refreshed Preferred Visa design.

The images identify card products. An older physical card or different network variant may look different. In particular, the selected Citi image is Mastercard and Mari's image is its digital card illustration. Artwork does not determine earn rules or recommendation eligibility.

Official illustrations may contain **bank-provided marketing sample names, account numbers or expiry dates**. These were present in the original issuer assets; none are Aleem's or Nurul's details. The app does not collect or add real card credentials to its card artwork. Crops remove surrounding bank-page UI and backgrounds while preserving the card faces.

The reusable `CardArt` component uses a fixed display frame, preserves each design's proportions with `object-fit: contain`, reserves space to avoid layout shifts, and supplies descriptive alternative text unless the adjacent text already names the card. Maybank XL and UOB One retain their portrait orientation. Unknown future templates receive a clearly labelled “Artwork unavailable” fallback.

All 11 files are WebP, about **424 KiB combined**. Large sources are resized without enlarging small originals. Maybank XL and Preferred Visa have smaller source dimensions; using a larger image from an unofficial source would sacrifice the verified variant. Recheck the official product imagery when updating a card's knowledge or if either user requests a different issued design.
