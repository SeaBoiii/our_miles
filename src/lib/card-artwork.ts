/** Official issuer artwork, bundled locally so it works offline and on GitHub Pages. */
export interface CardArtwork {
  templateId: string;
  name: string;
  src: string;
  width: number;
  height: number;
  sourceUrl: string;
  assetUrl: string;
  verifiedAt: string;
  variant?: string;
}

export const CARD_ARTWORK: Record<string, CardArtwork> = {
  "maybank-xl": {
    templateId: "maybank-xl", name: "Maybank XL Rewards", src: "/cards/maybank-xl.webp", width: 132, height: 213,
    sourceUrl: "https://cardspromo.maybank2u.com.sg/msia",
    assetUrl: "https://mbsg-microsite.s3.ap-southeast-1.amazonaws.com/b8f81495-b6fa-4c41-b1a8-43af3d8959cb-xl-card-face-2025.png",
    verifiedAt: "2026-10-07", variant: "XL Rewards, cropped from the issuer's two-card illustration.",
  },
  "citi-rewards": {
    templateId: "citi-rewards", name: "Citi Rewards", src: "/cards/citi-rewards.webp", width: 333, height: 213,
    sourceUrl: "https://www.citibank.com.sg/credit-cards",
    assetUrl: "https://www.citibank.com.sg/content/dam/cgcpc/sg/prelogin/www-citibank-com-sg/image/credit-cards/apple-products/rewardscard_5.png",
    verifiedAt: "2026-10-07", variant: "Mastercard artwork currently used in the issuer catalogue.",
  },
  "hsbc-revolution": {
    templateId: "hsbc-revolution", name: "HSBC Revolution", src: "/cards/hsbc-revolution.webp", width: 718, height: 453,
    sourceUrl: "https://www.hsbc.com.sg/credit-cards/products/revolution/",
    assetUrl: "https://www.hsbc.com.sg/content/dam/hsbc/sg/images/credit-cards/19582-sg-revolution-card-face-1600x900.jpg",
    verifiedAt: "2026-10-07", variant: "Current Visa Signature design.",
  },
  "trust-freedom": {
    templateId: "trust-freedom", name: "Trust Freedom", src: "/cards/trust-freedom.webp", width: 760, height: 492,
    sourceUrl: "https://trustbank.sg/freedom-credit-card/miles/",
    assetUrl: "https://trustbank.sg/_next/static/images/freedom-card-4ec7d4337deae94b12cd5aa710af4f05.webp",
    verifiedAt: "2026-10-07",
  },
  "dbs-esso": {
    templateId: "dbs-esso", name: "DBS Esso", src: "/cards/dbs-esso.webp", width: 280, height: 178,
    sourceUrl: "https://www.dbs.com.sg/personal/cards/credit-cards/dbs-esso-platinum-card",
    assetUrl: "https://www.dbs.com.sg/iwov-resources/media/images/cards/dbs-esso-cardface.png",
    verifiedAt: "2026-10-07", variant: "DBS Esso Platinum Mastercard.",
  },
  "mari": {
    templateId: "mari", name: "Mari Credit Card", src: "/cards/mari.webp", width: 307, height: 192,
    sourceUrl: "https://www.maribank.sg/product/mari-credit-card",
    assetUrl: "https://banking-aka-storage.maribank.com.sg/maribank/sg/website-content/02_Homepage_Phone_Desktop_MCC_17122025.png",
    verifiedAt: "2026-10-07", variant: "Digital credit-card artwork from the issuer's app illustration.",
  },
  "uob-one": {
    templateId: "uob-one", name: "UOB One", src: "/cards/uob-one.webp", width: 270, height: 427,
    sourceUrl: "https://www.uob.com.sg/personal/cards/cashback/one-card.page",
    assetUrl: "https://www.uob.com.sg/assets/web-resources/personal/images/cards/index/categorypagefilter/uob-one-credit.jpg",
    verifiedAt: "2026-10-07", variant: "Current portrait Visa Signature design.",
  },
  "uob-ladys": {
    templateId: "uob-ladys", name: "UOB Lady's Card", src: "/cards/uob-ladys.webp", width: 644, height: 407,
    sourceUrl: "https://www.uob.com.sg/personal/cards/rewards/ladys-card/index.page",
    assetUrl: "https://www.uob.com.sg/assets/web-resources/personal/images/cards/rewards/ladys-card/index/recommended-product-detail-tiles/uob-ladys-card.jpg",
    verifiedAt: "2026-10-07", variant: "Standard Lady's World Mastercard.",
  },
  "dbs-wwmc": {
    templateId: "dbs-wwmc", name: "DBS Woman's World", src: "/cards/dbs-wwmc.webp", width: 800, height: 505,
    sourceUrl: "https://www.dbs.com.sg/personal/cards/credit-cards/dbs-woman-mastercard-card",
    assetUrl: "https://www.dbs.com.sg/iwov-resources/media/images/cards/women-card/woman-world-card.png",
    verifiedAt: "2026-10-07", variant: "Woman's World Mastercard.",
  },
  "uob-ppv": {
    templateId: "uob-ppv", name: "UOB Preferred Visa", src: "/cards/uob-ppv.webp", width: 260, height: 164,
    sourceUrl: "https://www.uob.com.sg/personal/cards/rewards/preferred-visa-card.page",
    assetUrl: "https://www.uob.com.sg/assets/web-resources/personal/images/cards/rewards/preferred-platinum-visa-card/masthead/masthead.jpg",
    verifiedAt: "2026-10-07", variant: "Current refreshed blue Visa Signature artwork.",
  },
  "uob-krisflyer": {
    templateId: "uob-krisflyer", name: "KrisFlyer UOB", src: "/cards/uob-krisflyer.webp", width: 800, height: 506,
    sourceUrl: "https://www.uob.com.sg/personal/cards/travel/krisflyer-card.page",
    assetUrl: "https://www.uob.com.sg/assets/web-resources/personal/images/cards/travel/krisflyer-credit-card/carousel-banner/kf-1080x760.jpg",
    verifiedAt: "2026-10-07", variant: "KrisFlyer UOB Credit Mastercard.",
  },
};

export function getCardArtwork(templateId: string): CardArtwork | undefined {
  return CARD_ARTWORK[templateId];
}

export function cardArtworkUrl(src: string): string {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  return `${basePath}${src}`;
}
