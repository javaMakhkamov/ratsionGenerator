export type FeedClass = "roughage" | "energy" | "protein";

export type Feed = {
  feed_name: string;
  energy_me: number; // MJ/kg (ME)
  energy_nel_kg: number; // MJ/kg (NeL)
  protein_kg: number; // kg/kg (CP)
  ts_kg: number; // kg/kg (TS/DM ulushi)
  class: FeedClass; // deterministik sinf
};

export type CategoryKey =
  | "sut_sigirlar"
  | "tinim_sigirlar"
  | "buqalar_yetuk"
  | "buzoqlar_1_6";

export type Ratios = { roughage: number; energy: number; protein: number; note?: string };
export type NormPoint = { w: number; nel: number; prot_g: number };

export type UserFeedAmount = {
  feedName: string;
  amount: number; // kg as-fed per day
};

export type DistributionItem = {
  name: string;
  cls: FeedClass;
  kg: number;
  dm: number;
  f: Feed;
  isUserDefined: boolean; // indicates if this amount was set by user
};

