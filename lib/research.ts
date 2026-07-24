// Research Workspace domain constants. Kept in a plain module so they are
// reusable and unit-testable. Evidence classes are the directive's exact set,
// ordered most-established → least so the UI never nudges toward overclaiming.
export type EvidenceClass = "established" | "emerging" | "hypothesis" | "interpretation" | "personal_observation" | "testimony" | "historical" | "philosophical" | "theological" | "fictional" | "analogy" | "needs_verification" | "rejected";

export const EVIDENCE_CLASSES: Array<[EvidenceClass, string]> = [
  ["established", "Established Evidence"],
  ["emerging", "Emerging / Preliminary"],
  ["hypothesis", "Hypothesis"],
  ["interpretation", "Interpretation"],
  ["personal_observation", "Personal Observation"],
  ["testimony", "Testimony"],
  ["historical", "Historical Claim"],
  ["philosophical", "Philosophical Argument"],
  ["theological", "Theological Claim"],
  ["fictional", "Fictional / Creative Concept"],
  ["analogy", "Analogy / Metaphor"],
  ["needs_verification", "Needs Verification"],
  ["rejected", "Rejected / Superseded"],
];

export const CLAIM_TYPES: Array<[string, string]> = [["factual", "Factual"], ["interpretive", "Interpretive"], ["predictive", "Predictive"], ["normative", "Normative"], ["definitional", "Definitional"], ["creative", "Creative"]];
export const CONFIDENCE_LEVELS: Array<[string, string]> = [["unstated", "Unstated"], ["very_low", "Very low"], ["low", "Low"], ["moderate", "Moderate"], ["high", "High"]];
export const VERIFICATION_STATES: Array<[string, string]> = [["unverified", "Unverified"], ["in_review", "In review"], ["verified", "Verified"], ["rejected", "Rejected"]];
export const QUESTION_STATES: Array<[string, string]> = [["open", "Open"], ["investigating", "Investigating"], ["answered", "Answered"], ["parked", "Parked"]];

export const evidenceLabel = (value: EvidenceClass): string => EVIDENCE_CLASSES.find(([slug]) => slug === value)?.[1] || value;
